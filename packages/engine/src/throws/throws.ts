import { cardFaceKey } from "../cards/deck.js";
import type { ShengJiRuleset } from "../rulesets/schema.js";
import { componentHighRank, parseThrow } from "../tricks/formats.js";
import type { TrickComponent, TrickFormat } from "../tricks/types.js";
import { getEffectiveRankGroup, getEffectiveSuit } from "../trump/trump.js";
import type { CardInstance, TrumpSpec, WinnerRole } from "../types.js";

export type ThrowOpponent = {
  seat: number;
  hand: readonly CardInstance[];
};

export type FailingThrowComponent = {
  component: TrickComponent;
  beatBySeat: number;
};

export type ThrowResolution =
  | { kind: "successful"; trickFormat: TrickFormat }
  | {
      kind: "failed";
      attemptedFormat: TrickFormat;
      failingComponents: FailingThrowComponent[];
      forcedComponent: TrickComponent;
      pointDeltaToAttackers: number;
    };

type OpponentGroup = {
  order: number;
  count: number;
};

function opponentGroups(
  hand: readonly CardInstance[],
  component: TrickComponent,
  trump: TrumpSpec,
): OpponentGroup[] {
  const groups = new Map<string, CardInstance[]>();
  for (const card of hand) {
    if (getEffectiveSuit(card, trump) !== component.effectiveSuit) continue;
    const key = cardFaceKey(card.face);
    const existing = groups.get(key);
    if (existing === undefined) groups.set(key, [card]);
    else existing.push(card);
  }
  return [...groups.values()].map((cards) => ({
    count: cards.length,
    order: getEffectiveRankGroup(cards[0]!, trump).order,
  }));
}

export function canHandBeatComponent(
  hand: readonly CardInstance[],
  component: TrickComponent,
  trump: TrumpSpec,
): boolean {
  const groups = opponentGroups(hand, component, trump);
  const componentHigh = componentHighRank(component);
  if (component.kind === "tuple") {
    return groups.some(
      ({ count, order }) => count >= component.tupleSize && order > componentHigh,
    );
  }

  const eligibleOrders = [
    ...new Set(
      groups
        .filter(({ count }) => count >= component.tupleSize)
        .map(({ order }) => order),
    ),
  ].sort((a, b) => a - b);
  let runLength = 0;
  let previous: number | undefined;
  for (const order of eligibleOrders) {
    runLength = previous !== undefined && order === previous + 1 ? runLength + 1 : 1;
    if (runLength >= component.runLength && order > componentHigh) return true;
    previous = order;
  }
  return false;
}

export function chooseSmallestFailingComponent(
  failing: readonly FailingThrowComponent[],
): TrickComponent {
  const selected = [...failing].sort((a, b) => {
    if (a.component.cardCount !== b.component.cardCount) {
      return a.component.cardCount - b.component.cardCount;
    }
    const rankDifference =
      componentHighRank(a.component) - componentHighRank(b.component);
    if (rankDifference !== 0) return rankDifference;
    if (a.component.kind !== b.component.kind) {
      return a.component.kind === "tuple" ? -1 : 1;
    }
    return a.beatBySeat - b.beatBySeat;
  })[0];
  if (selected === undefined) {
    throw new RangeError("At least one failing component is required");
  }
  return selected.component;
}

export function resolveThrowAttempt(input: {
  cards: readonly CardInstance[];
  opponents: readonly ThrowOpponent[];
  trump: TrumpSpec;
  throwingRole: WinnerRole;
  rules: ShengJiRuleset["throws"];
}): ThrowResolution {
  const attemptedFormat = parseThrow(input.cards, input.trump);
  const failingComponents: FailingThrowComponent[] = [];

  for (const component of attemptedFormat.components) {
    const beatingOpponent = input.opponents.find(({ hand }) =>
      canHandBeatComponent(hand, component, input.trump),
    );
    if (beatingOpponent !== undefined) {
      failingComponents.push({ component, beatBySeat: beatingOpponent.seat });
    }
  }

  if (failingComponents.length === 0) {
    return { kind: "successful", trickFormat: attemptedFormat };
  }

  return {
    kind: "failed",
    attemptedFormat,
    failingComponents,
    forcedComponent: chooseSmallestFailingComponent(failingComponents),
    pointDeltaToAttackers:
      input.throwingRole === "defenders"
        ? input.rules.failedThrowAttackerPointDelta.defenderFailedThrow
        : input.rules.failedThrowAttackerPointDelta.attackerFailedThrow,
  };
}
