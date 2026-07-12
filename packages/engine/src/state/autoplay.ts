import { chooseFriendCallsForHand } from "../bot/friends.js";
import { getCardPoints } from "../cards/deck.js";
import {
  allocateThrowMatches,
  chooseConsecutiveGroups,
  filterEffectiveSuit,
  groupsFor,
} from "../tricks/legality.js";
import type { TrickFormat } from "../tricks/types.js";
import { getEffectiveRankGroup, getEffectiveSuit } from "../trump/trump.js";
import type { CardInstance, TrumpSpec } from "../types.js";
import { validateCommand } from "./commands.js";
import type { GameEvent, GameState } from "./model.js";

function rankOrder(card: CardInstance, trump: TrumpSpec): number {
  return getEffectiveRankGroup(card, trump).order;
}

/**
 * Sorts cards by how expendable they are: non-trump before trump, non-point
 * before point, then lowest rank first. Card id breaks ties deterministically.
 */
function byMostExpendable(trump: TrumpSpec) {
  const keep = (card: CardInstance): number =>
    (getEffectiveSuit(card, trump) === "trump" ? 2 : 0) +
    (getCardPoints(card) > 0 ? 1 : 0);
  return (a: CardInstance, b: CardInstance): number => {
    const keepDifference = keep(a) - keep(b);
    if (keepDifference !== 0) return keepDifference;
    const orderDifference = rankOrder(a, trump) - rankOrder(b, trump);
    if (orderDifference !== 0) return orderDifference;
    return a.id.localeCompare(b.id);
  };
}

function byLowestRank(trump: TrumpSpec) {
  return (a: CardInstance, b: CardInstance): number => {
    const orderDifference = rankOrder(a, trump) - rankOrder(b, trump);
    if (orderDifference !== 0) return orderDifference;
    return a.id.localeCompare(b.id);
  };
}

function withoutCards(
  source: readonly CardInstance[],
  removed: readonly CardInstance[],
): CardInstance[] {
  const removedIds = new Set(removed.map(({ id }) => id));
  return source.filter(({ id }) => !removedIds.has(id));
}

/** Lowest expendable cards to bury when the leader's exchange times out. */
export function selectForcedBury(
  hand: readonly CardInstance[],
  bottomSize: number,
  trump: TrumpSpec,
): CardInstance[] {
  return [...hand].sort(byMostExpendable(trump)).slice(0, bottomSize);
}

/**
 * Structural cards a follow must contribute to replicate the hand's
 * match-as-fully-as-possible profile (see validateFollow). For tuples and
 * tractors the lowest adequate groups are chosen; throws mirror the exact
 * allocation order used by the legality profile so later components see the
 * same remaining cards.
 */
export function structuralMatch(
  suitCards: readonly CardInstance[],
  ledFormat: TrickFormat,
  trump: TrumpSpec,
): CardInstance[] {
  if (ledFormat.kind === "single") return [];
  if (ledFormat.kind === "throw") {
    return allocateThrowMatches(suitCards, ledFormat, trump).consumed;
  }

  const component = ledFormat.components[0];
  if (component === undefined) return [];
  const groups = groupsFor(suitCards, trump).sort((a, b) => a.order - b.order);

  if (component.kind === "tuple") {
    const matchSize = Math.min(
      component.tupleSize,
      Math.max(0, ...groups.map(({ cards }) => cards.length)),
    );
    if (matchSize <= 1) return [];
    const lowestAdequate = groups.find(({ cards }) => cards.length >= matchSize)!;
    return lowestAdequate.cards.slice(0, matchSize);
  }

  const eligible = groups.filter(({ cards }) => cards.length >= component.tupleSize);
  const capacity = Math.min(component.runLength, eligible.length);
  const consecutive = chooseConsecutiveGroups(eligible, component.tupleSize, capacity);
  const chosen = [...consecutive];
  for (const group of eligible) {
    if (chosen.length >= capacity) break;
    if (!chosen.some(({ key }) => key === group.key)) chosen.push(group);
  }
  return chosen.flatMap(({ cards }) => cards.slice(0, component.tupleSize));
}

/** Minimal legal cards for a forced follow of the led format. */
export function selectForcedFollow(
  hand: readonly CardInstance[],
  ledFormat: TrickFormat,
  trump: TrumpSpec,
): CardInstance[] {
  const suitCards = filterEffectiveSuit(hand, ledFormat.effectiveSuit, trump);
  const need = ledFormat.cardCount;

  if (suitCards.length <= need) {
    const fillers = withoutCards(hand, suitCards)
      .sort(byMostExpendable(trump))
      .slice(0, need - suitCards.length);
    return [...suitCards, ...fillers];
  }

  const structural = structuralMatch(suitCards, ledFormat, trump);
  const fillers = withoutCards(suitCards, structural)
    .sort(byLowestRank(trump))
    .slice(0, need - structural.length);
  return [...structural, ...fillers];
}

/**
 * Deterministic auto-call for a stalled finding-friends declarer, mirroring
 * getForcedPlayEvents: the same pure heuristic the declarer bot uses (the
 * highest callable faces the hand lacks), validated through the production
 * CALL_FRIENDS path. The server's friend-calling timeout (Phase 3c) commits
 * these events; simulations drive the phase through the bot policy instead.
 */
export function getForcedFriendCallEvents(state: GameState, at: string): GameEvent[] {
  const round = state.round;
  const teams = state.rulesetSnapshot.teams;
  if (
    state.phase !== "friend-calling" ||
    teams.mode !== "finding-friends" ||
    round?.trumpSpec === undefined ||
    round.declarerSeat === undefined
  ) {
    return [];
  }
  const playerId = state.seats[round.declarerSeat];
  if (playerId === null || playerId === undefined) return [];
  const hand = (round.hands[round.declarerSeat] ?? []).map((id) => round.cards[id]!);
  const calls = chooseFriendCallsForHand({
    hand,
    trumpSpec: round.trumpSpec,
    callCount: teams.friends.callCount,
  });
  return validateCommand(state, playerId, { type: "CALL_FRIENDS", calls }, { now: at });
}

/**
 * Produces the events for a server-forced action when the current actor's
 * turn timer expires: a minimal legal play during tricks, or an expendable
 * burial during the bottom exchange. All selections are validated through
 * the same command path as human plays — this never bypasses legality.
 */
export function getForcedPlayEvents(state: GameState, at: string): GameEvent[] {
  const round = state.round;
  if (round === undefined || round.trumpSpec === undefined) return [];
  const trump = round.trumpSpec;

  if (state.phase === "bottom-exchange") {
    const seat = state.leaderSeat;
    const playerId = seat === undefined ? null : (state.seats[seat] ?? null);
    if (seat === undefined || playerId === null) return [];
    const hand = (round.hands[seat] ?? []).map((id) => round.cards[id]!);
    const buried = selectForcedBury(hand, state.rulesetSnapshot.bottom.size, trump);
    return validateCommand(
      state,
      playerId,
      { type: "BURY_BOTTOM", cards: buried.map(({ id }) => id) },
      { now: at },
    );
  }

  if (state.phase !== "playing") return [];
  const seat = round.currentTurnSeat;
  const playerId = seat === undefined ? null : (state.seats[seat] ?? null);
  if (seat === undefined || playerId === null) return [];
  const hand = (round.hands[seat] ?? []).map((id) => round.cards[id]!);
  if (hand.length === 0) return [];

  const ledFormat = round.currentTrick?.ledFormat;
  const cards =
    ledFormat === undefined
      ? [[...hand].sort(byMostExpendable(trump))[0]!]
      : selectForcedFollow(hand, ledFormat, trump);
  return validateCommand(
    state,
    playerId,
    { type: "PLAY_CARDS", cards: cards.map(({ id }) => id), intent: "normal" },
    { now: at },
  );
}
