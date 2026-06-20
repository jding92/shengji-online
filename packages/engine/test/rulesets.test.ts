import { describe, expect, it } from "vitest";
import {
  fourPlayerTwoDeckFixedTeamRuleset,
  sixPlayerThreeDeckFutureRuleset,
  validateRuleset,
} from "../src/index.js";

describe("ruleset validation", () => {
  it("accepts the v1 and future architecture presets", () => {
    expect(validateRuleset(fourPlayerTwoDeckFixedTeamRuleset).success).toBe(true);
    expect(validateRuleset(sixPlayerThreeDeckFutureRuleset).success).toBe(true);
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
});
