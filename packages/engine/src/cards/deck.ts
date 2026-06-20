import { JOKERS, RANKS, SUITS, type CardFace, type CardInstance } from "../types.js";

export function cardFaceKey(face: CardFace): string {
  return face.kind === "joker"
    ? `joker:${face.joker}`
    : `standard:${face.suit}:${face.rank}`;
}

export function sameCardFace(a: CardFace, b: CardFace): boolean {
  return cardFaceKey(a) === cardFaceKey(b);
}

export function createDeck(deckCount: number, includeJokers = true): CardInstance[] {
  if (!Number.isInteger(deckCount) || deckCount < 1) {
    throw new RangeError("deckCount must be a positive integer");
  }

  const cards: CardInstance[] = [];

  for (let deckIndex = 0; deckIndex < deckCount; deckIndex += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const face = { kind: "standard", suit, rank } as const;
        cards.push({
          id: `deck-${deckIndex}:${cardFaceKey(face)}`,
          deckIndex,
          face,
        });
      }
    }

    if (includeJokers) {
      for (const joker of JOKERS) {
        const face = { kind: "joker", joker } as const;
        cards.push({
          id: `deck-${deckIndex}:${cardFaceKey(face)}`,
          deckIndex,
          face,
        });
      }
    }
  }

  return cards;
}

export function getCardPoints(card: CardInstance | CardFace): number {
  const face = "face" in card ? card.face : card;
  if (face.kind === "joker") return 0;
  if (face.rank === "5") return 5;
  if (face.rank === "10" || face.rank === "K") return 10;
  return 0;
}

export function sumCardPoints(cards: readonly (CardInstance | CardFace)[]): number {
  return cards.reduce((total, card) => total + getCardPoints(card), 0);
}
