# Architecture

The game has three trust boundaries.

```text
Next.js client -> versioned JSON/WebSocket protocol -> queued room server
                                                     -> pure rules engine
                                                     -> SQLite events + snapshots
```

The engine owns legal play. React owns selection and presentation only. A room
serializes every command, checks its expected revision, asks the engine for
events, commits those events and the resulting snapshot transactionally, then
derives a separate private view for every connected player.

## State and replay

Commands express intent; events are durable facts. `applyEvent` is
deterministic, every event increments the revision, and a shuffled deck is
reproducible from the server-generated round seed. Random seeds and timestamps
enter through server command context or events, never from reducer-side clocks
or random APIs.

A `presetId` + sparse `GameOptions` layer sits above the dense
`ShengJiRuleset`: `resolveRuleset` composes and validates the two into the
snapshot everything else reads, so `rulesetSnapshot` is unchanged as the
runtime source of truth. `UPDATE_OPTIONS`/`OPTIONS_UPDATED` embed the fully
resolved ruleset, so replaying the event log never re-resolves options.
Lobby edits reset seats and ready state (see Timers); mid-game edits are
restricted to keys `OPTION_METADATA` marks in-game-safe (timers today) and
leave seats and ready state untouched. In finding-friends games, a
`friend-calling` phase sits between bottom exchange and play, where the
declarer's `CALL_FRIENDS` produces `FRIENDS_CALLED`; the engine derives
`FRIEND_REVEALED` events itself as called copies are played.

SQLite inserts a command or timer's event batch and its resulting latest
snapshot in one `BEGIN IMMEDIATE` transaction guarded by the previous revision.
This favors simple recovery while retaining event rows for audit and replay.

## Timers

The room owns deal pacing, bidding deadlines, and actor timeouts. It clears and
reschedules timers after every committed state change so timer callbacks and
player commands pass through the same per-room queue.

- Dealing emits one card event per interval. The code default is 600 ms.
- The persisted 30-second post-deal deadline is replaced by a 15-second
  response deadline after each valid post-deal bid.
- An all-pass round is redealt at the same rank with a fresh server seed. After
  two redeals, trump is forced from the first bottom card instead; a joker
  forces no-trump.
- Bottom exchange, trick turns, and starting the next round use the ruleset's
  60-second connected or 10-second disconnected window. Expiry uses the same
  engine validation and event path as a human action.

Only bidding deadlines are part of round state. A restored bidding room
continues from that deadline; restored dealing and actor turns receive a fresh
interval or window. Timer setup also self-heals a recovered `playing` state
whose hands are already empty by deriving the missing round-end events.

## Hidden state

Only `derivePrivateView` projects full state across the server/client boundary.
It includes the requesting player's hand, public bids and played cards, seat
card counts, and public round metadata. The leader also receives the cards they
personally buried; other players receive only the buried count. Once scoring
emits `BOTTOM_REVEALED`, the buried cards, multiplier, and awarded points become
public in every view.

Other hands, undealt cards, the unrevealed bottom, and the deck seed stay out of
the projection. The server sends a newly derived complete snapshot to each
player after every state change. Although an `EVENTS` envelope is declared, it
is not emitted, so raw engine events never cross the hidden-state boundary.

## Web client

`useGameRoom` owns the browser's resume token, REST join, reconnecting
WebSocket, revisioned command envelopes, and server-time offset. Storage uses
`localStorage` with an in-memory fallback; leaving forgets the local token but
does not remove the player or free their seat.

Practice mode creates a normal room and runs four independent `useGameRoom`
sessions and sockets in one browser. The practice bar only selects which
private view and command surface is active; it does not add bots or bypass
server authority. Its four tokens are local to the browser that created the
table.

The web layer imports pure engine helpers for trump-aware hand sorting and
selection previews. Bid and follow highlights are advisory and can be coarser
than the full legality rules; rejection from the authoritative server remains a
normal UI outcome.

Shared layout and responsive rules live in `app/globals.css`. The Default,
Retro, and Minimal skins are scoped under `html[data-theme="..."]`; the choice
is stored locally and applied before first paint.

## Extension points

Rulesets own player/deck counts, teams, rank order, bidding, bottom, throws, and
thresholds, behind a preset registry (`packages/engine/src/rulesets/registry.ts`,
eight production presets) plus the options/host layer described above.
`state/teams.ts` gives fixed and finding-friends tables the same team-membership
surface (`knownTeamIdForSeat` for views and bots; `finalTeamIdForSeat`, engine-only,
for end-of-round scoring), so finding-friends is a dynamic team strategy and a
redacted identity event stream, not conditionals sprinkled through fixed-team
code. The web UI still exposes only preset selection at room creation; the
options/host/in-game-editing protocol surface (`GET /api/presets`,
`UPDATE_OPTIONS`, bot-difficulty PATCH) is ready for a frontend to build
against once the web app's overhaul lands.
