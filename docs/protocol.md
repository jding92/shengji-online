# Protocol

WebSocket clients connect to:

```text
/ws?roomId=ABC123&token=<resume-token>
```

The token is issued by `POST /api/rooms/:roomId/join`. Every command envelope
contains protocol version `1`, room ID, token, a unique request ID, the last
observed revision, and one Zod-validated command.

Stale revisions are rejected and immediately followed by a fresh private
snapshot. Duplicate request IDs return a snapshot rather than applying twice.
Rooms process envelopes sequentially.

Server message kinds:

- `SNAPSHOT` — complete private view after connect or state change
- `COMMAND_REJECTED` — stable code, useful message, and current revision
- `TIMER_TICK` — authoritative deadline and server time

REST endpoints:

- `POST /api/rooms`
- `GET /api/rooms/:roomId`
- `POST /api/rooms/:roomId/join`
- `GET /api/health`

The protocol intentionally does not ship raw engine events yet: deal and bottom
events contain hidden card IDs. Public/private event projection can be added
later without weakening the snapshot boundary.
