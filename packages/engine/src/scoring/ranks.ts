import type { Rank } from "../types.js";
import type { ShengJiRuleset } from "../rulesets/schema.js";

export function advanceRank(
  current: Rank,
  levels: number,
  rules: ShengJiRuleset["ranks"],
): Rank {
  if (!Number.isInteger(levels) || levels < 0) {
    throw new RangeError("levels must be a non-negative integer");
  }
  const currentIndex = rules.sequence.indexOf(current);
  if (currentIndex < 0) throw new RangeError(`Rank ${current} is outside the ruleset`);
  return rules.sequence[Math.min(currentIndex + levels, rules.sequence.length - 1)]!;
}

export function isSuccessfulDefenseAtGameRank(
  defendingRank: Rank,
  winner: "defenders" | "attackers",
  rules: ShengJiRuleset["ranks"],
): boolean {
  return (
    winner === "defenders" && defendingRank === rules.gameEndsOnSuccessfulDefenseAt
  );
}
