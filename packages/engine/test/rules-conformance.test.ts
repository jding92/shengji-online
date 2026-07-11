/**
 * Conformance tests against the reference rules at
 * https://robertying.com/shengji/rules.html
 *
 * Each case is named after the reference rule it locks in so future changes
 * cannot silently drift from the standard game.
 */
import { describe, expect, it } from "vitest";
import {
  compareCards,
  createDeck,
  fourPlayerTwoDeckFixedTeamRuleset,
  getBottomMultiplier,
  getEffectiveRankGroup,
  parseTrickFormat,
  resolveThrowAttempt,
  scoreRound,
  sixPlayerThreeDeckFixedTeamRuleset,
  type CardInstance,
  type Rank,
  type Suit,
  type TrumpSpec,
} from "../src/index.js";

const deck = createDeck(3);

function card(suit: Suit, rank: Rank): CardInstance {
  const match = deck.find(
    (candidate) =>
      candidate.face.kind === "standard" &&
      candidate.face.suit === suit &&
      candidate.face.rank === rank,
  );
  if (match === undefined) throw new Error(`Missing ${rank} of ${suit}`);
  return match;
}

function cards(suit: Suit, rank: Rank, count: number): CardInstance[] {
  return deck
    .filter(
      (candidate) =>
        candidate.face.kind === "standard" &&
        candidate.face.suit === suit &&
        candidate.face.rank === rank,
    )
    .slice(0, count);
}

function joker(kind: "small" | "big"): CardInstance {
  const match = deck.find(
    (candidate) => candidate.face.kind === "joker" && candidate.face.joker === kind,
  );
  if (match === undefined) throw new Error(`Missing ${kind} joker`);
  return match;
}

describe("play direction", () => {
  it("all rulesets deal and play counter-clockwise", () => {
    expect(fourPlayerTwoDeckFixedTeamRuleset.players.seatOrder).toBe(
      "counterclockwise",
    );
    expect(sixPlayerThreeDeckFixedTeamRuleset.players.seatOrder).toBe(
      "counterclockwise",
    );
  });
});

describe("scoring table (n = 20 points per deck)", () => {
  it("two decks (n = 40) follows the 0 / 5..n-5 / n..2n-5 / ... bands", () => {
    const { scoring } = fourPlayerTwoDeckFixedTeamRuleset;
    expect(scoreRound(0, scoring)).toMatchObject({
      winner: "defenders",
      levelDelta: 3,
    });
    expect(scoreRound(5, scoring)).toMatchObject({
      winner: "defenders",
      levelDelta: 2,
    });
    expect(scoreRound(35, scoring)).toMatchObject({
      winner: "defenders",
      levelDelta: 2,
    });
    expect(scoreRound(40, scoring)).toMatchObject({
      winner: "defenders",
      levelDelta: 1,
    });
    expect(scoreRound(75, scoring)).toMatchObject({
      winner: "defenders",
      levelDelta: 1,
    });
    expect(scoreRound(80, scoring)).toMatchObject({
      winner: "attackers",
      levelDelta: 0,
    });
    expect(scoreRound(115, scoring)).toMatchObject({
      winner: "attackers",
      levelDelta: 0,
    });
    expect(scoreRound(120, scoring)).toMatchObject({
      winner: "attackers",
      levelDelta: 1,
    });
    expect(scoreRound(160, scoring)).toMatchObject({
      winner: "attackers",
      levelDelta: 2,
    });
    expect(scoreRound(200, scoring)).toMatchObject({
      winner: "attackers",
      levelDelta: 3,
    });
  });

  it("three decks (n = 60) scales the same bands", () => {
    const { scoring } = sixPlayerThreeDeckFixedTeamRuleset;
    expect(scoreRound(0, scoring)).toMatchObject({
      winner: "defenders",
      levelDelta: 3,
    });
    expect(scoreRound(55, scoring)).toMatchObject({
      winner: "defenders",
      levelDelta: 2,
    });
    expect(scoreRound(60, scoring)).toMatchObject({
      winner: "defenders",
      levelDelta: 1,
    });
    expect(scoreRound(120, scoring)).toMatchObject({
      winner: "attackers",
      levelDelta: 0,
    });
    expect(scoreRound(300, scoring)).toMatchObject({
      winner: "attackers",
      levelDelta: 3,
    });
  });
});

describe("kitty multiplier on the last trick", () => {
  const trump: TrumpSpec = { mode: "suit", rank: "2", suit: "hearts" };
  const { bottom } = fourPlayerTwoDeckFixedTeamRuleset;

  it("is twice the card count of the largest component of the led format", () => {
    expect(
      getBottomMultiplier(parseTrickFormat(cards("spades", "9", 1), trump), bottom),
    ).toBe(2);
    expect(
      getBottomMultiplier(parseTrickFormat(cards("spades", "9", 2), trump), bottom),
    ).toBe(4);
    expect(
      getBottomMultiplier(parseTrickFormat(cards("spades", "9", 3), trump), bottom),
    ).toBe(6);
    const twoPairTractor = [...cards("spades", "9", 2), ...cards("spades", "10", 2)];
    expect(getBottomMultiplier(parseTrickFormat(twoPairTractor, trump), bottom)).toBe(
      8,
    );
  });
});

describe("throw (甩牌) resolution", () => {
  it("forces the beatable component with no additional point penalty", () => {
    const trump: TrumpSpec = { mode: "suit", rank: "3", suit: "hearts" };
    const result = resolveThrowAttempt({
      cards: [...cards("spades", "A", 2), card("spades", "9")],
      opponents: [{ seat: 1, hand: [card("spades", "10")] }],
      trump,
      throwingRole: "defenders",
      rules: fourPlayerTwoDeckFixedTeamRuleset.throws,
    });
    expect(result.kind).toBe("failed");
    if (result.kind === "failed") {
      expect(result.forcedComponent.cards[0]?.face).toMatchObject({ rank: "9" });
      expect(result.pointDeltaToAttackers).toBe(0);
    }
  });
});

describe("trump ordering", () => {
  it("with a trump suit: big joker > small joker > trump rank in suit > trump rank off-suit > suit cards", () => {
    const trump: TrumpSpec = { mode: "suit", rank: "2", suit: "hearts" };
    const order = [
      joker("big"),
      joker("small"),
      card("hearts", "2"),
      card("spades", "2"),
      card("hearts", "A"),
      card("hearts", "K"),
    ];
    for (let i = 0; i < order.length - 1; i += 1) {
      expect(compareCards(order[i]!, order[i + 1]!, trump)).toBe(1);
    }
  });

  it("with a trump suit: trump rank cards in off suits have equal value", () => {
    const trump: TrumpSpec = { mode: "suit", rank: "2", suit: "hearts" };
    expect(compareCards(card("spades", "2"), card("clubs", "2"), trump)).toBe(0);
  });

  it("no trump: jokers rank above trump rank cards, which are all equal", () => {
    const trump: TrumpSpec = { mode: "no-trump", rank: "2" };
    expect(compareCards(joker("big"), joker("small"), trump)).toBe(1);
    expect(compareCards(joker("small"), card("hearts", "2"), trump)).toBe(1);
    expect(compareCards(card("hearts", "2"), card("spades", "2"), trump)).toBe(0);
    expect(compareCards(card("hearts", "2"), card("spades", "A"), trump)).toBe(1);
  });

  it("trump rank cards of different suits are equal in value but do not form pairs", () => {
    const trump: TrumpSpec = { mode: "suit", rank: "2", suit: "hearts" };
    const spades2 = getEffectiveRankGroup(card("spades", "2"), trump);
    const clubs2 = getEffectiveRankGroup(card("clubs", "2"), trump);
    expect(spades2.order).toBe(clubs2.order);
    expect(() =>
      parseTrickFormat([card("spades", "2"), card("clubs", "2")], trump),
    ).toThrow();
  });
});

describe("point cards", () => {
  it("fives are 5 points; tens and kings are 10 points; each deck totals 100", () => {
    const oneDeck = createDeck(1);
    const total = oneDeck.reduce((sum, candidate) => {
      if (candidate.face.kind !== "standard") return sum;
      if (candidate.face.rank === "5") return sum + 5;
      if (candidate.face.rank === "10" || candidate.face.rank === "K") return sum + 10;
      return sum;
    }, 0);
    expect(total).toBe(100);
  });
});
