import { createAndValidateBid } from "../bidding/bidding.js";
import { cardFaceKey, getCardPoints } from "../cards/deck.js";
import type { ClientCommand } from "../state/model.js";
import { CARDS_PER_DECK, type Bid, type CardInstance } from "../types.js";
import type { BotObservation, BotPublicBid } from "./observation.js";
import { noisyPick, type BotRng } from "./rng.js";
import type { BotConfig } from "./types.js";

type BidCandidate = {
  command: Extract<ClientCommand, { type: "BID" }>;
  score: number;
};

export function bidScoreThreshold(config: BotConfig): number {
  const aggression = Math.max(0, Math.min(1, config.bidAggression));
  return 14 - aggression * 15;
}

function asBid(bid: BotPublicBid): Bid {
  return { ...bid, cards: [] };
}

function groupsByFace(cards: readonly CardInstance[]): CardInstance[][] {
  const groups = new Map<string, CardInstance[]>();
  for (const card of cards) {
    const key = cardFaceKey(card.face);
    groups.set(key, [...(groups.get(key) ?? []), card]);
  }
  return [...groups.values()];
}

function candidateScore(
  cards: readonly CardInstance[],
  observation: BotObservation,
): number {
  const card = cards[0]!;
  const declaredSuit = card.face.kind === "standard" ? card.face.suit : undefined;
  const sameSuitBacking =
    declaredSuit !== undefined
      ? observation.ownHand.filter(
          (held) =>
            held.face.kind === "standard" &&
            held.face.suit === declaredSuit &&
            held.face.rank !== observation.round?.trumpRank,
        ).length
      : 0;
  const pointBacking =
    declaredSuit !== undefined
      ? observation.ownHand
          .filter(
            (held) => held.face.kind === "standard" && held.face.suit === declaredSuit,
          )
          .reduce((total, held) => total + getCardPoints(held), 0)
      : 0;
  const tier = card.face.kind === "joker" ? (card.face.joker === "big" ? 5 : 3) : 0;
  return cards.length * 5 + sameSuitBacking * 0.6 + pointBacking * 0.08 + tier;
}

function legalBidCandidates(
  observation: BotObservation,
  config: BotConfig,
): BidCandidate[] {
  const round = observation.round;
  const ownSeat = observation.ownSeat;
  if (round === undefined || ownSeat === null) return [];
  const currentBid =
    round.currentBid === undefined ? undefined : asBid(round.currentBid);
  if (currentBid?.seat === ownSeat) return [];
  if (currentBid !== undefined && config.counterBid === "never") return [];

  const candidates: BidCandidate[] = [];
  for (const group of groupsByFace(observation.ownHand)) {
    const first = group[0]!;
    const minimum =
      first.face.kind === "joker"
        ? observation.ruleset.bidding.minimumJokerBidCount
        : 1;
    for (let count = minimum; count <= group.length; count += 1) {
      if (currentBid !== undefined && config.counterBid === "pair-only" && count < 2) {
        continue;
      }
      const cards = group.slice(0, count);
      try {
        createAndValidateBid({
          seat: ownSeat,
          cards,
          hand: observation.ownHand,
          currentRank: round.trumpRank,
          ...(currentBid === undefined ? {} : { currentBid }),
          placedAt: "1970-01-01T00:00:00.000Z",
          rules: observation.ruleset.bidding,
        });
        candidates.push({
          command: { type: "BID", cards: cards.map(({ id }) => id) },
          score: candidateScore(cards, observation),
        });
      } catch {
        // Invalid faces and bids that cannot beat the standing bid are omitted.
      }
    }
  }
  return candidates;
}

export function decideBidAction(
  observation: BotObservation,
  config: BotConfig,
  rng: BotRng,
): ClientCommand | null {
  const round = observation.round;
  if (
    round === undefined ||
    observation.ownSeat === null ||
    (observation.phase !== "dealing" && observation.phase !== "post-deal-bidding")
  ) {
    return null;
  }
  if (
    round.passedBidSeats.includes(observation.ownSeat) ||
    round.currentBid?.seat === observation.ownSeat
  ) {
    return null;
  }

  const totalCards =
    observation.ruleset.decks.count *
    (CARDS_PER_DECK + (observation.ruleset.decks.includeJokers ? 2 : 0));
  const dealProgress =
    round.dealtCardCount / (totalCards - observation.ruleset.bottom.size);
  if (observation.phase === "dealing" && dealProgress < config.bidTiming) {
    return null;
  }

  const candidates = legalBidCandidates(observation, config);
  const bestScore = Math.max(0, ...candidates.map(({ score }) => score));
  const backingThreshold = bidScoreThreshold(config);
  const shouldBid =
    bestScore >= backingThreshold && (config.difficulty !== "beginner" || rng() < 0.6);
  if (!shouldBid) {
    return observation.phase === "post-deal-bidding" ? { type: "PASS_BID" } : null;
  }

  return (
    noisyPick(
      candidates,
      candidates.map(({ score }) => score),
      config.temperature,
      config.blunderRate,
      rng,
    )?.command ??
    (observation.phase === "post-deal-bidding" ? { type: "PASS_BID" } : null)
  );
}
