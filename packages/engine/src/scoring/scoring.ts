import type { RoundOutcome } from "../types.js";
import type { ShengJiRuleset } from "../rulesets/schema.js";

export function scoreRound(
  attackerPoints: number,
  rules: ShengJiRuleset["scoring"],
): RoundOutcome {
  if (!Number.isInteger(attackerPoints)) {
    throw new RangeError("attackerPoints must be an integer");
  }

  const threshold = rules.thresholds.find(
    ({ min, maxExclusive }) =>
      attackerPoints >= min &&
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

export function getBottomMultiplier(
  format:
    | { kind: "single" }
    | { kind: "tuple"; tupleSize: number }
    | { kind: "tractor" }
    | { kind: "throw"; longestComponent: "single" | "pair" | "tractor" },
  rules: ShengJiRuleset["bottom"],
): number {
  if (format.kind === "throw") {
    return rules.lastTrickMultipliers[format.longestComponent];
  }
  if (format.kind === "tractor") return rules.lastTrickMultipliers.tractor;
  if (format.kind === "tuple" && format.tupleSize >= 2) {
    return rules.lastTrickMultipliers.pair;
  }
  return rules.lastTrickMultipliers.single;
}
