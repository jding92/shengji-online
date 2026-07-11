import { shengJiRulesetSchema } from "../rulesets/schema.js";
import type { GameState } from "./model.js";

/**
 * v2: finding-friends round state (declarerSeat, friendCalls, pointsBySeat)
 * and the teams union. Every FF field is optional and the fixed teams shape
 * is unchanged, so v1 → v2 is a pure version stamp.
 */
export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Normalize a persisted snapshot on load: re-parse the embedded ruleset through
 * the schema so Phase 0+ defaults are filled, then backfill the new top-level
 * `GameState` fields old rooms never stored. Additive-with-defaults keeps this
 * cheap — nothing here rewrites round state, so loading always lifts a
 * snapshot to the current version.
 */
export function migrateGameStateSnapshot(raw: unknown): GameState {
  const state = raw as GameState;
  const rulesetSnapshot = shengJiRulesetSchema.parse(state.rulesetSnapshot);
  const migrated: GameState = {
    ...state,
    rulesetSnapshot,
    schemaVersion: CURRENT_SCHEMA_VERSION,
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
