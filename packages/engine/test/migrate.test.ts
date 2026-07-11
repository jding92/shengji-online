import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION, migrateGameStateSnapshot } from "../src/index.js";
import prePhase0 from "./fixtures/pre-phase0-room.json" with { type: "json" };

describe("migrateGameStateSnapshot", () => {
  it("fills Phase 0 ruleset defaults for old snapshots", () => {
    const migrated = migrateGameStateSnapshot(prePhase0);
    expect(migrated.rulesetSnapshot.bidding.noBidFallback).toBe("bottom-card-declares");
    expect(migrated.rulesetSnapshot.bidding.declareRankSource).toBe("round-rank");
    expect(migrated.rulesetSnapshot.roundFlow.laterRoundLeader).toBe(
      "round-progression",
    );
    expect(migrated.rulesetSnapshot.roundFlow.rankAdvancement).toBe(
      "winning-team-members",
    );
    expect(migrated.rulesetSnapshot.ranks.mustDefendRanks).toEqual([]);
  });

  it("backfills the schema version and host to the first non-bot player", () => {
    const migrated = migrateGameStateSnapshot(prePhase0);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    // bot-0 is first in insertion order but bots are never host; human-1 wins.
    expect(migrated.hostPlayerId).toBe("human-1");
  });

  it("preserves an existing host and schema version", () => {
    const withHost = {
      ...(prePhase0 as object),
      hostPlayerId: "human-2",
      schemaVersion: 1,
    };
    const migrated = migrateGameStateSnapshot(withHost);
    expect(migrated.hostPlayerId).toBe("human-2");
  });
});
