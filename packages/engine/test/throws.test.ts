import { describe, expect, it } from "vitest";
import {
  createDeck,
  fourPlayerTwoDeckFixedTeamRuleset,
  resolveThrowAttempt,
  type CardInstance,
  type Rank,
  type Suit,
  type TrumpSpec,
} from "../src/index.js";

const deck = createDeck(2);
const trump: TrumpSpec = { mode: "suit", rank: "3", suit: "hearts" };

function cards(suit: Suit, rank: Rank): CardInstance[] {
  return deck.filter(
    (card) =>
      card.face.kind === "standard" &&
      card.face.suit === suit &&
      card.face.rank === rank,
  );
}

function one(suit: Suit, rank: Rank): CardInstance {
  return cards(suit, rank)[0]!;
}

const attemptedThrow = [
  ...cards("spades", "K"),
  ...cards("spades", "A"),
  one("spades", "9"),
];

const penaltyRules = {
  ...fourPlayerTwoDeckFixedTeamRuleset.throws,
  failedThrowAttackerPointDelta: {
    defenderFailedThrow: 10,
    attackerFailedThrow: -10,
  },
};

describe("throw resolution", () => {
  it("allows a throw when no opponent can beat any component", () => {
    const result = resolveThrowAttempt({
      cards: attemptedThrow,
      opponents: [
        { seat: 1, hand: [one("spades", "2")] },
        { seat: 2, hand: [one("spades", "4")] },
        { seat: 3, hand: [] },
      ],
      trump,
      throwingRole: "defenders",
      rules: fourPlayerTwoDeckFixedTeamRuleset.throws,
    });
    expect(result.kind).toBe("successful");
  });

  it("imposes no point penalty on a failed throw by default", () => {
    const result = resolveThrowAttempt({
      cards: attemptedThrow,
      opponents: [{ seat: 1, hand: [one("spades", "10")] }],
      trump,
      throwingRole: "defenders",
      rules: fourPlayerTwoDeckFixedTeamRuleset.throws,
    });
    expect(result).toMatchObject({ kind: "failed", pointDeltaToAttackers: 0 });
  });

  it("forces the smallest failing component and awards +10 for a defender failure when the penalty is enabled", () => {
    const result = resolveThrowAttempt({
      cards: attemptedThrow,
      opponents: [{ seat: 1, hand: [one("spades", "10")] }],
      trump,
      throwingRole: "defenders",
      rules: penaltyRules,
    });
    expect(result.kind).toBe("failed");
    if (result.kind === "failed") {
      expect(result.forcedComponent).toMatchObject({ kind: "tuple", tupleSize: 1 });
      expect(result.forcedComponent.cards[0]?.face).toMatchObject({ rank: "9" });
      expect(result.failingComponents[0]?.beatBySeat).toBe(1);
      expect(result.pointDeltaToAttackers).toBe(10);
    }
  });

  it("subtracts 10 when an attacker fails a throw and the penalty is enabled", () => {
    const result = resolveThrowAttempt({
      cards: attemptedThrow,
      opponents: [{ seat: 2, hand: [one("spades", "10")] }],
      trump,
      throwingRole: "attackers",
      rules: penaltyRules,
    });
    expect(result).toMatchObject({ kind: "failed", pointDeltaToAttackers: -10 });
  });

  it("prefers a failing single over a failing pair", () => {
    const attempted = [...cards("spades", "9"), one("spades", "5"), one("spades", "2")];
    const result = resolveThrowAttempt({
      cards: attempted,
      opponents: [{ seat: 1, hand: [...cards("spades", "10"), one("spades", "6")] }],
      trump,
      throwingRole: "defenders",
      rules: fourPlayerTwoDeckFixedTeamRuleset.throws,
    });
    expect(result.kind).toBe("failed");
    if (result.kind === "failed") {
      expect(result.forcedComponent.cardCount).toBe(1);
      expect(result.forcedComponent.cards[0]?.face).toMatchObject({ rank: "2" });
    }
  });
});
