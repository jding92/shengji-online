import { describe, expect, it } from "vitest";
import {
  CARDS_PER_DECK,
  defaultBottomSize,
  defaultFixedTeams,
  defaultFriendCallCount,
  defaultThresholds,
  fourPlayerTwoDeckFixedTeamRuleset,
  sixPlayerThreeDeckFixedTeamRuleset,
  totalCards,
  validBottomSizes,
} from "../src/index.js";

const twoDecks = { count: 2, includeJokers: true };
const threeDecks = { count: 3, includeJokers: true };
const fourDecks = { count: 4, includeJokers: true };

describe("totalCards", () => {
  it("counts standard cards plus two jokers per deck", () => {
    expect(CARDS_PER_DECK).toBe(52);
    expect(totalCards(twoDecks)).toBe(108);
    expect(totalCards(threeDecks)).toBe(162);
    expect(totalCards(fourDecks)).toBe(216);
    expect(totalCards({ count: 2, includeJokers: false })).toBe(104);
  });
});

describe("validBottomSizes", () => {
  it("returns sizes that leave a deal divisible among players", () => {
    // 108 cards, 4 players: dealt = 108 − s must be a multiple of 4 ⇒ s ≡ 0 (mod 4).
    expect(validBottomSizes(4, twoDecks)).toEqual([4, 8]);
    // 162 cards, 6 players: s ≡ 0 (mod 6).
    expect(validBottomSizes(6, threeDecks)).toEqual([6, 12]);
    // 162 cards, 4 players: dealt divisible by 4 ⇒ s ≡ 2 (mod 4).
    expect(validBottomSizes(4, threeDecks)).toEqual([2, 6]);
    // 216 cards, 8 players: s ≡ 0 (mod 8).
    expect(validBottomSizes(8, fourDecks)).toEqual([8, 16]);
  });

  it("only includes sizes whose deal divides evenly", () => {
    for (const size of validBottomSizes(5, twoDecks)) {
      expect((totalCards(twoDecks) - size) % 5).toBe(0);
    }
  });
});

describe("defaultBottomSize", () => {
  it("is the smallest valid size >= 6", () => {
    expect(defaultBottomSize(4, twoDecks)).toBe(8);
    expect(defaultBottomSize(6, threeDecks)).toBe(6);
    expect(defaultBottomSize(5, twoDecks)).toBe(8);
    expect(defaultBottomSize(7, threeDecks)).toBe(8);
    expect(defaultBottomSize(8, fourDecks)).toBe(8);
    expect(defaultBottomSize(4, threeDecks)).toBe(6);
  });

  it("reproduces the shipping presets' bottom sizes", () => {
    expect(defaultBottomSize(4, twoDecks)).toBe(
      fourPlayerTwoDeckFixedTeamRuleset.bottom.size,
    );
    expect(defaultBottomSize(6, threeDecks)).toBe(
      sixPlayerThreeDeckFixedTeamRuleset.bottom.size,
    );
  });
});

describe("defaultThresholds", () => {
  it("reproduces the 4p/2d preset thresholds (band 40)", () => {
    expect(defaultThresholds(2)).toEqual(
      fourPlayerTwoDeckFixedTeamRuleset.scoring.thresholds,
    );
  });

  it("reproduces the 6p/3d preset thresholds (band 60)", () => {
    expect(defaultThresholds(3)).toEqual(
      sixPlayerThreeDeckFixedTeamRuleset.scoring.thresholds,
    );
  });

  it("scales the band linearly with deck count", () => {
    const bands = defaultThresholds(4);
    expect(bands[1]).toEqual({
      min: 1,
      maxExclusive: 80,
      winner: "defenders",
      levelDelta: 2,
    });
    expect(bands.at(-1)).toEqual({ min: 400, winner: "attackers", levelDelta: 3 });
  });
});

describe("defaultFixedTeams", () => {
  it("alternates seats into two teams", () => {
    expect(defaultFixedTeams(4)).toEqual([
      [0, 2],
      [1, 3],
    ]);
    expect(defaultFixedTeams(6)).toEqual([
      [0, 2, 4],
      [1, 3, 5],
    ]);
    expect(defaultFixedTeams(8)).toEqual([
      [0, 2, 4, 6],
      [1, 3, 5, 7],
    ]);
  });

  it("throws on odd player counts", () => {
    expect(() => defaultFixedTeams(5)).toThrow();
    expect(() => defaultFixedTeams(7)).toThrow();
  });
});

describe("defaultFriendCallCount", () => {
  it("is floor(n/2) − 1", () => {
    expect(defaultFriendCallCount(5)).toBe(1);
    expect(defaultFriendCallCount(6)).toBe(2);
    expect(defaultFriendCallCount(7)).toBe(2);
    expect(defaultFriendCallCount(8)).toBe(3);
  });
});
