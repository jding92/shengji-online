import type { ShengJiRuleset } from "./schema.js";

/** Architecture fixture only; it is intentionally not exposed by the v1 UI. */
export const sixPlayerThreeDeckFutureRuleset = {
  id: "shengji-6p-3d-fixed-experimental",
  name: "Sheng Ji 6P Fixed Teams (Experimental)",
  version: "0.0.1",
  players: { count: 6, seatOrder: "counterclockwise" },
  decks: { count: 3, includeJokers: true },
  teams: {
    mode: "fixed",
    teams: [
      [0, 2, 4],
      [1, 3, 5],
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
  trump: { jokersAlwaysTrump: true, levelCardsAlwaysTrump: true },
  bottom: {
    size: 6,
    lastTrickMultipliers: { single: 2, pair: 4, tractor: 8 },
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
      { min: 1, maxExclusive: 60, winner: "defenders", levelDelta: 2 },
      { min: 60, maxExclusive: 120, winner: "defenders", levelDelta: 1 },
      { min: 120, maxExclusive: 180, winner: "attackers", levelDelta: 0 },
      { min: 180, maxExclusive: 240, winner: "attackers", levelDelta: 1 },
      { min: 240, maxExclusive: 300, winner: "attackers", levelDelta: 2 },
      { min: 300, winner: "attackers", levelDelta: 3 },
    ],
  },
  roundFlow: {
    firstRoundLeader: "winning-bidder",
    laterRoundLeader: "round-progression",
  },
} satisfies ShengJiRuleset;
