import { describe, expect, it } from "vitest";
import {
  fourPlayerTwoDeckFixedTeamRuleset,
  sixPlayerThreeDeckFixedTeamRuleset,
  validateRuleset,
  type ShengJiRuleset,
} from "../src/index.js";

/** The v1 preset as persisted before the Phase 0 schema widening. */
function preWideningRuleset(): unknown {
  const legacy = structuredClone(fourPlayerTwoDeckFixedTeamRuleset) as {
    ranks: { mustDefendRanks?: unknown };
    bidding: { noBidFallback?: unknown; declareRankSource?: unknown };
    roundFlow: { rankAdvancement?: unknown };
  };
  delete legacy.ranks.mustDefendRanks;
  delete legacy.bidding.noBidFallback;
  delete legacy.bidding.declareRankSource;
  delete legacy.roundFlow.rankAdvancement;
  return legacy;
}

describe("ruleset validation", () => {
  it("accepts the shipping 4p/2d and 6p/3d presets", () => {
    expect(validateRuleset(fourPlayerTwoDeckFixedTeamRuleset).success).toBe(true);
    expect(validateRuleset(sixPlayerThreeDeckFixedTeamRuleset).success).toBe(true);
  });

  it("rejects fixed teams that omit or duplicate seats", () => {
    const invalid = structuredClone(fourPlayerTwoDeckFixedTeamRuleset);
    invalid.teams.teams = [
      [0, 2],
      [1, 2],
    ];
    const result = validateRuleset(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(({ message }) => message.includes("every seat")),
      ).toBe(true);
    }
  });

  it("rejects an impossible bottom size", () => {
    const invalid = structuredClone(fourPlayerTwoDeckFixedTeamRuleset);
    invalid.bottom.size = 7;
    const result = validateRuleset(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects scoring gaps", () => {
    const invalid = structuredClone(fourPlayerTwoDeckFixedTeamRuleset);
    invalid.scoring.thresholds[1]!.min = 2;
    const result = validateRuleset(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(({ message }) => message.includes("contiguous")),
      ).toBe(true);
    }
  });

  it("fills defaults for rulesets persisted before the schema widening", () => {
    const result = validateRuleset(preWideningRuleset());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ranks.startingRank).toBeUndefined();
      expect(result.data.ranks.mustDefendRanks).toEqual([]);
      expect(result.data.bidding.noBidFallback).toBe("bottom-card-declares");
      expect(result.data.bidding.declareRankSource).toBe("round-rank");
      expect(result.data.roundFlow.laterRoundLeader).toBe("round-progression");
      expect(result.data.roundFlow.rankAdvancement).toBe("winning-team-members");
    }
  });

  it("accepts a starting rank that appears in the sequence", () => {
    const custom: ShengJiRuleset = structuredClone(fourPlayerTwoDeckFixedTeamRuleset);
    custom.ranks.startingRank = "5";
    const result = validateRuleset(custom);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ranks.startingRank).toBe("5");
  });

  it("rejects a starting rank outside the sequence", () => {
    const invalid: ShengJiRuleset = structuredClone(fourPlayerTwoDeckFixedTeamRuleset);
    invalid.ranks.sequence = invalid.ranks.sequence.filter((rank) => rank !== "5");
    invalid.ranks.startingRank = "5";
    const result = validateRuleset(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(({ message }) => message.includes("Starting rank")),
      ).toBe(true);
    }
  });

  it("accepts must-defend ranks that appear in the sequence", () => {
    const custom: ShengJiRuleset = structuredClone(fourPlayerTwoDeckFixedTeamRuleset);
    custom.ranks.mustDefendRanks = ["5", "10", "K"];
    const result = validateRuleset(custom);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ranks.mustDefendRanks).toEqual(["5", "10", "K"]);
    }
  });

  it("rejects must-defend ranks outside the sequence", () => {
    const invalid: ShengJiRuleset = structuredClone(fourPlayerTwoDeckFixedTeamRuleset);
    invalid.ranks.sequence = invalid.ranks.sequence.filter((rank) => rank !== "5");
    invalid.ranks.mustDefendRanks = ["5"];
    const result = validateRuleset(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(({ message }) =>
          message.includes("Must-defend ranks"),
        ),
      ).toBe(true);
    }
  });
});
