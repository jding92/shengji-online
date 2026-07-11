import { shengJiRulesetSchema } from "../rulesets/schema.js";
import type { GameState } from "./model.js";

/** Bumped to 2 when finding-friends round state fields land (Phase 3). */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Normalize a persisted snapshot on load: re-parse the embedded ruleset through
 * the schema so Phase 0+ defaults are filled, then backfill the new top-level
 * `GameState` fields old rooms never stored. Additive-with-defaults keeps this
 * cheap — nothing here rewrites round state.
 */
export function migrateGameStateSnapshot(raw: unknown): GameState {
  const state = raw as GameState;
  const rulesetSnapshot = shengJiRulesetSchema.parse(state.rulesetSnapshot);
  const migrated: GameState = {
    ...state,
    rulesetSnapshot,
    schemaVersion: state.schemaVersion ?? CURRENT_SCHEMA_VERSION,
  };
  if (migrated.hostPlayerId === undefined) {
    // First non-bot player in insertion order; all-bot (practice) rooms stay host-less.
    const firstHuman = Object.values(state.players).find(
      (player) => player.bot === undefined,
    );
    if (firstHuman !== undefined) migrated.hostPlayerId = firstHuman.id;
  }
  return migrated;
}
