# Implementation Spec: AI Bot Players for Shengji Online

> Standalone instructions for implementing bot players. All architectural claims below were verified against the codebase (July 2026). Where line numbers have drifted, trust the described structure and search for the named symbols.

## Context

The game currently has no AI opponents. Practice mode (`apps/web/components/practice-room-client.tsx`) fakes a solo experience by opening four WebSocket sessions in one browser and letting the user manually switch POV between all four players. Goals:

1. **Bots addable to any match** — fill empty lobby seats, and take over mid-match for a disconnected/departed human (inheriting their hand). Human reclaims automatically on reconnect.
2. **Practice mode = 1 human + 3 bots**, with a table-wide difficulty picker at creation. The manual POV switcher is removed entirely.
3. **4 difficulty levels** (Beginner / Intermediate / Advanced / Expert) built from **one strong heuristic policy** with knobs: lower levels disable knowledge modules (card counting, void inference, team coordination) and add selection noise (softmax temperature + ε-blunder) for a smooth progression curve.

**Architecture** (validated against code): bots are **server-side actors owned by `Room`** — no WebSocket, no token, no `player_sessions` row. The server synthesizes `ClientCommand`s and runs them through the existing `validateCommand()` → `commit()` path inside the same `serialize()` mutex as envelopes and timers (apps/server/src/room.ts:66), so revision conflicts are impossible by construction. Bot policy lives in the **engine** package as pure functions (protocol depends on engine, not vice versa). Fairness is structural: policy input is a `BotObservation` derived only from public zones + the bot's own hand — `PrivateGameView` is insufficient because `completedTricksSummary` omits card identities, which card counting needs; the full public history lives in `GameState.round.completedTricks[].plays`.

**No persisted bot memory**: everything (counting, voids) recomputes from the observation each decision, so restart recovery is just "reschedule bot actions after rehydration" — the event log already preserves bot identity.

---

## Phase 1 — Engine: player model & events

**`packages/engine/src/state/model.ts`**
- `PlayerState` (line 24) gains `bot?: { difficulty: BotDifficulty }`.
- `PLAYER_JOINED` event (line 113) gains optional `bot?: { difficulty }` (old persisted events replay fine).
- New events:
  - `PLAYER_CONTROL_CHANGED { playerId, bot?, at }` — `bot` present = bot takeover, absent = returned to human.
  - `PLAYER_REMOVED { playerId, at }` — lobby-only bot removal (no removal event exists today).

**`packages/engine/src/state/reducer.ts`**
- `PLAYER_JOINED`: copy `bot`; bots keep `connected: true` always (no offline dot, normal timeout window).
- `PLAYER_CONTROL_CHANGED`: set/delete `player.bot`; takeover also sets `connected = true`.
- `PLAYER_REMOVED`: delete from `players`/`ranks`, clear seat.

**New `packages/engine/src/bot/types.ts`** — `BotDifficulty = "beginner" | "intermediate" | "advanced" | "expert"`, `BotConfig` knob record.

Tests: `packages/engine/test/bot-events.test.ts` — replay round-trips for the new events.

## Phase 2 — Engine: observation, knowledge, policy

New directory `packages/engine/src/bot/` (exported from `src/index.ts`):

| File | Contents |
|---|---|
| `observation.ts` | `BotObservation` + `deriveBotObservation(state, playerId)` — the ONLY bridge from `GameState`. Includes: phase, own seat/hand (+own buried if leader), trump/bids/passed seats, current trick plays, full `completedTricks[].plays` history (public), card counts per seat, points, ruleset slices. **Excludes** `round.cards`, other hands, `undealt`, `bottom`, `deckSeed`. |
| `knowledge.ts` | Config-gated modules: card counting (live copies per face/effective suit, "boss" detection), void inference per seat, partner/trick-winner helpers (via `determineTrickWinner` on partial plays). |
| `rng.ts` | Seeded PRNG (mulberry32), `softmaxPick(candidates, scores, τ, rng)`, ε-blunder gate. |
| `bidding.ts` | BID / PASS_BID / wait — evaluated after every dealt card AND in the post-deal window, all difficulties. Hand-strength eval per declarable suit (reuses `createAndValidateBid` logic from `bidding/bidding.ts`); config scales bid threshold (aggression), declare-timing (bid the moment a level card lands vs. wait for suit backing / hold for a pair), and counterbid/reinforce willingness. |
| `bury.ts` | Scores all cards for expendability (trumpness, points, boss status, void creation, tractor breakup) → bottom-size lowest. |
| `lead.ts` | Candidates from `groupsFor(hand, trump)`: boss singles, pairs, tractors, low leads; Advanced+ adds counting-proven-safe throws (never calls `resolveThrowAttempt` — that needs opponents' hands = cheating). |
| `follow.ts` | Candidate variants, each validated via `validateFollow` before scoring: minimal (reuse `selectForcedFollow`), strongest winning match, point-dump to winning partner, ruff/decline when void, trash discard. Port or export the private `structuralMatch` from `state/autoplay.ts:67`. |
| `score.ts` | Single shared scorer: `wTrick·P(win)·(trickPoints+leadValue) − wPoints·pointsToOpponents + wPartner·pointsToPartner − wSpend·cardEquity + wEndgame·lastTrickStake`. Knowledge gates change inputs (exact boss detection vs rank prior); knobs change weights; τ/ε change selection. |
| `policy.ts` | Entry point `decideBotAction(obs, config, rngSeed) → ClientCommand \| null`: lobby→SIT/READY, dealing + post-deal-bidding→bid module (all difficulties bid during the deal; config scales aggression/timing/counterbids), bottom-exchange→bury (if leader), playing→lead/follow (if own turn), round-scoring→START_NEXT_ROUND (if leader). |
| `difficulty.ts` | The 4 `BotConfig` presets (table below). |

**New `packages/engine/src/simulation/bot-match-simulator.ts`** — seeded full-game simulation of 4 bots at configurable difficulties (drives `validateCommand` + `getNextDealEvents` + `getFinalizeBiddingEvents`), modeled on existing `simulation/round-simulator.ts`.

## Phase 3 — Difficulty ladder spec

Noise mechanism everywhere: score candidates with the one strong scorer → ε chance of uniform random legal pick, else `softmax(score/τ)` sample.

| Knob | Beginner | Intermediate | Advanced | Expert |
|---|---|---|---|---|
| Temperature τ / ε-blunder | 1.6 / 0.15 | 0.9 / 0.06 | 0.45 / 0.015 | 0.12 / 0 |
| Candidate set | truncated (minimal follow, low lead, 1 random) | full | full | full |
| Card counting (boss detection) | off (rank prior) | off | on | on |
| Void/trump inference | off | off | on | on |
| Team coordination | off | knows if partner winning | + no overtrump of partner, feeds points | + leads at inferred voids/partner strength |
| Point management | off | hold vs opponents, dump to partner | on | + tracks live totals vs 40/80 thresholds |
| Trump conservation | off | won't ruff 0-point tricks with honors | full spend-cost model | full |
| Throws | never | never | counting-proven safe, ≤2 components | full counting-proven safe |
| Bottom-multiplier endgame | off | off | keeps a control card for last trick | full stake weighing both roles |
| Bid aggression | bids on any lone level card (~60% gate) | needs level card + ~4-card suit | proper hand eval threshold | full eval incl. joker/no-trump tiers |
| Bid timing (during deal) | impulsive: declares the moment a declarable card lands | waits a few more cards for suit backing | deliberate: bids mid-deal once strength is clear | strategic: waits to maximize info, weighs risk of being beaten to the declare; holds pairs to declare uncontestably |
| Counterbids / reinforce | never | rare, only with a pair | counterbids when clearly stronger | full counterbids + reinforces own bid (`samePlayerReinforceAllowed`) |
| Bury quality | lowest ranks (noise may bury points) | avoids points, keeps trump | + void creation, boss retention | + endgame stake awareness |

All levels bid during dealing — the ladder scales *how well and when*, not *whether*. Tune τ/ε until simulation shows each level beats the one below at 55–70% of rounds.

**Think delays are pacing, not difficulty**: one uniform jittered range for all levels (≈600–1500 ms per play/bid) so bot-heavy tables remain readable by humans; without it a 3-bot trick resolves in <50 ms. Delay knobs live in `RoomOptions`, not `BotConfig`.

## Phase 4 — Protocol

**`packages/protocol/src/views.ts`**: `SeatView` gains `isBot: boolean; botDifficulty?: BotDifficulty` (re-export `BotDifficulty` from engine). No envelope changes — bots send no envelopes.

## Phase 5 — Server

**`apps/server/src/private-views/derive-private-view.ts`**: populate `isBot`/`botDifficulty` on each `SeatView`.

**`apps/server/src/room.ts`** — bot scheduler:
- `RoomOptions` gains `botDelayMsOverride?: {min,max}` and `botNextRoundDelayMs?` (tests set 0).
- New `botTimers = Map<playerId, Timeout>`; cleared in `clearTimers()`.
- `scheduleBotActions()`: called from constructor and after every `commit` + `rescheduleTimers()` path — including each `CARD_DEALT` commit during dealing, which is what lets every difficulty bid mid-deal (the bid module returns null until its timing/aggression gate opens; re-evaluation is a cheap pure call). Skips bots already in `passedBidSeats` or holding `currentBid` to avoid loops. Delays: uniform jitter ≈600–1500 ms for plays/bids at all levels, bury 2–4 s, START_NEXT_ROUND ~10 s (humans must read the round summary; 60 s auto-start remains the backstop).
- Timer callback → `void this.serialize(() => runBotDecision(playerId))`: re-verify against **live** state (human may have reclaimed / state moved), `deriveBotObservation` → `decideBotAction(seed = roomId+playerId+revision)` → `validateCommand` → `commit` → `rescheduleTimers` → `scheduleBotActions`. On any throw: log + fall back to the minimal forced play for that bot so a policy bug never stalls the table.
- Bot-chain re-entrancy resolves naturally: each commit reschedules, each decision is a fresh serialized task.
- New public methods (same direct-commit pattern as `addPlayer`, room.ts:365):
  - `addBot(name, seat, difficulty, at)` — lobby only; commits `PLAYER_JOINED{bot}` + seat + ready events.
  - `removeBot(playerId, at)` — lobby only, bot only; commits `PLAYER_REMOVED`.
  - `takeoverByBot(playerId, difficulty, at)` — mid-match; guards: target is human AND `connected === false`.
- In `connect()` (room.ts:303): if the reconnecting player is bot-controlled, commit `PLAYER_CONTROL_CHANGED` (clear bot) + connection event, cancel their bot timer — reclaim is automatic and token-gated.

**`apps/server/src/room-manager.ts`**: `createRoom({practice, botDifficulty})` — if practice, `addBot()` ×3 for seats 1–3 with names from a small pool ("Ming", "Wei", "Lan"…). Bot playerIds are `randomUUID()`, **no** `player_sessions` row (so `authenticate()` can never resolve a bot). `roomSummary` seats gain `isBot`.

**`apps/server/src/index.ts`**:
- `createRoomBodySchema` (line 7) → `z.object({ practice: z.boolean().optional(), botDifficulty: z.enum([...]).optional() }).optional()`.
- New routes (membership-checked via `playerToken` + `rooms.authenticate`):
  - `POST /api/rooms/:roomId/bots {playerToken, seat, difficulty}` — lobby only; reject if table would be all-bot (≥1 human required).
  - `DELETE /api/rooms/:roomId/bots/:botId {playerToken}` — lobby only.
  - `POST /api/rooms/:roomId/players/:targetId/bot-takeover {playerToken, difficulty}` — reject if target connected, target is a bot, or no connected human would remain.

## Phase 6 — Web

**Practice rework:**
- **Delete `components/practice-room-client.tsx`** (4-hook POV controller + switcher).
- `app/room/[roomId]/page.tsx`: drop the `?practice=1` branch; always render `RoomClient`.
- `hooks/use-game-room.ts`: remove `sessionSlot` param and the slot branch of `sessionKey()` (lines 24–28); move `sessionKey` into new `apps/web/lib/session.ts` so the home page can pre-store the join token.
- `app/page.tsx`: "Practice table · solo" becomes difficulty picker (4 options, default Intermediate) + start. Flow: `POST /api/rooms {practice, botDifficulty}` → `POST /join {name}` → store token via `lib/session.ts` → `router.push('/room/:id')`. Lobby opens with 3 seated ready bots.
- `components/room-client.tsx`: auto-SIT effect — in lobby, if `you.seat === null` and all occupied seats are bots, SIT at lowest open seat once. READY stays manual (one tap starts round 1 since bots are pre-readied).

**Bot UI:**
- `components/lobby.tsx`: bot seats show badge + "Bot · Advanced" + "×" remove (lobby only); empty seats keep tap-to-sit and add a secondary "Add bot" affordance with difficulty select. New `apps/web/lib/bot-api.ts` wraps the bot endpoints.
- `components/table-seat.tsx`: bot chip next to name (like the existing leader badge); when `!connected && playerId !== null && !isBot`, show a "Replace with bot" button (difficulty popover) → takeover endpoint.
- `components/room-client.tsx`: connection notices announce takeovers/reclaims.
- `app/globals.css`: add bot badge/add-bot/popover styles; delete `.practice-bar`/`.practice-tab*`/`.practice-float` rules (lines ~649–673).

## Phase 7 — Tests

1. **Policy legality property tests** (`packages/engine/test/bot-policy.test.ts`, fast-check is already a devDep): advance seeded random games to random decision points; assert `decideBotAction` output always passes `validateCommand`, all 4 difficulties, including blunder paths. Observation-hygiene test: serialized observation contains no card id outside `hand ∪ playedHistory ∪ currentTrick ∪ myBuried ∪ bottomReveal`.
2. **Ladder validation** (`packages/engine/test/bot-ladder.test.ts` + simulator): ~200 seeded rounds per adjacent pairing; assert level N+1 beats N at >0.55 winrate, Expert vs Beginner >0.75. Slow suite behind `test:ladder` script; 10-round smoke in default CI.
3. **Server integration** (`apps/server/test/bots.test.ts`, modeled on the existing turn-timeout test, `botDelayMsOverride {0,0}`): practice room full round end-to-end; takeover on disconnect + reclaim on reconnect cancels bot timer; restart mid-bot-turn resumes; guards (all-bot rejection, lobby-only, connected-target rejection).
4. **E2E** (`apps/e2e/tests/practice-round.spec.ts`): home → difficulty → practice lobby auto-seated → ready → dealing starts, bot bid badge appears, bot plays land in trick center. Second spec: add/remove bot in a normal room lobby.

## Risks / edge cases (handled in design)

- **Bid-during-deal**: all difficulties evaluate bidding after each dealt card; the config's timing gate decides when they actually declare, so low levels bid impulsively and high levels time it. PASS_BID is only meaningful in the post-deal window; during dealing "no bid" is simply returning null. Skip bots in `passedBidSeats`/holding `currentBid` (note `BID_PLACED` resets passes — re-deciding after a counterbid is intended).
- **Failed bot throw**: engine already punishes with smallest-component force — graceful degradation.
- **All-bot rooms**: blocked at endpoints; a room whose last human disconnects idles under existing forced-play timeouts.
- **Restart mid-turn**: `rescheduleTimers()` self-heal runs first, then `scheduleBotActions()` in constructor.
- **Old persisted rooms**: all new event fields optional, new events additive.

## Verification

1. `pnpm check` (format, lint, typecheck, unit tests, build).
2. `pnpm --filter @shengji/engine test:ladder` — confirm difficulty ordering winrates.
3. `pnpm dev` → create practice table at each difficulty → play a full round vs 3 bots; confirm no POV switcher, bots bid/bury/play/start next round with human-like pacing.
4. Normal room: add bot from lobby, remove it, start with 2 humans + 2 bots; kill one human's tab mid-round → replace with bot → reconnect → control returns.
5. Restart the server mid-round with bots seated → bots resume play.
