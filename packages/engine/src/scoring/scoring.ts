import type { RoundOutcome } from "../types.js";
import type { ShengJiRuleset } from "../rulesets/schema.js";
import type { TrickFormat } from "../tricks/types.js";

export function scoreRound(
  attackerPoints: number,
  rules: ShengJiRuleset["scoring"],
): RoundOutcome {
  if (!Number.isInteger(attackerPoints)) {
    throw new RangeError("attackerPoints must be an integer");
  }

  const threshold = rules.thresholds.find(
    ({ min, maxExclusive }) =>
      (min === undefined || attackerPoints >= min) &&
      (maxExclusive === undefined || attackerPoints < maxExclusive),
  );

  if (threshold === undefined) {
    throw new RangeError(`No scoring threshold covers ${attackerPoints} points`);
  }

  return {
    attackerPoints,
    winner: threshold.winner,
    levelDelta: threshold.levelDelta,
  };
}

/**
 * Bottom points are multiplied per card in the largest component of the
 * final trick's led format: single = 2x, pair = 4x, triple = 6x,
 * two-pair tractor = 8x, and so on.
 */
export function getBottomMultiplier(
  format: TrickFormat,
  rules: ShengJiRuleset["bottom"],
): number {
  const largestComponentCardCount = format.components.reduce(
    (largest, component) => Math.max(largest, component.cardCount),
    1,
  );
  return rules.lastTrickMultiplier.perCard * largestComponentCardCount;
}
