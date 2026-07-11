import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  advanceRank,
  createDeck,
  determineTrickWinner,
  fourPlayerTwoDeckFixedTeamRuleset,
  parseTrickFormat,
  RANKS,
  scoreRound,
  shuffleDeck,
  SUITS,
  validateFollow,
  validateLead,
  type CardInstance,
  type Rank,
  type Suit,
  type TrumpSpec,
} from "../src/index.js";

function cardsOf(
  deck: readonly CardInstance[],
  suit: Suit,
  rank: Rank,
  count: number,
): CardInstance[] {
  return deck
    .filter(
      (card) =>
        card.face.kind === "standard" &&
        card.face.suit === suit &&
        card.face.rank === rank,
    )
    .slice(0, count);
}

describe("engine properties", () => {
  it("generates the expected number of unique physical cards for any deck count", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 8 }), (deckCount) => {
        const deck = createDeck(deckCount);
        expect(deck).toHaveLength(deckCount * 54);
        expect(new Set(deck.map(({ id }) => id)).size).toBe(deck.length);
      }),
    );
  });

  it("shuffle is deterministic and conserves every card", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 80 }), (seed) => {
        const original = createDeck(2);
        const first = shuffleDeck(original, seed);
        const second = shuffleDeck(original, seed);
        expect(first.map(({ id }) => id)).toEqual(second.map(({ id }) => id));
        expect([...first.map(({ id }) => id)].sort()).toEqual(
          [...original.map(({ id }) => id)].sort(),
        );
      }),
    );
  });

  it("every non-negative point total resolves to exactly one scoring outcome", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000 }), (points) => {
        const result = scoreRound(points, fourPlayerTwoDeckFixedTeamRuleset.scoring);
        expect(result.attackerPoints).toBe(points);
        expect(["defenders", "attackers"]).toContain(result.winner);
      }),
    );
  });

  it("rank advancement never leaves the configured rank sequence", () => {
    const rankRules = fourPlayerTwoDeckFixedTeamRuleset.ranks;
    fc.assert(
      fc.property(
        fc.constantFrom(...rankRules.sequence),
        fc.integer({ min: 0, max: 100 }),
        (rank, levels) => {
          expect(rankRules.sequence).toContain(advanceRank(rank, levels, rankRules));
        },
      ),
    );
  });
});

// Play-legality and trick-format generators re-run at 2, 3, and 4 decks so the
// generic tricks/legality machinery (verified by hand only up to tupleSize 2
// in rules-conformance.test.ts) is exercised across the deck counts the new
// multi-deck presets actually use.
describe("play legality & format properties across deck counts (2-4)", () => {
  const trump: TrumpSpec = { mode: "suit", rank: "2", suit: "hearts" };
  const eligibleRanks = RANKS.filter((rank) => rank !== trump.rank);

  it("a same-face group of N cards always parses as a tuple of size N", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(2, 3, 4),
        fc.constantFrom(...SUITS),
        fc.integer({ min: 0, max: eligibleRanks.length - 1 }),
        (deckCount, suit, rankIndex) => {
          const deck = createDeck(deckCount);
          const group = cardsOf(deck, suit, eligibleRanks[rankIndex]!, deckCount);
          expect(group).toHaveLength(deckCount);
          const format = parseTrickFormat(group, trump);
          expect(format.kind).toBe("tuple");
          expect(format.components[0]).toMatchObject({
            kind: "tuple",
            tupleSize: deckCount,
            cardCount: deckCount,
          });
        },
      ),
      { numRuns: 30 },
    );
  });

  it("a higher same-suit tuple always beats a lower one of equal size", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(2, 3, 4),
        fc.constantFrom(...SUITS),
        fc.integer({ min: 0, max: eligibleRanks.length - 1 }),
        fc.integer({ min: 0, max: eligibleRanks.length - 1 }),
        (deckCount, suit, indexA, indexB) => {
          fc.pre(indexA !== indexB);
          const lowIndex = Math.min(indexA, indexB);
          const highIndex = Math.max(indexA, indexB);
          const deck = createDeck(deckCount);
          const lowCards = cardsOf(deck, suit, eligibleRanks[lowIndex]!, deckCount);
          const highCards = cardsOf(deck, suit, eligibleRanks[highIndex]!, deckCount);
          const ledFormat = parseTrickFormat(lowCards, trump);
          const lead = validateLead({
            cards: lowCards,
            hand: lowCards,
            trump,
            intent: "normal",
            throwsEnabled: true,
          });
          const follow = validateFollow({
            cards: highCards,
            hand: highCards,
            ledFormat,
            trump,
          });
          const winner = determineTrickWinner(
            [
              { seat: 0, ...lead },
              { seat: 1, ...follow },
            ],
            trump,
          );
          expect(winner.winnerSeat).toBe(1);
        },
      ),
      { numRuns: 30 },
    );
  });

  it("a hand void in the led suit may always discard a single card of another suit", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(2, 3, 4),
        fc.constantFrom(...SUITS),
        fc.constantFrom(...SUITS),
        fc.integer({ min: 0, max: eligibleRanks.length - 1 }),
        fc.integer({ min: 0, max: eligibleRanks.length - 1 }),
        (deckCount, ledSuit, offSuit, ledRankIndex, offRankIndex) => {
          fc.pre(ledSuit !== offSuit);
          const deck = createDeck(deckCount);
          const ledCard = cardsOf(deck, ledSuit, eligibleRanks[ledRankIndex]!, 1);
          const offCard = cardsOf(deck, offSuit, eligibleRanks[offRankIndex]!, 1);
          const ledFormat = parseTrickFormat(ledCard, trump);
          expect(() =>
            validateFollow({
              cards: offCard,
              hand: offCard,
              ledFormat,
              trump,
            }),
          ).not.toThrow();
        },
      ),
      { numRuns: 30 },
    );
  });
});
