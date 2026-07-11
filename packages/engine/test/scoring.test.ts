import { describe, expect, it } from "vitest";
import {
  advanceRank,
  createDeck,
  fourPlayerTwoDeckFixedTeamRuleset,
  getBottomMultiplier,
  parseThrow,
  parseTrickFormat,
  scoreRound,
  type CardInstance,
  type Rank,
  type Suit,
  type TrumpSpec,
} from "../src/index.js";

const { scoring, bottom } = fourPlayerTwoDeckFixedTeamRuleset;
const trump: TrumpSpec = { mode: "suit", rank: "2", suit: "hearts" };
const deck = createDeck(3);

function cards(suit: Suit, rank: Rank, count: number): CardInstance[] {
  const matches = deck.filter(
    (card) =>
      card.face.kind === "standard" &&
      card.face.suit === suit &&
      card.face.rank === rank,
  );
  return matches.slice(0, count);
}

describe("round scoring", () => {
  it.each([
    [-50, "defenders", 3],
    [-10, "defenders", 3],
    [0, "defenders", 3],
    [1, "defenders", 2],
    [39, "defenders", 2],
    [40, "defenders", 1],
    [79, "defenders", 1],
    [80, "attackers", 0],
    [119, "attackers", 0],
    [120, "attackers", 1],
    [159, "attackers", 1],
    [160, "attackers", 2],
    [199, "attackers", 2],
    [200, "attackers", 3],
    [250, "attackers", 3],
  ] as const)("scores %i attacker points", (points, winner, levelDelta) => {
    expect(scoreRound(points, scoring)).toEqual({
      attackerPoints: points,
      winner,
      levelDelta,
    });
  });
});

describe("bottom multipliers", () => {
  it("doubles per card in the largest component: single 2x, pair 4x, triple 6x", () => {
    expect(
      getBottomMultiplier(parseTrickFormat(cards("spades", "9", 1), trump), bottom),
    ).toBe(2);
    expect(
      getBottomMultiplier(parseTrickFormat(cards("spades", "9", 2), trump), bottom),
    ).toBe(4);
    expect(
      getBottomMultiplier(parseTrickFormat(cards("spades", "9", 3), trump), bottom),
    ).toBe(6);
  });

  it("scales with tractor length: two-pair 8x, three-pair 12x", () => {
    const twoPair = [...cards("spades", "9", 2), ...cards("spades", "10", 2)];
    const threePair = [...twoPair, ...cards("spades", "J", 2)];
    expect(getBottomMultiplier(parseTrickFormat(twoPair, trump), bottom)).toBe(8);
    expect(getBottomMultiplier(parseTrickFormat(threePair, trump), bottom)).toBe(12);
  });

  it("uses the largest component of a throw", () => {
    const throwCards = [
      ...cards("spades", "9", 2),
      ...cards("spades", "10", 2),
      ...cards("spades", "A", 1),
    ];
    expect(getBottomMultiplier(parseThrow(throwCards, trump), bottom)).toBe(8);
  });
});

describe("rank advancement with must-defend ranks", () => {
  const mustDefendRules = {
    ...fourPlayerTwoDeckFixedTeamRuleset.ranks,
    mustDefendRanks: ["5", "10", "K"] as Rank[],
  };

  it("clamps a non-defender that would skip past a must-defend rank", () => {
    expect(advanceRank("4", 3, mustDefendRules)).toBe("5");
    expect(advanceRank("4", 3, mustDefendRules, { wasDefender: false })).toBe("5");
  });

  it("clamps to the lowest must-defend rank crossed", () => {
    expect(advanceRank("4", 20, mustDefendRules)).toBe("5");
  });

  it("holds a non-defender parked on a must-defend rank", () => {
    expect(advanceRank("5", 2, mustDefendRules)).toBe("5");
  });

  it("does not clamp a defender", () => {
    expect(advanceRank("4", 3, mustDefendRules, { wasDefender: true })).toBe("7");
    expect(advanceRank("5", 2, mustDefendRules, { wasDefender: true })).toBe("7");
  });

  it("allows landing exactly on a must-defend rank", () => {
    expect(advanceRank("3", 2, mustDefendRules)).toBe("5");
  });

  it("ignores must-defend ranks below the current rank", () => {
    expect(advanceRank("6", 2, mustDefendRules)).toBe("8");
  });

  it("is a no-op with the default empty list", () => {
    const openRules = { ...fourPlayerTwoDeckFixedTeamRuleset.ranks };
    expect(openRules.mustDefendRanks).toEqual([]);
    expect(advanceRank("4", 3, openRules)).toBe("7");
    expect(advanceRank("K", 5, openRules)).toBe("A");
  });
});
