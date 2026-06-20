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

Commands express intent; events are durable facts. `applyEvent` is deterministic,
and a shuffled deck is reproducible from the server-generated round seed. The
seed and full deck order never enter a private view. SQLite currently snapshots
after every command/timer batch, which favors simple recovery; event rows retain
the audit/replay history.

## Timers

The room owns deal pacing and bidding deadlines. The 30-second post-deal timer is
replaced by a 15-second timer after a valid raise. Restored rooms reconstruct
their active timer from the persisted deadline. If nobody bids, the server
redeals the same round with a new cryptographically random seed.

## Hidden state

Only `derivePrivateView` crosses the server/client boundary. It includes the
requesting player's hand, public played cards, seat card counts, and public round
metadata. It excludes other hands, buried card identities, deck order, and seed.
The server currently sends fresh private snapshots after every state change;
this deliberately favors a small anti-cheat surface over premature patch logic.

## Extension points

Rulesets own player/deck counts, teams, rank order, bidding, bottom, throws, and
thresholds. UI exposes only the v1 preset. Finding-friends will require a dynamic
team strategy and redacted identity events, not conditionals in fixed-team code.
