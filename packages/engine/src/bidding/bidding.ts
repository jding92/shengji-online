import { sameCardFace } from "../cards/deck.js";
import type { ShengJiRuleset } from "../rulesets/schema.js";
import type { Bid, BidTier, CardInstance, Rank, SeatIndex } from "../types.js";

export type BidComparison =
  | "challenger-wins"
  | "challenger-loses"
  | "same-tier-not-allowed";

export type BidErrorCode =
  | "CARDS_NOT_OWNED"
  | "BID_CARDS_NOT_IDENTICAL"
  | "INVALID_BID_FACE"
  | "SINGLE_JOKER_BID"
  | "NO_TRUMP_DISABLED"
  | "BID_NOT_STRONGER"
  | "SAME_TIER_COUNTERBID"
  | "INVALID_REINFORCEMENT";

export class BidValidationError extends Error {
  constructor(
    readonly code: BidErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BidValidationError";
  }
}

type CreateBidInput = {
  seat: SeatIndex;
  cards: readonly CardInstance[];
  hand: readonly CardInstance[];
  currentRank: Rank;
  currentBid?: Bid;
  placedAt: string;
  rules: ShengJiRuleset["bidding"];
};

export function getBidTier(card: CardInstance): BidTier {
  if (card.face.kind === "standard") return "level-card";
  return card.face.joker === "small" ? "small-joker" : "big-joker";
}

function bidTierValue(tier: BidTier, rules: ShengJiRuleset["bidding"]): number {
  return rules.tiers.indexOf(tier);
}

export function compareBids(
  challenger: Bid,
  current: Bid,
  rules: ShengJiRuleset["bidding"],
): BidComparison {
  if (challenger.count > current.count) return "challenger-wins";
  if (challenger.count < current.count) return "challenger-loses";

  const challengerTier = bidTierValue(challenger.tier, rules);
  const currentTier = bidTierValue(current.tier, rules);
  if (challengerTier > currentTier) return "challenger-wins";
  if (challengerTier < currentTier) return "challenger-loses";
  return rules.sameTierCounterbidAllowed ? "challenger-wins" : "same-tier-not-allowed";
}

export function createAndValidateBid({
  seat,
  cards,
  hand,
  currentRank,
  currentBid,
  placedAt,
  rules,
}: CreateBidInput): Bid {
  if (cards.length === 0) {
    throw new BidValidationError("INVALID_BID_FACE", "A bid must contain cards");
  }

  const handIds = new Set(hand.map(({ id }) => id));
  const cardIds = new Set(cards.map(({ id }) => id));
  if (cardIds.size !== cards.length || cards.some(({ id }) => !handIds.has(id))) {
    throw new BidValidationError(
      "CARDS_NOT_OWNED",
      "Every bid card must be a distinct card in the player's hand",
    );
  }

  const first = cards[0];
  if (first === undefined) {
    throw new BidValidationError("INVALID_BID_FACE", "A bid must contain cards");
  }
  if (cards.some(({ face }) => !sameCardFace(first.face, face))) {
    throw new BidValidationError(
      "BID_CARDS_NOT_IDENTICAL",
      "All cards in a bid must have the same face",
    );
  }

  const tier = getBidTier(first);
  if (first.face.kind === "standard" && first.face.rank !== currentRank) {
    throw new BidValidationError(
      "INVALID_BID_FACE",
      `Only level-rank ${currentRank} cards or jokers may be bid`,
    );
  }
  if (first.face.kind === "joker") {
    if (!rules.allowNoTrumpJokerBid) {
      throw new BidValidationError("NO_TRUMP_DISABLED", "Joker bids are disabled");
    }
    if (cards.length < rules.minimumJokerBidCount) {
      throw new BidValidationError(
        "SINGLE_JOKER_BID",
        `A joker bid requires at least ${rules.minimumJokerBidCount} identical jokers`,
      );
    }
  }

  const bid: Bid = {
    seat,
    cards: cards.map(({ id }) => id),
    face: first.face,
    count: cards.length,
    tier,
    declares:
      first.face.kind === "joker"
        ? { mode: "no-trump", rank: currentRank }
        : { mode: "suit", rank: currentRank, suit: first.face.suit },
    placedAt,
  };

  if (currentBid === undefined) return bid;

  if (currentBid.seat === seat) {
    if (!rules.samePlayerReinforceAllowed) {
      throw new BidValidationError(
        "INVALID_REINFORCEMENT",
        "The current bidder cannot reinforce their bid",
      );
    }
    if (!sameCardFace(currentBid.face, bid.face) || bid.count <= currentBid.count) {
      throw new BidValidationError(
        "INVALID_REINFORCEMENT",
        "A reinforcement must add more cards of the original bid face",
      );
    }
  }

  const comparison = compareBids(bid, currentBid, rules);
  if (comparison === "same-tier-not-allowed") {
    throw new BidValidationError(
      "SAME_TIER_COUNTERBID",
      "A bid cannot counter another bid at the same count and tier",
    );
  }
  if (comparison === "challenger-loses") {
    throw new BidValidationError(
      "BID_NOT_STRONGER",
      "The bid must have a higher count, or a higher tier at the same count",
    );
  }

  return bid;
}
