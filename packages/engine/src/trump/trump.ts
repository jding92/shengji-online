import {
  RANKS,
  SUITS,
  type CardInstance,
  type EffectiveSuit,
  type TrumpSpec,
} from "../types.js";

export type EffectiveRankGroup = {
  /** Equal keys are equal for trick-format purposes. */
  key: string;
  /** Adjacent order values form a tractor when tuple sizes also match. */
  order: number;
};

export function isTrump(card: CardInstance, trump: TrumpSpec): boolean {
  const face = card.face;
  if (face.kind === "joker") return true;
  if (face.rank === trump.rank) return true;
  return trump.mode === "suit" && face.suit === trump.suit;
}

export function getEffectiveSuit(card: CardInstance, trump: TrumpSpec): EffectiveSuit {
  if (isTrump(card, trump)) return "trump";
  const face = card.face;
  if (face.kind === "joker") return "trump";
  return face.suit;
}

function ordinaryRankOrder(rank: (typeof RANKS)[number], trump: TrumpSpec): number {
  return RANKS.filter((candidate) => candidate !== trump.rank).indexOf(rank);
}

export function getEffectiveRankGroup(
  card: CardInstance,
  trump: TrumpSpec,
): EffectiveRankGroup {
  const ordinaryRankCount = RANKS.length - 1;

  if (card.face.kind === "joker") {
    const levelGroupCount = trump.mode === "suit" ? 2 : 1;
    const order = ordinaryRankCount + levelGroupCount;
    return card.face.joker === "small"
      ? { key: "joker:small", order }
      : { key: "joker:big", order: order + 1 };
  }

  if (card.face.rank === trump.rank) {
    if (trump.mode === "suit" && card.face.suit === trump.suit) {
      return {
        key: `level:primary:${card.face.rank}`,
        order: ordinaryRankCount + 1,
      };
    }

    return {
      key: `level:secondary:${card.face.rank}`,
      order: ordinaryRankCount,
    };
  }

  return {
    key: `ordinary:${card.face.rank}`,
    order: ordinaryRankOrder(card.face.rank, trump),
  };
}

/**
 * Compares trick strength. Different non-trump suits are intentionally
 * incomparable because the led suit determines eligibility to win.
 */
export function compareCards(
  a: CardInstance,
  b: CardInstance,
  trump: TrumpSpec,
): -1 | 0 | 1 | null {
  const suitA = getEffectiveSuit(a, trump);
  const suitB = getEffectiveSuit(b, trump);

  if (suitA !== suitB) {
    if (suitA === "trump") return 1;
    if (suitB === "trump") return -1;
    return null;
  }

  const rankA = getEffectiveRankGroup(a, trump).order;
  const rankB = getEffectiveRankGroup(b, trump).order;
  return rankA === rankB ? 0 : rankA > rankB ? 1 : -1;
}

export function compareCardsForSort(
  a: CardInstance,
  b: CardInstance,
  trump: TrumpSpec,
): number {
  const suitA = getEffectiveSuit(a, trump);
  const suitB = getEffectiveSuit(b, trump);
  const suitOrder = [...SUITS, "trump"] as const;

  if (suitA !== suitB) return suitOrder.indexOf(suitA) - suitOrder.indexOf(suitB);

  const rankDifference =
    getEffectiveRankGroup(a, trump).order - getEffectiveRankGroup(b, trump).order;
  if (rankDifference !== 0) return rankDifference;
  return a.id.localeCompare(b.id);
}
