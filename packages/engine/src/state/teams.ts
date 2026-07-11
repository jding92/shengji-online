import type { ShengJiRuleset } from "../rulesets/schema.js";
import type { SeatIndex, TeamId } from "../types.js";
import type { GameState } from "./model.js";

/**
 * Team membership helpers. Fixed mode derives membership from the ruleset;
 * finding-friends derives it exclusively from the declarer seat and reveal
 * events — never from hand contents. FF rounds use the round-scoped team ids
 * "defenders" (declarer's side) and "attackers".
 */

export type SeatRole = "declarer" | "friend" | "attacker" | "unknown";

/** Persistent fixed-team id for a seat. Fixed mode only. */
export function teamIdForSeat(seat: number, ruleset: ShengJiRuleset): string {
  if (ruleset.teams.mode !== "fixed") {
    throw new Error("teamIdForSeat is fixed-mode only; use knownTeamIdForSeat");
  }
  const teamIndex = ruleset.teams.teams.findIndex((team) => team.includes(seat));
  if (teamIndex < 0) throw new RangeError(`Seat ${seat} is not assigned to a team`);
  return `team-${teamIndex}`;
}

function isRevealedFriend(state: GameState, seat: SeatIndex): boolean {
  return (state.round?.friendCalls ?? []).some(
    (call) => call.revealed !== undefined && call.revealed.seat === seat,
  );
}

/**
 * Publicly known role of a seat in the current round. In finding-friends an
 * unrevealed friend is indistinguishable from an attacker, so every
 * non-declarer seat without a reveal is "unknown" while the round is live. In
 * fixed mode the defending team plays the declarer side: the round leader is
 * the declarer, other defenders are friends, and everyone else attacks.
 */
export function seatRole(state: GameState, seat: SeatIndex): SeatRole {
  if (state.rulesetSnapshot.teams.mode === "finding-friends") {
    const declarerSeat = state.round?.declarerSeat;
    if (declarerSeat === undefined) return "unknown";
    if (seat === declarerSeat) return "declarer";
    return isRevealedFriend(state, seat) ? "friend" : "unknown";
  }
  if (state.defendingTeamId === undefined) return "unknown";
  if (teamIdForSeat(seat, state.rulesetSnapshot) !== state.defendingTeamId) {
    return "attacker";
  }
  return seat === state.leaderSeat ? "declarer" : "friend";
}

/**
 * Publicly known team of a seat: always defined in fixed mode; in
 * finding-friends "defenders" for the declarer and revealed friends, undefined
 * otherwise. The ONLY membership helper views and bots may use.
 */
export function knownTeamIdForSeat(
  state: GameState,
  seat: SeatIndex,
): TeamId | undefined {
  if (state.rulesetSnapshot.teams.mode === "fixed") {
    return teamIdForSeat(seat, state.rulesetSnapshot);
  }
  const declarerSeat = state.round?.declarerSeat;
  if (declarerSeat === undefined) return undefined;
  if (seat === declarerSeat || isRevealedFriend(state, seat)) return "defenders";
  return undefined;
}

/**
 * End-of-round accounting membership: an unrevealed finding-friends seat
 * scores as an attacker. Scoring only — deliberately not exported from the
 * package index so views and bots physically cannot leak it.
 */
export function finalTeamIdForSeat(state: GameState, seat: SeatIndex): TeamId {
  return knownTeamIdForSeat(state, seat) ?? "attackers";
}
