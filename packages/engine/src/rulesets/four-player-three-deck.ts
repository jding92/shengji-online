import { defaultBottomSize, defaultFixedTeams, defaultThresholds } from "./derive.js";
import type { ShengJiRuleset } from "./schema.js";

const players = 4;
const decks = { count: 3, includeJokers: true };

export const fourPlayerThreeDeckFixedTeamRuleset = {
  id: "shengji-4p-3d-fixed-v1",
  name: "Sheng Ji 4P Fixed Teams (3 Decks)",
  version: "1.0.0",
  players: {
    count: players,
    seatOrder: "counterclockwise",
  },
  decks,
  teams: {
    mode: "fixed",
    teams: defaultFixedTeams(players),
  },
  ranks: {
    sequence: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"],
    gameEndsOnSuccessfulDefenseAt: "A",
    mustDefendRanks: [],
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
    maxRedeals: 2,
    noBidFallback: "bottom-card-declares",
    declareRankSource: "round-rank",
  },
  trump: { jokersAlwaysTrump: true, levelCardsAlwaysTrump: true },
  bottom: {
    size: defaultBottomSize(players, decks),
    lastTrickMultiplier: { strategy: "per-card-in-largest-component", perCard: 2 },
  },
  turns: { playTimeoutSeconds: 60, disconnectedTimeoutSeconds: 10 },
  trickPlay: {
    formats: ["single", "tuple", "tractor", "throw"],
    mustFollowEffectiveSuit: true,
    mustMatchFormat: true,
  },
  throws: {
    enabled: true,
    failedThrowResolution: "force-smallest-failing-component",
    failedThrowAttackerPointDelta: {
      defenderFailedThrow: 0,
      attackerFailedThrow: 0,
    },
  },
  scoring: {
    model: "thresholds",
    thresholds: defaultThresholds(decks.count),
  },
  roundFlow: {
    firstRoundLeader: "winning-bidder",
    laterRoundLeader: "round-progression",
    rankAdvancement: "winning-team-members",
  },
} satisfies ShengJiRuleset;
