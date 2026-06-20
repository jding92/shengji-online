import { describe, expect, it } from "vitest";
import {
  compareCards,
  createDeck,
  getEffectiveRankGroup,
  getEffectiveSuit,
  isTrump,
  type CardInstance,
  type Rank,
  type Suit,
} from "../src/index.js";

const deck = createDeck(2);

function standard(suit: Suit, rank: Rank, deckIndex = 0): CardInstance {
  return deck.find(
    (card) =>
      card.deckIndex === deckIndex &&
      card.face.kind === "standard" &&
      card.face.suit === suit &&
      card.face.rank === rank,
  )!;
}

function joker(kind: "small" | "big", deckIndex = 0): CardInstance {
  return deck.find(
    (card) =>
      card.deckIndex === deckIndex &&
      card.face.kind === "joker" &&
      card.face.joker === kind,
  )!;
}

describe("effective trump behavior", () => {
  const trump = { mode: "suit", rank: "3", suit: "hearts" } as const;

  it("moves jokers, level cards, and the trump suit into the trump suit", () => {
    expect(isTrump(standard("clubs", "3"), trump)).toBe(true);
    expect(isTrump(standard("hearts", "9"), trump)).toBe(true);
    expect(isTrump(joker("small"), trump)).toBe(true);
    expect(getEffectiveSuit(standard("spades", "9"), trump)).toBe("spades");
    expect(getEffectiveSuit(standard("hearts", "9"), trump)).toBe("trump");
  });

  it("makes 2 and 4 adjacent when the level rank is 3", () => {
    const two = getEffectiveRankGroup(standard("hearts", "2"), trump);
    const four = getEffectiveRankGroup(standard("hearts", "4"), trump);
    expect(four.order - two.order).toBe(1);
  });

  it("supports all required consecutive trump tractor boundaries", () => {
    const secondaryLevel = getEffectiveRankGroup(standard("clubs", "3"), trump);
    const primaryLevel = getEffectiveRankGroup(standard("hearts", "3"), trump);
    const smallJoker = getEffectiveRankGroup(joker("small"), trump);
    const bigJoker = getEffectiveRankGroup(joker("big"), trump);

    expect(primaryLevel.order - secondaryLevel.order).toBe(1);
    expect(smallJoker.order - primaryLevel.order).toBe(1);
    expect(bigJoker.order - smallJoker.order).toBe(1);
  });

  it("orders ordinary trump below level cards and jokers", () => {
    expect(compareCards(standard("hearts", "A"), standard("clubs", "3"), trump)).toBe(
      -1,
    );
    expect(compareCards(standard("clubs", "3"), standard("hearts", "3"), trump)).toBe(
      -1,
    );
    expect(compareCards(standard("hearts", "3"), joker("small"), trump)).toBe(-1);
    expect(compareCards(joker("small"), joker("big"), trump)).toBe(-1);
  });

  it("does not impose a trick order between different non-trump suits", () => {
    expect(compareCards(standard("clubs", "A"), standard("spades", "2"), trump)).toBe(
      null,
    );
  });
});

describe("no-trump behavior", () => {
  const trump = { mode: "no-trump", rank: "7" } as const;

  it("keeps ordinary suits separate while moving level cards and jokers to trump", () => {
    expect(getEffectiveSuit(standard("hearts", "A"), trump)).toBe("hearts");
    expect(getEffectiveSuit(standard("clubs", "7"), trump)).toBe("trump");
    expect(getEffectiveSuit(joker("big"), trump)).toBe("trump");
  });

  it("orders the level group immediately below small and big jokers", () => {
    const level = getEffectiveRankGroup(standard("clubs", "7"), trump);
    const small = getEffectiveRankGroup(joker("small"), trump);
    const big = getEffectiveRankGroup(joker("big"), trump);
    expect(small.order - level.order).toBe(1);
    expect(big.order - small.order).toBe(1);
  });
});
