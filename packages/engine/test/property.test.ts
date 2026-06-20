import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  advanceRank,
  createDeck,
  fourPlayerTwoDeckFixedTeamRuleset,
  scoreRound,
  shuffleDeck,
} from "../src/index.js";

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
