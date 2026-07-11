import type { Rank } from "../types.js";
import type { ShengJiRuleset } from "../rulesets/schema.js";

export type AdvanceRankContext = {
  /** True when the player was on the defending side that round. */
  wasDefender?: boolean;
};

export function advanceRank(
  current: Rank,
  levels: number,
  // mustDefendRanks stays optional here so pre-widening snapshots that were
  // never re-parsed through the schema keep working.
  rules: Pick<ShengJiRuleset["ranks"], "sequence"> &
    Partial<Pick<ShengJiRuleset["ranks"], "mustDefendRanks">>,
  context: AdvanceRankContext = {},
): Rank {
  if (!Number.isInteger(levels) || levels < 0) {
    throw new RangeError("levels must be a non-negative integer");
  }
  const currentIndex = rules.sequence.indexOf(current);
  if (currentIndex < 0) throw new RangeError(`Rank ${current} is outside the ruleset`);
  const targetIndex = Math.min(currentIndex + levels, rules.sequence.length - 1);

  // A non-defender may not advance PAST a must-defend rank; clamp to the lowest
  // must-defend rank crossed. Landing exactly on one is always allowed.
  let clampedIndex = targetIndex;
  if (context.wasDefender !== true) {
    for (const mustDefendRank of rules.mustDefendRanks ?? []) {
      const mustDefendIndex = rules.sequence.indexOf(mustDefendRank);
      if (mustDefendIndex < 0) continue;
      if (currentIndex <= mustDefendIndex && targetIndex > mustDefendIndex) {
        clampedIndex = Math.min(clampedIndex, mustDefendIndex);
      }
    }
  }
  return rules.sequence[clampedIndex]!;
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
