import {
  compareCardsForSort,
  getEffectiveSuit,
  parseTrickFormat,
  type CardFace,
  type CardInstance,
  type Suit,
  type TrickFormat,
  type TrumpSpec,
} from "@shengji/engine";

const SUIT_GLYPHS = { spades: "♠", hearts: "♥", clubs: "♣", diamonds: "♦" } as const;

/**
 * Suit display order that keeps colors alternating (black/red/black/red),
 * the way people fan a real hand. The engine's canonical order is already
 * ♠♥♣♦, but pulling the trump suit out of the middle can strand two same-
 * colored suits together — so when a suit is trump we reorder the remaining
 * three as majority-color / minority / majority to restore the alternation,
 * with the trump group last.
 */
function alternatingSuitOrder(trump: TrumpSpec): readonly (Suit | "trump")[] {
  const trumpSuit = trump.mode === "suit" ? trump.suit : null;
  if (trumpSuit === null) {
    return ["spades", "hearts", "clubs", "diamonds", "trump"];
  }
  if (trumpSuit === "hearts" || trumpSuit === "diamonds") {
    // Two blacks, one red left → black, red, black.
    const otherRed = trumpSuit === "hearts" ? "diamonds" : "hearts";
    return ["spades", otherRed, "clubs", "trump"];
  }
  // Two reds, one black left → red, black, red.
  const otherBlack = trumpSuit === "spades" ? "clubs" : "spades";
  return ["hearts", otherBlack, "diamonds", "trump"];
}

/**
 * Hand-display comparator: orders suits with alternating colors, then defers
 * to the engine's trump-aware ordering (rank groups, tuples) within a suit.
 */
export function compareForHandDisplay(
  a: CardInstance,
  b: CardInstance,
  trump: TrumpSpec,
): number {
  const order = alternatingSuitOrder(trump);
  const suitDelta =
    order.indexOf(getEffectiveSuit(a, trump)) -
    order.indexOf(getEffectiveSuit(b, trump));
  if (suitDelta !== 0) return suitDelta;
  return compareCardsForSort(a, b, trump);
}

/** Short display for a card face, e.g. "2♠" or "小王". */
export function cardFaceLabel(face: CardFace): string {
  if (face.kind === "joker") return face.joker === "big" ? "大王" : "小王";
  return `${face.rank}${SUIT_GLYPHS[face.suit]}`;
}

/** Names the shape of a parsed lead ("pair", "tractor", …) or null for a single. */
function shapeNoun(format: TrickFormat): string | null {
  switch (format.kind) {
    case "single":
      return null;
    case "tuple": {
      const n = format.cardCount;
      return n === 2
        ? "pair"
        : n === 3
          ? "triple"
          : n === 4
            ? "bomb"
            : `${n}-of-a-kind`;
    }
    case "tractor":
      return "tractor";
    default:
      return null;
  }
}

/**
 * A confident, human label for the primary play button based on the current
 * selection: "Play", "Play pair", "Play tractor", "Play 大 joker pair", etc.
 * Throws (甩牌) are labelled by the caller, which owns the confirm flow.
 */
export function describePlaySelection(
  cards: readonly CardInstance[],
  trump: TrumpSpec | undefined,
): string {
  if (cards.length === 0) return "Play";
  const first = cards[0]!.face;
  const jokerKind =
    first.kind === "joker" &&
    cards.every((c) => c.face.kind === "joker" && c.face.joker === first.joker)
      ? first.joker
      : null;
  const jokerNoun =
    jokerKind === "big" ? "大 joker" : jokerKind === "small" ? "小 joker" : null;

  let shape: string | null = null;
  if (trump !== undefined) {
    try {
      shape = shapeNoun(parseTrickFormat(cards, trump));
    } catch {
      shape = null;
    }
  }

  if (jokerNoun !== null)
    return shape ? `Play ${jokerNoun} ${shape}` : `Play ${jokerNoun}`;
  if (shape !== null) return `Play ${shape}`;
  return "Play";
}

export type TablePosition = "south" | "east" | "north" | "west";

/** Rotates absolute seat indexes so the local player is always south. */
export function relativeSeatPosition(seat: number, you: number | null): TablePosition {
  const relative = you === null ? seat : (seat - you + 4) % 4;
  return (["south", "east", "north", "west"] as const)[relative] ?? "north";
}
