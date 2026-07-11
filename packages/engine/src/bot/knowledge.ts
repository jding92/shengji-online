import { cardFaceKey, createDeck } from "../cards/deck.js";
import { determineTrickWinner } from "../tricks/winner.js";
import { getEffectiveRankGroup, getEffectiveSuit } from "../trump/trump.js";
import type { CardInstance, EffectiveSuit, SeatIndex, TeamId } from "../types.js";
import type { BotObservation } from "./observation.js";
import type { BotConfig } from "./types.js";

function knownCards(observation: BotObservation): CardInstance[] {
  const cards = new Map<string, CardInstance>();
  const add = (card: CardInstance) => cards.set(card.id, card);
  observation.ownHand.forEach(add);
  observation.ownBuried?.forEach(add);
  observation.round?.currentTrick?.plays
    .flatMap(({ cards: played }) => played)
    .forEach(add);
  observation.round?.completedTricks
    .flatMap(({ plays }) => plays)
    .flatMap(({ cards: played }) => played)
    .forEach(add);
  observation.round?.bottomReveal?.cards.forEach(add);
  return [...cards.values()];
}

export type BotCardKnowledge = {
  unseenCopiesByFace: ReadonlyMap<string, number>;
  unseenBySuitAndOrder: ReadonlyMap<string, number>;
};

export function deriveCardKnowledge(
  observation: BotObservation,
  config: BotConfig,
): BotCardKnowledge | null {
  const trump = observation.round?.trumpSpec;
  if (!config.cardCounting || trump === undefined) return null;
  const unseenCopiesByFace = new Map<string, number>();
  const unseenBySuitAndOrder = new Map<string, number>();
  for (const card of createDeck(
    observation.ruleset.decks.count,
    observation.ruleset.decks.includeJokers,
  )) {
    const face = cardFaceKey(card.face);
    unseenCopiesByFace.set(face, (unseenCopiesByFace.get(face) ?? 0) + 1);
    const rank = getEffectiveRankGroup(card, trump).order;
    const suitRank = `${getEffectiveSuit(card, trump)}:${rank}`;
    unseenBySuitAndOrder.set(suitRank, (unseenBySuitAndOrder.get(suitRank) ?? 0) + 1);
  }
  for (const card of knownCards(observation)) {
    const face = cardFaceKey(card.face);
    unseenCopiesByFace.set(face, Math.max(0, (unseenCopiesByFace.get(face) ?? 0) - 1));
    const rank = getEffectiveRankGroup(card, trump).order;
    const suitRank = `${getEffectiveSuit(card, trump)}:${rank}`;
    unseenBySuitAndOrder.set(
      suitRank,
      Math.max(0, (unseenBySuitAndOrder.get(suitRank) ?? 0) - 1),
    );
  }
  return { unseenCopiesByFace, unseenBySuitAndOrder };
}

export function isKnownBoss(
  card: CardInstance,
  observation: BotObservation,
  knowledge: BotCardKnowledge | null,
): boolean {
  const trump = observation.round?.trumpSpec;
  if (trump === undefined) return false;
  const suit = getEffectiveSuit(card, trump);
  const order = getEffectiveRankGroup(card, trump).order;
  if (knowledge === null) return order >= 11;
  for (const [key, count] of knowledge.unseenBySuitAndOrder) {
    const separator = key.lastIndexOf(":");
    const candidateSuit = key.slice(0, separator) as EffectiveSuit;
    const candidateOrder = Number(key.slice(separator + 1));
    if (candidateSuit === suit && candidateOrder > order && count > 0) {
      return false;
    }
  }
  return true;
}

export function inferVoidSuits(
  observation: BotObservation,
  config: BotConfig,
): ReadonlyMap<SeatIndex, ReadonlySet<EffectiveSuit>> {
  const inferred = new Map<SeatIndex, Set<EffectiveSuit>>();
  const trump = observation.round?.trumpSpec;
  if (!config.voidInference || trump === undefined) return inferred;

  const inspect = (
    effectiveSuit: EffectiveSuit,
    plays: readonly { seat: number; cards: CardInstance[] }[],
  ) => {
    for (const play of plays.slice(1)) {
      if (play.cards.some((card) => getEffectiveSuit(card, trump) !== effectiveSuit)) {
        const seats = inferred.get(play.seat) ?? new Set<EffectiveSuit>();
        seats.add(effectiveSuit);
        inferred.set(play.seat, seats);
      }
    }
  };

  for (const trick of observation.round?.completedTricks ?? []) {
    const suit = trick.plays[0]?.format?.effectiveSuit;
    if (suit !== undefined) inspect(suit, trick.plays);
  }
  const current = observation.round?.currentTrick;
  if (current !== undefined) inspect(current.ledFormat.effectiveSuit, current.plays);
  return inferred;
}

export function teamForSeat(
  observation: BotObservation,
  seat: SeatIndex,
): TeamId | undefined {
  return observation.seats.find((candidate) => candidate.seat === seat)?.teamId;
}

/** Every seat on the acting bot's team except its own; empty when unknown. */
export function teammateSeats(observation: BotObservation): SeatIndex[] {
  if (observation.ownSeat === null || observation.ownTeamId === undefined) {
    return [];
  }
  return observation.seats
    .filter(
      ({ seat, teamId }) =>
        seat !== observation.ownSeat && teamId === observation.ownTeamId,
    )
    .map(({ seat }) => seat);
}

/** @deprecated use teammateSeats — kept as a thin shim for one release. */
export function partnerSeat(observation: BotObservation): SeatIndex | undefined {
  return teammateSeats(observation)[0];
}

export function currentWinningSeat(observation: BotObservation): SeatIndex | undefined {
  const round = observation.round;
  if (
    round?.trumpSpec === undefined ||
    round.currentTrick === undefined ||
    round.currentTrick.plays.length === 0
  ) {
    return undefined;
  }
  return determineTrickWinner(round.currentTrick.plays, round.trumpSpec).winnerSeat;
}
