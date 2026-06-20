import type { ShengJiRuleset } from "./schema.js";

export const fourPlayerTwoDeckFixedTeamRuleset = {
  id: "shengji-4p-2d-fixed-v1",
  name: "Sheng Ji 4P Fixed Teams",
  version: "1.0.0",
  players: {
    count: 4,
    seatOrder: "counterclockwise",
  },
  decks: {
    count: 2,
    includeJokers: true,
  },
  teams: {
    mode: "fixed",
    teams: [
      [0, 2],
      [1, 3],
    ],
  },
  ranks: {
    sequence: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"],
    gameEndsOnSuccessfulDefenseAt: "A",
  },
  bidding: {
    duringDeal: true,
    postDealWindowSeconds: 30,
    responseWindowSeconds: 15,
    sameTierCounterbidAllowed: false,
    samePlayerReinforceAllowed: true,
    strengthOrder: ["count", "tier"],
    allowNoTrumpJokerBid: true,
    minimumJokerBidCount: 2,
    tiers: ["level-card", "small-joker", "big-joker"],
  },
  trump: {
    jokersAlwaysTrump: true,
    levelCardsAlwaysTrump: true,
  },
  bottom: {
    size: 8,
    lastTrickMultipliers: {
      single: 2,
      pair: 4,
      tractor: 8,
    },
    throwMultiplierStrategy: "longest-component",
  },
  trickPlay: {
    formats: ["single", "tuple", "tractor", "throw"],
    mustFollowEffectiveSuit: true,
    mustMatchFormat: true,
  },
  throws: {
    enabled: true,
    failedThrowResolution: "force-smallest-failing-component",
    failedThrowAttackerPointDelta: {
      defenderFailedThrow: 10,
      attackerFailedThrow: -10,
    },
  },
  scoring: {
    model: "thresholds",
    thresholds: [
      { min: 0, maxExclusive: 1, winner: "defenders", levelDelta: 3 },
      { min: 1, maxExclusive: 40, winner: "defenders", levelDelta: 2 },
      { min: 40, maxExclusive: 80, winner: "defenders", levelDelta: 1 },
      { min: 80, maxExclusive: 120, winner: "attackers", levelDelta: 0 },
      { min: 120, maxExclusive: 160, winner: "attackers", levelDelta: 1 },
      { min: 160, maxExclusive: 200, winner: "attackers", levelDelta: 2 },
      { min: 200, winner: "attackers", levelDelta: 3 },
    ],
  },
  roundFlow: {
    firstRoundLeader: "winning-bidder",
    laterRoundLeader: "round-progression",
  },
} satisfies ShengJiRuleset;
