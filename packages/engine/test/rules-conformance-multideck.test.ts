/**
 * Multi-deck conformance fixtures. `tricks/formats.ts`, `tricks/legality.ts`,
 * `tricks/winner.ts`, and `throws/throws.ts` are parameterized over tuple
 * size, but before this file nothing exercised tupleSize >= 3 end-to-end.
 * Each case below locks in a specific rule at 3 or 4 decks using the same
 * public API as `rules-conformance.test.ts`.
 */
import { describe, expect, it } from "vitest";
import {
  createDeck,
  defaultThresholds,
  determineTrickWinner,
  eightPlayerFourDeckFixedTeamRuleset,
  fourPlayerThreeDeckFixedTeamRuleset,
  getBottomMultiplier,
  parseTrickFormat,
  resolveThrowAttempt,
  sixPlayerThreeDeckFixedTeamRuleset,
  validateFollow,
  validateLead,
  type CardInstance,
  type Rank,
  type Suit,
  type TrumpSpec,
} from "../src/index.js";

const deck3 = createDeck(3);
const deck4 = createDeck(4);

function cardsFromDeck(
  deck: readonly CardInstance[],
  suit: Suit,
  rank: Rank,
  count: number,
): CardInstance[] {
  const matches = deck.filter(
    (candidate) =>
      candidate.face.kind === "standard" &&
      candidate.face.suit === suit &&
      candidate.face.rank === rank,
  );
  if (matches.length < count) {
    throw new Error(`Not enough copies of ${rank} of ${suit} for count ${count}`);
  }
  return matches.slice(0, count);
}

describe("triple and quad tuples", () => {
  const trump: TrumpSpec = { mode: "suit", rank: "3", suit: "hearts" };

  it("a triple (555) parses as a size-3 tuple at 3 decks and beats a lower triple", () => {
    const led = cardsFromDeck(deck3, "spades", "9", 3);
    const follow = cardsFromDeck(deck3, "spades", "10", 3);
    const ledFormat = parseTrickFormat(led, trump);
    expect(ledFormat.kind).toBe("tuple");
    expect(ledFormat.components[0]).toMatchObject({ kind: "tuple", tupleSize: 3 });

    const lead = validateLead({
      cards: led,
      hand: led,
      trump,
      intent: "normal",
      throwsEnabled: true,
    });
    const followed = validateFollow({
      cards: follow,
      hand: follow,
      ledFormat,
      trump,
    });
    const winner = determineTrickWinner(
      [
        { seat: 0, ...lead },
        { seat: 1, ...followed },
      ],
      trump,
    );
    expect(winner.winnerSeat).toBe(1);
  });

  it("a quad parses as a size-4 tuple at 4 decks and beats a lower quad", () => {
    const led = cardsFromDeck(deck4, "clubs", "J", 4);
    const follow = cardsFromDeck(deck4, "clubs", "Q", 4);
    const ledFormat = parseTrickFormat(led, trump);
    expect(ledFormat.kind).toBe("tuple");
    expect(ledFormat.components[0]).toMatchObject({ kind: "tuple", tupleSize: 4 });

    const lead = validateLead({
      cards: led,
      hand: led,
      trump,
      intent: "normal",
      throwsEnabled: true,
    });
    const followed = validateFollow({
      cards: follow,
      hand: follow,
      ledFormat,
      trump,
    });
    const winner = determineTrickWinner(
      [
        { seat: 0, ...lead },
        { seat: 1, ...followed },
      ],
      trump,
    );
    expect(winner.winnerSeat).toBe(1);
  });
});

describe("triple tractors and shape distinctions", () => {
  const trump: TrumpSpec = { mode: "suit", rank: "3", suit: "hearts" };

  it("555666 parses as a tractor (tupleSize 3, runLength 2) at 3 decks", () => {
    const cards = [
      ...cardsFromDeck(deck3, "spades", "5", 3),
      ...cardsFromDeck(deck3, "spades", "6", 3),
    ];
    const format = parseTrickFormat(cards, trump);
    expect(format.kind).toBe("tractor");
    expect(format.components[0]).toMatchObject({
      kind: "tractor",
      tupleSize: 3,
      runLength: 2,
    });
  });

  it("three consecutive pairs (2x3) and two consecutive triples (3x2) parse as different shapes", () => {
    const threePairs = [
      ...cardsFromDeck(deck3, "spades", "5", 2),
      ...cardsFromDeck(deck3, "spades", "6", 2),
      ...cardsFromDeck(deck3, "spades", "7", 2),
    ];
    const twoTriples = [
      ...cardsFromDeck(deck3, "spades", "5", 3),
      ...cardsFromDeck(deck3, "spades", "6", 3),
    ];
    expect(threePairs).toHaveLength(6);
    expect(twoTriples).toHaveLength(6);

    const pairsFormat = parseTrickFormat(threePairs, trump);
    const triplesFormat = parseTrickFormat(twoTriples, trump);
    expect(pairsFormat.kind).toBe("tractor");
    expect(triplesFormat.kind).toBe("tractor");
    expect(pairsFormat.components[0]).toMatchObject({ tupleSize: 2, runLength: 3 });
    expect(triplesFormat.components[0]).toMatchObject({ tupleSize: 3, runLength: 2 });

    // Same card count (6), same suit, same rank span (5-6-7 vs 5-6) — yet the
    // two parse as structurally distinct tractor shapes.
    expect(pairsFormat.components[0]).not.toMatchObject(triplesFormat.components[0]!);
  });
});

describe("follow rules at tupleSize 3", () => {
  // Rank "2" as trump keeps hearts' ordinary ordering intact for K/Q/J.
  const trump: TrumpSpec = { mode: "suit", rank: "2", suit: "clubs" };

  it("holding a pair plus a single of the led suit must play the pair together, not break it", () => {
    const led = cardsFromDeck(deck3, "hearts", "9", 3);
    const ledFormat = parseTrickFormat(led, trump);

    const pair = cardsFromDeck(deck3, "hearts", "K", 2);
    const singleQ = cardsFromDeck(deck3, "hearts", "Q", 1);
    const singleJ = cardsFromDeck(deck3, "hearts", "J", 1);
    const filler = cardsFromDeck(deck3, "spades", "4", 2);
    const hand = [...pair, ...singleQ, ...singleJ, ...filler];

    // Legal: play the pair plus one single — preserves the largest group (2).
    expect(() =>
      validateFollow({
        cards: [...pair, ...singleQ],
        hand,
        ledFormat,
        trump,
      }),
    ).not.toThrow();

    // Illegal: break the pair and play both singles instead — the hand could
    // have preserved a group of 2, so the played profile (all 1s) must fail.
    expect(() =>
      validateFollow({
        cards: [pair[0]!, ...singleQ, ...singleJ],
        hand,
        ledFormat,
        trump,
      }),
    ).toThrow();
  });
});

describe("throws at 3 decks", () => {
  const trump: TrumpSpec = { mode: "suit", rank: "2", suit: "hearts" };
  const rules = fourPlayerThreeDeckFixedTeamRuleset.throws;

  it("a triple component fails against an opponent holding a higher triple", () => {
    const pairAce = cardsFromDeck(deck3, "spades", "A", 2);
    const tripleTen = cardsFromDeck(deck3, "spades", "10", 3);
    const thrown = [...tripleTen, ...pairAce];

    const result = resolveThrowAttempt({
      cards: thrown,
      opponents: [{ seat: 1, hand: cardsFromDeck(deck3, "spades", "J", 3) }],
      trump,
      throwingRole: "defenders",
      rules,
    });

    expect(result.kind).toBe("failed");
    if (result.kind === "failed") {
      // The pair of aces is unbeatable (nothing outranks an ace); only the
      // triple-ten component can fail against the opponent's triple jacks.
      expect(result.failingComponents).toHaveLength(1);
      expect(result.forcedComponent).toMatchObject({ kind: "tuple", tupleSize: 3 });
      expect(result.forcedComponent.cards[0]?.face).toMatchObject({ rank: "10" });
      expect(result.pointDeltaToAttackers).toBe(0);
    }
  });
});

describe("bottom multiplier at 3 decks", () => {
  it("a final trick led by a triple multiplies the bottom by 6x (2 per card)", () => {
    const trump: TrumpSpec = { mode: "suit", rank: "2", suit: "hearts" };
    const { bottom } = fourPlayerThreeDeckFixedTeamRuleset;
    const triple = cardsFromDeck(deck3, "spades", "9", 3);
    expect(getBottomMultiplier(parseTrickFormat(triple, trump), bottom)).toBe(6);
  });
});

describe("scoring thresholds at 3 and 4 decks (new presets)", () => {
  it("defaultThresholds(3) reproduces the 4p/3d and 6p/3d preset bands (band 60)", () => {
    expect(defaultThresholds(3)).toEqual(
      fourPlayerThreeDeckFixedTeamRuleset.scoring.thresholds,
    );
    expect(defaultThresholds(3)).toEqual(
      sixPlayerThreeDeckFixedTeamRuleset.scoring.thresholds,
    );
  });

  it("defaultThresholds(4) reproduces the 8p/4d preset bands (band 80)", () => {
    expect(defaultThresholds(4)).toEqual(
      eightPlayerFourDeckFixedTeamRuleset.scoring.thresholds,
    );
  });
});
