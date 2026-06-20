import { describe, expect, it } from "vitest";
import {
  BidValidationError,
  createAndValidateBid,
  createDeck,
  fourPlayerTwoDeckFixedTeamRuleset,
  type CardInstance,
  type Rank,
  type Suit,
} from "../src/index.js";

const twoDecks = createDeck(2);
const threeDecks = createDeck(3);
const rules = fourPlayerTwoDeckFixedTeamRuleset.bidding;
const placedAt = "2026-06-19T12:00:00.000Z";

function standards(
  deck: readonly CardInstance[],
  suit: Suit,
  rank: Rank,
): CardInstance[] {
  return deck.filter(
    (card) =>
      card.face.kind === "standard" &&
      card.face.suit === suit &&
      card.face.rank === rank,
  );
}

function jokers(deck: readonly CardInstance[], kind: "small" | "big"): CardInstance[] {
  return deck.filter((card) => card.face.kind === "joker" && card.face.joker === kind);
}

function expectBidError(run: () => unknown, code: BidValidationError["code"]): void {
  try {
    run();
    expect.fail("Expected bid validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(BidValidationError);
    expect((error as BidValidationError).code).toBe(code);
  }
}

describe("bidding", () => {
  it("parses a level-card bid and declares its suit", () => {
    const cards = standards(twoDecks, "hearts", "2");
    const bid = createAndValidateBid({
      seat: 0,
      cards: cards.slice(0, 1),
      hand: cards,
      currentRank: "2",
      placedAt,
      rules,
    });

    expect(bid.tier).toBe("level-card");
    expect(bid.declares).toEqual({ mode: "suit", rank: "2", suit: "hearts" });
  });

  it("rejects a single joker bid", () => {
    const cards = jokers(twoDecks, "small");
    expectBidError(
      () =>
        createAndValidateBid({
          seat: 0,
          cards: cards.slice(0, 1),
          hand: cards,
          currentRank: "2",
          placedAt,
          rules,
        }),
      "SINGLE_JOKER_BID",
    );
  });

  it("lets a big-joker pair outbid a small-joker pair", () => {
    const small = jokers(twoDecks, "small");
    const big = jokers(twoDecks, "big");
    const currentBid = createAndValidateBid({
      seat: 0,
      cards: small,
      hand: small,
      currentRank: "2",
      placedAt,
      rules,
    });
    const bid = createAndValidateBid({
      seat: 1,
      cards: big,
      hand: big,
      currentRank: "2",
      currentBid,
      placedAt,
      rules,
    });

    expect(bid.tier).toBe("big-joker");
    expect(bid.declares).toEqual({ mode: "no-trump", rank: "2" });
  });

  it("rejects a same-count, same-tier counterbid", () => {
    const hearts = standards(twoDecks, "hearts", "2");
    const spades = standards(twoDecks, "spades", "2");
    const currentBid = createAndValidateBid({
      seat: 0,
      cards: hearts,
      hand: hearts,
      currentRank: "2",
      placedAt,
      rules,
    });

    expectBidError(
      () =>
        createAndValidateBid({
          seat: 1,
          cards: spades,
          hand: spades,
          currentRank: "2",
          currentBid,
          placedAt,
          rules,
        }),
      "SAME_TIER_COUNTERBID",
    );
  });

  it("prioritizes card count before tier", () => {
    const big = jokers(threeDecks, "big").slice(0, 2);
    const levelCards = standards(threeDecks, "clubs", "2");
    const currentBid = createAndValidateBid({
      seat: 0,
      cards: big,
      hand: big,
      currentRank: "2",
      placedAt,
      rules,
    });
    const bid = createAndValidateBid({
      seat: 1,
      cards: levelCards,
      hand: levelCards,
      currentRank: "2",
      currentBid,
      placedAt,
      rules,
    });

    expect(bid.count).toBe(3);
    expect(bid.tier).toBe("level-card");
  });

  it("allows the current bidder to reinforce only with the original face", () => {
    const hearts = standards(twoDecks, "hearts", "2");
    const currentBid = createAndValidateBid({
      seat: 0,
      cards: hearts.slice(0, 1),
      hand: hearts,
      currentRank: "2",
      placedAt,
      rules,
    });
    const reinforced = createAndValidateBid({
      seat: 0,
      cards: hearts,
      hand: hearts,
      currentRank: "2",
      currentBid,
      placedAt,
      rules,
    });
    expect(reinforced.count).toBe(2);

    const spades = standards(twoDecks, "spades", "2");
    expectBidError(
      () =>
        createAndValidateBid({
          seat: 0,
          cards: spades,
          hand: spades,
          currentRank: "2",
          currentBid,
          placedAt,
          rules,
        }),
      "INVALID_REINFORCEMENT",
    );
  });

  it("rejects cards not present in the bidder's hand", () => {
    const cards = standards(twoDecks, "hearts", "2");
    expectBidError(
      () =>
        createAndValidateBid({
          seat: 0,
          cards,
          hand: cards.slice(0, 1),
          currentRank: "2",
          placedAt,
          rules,
        }),
      "CARDS_NOT_OWNED",
    );
  });
});
