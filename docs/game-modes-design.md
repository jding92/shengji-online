# Game modes expansion — technical design

Status: implemented (Phases 0–4); this doc is the design of record.
Scope: engine, protocol, and server. Frontend UX is deliberately out of scope
(the web app is mid-overhaul); each phase notes the protocol surface it exposes
so the frontend can be built against it later.

## Goals

1. **Finding friends (找朋友)** with odd player counts: 5p/2d, 6p/3d, 7p/3d,
   8p/4d presets, all production quality.
2. **Large fixed-team tables**: promote 6p/3d from architecture fixture to
   production; add 4p/3d and 8p/4d.
3. **General house-rule customization**: bottom size, scoring bands, throw
   penalties, joker-bid rules, starting rank, game-ending rank, must-defend
   ranks, timers.
4. **Host-controlled options**: everything editable in the lobby; a classified
   safe subset (timers, pacing, bot difficulty) editable in-game. Structural
   rules (players, decks, mode, scoring, penalties) lock at game start.

## Decided constraints

- Room creator is host; host migrates to the earliest-joined human when the
  host leaves; bots are never host. Option editing is host-only.
- Lobby option changes reset every player's ready state (re-ready is the
  consent mechanism; game start remains "all seats ready").
- In-game changes are limited to keys whose metadata marks them in-game safe.

---

## A. Ruleset/options architecture

`ShengJiRuleset` stays the single runtime source of truth — everything already
reads `state.rulesetSnapshot`. We add the layer above it:

```text
presetId + GameOptions (sparse, user-facing)
        │  resolveRuleset() — overrides, derivation, validation
        ▼
ShengJiRuleset (dense, validated, snapshotted into GameState — unchanged)
```

New files in `packages/engine/src/rulesets/`:

### A1. `registry.ts`

```ts
export type RulesetPresetEntry = {
  id: string;
  ruleset: ShengJiRuleset;
  visibility: "production" | "experimental";
  description: string;
};
export const RULESET_PRESETS: readonly RulesetPresetEntry[];
export function getPreset(id: string): RulesetPresetEntry | undefined;
export function listPresets(includeExperimental?: boolean): RulesetPresetEntry[];
export const DEFAULT_PRESET_ID = "shengji-4p-2d-fixed-v1";
```

### A2. `options.ts` — the sparse user-editable layer

```ts
export type GameOptions = {
  playerCount?: number;
  deckCount?: number;
  teamsMode?: "fixed" | "finding-friends";
  friendCallCount?: number; // FF only
  bottomSize?: number; // must be in validBottomSizes()
  startingRank?: Rank;
  gameEndsOnSuccessfulDefenseAt?: Rank;
  mustDefendRanks?: Rank[]; // e.g. ["5", "10", "K"]
  scoring?: { bandSize?: number }; // thresholds regenerated
  throwPenalty?: { defenderFailedThrow: number; attackerFailedThrow: number };
  allowNoTrumpJokerBid?: boolean;
  minimumJokerBidCount?: number;
  maxRedeals?: number;
  timers?: {
    playTimeoutSeconds?: number;
    disconnectedTimeoutSeconds?: number;
    postDealWindowSeconds?: number;
    responseWindowSeconds?: number;
  };
};

export type ResolveResult =
  | { ok: true; ruleset: ShengJiRuleset }
  | { ok: false; issues: { path: string; message: string }[] };

export function resolveRuleset(presetId: string, options: GameOptions): ResolveResult;
```

`resolveRuleset` is the only composer: deep-clone the preset, apply overrides,
re-derive dependent fields the user did not pin (teams layout for the new
player count, bottom size, scoring thresholds), stamp a derived id
(`"<presetId>+custom"` when any override is present so replay tooling can
tell), and run the result through `shengJiRulesetSchema`. Zod issues map 1:1
to user-facing rejection messages — there is no second validation system.

### A3. `derive.ts` — pure derivation helpers

Each helper is a unit-test target, reused by `resolveRuleset` and preset
definitions:

```ts
export const CARDS_PER_DECK = 52; // replaces the literal in schema.ts and bot/bidding.ts
export function totalCards(decks: { count: number; includeJokers: boolean }): number;
/** All s with dealt = total − s > 0 and dealt % players === 0, s in a sane range. */
export function validBottomSizes(players: number, decks: Decks): number[];
/** Smallest valid size >= 6. 4p/2d → 8, 6p/3d → 6, 5p/2d → 8, 7p/3d → 8, 8p/4d → 8, 4p/3d → 6. */
export function defaultBottomSize(players: number, decks: Decks): number;
/** band = 20 × decks; attackers-win-at = 2 × band. Reproduces both existing presets. */
export function defaultThresholds(deckCount: number): ScoringThreshold[];
/** Alternating seats; even player counts only. */
export function defaultFixedTeams(players: number): number[][];
/** floor(n/2) − 1: 5p→1, 6p→2, 7p→2, 8p→3. */
export function defaultFriendCallCount(players: number): number;
```

`defaultThresholds(d)` generates
`[(-∞,1) def+3, [1,band) def+2, [band,2band) def+1, [2band,3band) att+0,
[3band,4band) att+1, [4band,5band) att+2, [5band,∞) att+3]` — verified to
reproduce the 4p/2d (band 40) and 6p/3d (band 60) presets exactly.

### A4. `options-metadata.ts` — editability classification

```ts
export type OptionEditability = {
  key: keyof GameOptions | `timers.${string}`;
  editableIn: ("lobby" | "in-game")[];
  authority: "host"; // enum on purpose; "consensus" reserved
  requiresReReady: boolean; // true for everything except in-game-safe keys
};
export const OPTION_METADATA: readonly OptionEditability[];
export function optionsEditableInPhase(phase: GamePhase): (keyof GameOptions)[];
```

v1 classification: everything is lobby-editable, host-only,
re-ready-required. The in-game subset is `timers.*`, deal pacing, and bot
difficulty (see D4) — safe because timers and pacing are read on every
reschedule. Structural options are never in-game editable: deck/player/
bottom/scoring changes invalidate the live round.

### A5. Widening locked literals — now vs deferred

Widen now (each becomes a named strategy enum consumed by a `switch` in
exactly one function; defaults reproduce current behavior bit-for-bit):

| Field                             | Today                              | New                                                                                                                             |
| --------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `teams`                           | `{mode enum, teams: number[][]}`   | discriminated union: `{mode:"fixed"; teams}` \| `{mode:"finding-friends"; friends: FriendsConfig}`                              |
| `roundFlow.laterRoundLeader`      | literal `"round-progression"`      | `enum ["round-progression", "rebid-each-round"]`                                                                                |
| `bidding.noBidFallback` (new)     | hardcoded forced-trump-from-bottom | `enum ["bottom-card-declares"]` with default — names the existing behavior per the standing TODO in `docs/rules-assumptions.md` |
| `bidding.declareRankSource` (new) | implicit round rank                | `enum ["round-rank", "bidder-own-rank"]` default `"round-rank"`                                                                 |
| `roundFlow.rankAdvancement` (new) | hardcoded team loop                | `enum ["winning-team-members"]` with default                                                                                    |

Keep as literals (deferred — no planned mode needs them; widening would be
speculative): `players.seatOrder`, `trump.jokersAlwaysTrump`/
`levelCardsAlwaysTrump`, `bottom.lastTrickMultiplier.strategy`,
`throws.failedThrowResolution`, `scoring.model`, `roundFlow.firstRoundLeader`.

Additional schema fields: optional `ranks.startingRank` (default
`sequence[0]`) and `ranks.mustDefendRanks` (default `[]`) — a player may not
advance past a must-defend rank unless they were on the defending side that
round; implemented as a clamp inside `advanceRank` given round context.

`players.count` stays `min(4).max(12)`. New superRefine rules: fixed mode
requires an even count; FF requires `count >= 5` and
`friends.callCount <= floor(count/2) − 1`.

### A6. Snapshot versioning & migration

`rulesetSnapshot` is embedded in `latest_snapshot_json` (read on every boot)
and duplicated in `rooms.ruleset_snapshot_json`. Two rules keep migration
cheap:

1. **Additive-with-defaults.** Every new ruleset field carries a Zod
   `.default(...)` reproducing current behavior; every new `GameState` field
   is optional. Old persisted snapshots parse unchanged. The `teams` union
   keeps the exact current object shape for `mode: "fixed"`.
2. **Normalize on load.** New `packages/engine/src/state/migrate.ts` exports
   `migrateGameStateSnapshot(raw: unknown): GameState` — parses
   `rulesetSnapshot` through the schema (fills defaults) and backfills new
   state fields (`hostPlayerId` from the first non-bot player in insertion
   order, FF fields absent). Called from `SqliteStore.loadRoom` /
   `loadActiveRooms`. Add `schemaVersion: number` to `GameState`
   (backfilled to 1; bumped to 2 when FF state fields land).

`SqliteStore.appendEvents` starts updating `ruleset_snapshot_json` alongside
`latest_snapshot_json` (options can now change after creation). Replay safety:
`OPTIONS_UPDATED` embeds the fully resolved ruleset, so replaying an event log
never re-resolves options.

---

## B. Finding friends (找朋友)

Follows the widely documented FF rules: per-player levels, declarer calls
"Nth copy of a face", identity revealed only by playing the called copy,
per-seat point piles resolved retroactively. Genuinely contested house rules
are explicit options with recommended defaults (see Flagged defaults).

### B1. Schema

```ts
// inside the teams union, mode: "finding-friends"
export type FriendsConfig = {
  /** How many friend calls the declarer makes. Default defaultFriendCallCount(players). */
  callCount: number;
  /** Which faces may be called. v1 single strategy: no jokers, no level-rank cards, no trump-suit faces. */
  callableCards: "any-non-trump";
  /** Declarer may call a face they hold every copy of (unenforceable without leaking hands). */
  allowOwnCardCall: true; // literal for now
};
```

FF forces (validated in superRefine): `roundFlow.laterRoundLeader ===
"rebid-each-round"` and `bidding.declareRankSource === "bidder-own-rank"`.

Presets in `rulesets/finding-friends-presets.ts`: `ff-5p-2d`, `ff-6p-3d`,
`ff-7p-3d`, `ff-8p-4d` — all built from the derive helpers, all production.

### B2. Team identity model

FF teams are round-scoped roles, not persistent teams. New
`packages/engine/src/state/teams.ts` (absorbs `teamIdForSeat` from
`reducer.ts`):

```ts
export type SeatRole = "declarer" | "friend" | "attacker" | "unknown";

/** Fixed: derived from ruleset. FF: derived from declarer + reveal events. */
export function seatRole(state: GameState, seat: SeatIndex): SeatRole;
/** "defenders" | "attackers" | undefined — undefined only in FF pre-reveal.
    The ONLY membership helper views and bots may use. */
export function knownTeamIdForSeat(
  state: GameState,
  seat: SeatIndex,
): TeamId | undefined;
/** End-of-round accounting: unknown ⇒ attacker. Scoring only.
    NOT exported from the package index so server code physically cannot leak it. */
export function finalTeamIdForSeat(state: GameState, seat: SeatIndex): TeamId;
```

Critical redaction invariant: the engine state holds all hands, so friendship
must derive exclusively from `round.friendCalls[].revealed` — never from hand
contents. The declarer and call specs are public. A player holding a called
copy privately knows they will be a friend; that inference comes free from
their own hand plus the public calls, requiring no private channel.

Every current `teamIdForSeat` call site (reducer, commands, private views,
bot observation) is audited and switched to the appropriate helper; the
exported helpers branch on `ruleset.teams.mode` so callers do not.

### B3. State, commands, events

`RoundState` additions (all optional; absent in fixed mode):

```ts
declarerSeat?: SeatIndex;                    // = winning bidder at trump finalize
friendCalls?: FriendCall[];
pointsBySeat?: Record<SeatIndex, number>;    // per-seat captured trick points (FF source of truth)

export type FriendCall = {
  face: StandardCardFace;                    // no jokers
  copyIndex: number;                         // 1-based; 1 = "first ♠K played"; <= decks.count
  revealed?: { seat: SeatIndex; trickNumber: number; at: string };
};
```

`GameState` additions: `hostPlayerId?` (section D), `presetId?`,
`pendingOptions?` (raw `GameOptions` for lobby re-editing), `schemaVersion`.
`RoundHistoryEntry` gains `defenderSeats?: SeatIndex[]` for FF rounds.

New phase `"friend-calling"` between `bottom-exchange` and `playing`, entered
only in FF mode. Sequence: `TRUMP_FINALIZED → BOTTOM_PICKED_UP →
BOTTOM_BURIED → (FF) friend-calling → FRIENDS_CALLED → playing`. Calling
after burying is deliberate: the declarer knows their final hand, and called
copies may sit in the buried bottom (the declarer's own informed choice).

New command:

```ts
{
  type: "CALL_FRIENDS";
  calls: {
    face: StandardCardFace;
    copyIndex: number;
  }
  [];
}
```

Validation: phase `friend-calling`; actor is declarer; `calls.length ===
friends.callCount`; each face callable per `callableCards` (no jokers, no
level-rank faces, no trump-suit faces); `copyIndex ∈ [1, decks.count]`; no
duplicate `(face, copyIndex)` pairs.

New events:

```ts
| { type: "FRIENDS_CALLED"; seat: SeatIndex; calls: FriendCall[]; at: string }
| { type: "FRIEND_REVEALED"; seat: SeatIndex; callIndex: number; trickNumber: number; at: string }
```

`FRIEND_REVEALED` is engine-derived (never client-sent): after each
`CARDS_PLAYED`, count cumulative played copies of each called face in event
order and emit reveals for newly crossed thresholds. A multi-card play can
cross multiple thresholds and reveal two calls at once.

Reducer accounting (FF branch only; fixed mode path untouched):

- `TRICK_WON` credits `pointsBySeat[winnerSeat]`. `round.attackerPoints`
  becomes a reducer-derived provisional display value: the sum over seats
  whose `knownTeamIdForSeat` is not `"defenders"` — unknown seats count as
  attackers until revealed; a reveal retroactively moves that seat's pile.
  Recomputed on `TRICK_WON` and `FRIEND_REVEALED` so existing consumers keep
  reading one number.
- `finishRoundEvents`: final attacker total = Σ `pointsBySeat[s]` where
  `finalTeamIdForSeat(s) === "attackers"`, plus bottom award and throw
  adjustment. "Attackers won the last trick" uses final membership. Bottom
  multiplier formula unchanged.
- Rank advancement: same winning-side loop, membership from
  `finalTeamIdForSeat`; each winning-side player advances individually (the
  per-player `ranks: Record<PlayerId, Rank>` already supports this), with the
  `mustDefendRanks` clamp applied per player.
- Game end: `GAME_ENDED` when the **declarer** defends successfully at
  `gameEndsOnSuccessfulDefenseAt` — the defending-seat lookup becomes a
  roundFlow-aware helper; fixed mode keeps current behavior.

### B4. Round flow: `rebid-each-round`

No leader progression in FF. Every round is open bidding; `TRUMP_FINALIZED`
sets declarer = winning bidder = leader; the round's trump rank is the
bidder's own rank.

- `ROUND_STARTED.trumpRank` becomes provisional (previous declarer's rank, or
  `startingRank` on round 1 — it only seeds the redeal-cap fallback). Bid
  validation passes `currentRank: state.ranks[bidderPlayerId]` instead of
  `round.trumpRank`. Bid comparison across different ranks is unchanged
  (count, then tier).
- `TRUMP_FINALIZED` gains an explicit `trumpRank: Rank`; the reducer sets
  `round.trumpRank` from it so tuple grouping, effective-rank ordering, bots,
  and views stay consistent.
- No-bid redeal-cap fallback: declarer rotates to the next seat
  (`(previousDeclarerSeat + 1) % count`), level = that player's rank. Named
  under `noBidFallback`.
- `START_NEXT_ROUND` / auto-start: the previous declarer starts the next
  round (mirrors current leader semantics); the actual declarer comes from
  bidding.

### B5. Redaction

- `derive-private-view.ts`: `SeatView.teamId` present only when
  `knownTeamIdForSeat` is defined; new `SeatView.role?: SeatRole`; new
  `publicRound.declarerSeat?` and `publicRound.friendCalls?` (face,
  copyIndex, revealed seat/trick); `roundsWonBySeat` replaces
  `roundsWonByTeam` in FF mode (kept for fixed mode).
- `bot/observation.ts`: `teamId` becomes optional plus `role: SeatRole`;
  public `friendCalls` added to the round observation; observation derivation
  routes through `knownTeamIdForSeat` only — never `finalTeamIdForSeat`,
  never hands.
- Leak tests: serialize views and bot observations for two states differing
  only in the hidden placement of a called copy — they must be
  byte-identical pre-reveal. Extend `apps/server/test/private-view.test.ts`
  and `packages/engine/test/bot-knowledge.test.ts`.

### B6. Bots (v1 policy, deliberately minimal)

- `partnerSeat` (bot/knowledge.ts) generalizes to
  `teammateSeats(observation): SeatIndex[]` (empty when unknown), with a
  deprecated `partnerSeat` shim for one release.
- Unknown seats are treated as opponents, except: a bot holding an unplayed
  called copy treats the declarer's side as its own for point-dumping
  decisions — one `isSecretFriend(observation)` helper reading own hand ×
  public calls.
- Declarer bot call policy: first copy of the highest non-trump face it
  lacks (classic "ace you don't hold" heuristic); fallback to the highest
  absent face.
- Friend-calling timeout auto-calls via the same heuristic
  (`getForcedFriendCallEvents`, mirroring `getForcedPlayEvents`).

### B7. Edge-case rulings

| Case                                              | v1 ruling                                                                                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Declarer plays the called copy                    | Legal; reveal fires on the declarer's seat; membership no-op (declarer effectively plays with fewer friends).                                                             |
| Called copy buried in the bottom                  | Legal. That call can never reveal; the would-be friend stays unknown all round ⇒ scores as attacker. `BOTTOM_REVEALED` makes it publicly auditable at round end.          |
| Called face hoarded, never played                 | Seat stays unknown ⇒ attacker at scoring. Playing the copy is the only way in.                                                                                            |
| Copy counting with multi-card plays               | Cumulative count in event order; one play may reveal multiple calls (multiple `FRIEND_REVEALED`, same trick).                                                             |
| Redeal                                            | Fresh `ROUND_STARTED` clears everything; calls happen post-bury so a redeal can never have calls.                                                                         |
| Throw resolution                                  | Unchanged — beatability already checks every non-thrower hand, which is exactly right under hidden identity. Penalty role uses `knownTeamIdForSeat(seat) ?? "attackers"`. |
| Last-trick/bottom multiplier                      | Formula unchanged; the winning side resolves with final membership.                                                                                                       |
| Varying defender counts                           | No scoring adjustment in v1 (declarer-alone bonus multipliers deliberately excluded — see Flagged defaults).                                                              |
| Disconnect / bot takeover of an unrevealed friend | Nothing special: takeover preserves the seat; the bot inherits the hand and the `isSecretFriend` inference.                                                               |

---

## C. Multi-deck / large-table generalization

### C1. Verified already generic

`tricks/formats.ts`, `tricks/legality.ts`, `tricks/winner.ts`,
`throws/throws.ts` are parameterized over tuple size: triples/quads form
tuples, triple tractors (e.g. 555666 at 3 decks) parse, follow-profile
matching and component comparison are size-generic. Dealing, seats, and hands
are all `players.count`-driven. **But nothing exercises tupleSize ≥ 3
end-to-end** — rules-conformance must grow a multi-deck section before these
presets ship.

### C2. Changes needed

1. `bot/knowledge.ts` `partnerSeat` → `teammateSeats` (see B6); update
   `bot/lead.ts` and `bot/follow.ts` heuristics from "is my partner winning"
   to "is any teammate winning" / point-dump to a winning teammate.
2. The literal `52` in `rulesets/schema.ts` and `bot/bidding.ts` →
   `CARDS_PER_DECK` (exported from a location that avoids import cycles).
3. Simulators (`simulation/round-simulator.ts`, `bot-match-simulator.ts`)
   currently hardcode the 4p preset and 4-seat loops — generalize to accept
   `{ ruleset?, difficulties? }`, defaulting to the 4p preset.
4. New production presets: `shengji-4p-3d-fixed-v1` (bottom 6, band 60),
   `shengji-6p-3d-fixed-v1` (fixture promoted, regenerated via derive
   helpers), `shengji-8p-4d-fixed-v1` (teams alternating over 8 seats,
   bottom 8, band 80) — defined with `satisfies ShengJiRuleset` and built
   from the derive helpers so drift is impossible.

### C3. Performance

`applyEvent` structured-clones the whole `GameState` per event and
`appendEvents` serializes a full snapshot per commit. At 8p/4d: 216 cards ⇒
~208 `CARD_DEALT` events, ~27 tricks × 8 plays; state stays in the
low-hundreds-of-KB. Expected fine — but measure, don't guess: add a benchmark
test asserting a full 8p/4d bot match completes under a budget, and log
per-event apply time in the bot-match simulator. Documented escape hatches
(not built now): batch `CARD_DEALT` into one `CARDS_DEALT` per tick; move
immutable-per-round card data out of the cloned hot path.

---

## D. Server / protocol

### D1. Host

- `GameState.hostPlayerId?: PlayerId`; new event
  `{ type: "HOST_CHANGED"; playerId: PlayerId; at: string }`.
- First human `PLAYER_JOINED` emits `HOST_CHANGED` alongside. If the host
  leaves, the room appends `HOST_CHANGED` to the earliest-joined remaining
  human. Bots never host. Snapshot migration backfills live rooms.
- Surfaced in `PrivateGameView` as `hostPlayerId: string | null`.

### D2. Room creation

```ts
const createRoomBodySchema = z
  .object({
    practice: z.boolean().optional(),
    botDifficulty: botDifficultySchema.optional(),
    presetId: z.string().optional(), // default DEFAULT_PRESET_ID
    options: gameOptionsSchema.optional(), // runtime Zod mirror in @shengji/protocol
  })
  .optional();
```

`RoomManager.createRoom` replaces the pinned
`structuredClone(fourPlayerTwoDeckFixedTeamRuleset)` with
`resolveRuleset(presetId ?? DEFAULT_PRESET_ID, options ?? {})`; 400 with the
issue list on failure. Env bid-timer overrides continue to apply after
resolution (ops-level knobs). `presetId` + raw options are stored in
`GameState` so the lobby can re-edit from the user's last input.

New endpoint `GET /api/presets` → production presets projected to
`{ id, name, players, decks, teamsMode, description }[]` plus
`OPTION_METADATA`. `roomSummary` gains `presetId` and `teamsMode`.

### D3. Lobby option editing

Command (full replace, not patch — idempotent):

```ts
{ type: "UPDATE_OPTIONS"; presetId?: string; options: GameOptions }
```

Event (embeds the resolved ruleset so replay never re-resolves):

```ts
| { type: "OPTIONS_UPDATED"; presetId: string; options: GameOptions;
    ruleset: ShengJiRuleset; at: string }
```

Validation: lobby phase (in-game subset below); actor is `hostPlayerId`;
`resolveRuleset` succeeds; shrinking `players.count` below an occupied seat
index is rejected with the conflicting seats listed (no silent unseat).
Reducer: swap `rulesetSnapshot`/`rulesetId`, resize `state.seats`, set every
player `ready = false`. The room's existing post-commit `rescheduleTimers()`
picks up new timer values automatically.

### D4. In-game editing

Same `UPDATE_OPTIONS` command accepted in non-lobby phases only when the diff
against current options touches exclusively in-game-editable keys per
`OPTION_METADATA` (timers, pacing). Everything else rejects with
`INVALID_PHASE`. Timer changes take effect on the next reschedule — no
retroactive deadline math.

Bot difficulty mid-game is a small separate path (difficulty is currently
fixed per-bot at creation): a host-only update (REST or command) that swaps
the stored difficulty on a bot player; the next scheduled bot decision reads
the new config.

### D5. Protocol versioning

`PROTOCOL_VERSION` stays 1: new command variants are invisible to old
clients, and view changes are additive/optional. Add serialized-fixture
compat tests in `packages/protocol` so accidental breaking changes fail CI.
The one field changing meaning — `SeatView.teamId` absent pre-reveal in FF —
is already optional.

### D6. Private-view surface (for the future frontend)

```ts
PrivateGameView {
  hostPlayerId: string | null;                               // Phase 1
  ruleset: { id; name; players; decks; bottomSize;
             presetId: string; teamsMode: "fixed" | "finding-friends";
             options: GameOptions };                          // Phase 1
  seats[]: { ...; role?: "declarer"|"friend"|"attacker"|"unknown" };  // Phase 3
  publicRound?: { ...; declarerSeat?: number;
                  friendCalls?: PublicFriendCall[];
                  roundsWonBySeat?: Record<number, number> }; // Phase 3
  legalActions: [..., "update-options", "call-friends"];      // Phases 1, 3
}
```

`OPTION_METADATA` is exported statically from `@shengji/protocol`, not sent
in views.

---

## E. Implementation phases

Each phase is independently committable and keeps `pnpm -r test` green.
Sizes: S < M < L < XL. Order: 0 → 1 → 2 → 3a → 3b → 3c → 4 (1 and 2 are
parallelizable in principle; sequential keeps review simple).

- **Phase 0 (S–M), engine only:** `derive.ts`, `registry.ts`, schema widening
  with defaults, `CARDS_PER_DECK`, `mustDefendRanks` clamp, strategy switches
  in `state/commands.ts` (`nextRoundEvents`, forced-trump fallback, rank
  advance). Tests: derive helpers reproduce both existing presets; existing
  suite proves zero behavior change. Exposed surface: none.
- **Phase 1 (M):** `options.ts`, `options-metadata.ts`, `state/migrate.ts`,
  protocol `gameOptionsSchema`; `hostPlayerId` + `HOST_CHANGED`;
  `UPDATE_OPTIONS`/`OPTIONS_UPDATED`; createRoom API + `GET /api/presets`;
  sqlite migrate-on-load + snapshot-column sync; private-view host/options.
  Tests: host-only/phase gating/re-ready/seat-shrink; restart-with-options;
  pre-change JSON snapshot fixture. Exposed: create-room options, presets
  endpoint, `UPDATE_OPTIONS`, `hostPlayerId` + `ruleset.options` in views.
- **Phase 2 (M):** multi-deck fixed presets to production; `teammateSeats`;
  parametric simulators; multi-deck conformance fixtures (triple/quad tuples,
  triple tractors, 3-deck throw profiles, thresholds at 3–4 decks, 6× triple
  bottom multiplier); property tests at 2–4 decks; perf benchmark; 6-bot
  server round test. Exposed: new presetIds.
- **Phase 3a (L):** FF engine core — teams union + `FriendsConfig`;
  `state/teams.ts` + call-site audit; friend-calling phase;
  `CALL_FRIENDS`/`FRIENDS_CALLED`/`FRIEND_REVEALED`; `pointsBySeat`
  accounting; rebid-each-round + bidder-own-rank; FF scoring/rank/game-end;
  `schemaVersion` 2; FF presets (experimental until 3c). Tests: fixture suite
  covering every B7 ruling; accounting-invariant property test
  (Σ pointsBySeat + bottom = 100 × decks); replay determinism.
- **Phase 3b (M):** FF views + bots — private-view redaction, bot observation
  roles, `isSecretFriend`, declarer call heuristic, byte-equality leak tests,
  FF bot-match simulations to game end.
- **Phase 3c (S–M):** protocol `CALL_FRIENDS` schema + view fields;
  friend-calling timeout with auto-call; FF presets flip to production;
  server integration test (5 bots + fake-socket human). Exposed:
  `CALL_FRIENDS`, `friendCalls`/`role`/`declarerSeat`, FF presets.
- **Phase 4 (S):** in-game options path incl. bot-difficulty change; timer
  reschedule test; docs sweep (`architecture.md`, `variants.md`,
  `rules-assumptions.md`, `protocol.md`, `scoring.md`).

E2E (Playwright) specs for new modes are deferred alongside the frontend.

## Risks

1. **Retroactive point movement on friend reveal** — the likeliest source of
   subtle bugs. Mitigation: `pointsBySeat` is the sole source of truth;
   `attackerPoints` is derived; accounting-invariant property test.
2. **Hidden-information leaks** through views or bot observations.
   Mitigation: byte-equality leak tests; `finalTeamIdForSeat` un-exported
   from the package index.
3. **Snapshot compat across deploys.** Mitigation: additive-with-defaults
   policy, migrate-on-load, checked-in pre-change JSON fixtures per
   schemaVersion.
4. **`bidder-own-rank` bidding interactions** (reinforce/counterbid when
   players hold different level ranks) have no reference implementation in
   the repo — needs deliberate fixtures, not ports of existing bidding tests.
5. **State-clone/snapshot growth at 8p/4d** — bounded; benchmark in Phase 2
   before FF piles on.

## Flagged defaults (product-review checklist)

Chosen defaults, all cheap to change later; contested ones are explicit
ruleset options:

- Friend count defaults to `floor(n/2) − 1`, lobby-editable within
  `1..floor(n/2) − 1`.
- Callable cards exclude jokers, level-rank cards, and trump-suit faces
  (`callableCards` enum is ready for looser strategies).
- An unrevealed friend (call buried or never played) scores as an attacker.
- The previous declarer starts/auto-starts the next FF round.
- Bot add/remove/takeover REST endpoints stay any-member (not host-only).
- `mustDefendRanks` ships empty (off) by default, even though many houses
  play 5/10/K.
- No declarer-alone bonus multipliers in v1.
