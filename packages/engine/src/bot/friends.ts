import { cardFaceKey } from "../cards/deck.js";
import type { ClientCommand } from "../state/model.js";
import {
  RANKS,
  SUITS,
  type CardInstance,
  type StandardCardFace,
  type TrumpSpec,
} from "../types.js";
import type { BotObservation } from "./observation.js";

export type FriendCallChoice = { face: StandardCardFace; copyIndex: number };

/**
 * Pure declarer call heuristic (design B6): call the first copy of the
 * highest callable face the hand lacks entirely — the classic "ace you don't
 * hold" — and continue down the face ranking for additional calls. When every
 * candidate face is held (vanishingly rare), prefer the faces held in the
 * fewest copies, highest face first. Candidates honor the CALL_FRIENDS rules
 * (standard faces only, no level-rank faces, no trump-suit faces, copy index
 * 1), so the produced calls always validate.
 */
export function chooseFriendCallsForHand(input: {
  hand: readonly CardInstance[];
  trumpSpec: TrumpSpec;
  callCount: number;
}): FriendCallChoice[] {
  const heldCopies = new Map<string, number>();
  for (const card of input.hand) {
    const key = cardFaceKey(card.face);
    heldCopies.set(key, (heldCopies.get(key) ?? 0) + 1);
  }
  const candidates: { face: StandardCardFace; held: number; rankOrder: number }[] = [];
  RANKS.forEach((rank, rankOrder) => {
    if (rank === input.trumpSpec.rank) return; // level-rank faces are not callable
    for (const suit of SUITS) {
      if (input.trumpSpec.mode === "suit" && suit === input.trumpSpec.suit) continue;
      const face: StandardCardFace = { kind: "standard", suit, rank };
      candidates.push({
        face,
        held: heldCopies.get(cardFaceKey(face)) ?? 0,
        rankOrder,
      });
    }
  });
  candidates.sort((a, b) => {
    // Faces the hand lacks first, then the fewest held copies.
    if (a.held !== b.held) return a.held - b.held;
    // Highest face first; the SUITS declaration order breaks ties.
    if (a.rankOrder !== b.rankOrder) return b.rankOrder - a.rankOrder;
    return SUITS.indexOf(a.face.suit) - SUITS.indexOf(b.face.suit);
  });
  return candidates
    .slice(0, input.callCount)
    .map(({ face }) => ({ face: { ...face }, copyIndex: 1 }));
}

/**
 * Observation wrapper over the pure heuristic, shared by the bot policy and
 * (Phase 3c) the server's friend-calling timeout auto-call.
 */
export function chooseFriendCalls(
  observation: BotObservation,
): FriendCallChoice[] | null {
  const teams = observation.ruleset.teams;
  const trumpSpec = observation.round?.trumpSpec;
  if (teams.mode !== "finding-friends" || trumpSpec === undefined) return null;
  return chooseFriendCallsForHand({
    hand: observation.ownHand,
    trumpSpec,
    callCount: teams.friends.callCount,
  });
}

/** CALL_FRIENDS for the declarer bot during the friend-calling phase. */
export function decideFriendCallAction(
  observation: BotObservation,
): ClientCommand | null {
  if (
    observation.phase !== "friend-calling" ||
    observation.ownSeat === null ||
    observation.round?.declarerSeat !== observation.ownSeat
  ) {
    return null;
  }
  const calls = chooseFriendCalls(observation);
  return calls === null ? null : { type: "CALL_FRIENDS", calls };
}
