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

Outbound envelopes and views are TypeScript types, not runtime Zod schemas.
Changing their shape therefore requires serialization-level secrecy and
compatibility tests.

## REST endpoints

- `POST /api/rooms`
- `GET /api/rooms/:roomId`
- `POST /api/rooms/:roomId/join`
- `GET /api/health`

The protocol intentionally does not ship raw engine events: deal and bottom
events contain hidden card IDs. Public/private event projection would need to
preserve the same boundary.
