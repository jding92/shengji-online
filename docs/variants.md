# Variant roadmap

The ruleset schema already separates player/deck counts, teams, bidding, bottom,
throws, scoring, and round flow. The UI intentionally exposes only
`shengji-4p-2d-fixed-v1`.

Planned progression:

1. House-rule controls for timers, throw penalties, thresholds, and bottom.
2. Five/six-player layouts with dynamic deck and bottom sizes.
3. Finding Friends with friend declaration, hidden team identity, reveal events,
   and spectator-safe private views.
4. Replays, spectators, accounts, matchmaking, and bots.

The experimental six-player preset is an architecture fixture, not a supported
room option. It should not become user-visible until its rules and UI have named
fixtures and full-round integration coverage.
