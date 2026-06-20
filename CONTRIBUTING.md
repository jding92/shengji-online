# Contributing

Use Node 24 and the pnpm version declared in `package.json`.

1. Read `docs/rules-assumptions.md` before changing rules.
2. Add a named regression fixture or focused test for every rules correction.
3. Keep final legality in `packages/engine`; client previews are advisory.
4. Do not add hidden fields to `PrivateGameView` without an anti-cheat test.
5. Run `pnpm check` before opening a pull request.

Changes should stay scoped and preserve deterministic event replay. New house
rules belong in the ruleset when they alter outcomes; avoid global constants in
engine logic.
