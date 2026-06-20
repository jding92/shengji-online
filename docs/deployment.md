# Deployment

## Docker

```bash
docker compose up --build -d
```

The container runs the Next.js UI on port 3000 and game server/WebSocket on port 3001. Persist `/app/data`. Browsers connect to the same hostname on port 3001 by
default, so publish both ports or set `NEXT_PUBLIC_WS_URL` at build time to a
reverse-proxied `wss://.../ws` endpoint.

For a single public origin, route `/api/*` and `/ws` to port 3001 and everything
else to port 3000. Set `GAME_SERVER_ORIGIN` to the internal server origin during
the web build.

## Backups

SQLite uses WAL mode. Use SQLite's online backup command or stop the container
briefly before copying the database plus any `-wal` file. Restore the volume and
restart; active rooms load their latest snapshot and reconstruct timers.

## Environment

See `.env.example`. Keep the data volume and logs private: event rows contain the
authoritative hidden state even though player snapshots do not.
