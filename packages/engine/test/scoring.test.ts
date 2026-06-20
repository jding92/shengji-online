import { describe, expect, it } from "vitest";
import {
  fourPlayerTwoDeckFixedTeamRuleset,
  getBottomMultiplier,
  scoreRound,
} from "../src/index.js";

const { scoring, bottom } = fourPlayerTwoDeckFixedTeamRuleset;

describe("round scoring", () => {
  it.each([
    [0, "defenders", 3],
    [1, "defenders", 2],
    [39, "defenders", 2],
    [40, "defenders", 1],
    [79, "defenders", 1],
    [80, "attackers", 0],
    [119, "attackers", 0],
    [120, "attackers", 1],
    [159, "attackers", 1],
    [160, "attackers", 2],
    [199, "attackers", 2],
    [200, "attackers", 3],
    [250, "attackers", 3],
  ] as const)("scores %i attacker points", (points, winner, levelDelta) => {
    expect(scoreRound(points, scoring)).toEqual({
      attackerPoints: points,
      winner,
      levelDelta,
    });
  });
});

describe("bottom multipliers", () => {
  it("uses 2x, 4x, and 8x for singles, pairs, and tractors", () => {
    expect(getBottomMultiplier({ kind: "single" }, bottom)).toBe(2);
    expect(getBottomMultiplier({ kind: "tuple", tupleSize: 2 }, bottom)).toBe(4);
    expect(getBottomMultiplier({ kind: "tractor" }, bottom)).toBe(8);
  });

  it("uses the longest throw component", () => {
    expect(
      getBottomMultiplier({ kind: "throw", longestComponent: "tractor" }, bottom),
    ).toBe(8);
  });
});
