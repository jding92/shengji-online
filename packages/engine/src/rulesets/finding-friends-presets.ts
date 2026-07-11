import {
  defaultBottomSize,
  defaultFriendCallCount,
  defaultThresholds,
} from "./derive.js";
import type { ShengJiRuleset } from "./schema.js";

/**
 * Finding-friends presets, all built from the derive helpers so layout,
 * bottom, scoring, and call counts cannot drift from the seat/deck shape.
 */
function findingFriendsRuleset(input: {
  id: string;
  name: string;
  players: number;
  deckCount: number;
}): ShengJiRuleset {
  const decks = { count: input.deckCount, includeJokers: true };
  return {
    id: input.id,
    name: input.name,
    version: "1.0.0",
    players: {
      count: input.players,
      seatOrder: "counterclockwise",
    },
    decks,
    teams: {
      mode: "finding-friends",
      friends: {
        callCount: defaultFriendCallCount(input.players),
        callableCards: "any-non-trump",
        allowOwnCardCall: true,
      },
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
      declareRankSource: "bidder-own-rank",
    },
    trump: { jokersAlwaysTrump: true, levelCardsAlwaysTrump: true },
    bottom: {
      size: defaultBottomSize(input.players, decks),
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
      laterRoundLeader: "rebid-each-round",
      rankAdvancement: "winning-team-members",
    },
  } satisfies ShengJiRuleset;
}

export const fivePlayerTwoDeckFindingFriendsRuleset = findingFriendsRuleset({
  id: "shengji-ff-5p-2d-v1",
  name: "Finding Friends 5P",
  players: 5,
  deckCount: 2,
});

export const sixPlayerThreeDeckFindingFriendsRuleset = findingFriendsRuleset({
  id: "shengji-ff-6p-3d-v1",
  name: "Finding Friends 6P",
  players: 6,
  deckCount: 3,
});

export const sevenPlayerThreeDeckFindingFriendsRuleset = findingFriendsRuleset({
  id: "shengji-ff-7p-3d-v1",
  name: "Finding Friends 7P",
  players: 7,
  deckCount: 3,
});

export const eightPlayerFourDeckFindingFriendsRuleset = findingFriendsRuleset({
  id: "shengji-ff-8p-4d-v1",
  name: "Finding Friends 8P",
  players: 8,
  deckCount: 4,
});
