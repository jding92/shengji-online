import { describe, expect, it } from "vitest";
import { createDeck, getCardPoints, sumCardPoints } from "../src/index.js";

describe("deck generation", () => {
  it("creates two complete decks with unique physical ids", () => {
    const deck = createDeck(2);

    expect(deck).toHaveLength(108);
    expect(new Set(deck.map(({ id }) => id))).toHaveLength(108);
    expect(deck.filter(({ face }) => face.kind === "joker")).toHaveLength(4);
  });

  it("contains 100 points per deck", () => {
    expect(sumCardPoints(createDeck(1))).toBe(100);
    expect(sumCardPoints(createDeck(2))).toBe(200);
  });

  it("scores only fives, tens, and kings", () => {
    const deck = createDeck(1);
    const byRank = (rank: string) =>
      deck.find((card) => card.face.kind === "standard" && card.face.rank === rank);

    expect(getCardPoints(byRank("5")!)).toBe(5);
    expect(getCardPoints(byRank("10")!)).toBe(10);
    expect(getCardPoints(byRank("K")!)).toBe(10);
    expect(getCardPoints(byRank("A")!)).toBe(0);
  });

  it("rejects nonsensical deck counts", () => {
    expect(() => createDeck(0)).toThrowError(/positive integer/);
    expect(() => createDeck(1.5)).toThrowError(/positive integer/);
  });
});
