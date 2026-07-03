# Sheng Ji Online · 升级

A server-authoritative, browser-based Sheng Ji table for friends. The supported
product is one four-player, two-deck preset with fixed partnerships; the engine
contains ruleset infrastructure for future variants, but those variants are not
available from the server or UI.

The current game includes:

- real-time private rooms with resumable browser sessions;
- bidding during the deal and a timed post-deal bidding window;
- suit and joker-declared no-trump contracts;
- singles, tuples, tractors, throws, forced follow rules, and trump ruffs;
- bottom exchange, last-trick bottom scoring, rank progression, and game end;
- visible bids, trump-aware hand sorting, and structure-aware follow hints;
- server timeouts that play, bury, or start the next round for an idle player;
- a solo practice table in which one browser controls four real player sessions;
- Default, Retro, and Minimal themes that persist in the browser.

There are no accounts, matchmaking, spectators, or bots. Practice mode is a
four-seat control surface, not an AI opponent.

## Run locally

Requirements:

- Node.js 24 or newer
- pnpm 11.7.0 (the version declared in `package.json`)

```bash
pnpm install
pnpm dev
```

- Web UI: <http://localhost:3000>
- REST and WebSocket server: <http://localhost:3001>
- Health check: <http://localhost:3001/api/health>
- Default development database: `apps/server/data/shengji.sqlite`

For a normal game, create a table and open its invite link in four browser
profiles. Each player joins, chooses a seat, and readies up. For local
exploration, choose **Practice table · solo**; switch between the four players
with the practice bar and play every seat yourself. Practice sessions are
browser-local, so reopen that table in the browser that created it.

## Using the table

The table shows the current level, trump, attacker points, timer, team colors,
leader, active turn, standing bid, and each opponent's remaining card count.
The leader can reopen their own buried cards during play, and the round summary
reveals the bottom, multiplier, and points awarded to everyone.

Cards sort by effective suit and trump strength; equal-strength level cards
remain grouped by printed face instead of interleaving deck copies. Click to
toggle cards or Shift-click to select a range. Gold hints mark bid candidates
or the relevant led-suit tuples when following; these are guidance, not a
legality guarantee. The primary button names recognizable plays and requires a
second click to confirm a throw. Escape clears a selection, while Enter submits
a normal bid, bury, or play but never confirms a throw. Feedback banners and
errors dismiss automatically and can also be clicked away.

## How it is built

| Path                | Responsibility                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| `packages/engine`   | Deterministic cards, bidding, tricks, throws, scoring, commands, events, reducer, and forced plays          |
| `packages/protocol` | Zod validation for client commands plus shared WebSocket envelopes and private-view types                   |
| `apps/server`       | Fastify REST API, queued WebSocket rooms, authoritative timers, private projections, and SQLite persistence |
| `apps/web`          | Next.js App Router UI, reconnecting WebSocket client, card-table interactions, and practice mode            |
| `apps/e2e`          | Playwright coverage of the four-browser happy path                                                          |

The runtime path is:

```text
browser command
  -> Zod protocol validation
  -> per-room serialized queue
  -> engine command validation
  -> deterministic engine events and reducer
  -> transactional SQLite events + latest snapshot
  -> a separately derived private snapshot for each player
```

The game phases are:

```text
lobby -> dealing -> post-deal-bidding -> bottom-exchange
      -> playing -> round-scoring -> next round or game-over
```

The browser uses engine helpers for sorting and interaction hints, but those
hints are advisory. Only the server invokes the authoritative command path.

## Implemented preset

`shengji-4p-2d-fixed-v1` deals 108 physical cards: 25 to each player and 8 to
the bottom. Seats `0` and `2` oppose seats `1` and `3`, and play advances by
increasing seat number.

Bids use identical level cards or at least two identical jokers. More cards
beat fewer cards; at equal counts the order is level card, small joker, big
joker. The initial post-deal window is 30 seconds, and a post-deal bid starts a
15-second response window. A no-bid deal is redealt twice before trump is
forced from the first bottom card.

Fives score 5 points; tens and kings score 10. Attackers need 80 points to take
over as defenders. If attackers win the last trick, bottom points are
multiplied by twice the card count of the largest component in the led format
(single 2x, pair 4x, triple 6x, two-pair tractor 8x, and so on).

The exact rules are encoded by the ruleset and executable engine tests. Treat
those as authoritative if prose documentation differs.

## Persistence and private state

SQLite stores the full room snapshot, every engine event, and player sessions.
Writes for an event batch and its resulting snapshot are committed in one
transaction. Active rooms are restored on server startup.

The database contains hidden cards and deck seeds and must remain private.
Clients receive only `PrivateGameView`: their own hand, public played cards,
counts, and public round metadata. After burying, the leader can still inspect
the cards they personally buried; other players see only the count. The buried
cards become public to everyone in the round summary after scoring. Other
hands, the undealt deck, and the deck seed always stay server-side.

A join returns a random resume token. The browser stores the token in
`localStorage` (with an in-memory fallback when storage is unavailable); SQLite
stores only its SHA-256 hash. There is no password or account recovery, so
clearing browser storage loses that session.

## Configuration

Server settings are read from the process environment. `.env.example` is a
reference; export variables or prefix the command rather than assuming the
server loads that file.

| Variable                | Default                      | Purpose                                                   |
| ----------------------- | ---------------------------- | --------------------------------------------------------- |
| `HOST`                  | `0.0.0.0`                    | Game-server bind address                                  |
| `PORT`                  | `3001`                       | Game-server port                                          |
| `DATABASE_PATH`         | `./data/shengji.sqlite`      | SQLite path, relative to `apps/server` under pnpm scripts |
| `DEAL_INTERVAL_MS`      | `600`                        | Delay between visual card-deal steps                      |
| `BID_POST_DEAL_SECONDS` | `30` from the preset         | Override for newly created rooms                          |
| `BID_RESPONSE_SECONDS`  | `15` from the preset         | Override for newly created rooms                          |
| `GAME_SERVER_ORIGIN`    | `http://localhost:3001`      | Next.js `/api/*` rewrite destination                      |
| `NEXT_PUBLIC_WS_URL`    | same hostname on port `3001` | Explicit browser WebSocket URL, including `/ws`           |

Environment-based bidding overrides are copied into a room's ruleset snapshot
when the room is created; they do not retroactively alter existing rooms.

## Verify changes

```bash
pnpm check
pnpm test:e2e
```

`pnpm check` runs formatting checks, typed ESLint, strict TypeScript, Vitest
unit/integration tests, and production builds. It does **not** include
Playwright. `pnpm test:e2e` starts isolated development servers and exercises a
room in four Chromium contexts. Install a local browser if needed:

```bash
pnpm --filter @shengji/e2e exec playwright install chromium
```

Run the deterministic, browser-free full-round smoke simulation with:

```bash
pnpm --filter @shengji/server simulate
```

## Deploy

```bash
docker compose up --build -d
```

The container serves Next.js on port 3000 and the game server on port 3001 and
persists SQLite under `/app/data`. For a single public origin, route `/api/*`
and `/ws` to port 3001 and everything else to port 3000; set
`NEXT_PUBLIC_WS_URL` to the public `wss://.../ws` endpoint at build time.

Additional design notes live in [`docs`](docs). Implementation and tests remain
the source of truth. See [AGENTS.md](AGENTS.md) for a detailed code map and safe
change workflow.

Licensed under the [MIT License](LICENSE).
