# Deployment

## Docker

```bash
docker compose up --build -d
```

The container runs the Next.js UI on port 3000 and game server/WebSocket on port 3001. Persist `/app/data`. Browsers connect to the same hostname on port 3001
by default, so publish both ports or set `NEXT_PUBLIC_WS_URL` at build time to
a reverse-proxied `wss://.../ws` endpoint.

For a single public origin, route `/api/*` and `/ws` to port 3001 and everything
else to port 3000. Set `GAME_SERVER_ORIGIN` to the internal server origin during
the web build.

## Backups

SQLite uses WAL mode. Use SQLite's online backup command or stop the container
briefly before copying the database plus any `-wal` file. Restore the volume and
restart; non-game-over rooms load their latest snapshot. A saved bidding
deadline resumes from its persisted time, while dealing and actor turns receive
a fresh interval or timeout window.

## Environment

Server and web settings come from the process environment; the application
does not load the repository's `.env.example` itself. That file demonstrates a
fast 45 ms deal override, while the server's code default is 600 ms. The full
variable table and defaults are in the [README](../README.md#configuration).

Keep the data volume and logs private: snapshots and event rows contain the
authoritative hidden state even though player views do not.
