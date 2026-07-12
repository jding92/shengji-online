# Protocol

## Connection and authentication

WebSocket clients connect to:

```text
/ws?roomId=ABC123&token=<resume-token>
```

The token is issued by `POST /api/rooms/:roomId/join`. A new token creates a
player only while the room is in the lobby and below its player limit. Passing
an existing token in the REST request resumes that player. SQLite stores only
the token's SHA-256 hash, and the WebSocket upgrade authenticates the query
token before accepting the connection.

There is no player-removal command. Closing the socket changes connection state
only after that player's last socket closes; it does not free the player or
seat.

## Commands and revisions

Every command envelope contains protocol version `1`, room ID, player token, a
unique request ID, the last observed revision, and one Zod-validated command.
Rooms serialize commands and timer callbacks on the same promise queue.

Command types: `SIT`, `READY`, `BID`, `PASS_BID`, `BURY_BOTTOM`, `CALL_FRIENDS`
(finding-friends only — the declarer's friend calls in the `friend-calling`
phase), `PLAY_CARDS`, `START_NEXT_ROUND`, and `UPDATE_OPTIONS` (host-only;
`{ presetId?, options }`, full replace not patch). `UPDATE_OPTIONS` is valid in
the lobby for any option and, once a game has started, for the in-game-safe
subset `OPTION_METADATA` marks (timers today) — everything else is rejected
with `INVALID_PHASE` naming the offending key(s).

Outside `dealing`, a stale revision produces `COMMAND_REJECTED` with code
`STALE_REVISION`, followed by a fresh private snapshot. During `dealing`, stale
revisions are accepted because each dealt card advances the revision while
players need to bid; the command is still fully validated against live state.

Request-ID deduplication is per player and in memory. Reusing an ID in a running
room returns a snapshot without applying the command twice. The cache is not
restored after a server restart.

## Server messages

- `SNAPSHOT` — complete private view after connect or state change
- `COMMAND_REJECTED` — stable code, useful message, and current revision
- `TIMER_TICK` — active deadline and server time, sent once per second

The `EVENTS` envelope remains declared in the shared type and the web client can
consume it, but the server does not currently emit it. State changes broadcast
complete snapshots derived separately for each player.

`PrivateGameView` can contain the requesting player's hand, public bids and
plays, counts, bidding deadline, scores, and legal-action hints. The leader
alone can see their own buried cards before scoring. After `BOTTOM_REVEALED`,
every player sees the buried cards, multiplier, and points awarded. Other
hands, undealt cards, and the deck seed must never appear.

The view also carries `hostPlayerId` (null before the first human joins) and
`ruleset.options`/`presetId`/`teamsMode`, so a client can render the current
house rules and who may change them. In finding-friends games, seats carry an
optional `role` (`"declarer" | "friend" | "attacker" | "unknown"`) and
`publicRound.friendCalls`/`declarerSeat` are present once calling has
happened. The redaction rule: a seat's `teamId`/`role` reflect only
`knownTeamIdForSeat` — an unrevealed friend is indistinguishable from an
attacker in every view and every bot's observation until its `FRIEND_REVEALED`
fires. `legalActions` includes `"update-options"` and `"call-friends"` when
applicable.

Outbound envelopes and views are TypeScript types, not runtime Zod schemas.
Changing their shape therefore requires serialization-level secrecy and
compatibility tests.

## REST endpoints

- `GET /api/health`
- `GET /api/presets` — production presets (`{ id, name, players, decks,
teamsMode, description }[]`) plus the static `OPTION_METADATA` table
  (editability per option key), so a client can build a create-room and
  in-game-options UI without engine internals.
- `POST /api/rooms` — `{ practice?, botDifficulty?, presetId?, options? }`;
  400 with the `resolveRuleset` issue list on invalid options.
- `GET /api/rooms/:roomId`
- `POST /api/rooms/:roomId/join`
- `POST /api/rooms/:roomId/bots` — any room member adds a bot (lobby only).
- `DELETE /api/rooms/:roomId/bots/:botId` — any room member removes a bot
  (lobby only).
- `PATCH /api/rooms/:roomId/bots/:botId` — any room member retunes a seated
  bot's difficulty, in any phase; the next scheduled decision for that bot
  reads the new difficulty.
- `POST /api/rooms/:roomId/players/:targetId/bot-takeover` — any room member
  replaces a disconnected human with a bot, mid-game.

The protocol intentionally does not ship raw engine events: deal and bottom
events contain hidden card IDs. Public/private event projection would need to
preserve the same boundary.
