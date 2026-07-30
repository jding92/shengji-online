# Agent guide

This file is a map of the implementation as it exists now. Verify behavior in
source and executable tests before trusting comments or prose under `docs/`;
some older explanations can lag behind the code.

## Product boundary

The production catalog has eight presets for 4–8 players and 2–4 decks, covering
fixed teams and finding-friends tables. Room creation accepts `presetId` and
`options`; hosts alone edit the full ruleset in the lobby and timer options
in-game. Player count is capped at 8, and joined-player shrink is rejected.

Presets are the backend vocabulary, not a user-facing choice. The start screen
has no preset list: the player sets teams mode, players, decks, scoring band,
and timers directly, and `snapToBestPreset` in `apps/web/lib/rules.ts` re-bases
those choices onto the closest registry preset. Players and mode are honored
exactly; deck count follows the chosen preset unless explicitly pinned. The
point is that a stock table resolves to a stock preset with an _empty_ override
bag, so the `CUSTOM · 自定义` ribbon means "differs from stock" rather than
"was configured". Anything that writes `{presetId, options}` from UI intent
should go through that helper instead of assembling overrides by hand.

Practice mode is not a separate engine mode, and it is not a separate
destination in the UI either. It is the bots choice on the one start screen. It
creates a normal room and fills the remaining N−1 seats with server-side bots
for any preset, then the web client auto-sits and readies the human. The web
table renders 4–8 seats radially while preserving the tuned four-player layout,
and finding-friends calling, dashboard, and round UI are complete.

There is no player-removal command. “Leave” closes the socket and forgets the
local resume token; it does not free the joined player or seat. New joins are
allowed only in the lobby, up to the configured player count.

## Workspace and dependency direction

| Path                    | Owns                                                                       | Notes                                                                                         |
| ----------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `packages/engine/src`   | All authoritative game behavior                                            | Pure TypeScript; receives timestamps and random seeds from callers                            |
| `packages/protocol/src` | Wire command schema and shared envelope/view types                         | Depends on the engine's public types                                                          |
| `apps/server/src`       | Transport, serialization, timers, persistence, authentication, projections | Depends on built engine and protocol packages                                                 |
| `apps/web`              | Presentation and client transport                                          | Single mythic skin; uses protocol types and selected engine helpers only for previews/sorting |
| `apps/e2e`              | Browser-level flow                                                         | Starts server and web itself                                                                  |

Important engine entry points:

- `state/model.ts` defines phases, full authoritative state, client commands,
  and durable events.
- `state/commands.ts` validates intent and produces events. It also owns deal
  steps, bidding finalization, round completion, rank/team progression, and
  automatic next-round events.
- `state/reducer.ts` is the deterministic event reducer. Every applied event
  increments `revision`.
- `state/autoplay.ts` selects timeout actions, then sends them through the same
  command validator used for human actions.
- `tricks/formats.ts`, `tricks/legality.ts`, and `tricks/winner.ts` own trick
  structure, follow obligations, eligibility, and winners.
- `throws/throws.ts`, `bidding/bidding.ts`, `trump/trump.ts`, and
  `scoring/*` own their respective rule domains.
- `rulesets/schema.ts` validates structural ruleset invariants;
  `rulesets/four-player-two-deck.ts` contains the supported values.

Important server entry points:

- `index.ts` creates Fastify, REST routes, WebSocket upgrade handling, and
  shutdown hooks.
- `room-manager.ts` creates/restores rooms, issues and hashes resume tokens,
  and authenticates WebSocket upgrades.
- `room.ts` serializes all mutations for one room, owns timers, commits event
  batches, and broadcasts player-specific snapshots.
- `persistence/sqlite-store.ts` owns the SQLite schema and transaction boundary.
- `private-views/derive-private-view.ts` is the only full-state-to-client
  projection.

Important web entry points:

- `hooks/use-game-room.ts` owns session storage, REST join, WebSocket
  reconnect/backoff, revisioned command envelopes, and server-time offset.
- `components/room-client.tsx` switches among join, lobby, and game views.
- `components/room-client.tsx` also auto-sits/readies practice tables when the
  room was created with server-side bots.
- `components/game-table.tsx` sorts the private hand and computes visual hints;
  `hand-dock.tsx` emits commands.
- `app/page.tsx` creates/joins rooms. `next.config.ts` proxies only `/api/*`;
  WebSockets connect separately.

## Runtime flow and trust boundaries

1. `POST /api/rooms` creates a six-character room code, clones the supported
   ruleset, applies bidding-window environment overrides, and persists revision 0.
2. `POST /api/rooms/:roomId/join` either creates a lobby player and a 32-byte
   resume token or resumes a session by token. Only the SHA-256 token hash is
   stored.
3. `/ws?roomId=...&token=...` authenticates during HTTP upgrade. A connection
   immediately receives its own `SNAPSHOT`.
4. The client sends a Zod-validated protocol-v1 envelope with a unique
   `requestId`, its last `expectedRevision`, and one command.
5. `Room.serialize` puts commands and timer callbacks on the same promise
   queue. Outside `dealing`, a stale revision is rejected and followed by a
   fresh snapshot. During `dealing`, stale revisions are accepted so rapid deal
   events cannot make bidding impossible; the live state still fully
   revalidates the bid.
6. `validateCommand` returns engine events. `replayEvents` computes the next
   state, and `SqliteStore.appendEvents` inserts every event plus the latest
   snapshot in one `BEGIN IMMEDIATE` transaction guarded by the previous
   revision.
7. The room broadcasts a newly derived `PrivateGameView` to every socket,
   deriving it separately for each player.

The `EVENTS` server envelope is declared but is not currently emitted. State
changes broadcast complete private `SNAPSHOT`s. Never send raw `GameState` or
raw engine events to a browser: deals, hands, bottom cards, and seeds can contain
hidden information.

Request-id deduplication is per player and in memory. It prevents duplicate
application within a running `Room`, but the cache is not restored after a
server restart.

## State lifecycle and timers

```text
lobby
  -> dealing
  -> post-deal-bidding
  -> bottom-exchange
  -> playing
  -> round-scoring
  -> dealing (next round) or game-over
```

- All seats must be occupied and ready before the last `READY` starts round 1.
- Dealing emits one `CARD_DEALT` per interval. Bids are legal during this
  phase. When 8 cards remain, `DEAL_FINISHED` moves them to the bottom and
  starts the post-deal deadline.
- The preset gives the first post-deal window 30 seconds. Each valid post-deal
  bid replaces it with a 15-second response window. `PASS_BID` records the seat
  but does not end bidding early.
- With no bid, the same round number is redealt with a new server UUID. After
  two redeals, trump is forced from the first bottom card; a joker forces
  no-trump. The first forced leader is seat 0.
- The round leader picks up the bottom, buries exactly 8 distinct owned cards,
  and leads the first trick.
- Connected actors have 60 seconds and disconnected actors 10 seconds for
  bottom exchange, trick play, and starting the next round. Timeout values live
  in the room's ruleset snapshot. Forced buries/plays use the normal validator.
- Bidding deadlines are persisted in round state. Deal and turn deadlines are
  not persisted; a restored room schedules a fresh interval/window.
- After every state change `Room.rescheduleTimers` clears old timers. It also
  self-heals a recovered `playing` state with empty hands by deriving the
  missing round-end events.
- A player is marked disconnected only when all of that player's sockets close.

## Rules that are easy to break

### Cards, trump, and structures

- Two decks produce 108 unique physical card instances. Identity is the `id`;
  tuple identity is printed face (`cardFaceKey`), not just effective rank.
- Each player receives 25 cards and 8 remain in the bottom.
- Jokers and all level-rank cards are trump. With a suit contract, ordinary
  cards in that suit are also trump.
- In a suit contract, strength is big joker, small joker, primary level card,
  secondary level cards, then ordinary trump. Secondary level cards from
  different suits have equal strength but do not form a tuple together.
- Removing the level rank closes the ordinary rank sequence for tractor
  adjacency. Trump rank groups then continue through secondary level, primary
  level, small joker, and big joker.
- A normal lead must be a single, one identical-face tuple, or a consecutive
  same-size tractor, all in one effective suit. A throw must contain multiple
  canonical components in one effective suit.

### Bidding and following

- A bid is one or more identical level cards, or at least two identical small
  or big jokers. Bids compare card count first, then tier
  `level-card < small-joker < big-joker`.
- Equal-count/equal-tier counterbids are disallowed. The current bidder may
  reinforce only the same face with a larger total count.
- Followers must contribute as many cards in the led effective suit as they
  hold, up to the trick's card count, and must match tuple/tractor/throw
  structure as fully as their hand allows.
- A legal follow can still be ineligible to win when its final shape does not
  match. A trump ruff is eligible only when the player is void in the led
  effective suit and reproduces the led shape.
- Client highlights and `legalActions` are coarse UX guidance. They do not
  prove a selected bid or play is legal.

### Throws, scoring, and progression

- The server can inspect opponents' authoritative hands to decide whether any
  throw component is beatable. A failed throw forces the smallest failing
  component. The supported preset's throw point adjustments are both zero,
  though the ruleset supports nonzero values.
- Fives are 5 points; tens and kings are 10 points. Each deck contains 100
  points.
- Final attacker points are trick points plus any bottom award plus throw
  adjustment. Negative totals are valid and fall into the first scoring band;
  do not clamp them.
- Attackers receive bottom points only when their team wins the final trick.
  The multiplier is `2 * cardCount` of the largest component in the final led
  format: single 2x, pair 4x, triple 6x, two-pair tractor 8x, and so on.
- Supported thresholds are `<1` defenders +3, `1–39` defenders +2, `40–79`
  defenders +1, `80–119` attackers +0, `120–159` attackers +1, `160–199`
  attackers +2, and `200+` attackers +3.
- The winning team advances. It becomes the next defending team, and leadership
  moves forward to the next seat belonging to that team. A defending team that
  successfully holds while its rank is A ends the game.
- On round 1, the winning bidder's team becomes defenders. In later rounds the
  progressed leader remains leader regardless of which seat wins the bid.

## Persistence and private-view invariants

- SQLite uses Node's synchronous `node:sqlite` API with WAL and foreign keys.
  The `rooms` row stores a latest snapshot and revision; `room_events` stores one
  row per event revision; `player_sessions` stores token hashes.
- Every event increments state revision, so a multi-event command advances by
  more than one revision.
- Only non-`game-over` rooms are loaded into `RoomManager` at startup.
- A ruleset is cloned and stored in every room. Changing the preset affects new
  rooms, not saved rooms.
- Deterministic shuffle requires a non-empty seed. Generate randomness and
  timestamps in the server/context, then put them in events; do not call
  `Date.now()` or random APIs inside reducer logic.
- `PrivateGameView` may expose the requesting player's hand, played cards,
  public bid/trump/score data, seat counts, and the bottom after
  `BOTTOM_REVEALED`. It must not expose other hands, undealt/bottom/buried card
  identities before reveal, or `deckSeed`.
- Any private-view field addition needs serialization-level anti-cheat tests,
  not just TypeScript review.

## How to make changes

For a rule change:

1. Add or update a focused engine test that states the boundary behavior.
2. Change the ruleset schema/preset if the behavior is configurable.
3. Keep legality and scoring in the engine, then update private projection and
   UI only if the player needs new public information.
4. Check deterministic replay and forced-play behavior for the changed rule.

For a new command or event, update all applicable layers:

1. `ClientCommand` / `GameEvent` in `state/model.ts`;
2. validation and event production in `state/commands.ts`;
3. deterministic application in `state/reducer.ts`;
4. the Zod wire command in `packages/protocol/src/commands.ts`;
5. private-view/legal-action projection;
6. web command emission and rendering;
7. engine/server tests, including stale revision or secrecy coverage when
   relevant.

For protocol changes, preserve compatibility or bump `PROTOCOL_VERSION`.
Outbound envelopes and views are TypeScript types, not runtime Zod schemas.

For timer changes, keep mutations inside the room queue, reschedule after every
commit, and ensure timeout actions still use engine validation. For persistence
changes, remember that `CREATE TABLE IF NOT EXISTS` is not a migration strategy
for altering existing tables; implement an explicit forward migration.

For UI changes, retain server authority. The web app may import pure engine
format/sort helpers to preview a selection, but it must handle server rejection
as normal. The table has two layout paths chosen by player count: the tuned
legacy four-seat classes (`relativeSeatPosition` in `lib/cards.ts` plus
`.seat-north/south/east/west` CSS), which must stay pixel-stable, and the radial
system (`lib/table-layout.ts` `seatSlots()`) for 5–8 seats, which reserves a
bottom arc so opponent plates clear the local south cluster. The radial
`[data-players]` overrides in `globals.css` are higher-specificity ((0,2,0)+)
than plain responsive rules; responsive rules that must affect radial tables
either repeat the attribute selector or set only custom properties consumed at
base specificity.

The same specificity trap bites the start screen, in two directions, and both
failures are silent — the page still renders, just with the wrong values:

- A single-class landing rule cannot override a single-class rule defined later
  in the file. `.rules-ribbon` lives in the lobby block, well below the landing
  block, so `.start-summary` alone loses to it on source order. Scope to
  `.start-game-panel .start-summary` rather than reordering the file.
- Conversely, a two-class rule such as `.options-primary .options-table-grid`
  outranks a media query that only says `.options-primary-grid`, so the
  responsive collapse never applies. Repeat the prefix inside the query.

When touching the start screen, verify in a browser, not just in unit tests.
The acceptance criterion is that the whole panel plus the start button fits one
1280×800 viewport with the Advanced fold collapsed, in _every_ state: friends
and bots, fixed and finding-friends. Unit tests assert markup, so none of them
can see a 460px overflow. Two structural facts keep the budget: bot difficulty
renders inline beside the opponents segments so choosing bots adds no row, and
the table block is a three-column grid with teams spanning two, which holds it
to two rows in both team modes because finding-friends' `FRIEND CALLS` fills the
cell that is empty under fixed teams. Adding a primary option, or restoring the
full-width teams row, will break the fit.

`OPTION_FIELDS` carries a `tier` that splits always-visible controls from the
`ADVANCED · 高级` fold, and its array order is locked by a `rules.test.ts`
assertion. Display order for the primary block lives in `PRIMARY_TABLE_ORDER` in
`options-editor.tsx`; teams leads because teams mode decides which player counts
are legal. On a mode switch, `adjustedPlayerCountForMode` must run _before_
`snapToBestPreset` — 5 players with fixed teams matches no preset, so snapping
first hits the empty-candidate path and silently returns the value unchanged.

## Commands and test strategy

Use Node 24 and pnpm 11.7.0.

```bash
pnpm install
pnpm dev
pnpm check
pnpm test:e2e
pnpm --filter @shengji/server simulate
pnpm art:build
```

`pnpm check` runs, in order, formatting verification, typed lint, strict
typechecking, Vitest tests, and production builds. Playwright is separate.
`pnpm art:build` regenerates committed `apps/web/public/art` WebPs from the
`/assets` masters; run it after adding source art.

`playwright.config.ts` sets `reuseExistingServer` only when `PW_REUSE_SERVER=1`,
so a plain `pnpm test:e2e` while `pnpm dev` holds 3000/3001 will stall or fail
on its own web servers. Run the suite on its own ports instead of killing a dev
server someone else may be using:

```bash
PLAYWRIGHT_WEB_PORT=3100 PLAYWRIGHT_SERVER_PORT=3101 pnpm test:e2e
```

Setting `PLAYWRIGHT_WEB_PORT` also redirects the build to
`.next-playwright-<port>`, so it will not clobber `.next`. It does rewrite the
import in generated `apps/web/next-env.d.ts` to that directory, though, so check
`git status` afterwards: committing it points everyone else's typecheck at a
dist directory that only exists during a run on that port.

Read Playwright's own summary line for the result. Piping the command through
`tail` or `head` makes `$?` report the pager's status, so a run that says
`1 failed` can still leave a zero exit code behind.

Prefer group-scoped locators over bare accessible names on the start screen.
`getByRole` matches names case-insensitively **by substring**, so a plain
`{ name: "Advanced" }` matches both the bot-difficulty `Advanced` button and the
`ADVANCED · 高级` fold toggle. Also give a control exactly one accessible name:
a `fieldset` whose `legend` and inner `div` both carry the same label produces
two matching groups and trips strict mode.

Useful focused commands:

```bash
pnpm --filter @shengji/engine exec vitest run test/bidding.test.ts
pnpm build:packages
pnpm --filter @shengji/server exec vitest run test/reconnect.test.ts
pnpm --filter @shengji/e2e exec playwright test
pnpm format
```

Engine tests import source directly. Server and web resolve workspace packages
through their built `dist` exports, so run `pnpm build:packages` before focused
server/web checks after changing engine or protocol code. Never edit generated
`dist` or `.next` output.

Test coverage is split deliberately:

- engine Vitest tests cover rules, boundaries, property checks, event replay,
  full-round simulation, and forced play;
- server Vitest tests cover SQLite, hidden-state projection, reconnects,
  idempotency, deal-time revision handling, and timeouts;
- Playwright covers room creation, four isolated browser sessions, reconnect,
  bidding, bottom exchange, and one full trick.

## TypeScript and repository conventions

- TypeScript is strict with `exactOptionalPropertyTypes` and
  `noUncheckedIndexedAccess`. Omit absent optional properties with conditional
  spreads rather than assigning `undefined`.
- Engine, protocol, and server use NodeNext ESM and `.js` suffixes in relative
  source imports. Follow the local Next.js import style inside `apps/web`.
- Use type-only imports where possible; ESLint enforces them.
- Keep user-facing validation failures as stable error codes plus useful
  messages. The room maps known `CommandValidationError`s into rejected
  envelopes.
- Add named regression tests for rule fixes. Do not replace exact boundary
  fixtures with broad happy-path assertions.
- Preserve unrelated working-tree changes and do not commit SQLite databases,
  build output, Playwright artifacts, or environment files. `next dev` and
  `next build` rewrite the import path in generated `apps/web/next-env.d.ts`;
  that churn is not a real change, so restore the file rather than staging it.

Process environment defaults come from code, not `.env.example`. In particular,
the server's code default for `DEAL_INTERVAL_MS` is 600 ms; the example file
shows a faster 45 ms override. `pnpm check` does not run E2E tests.
