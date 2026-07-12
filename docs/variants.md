# Variant roadmap

The ruleset schema separates player/deck counts, teams, bidding, bottom,
throws, scoring, and round flow behind a `presetId` + `GameOptions` layer
(`resolveRuleset`), with a host role and `UPDATE_OPTIONS` command controlling
both lobby setup and a narrow in-game-safe subset. The game-modes design
(`docs/game-modes-design.md`) is the design of record; this doc tracks what
shipped and what is still ahead.

Done:

1. House-rule controls for timers, throw penalties, thresholds, bottom size,
   starting/game-ending/must-defend ranks, joker-bid rules, and redeal cap —
   host-editable in the lobby via `UPDATE_OPTIONS`; timers stay editable
   in-game too (see below).
2. Five/six/seven/eight-player layouts with dynamic deck and bottom sizes,
   parametric bots (`teammateSeats`), and multi-deck rules-conformance
   coverage (triple/quad tuples, triple tractors, 3–4 deck thresholds).
3. Finding Friends (找朋友): friend declaration (`CALL_FRIENDS`), hidden team
   identity until reveal (`FRIEND_REVEALED`), per-seat point piles, per-player
   rank advancement, and spectator-safe private views/bot observations
   (byte-equality leak tests).

Eight production presets are registered (`GET /api/presets`):

| Preset id                | Table                                         |
| ------------------------ | --------------------------------------------- |
| `shengji-4p-2d-fixed-v1` | 4 players, 2 decks, fixed teams (default)     |
| `shengji-4p-3d-fixed-v1` | 4 players, 3 decks, fixed teams               |
| `shengji-6p-3d-fixed-v1` | 6 players, 3 decks, fixed teams               |
| `shengji-8p-4d-fixed-v1` | 8 players, 4 decks, fixed teams               |
| `shengji-ff-5p-2d-v1`    | 5 players, 2 decks, finding friends (1 call)  |
| `shengji-ff-6p-3d-v1`    | 6 players, 3 decks, finding friends (2 calls) |
| `shengji-ff-7p-3d-v1`    | 7 players, 3 decks, finding friends (2 calls) |
| `shengji-ff-8p-4d-v1`    | 8 players, 4 decks, finding friends (3 calls) |

Host-controlled option editing (`docs/game-modes-design.md` sections A4/D3/D4)
is also live: everything above is lobby-editable; timers alone stay editable
mid-game, since they are read fresh on every reschedule and can never
invalidate a live round. A host can also retune a seated bot's difficulty at
any time via `PATCH /api/rooms/:roomId/bots/:botId`.

Remaining roadmap:

- Replays, spectators, accounts, and matchmaking.
- Frontend UX for presets, options, and in-game editing — deliberately
  deferred; the protocol surface (`GET /api/presets`, `UPDATE_OPTIONS`,
  `OPTION_METADATA`) is ready for the web app once its overhaul lands.
