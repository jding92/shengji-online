# Sheng Ji Online · 升级

A private, server-authoritative online table for four-player, two-deck Sheng Ji.

The v1 preset includes fixed teams, bidding during and after the deal, joker
no-trump tiers, effective-rank tractors, intentional throws, eight-card bottom
scoring, 40-point rank thresholds, reconnectable sessions, and hidden-state-safe
player views.

## Run locally

Requirements: Node.js 24+ and pnpm 11.7+.

```bash
pnpm install
pnpm dev
```

- Web UI: <http://localhost:3000>
- Game server: <http://localhost:3001>
- SQLite data: `apps/server/data/shengji.sqlite` unless `DATABASE_PATH` is set

Create a room from the home page, open its invite URL in four browser profiles,
choose seats, and ready up. Each browser stores only a random resume token; the
server stores its SHA-256 hash.

## Verify

```bash
pnpm check
```

The gate runs formatting, typed lint, strict TypeScript, unit/integration tests,
and production builds. The rules engine tests cover all scoring boundaries,
required level/joker tractor transitions, bid tiers, follow obligations, throws,
bottom scoring, rank advancement, game end, and deterministic event replay.

Run a complete deterministic 25-trick round without a browser with:

```bash
pnpm --filter @shengji/server simulate
```

## Workspace

- `packages/engine` — deterministic rules, commands, events, and reducer
- `packages/protocol` — shared Zod command envelopes and private view types
- `apps/server` — queued rooms, timers, WebSockets, SQLite, reconnects
- `apps/web` — Next.js lobby and responsive animated card table
- `docs` — architecture, protocol, rules decisions, scoring, and variants

Start with [the architecture](docs/architecture.md) and
[rules assumptions](docs/rules-assumptions.md) before changing game behavior.
Container and reverse-proxy notes live in [deployment](docs/deployment.md).

## Current product boundary

The exposed preset is intentionally one excellent friend-room experience: four
players, two decks, and fixed teams. The engine is ruleset-driven and includes an
experimental six-player configuration fixture, but finding-friends teams,
spectators, accounts, matchmaking, and bots remain future work.

Licensed under the [MIT License](LICENSE).
