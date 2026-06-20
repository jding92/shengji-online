import { sumCardPoints } from "../cards/deck.js";
import { componentHighRank } from "./formats.js";
import type { PlayedCards, TrickFormat } from "./types.js";
import type { TrumpSpec } from "../types.js";

function compareSameSuitFormat(a: TrickFormat, b: TrickFormat): -1 | 0 | 1 {
  const strengthsA = a.components.map(componentHighRank);
  const strengthsB = b.components.map(componentHighRank);
  let anyHigher = false;
  let anyLower = false;
  for (let index = 0; index < strengthsA.length; index += 1) {
    const strengthA = strengthsA[index];
    const strengthB = strengthsB[index];
    if (strengthA === undefined || strengthB === undefined) continue;
    if (strengthA > strengthB) anyHigher = true;
    if (strengthA < strengthB) anyLower = true;
  }
  if (anyHigher && !anyLower) return 1;
  if (anyLower && !anyHigher) return -1;
  return 0;
}

function beats(
  candidate: PlayedCards,
  current: PlayedCards,
  trump: TrumpSpec,
): boolean {
  void trump;
  if (
    !candidate.eligibleToWin ||
    candidate.format === null ||
    current.format === null
  ) {
    return false;
  }
  const candidateSuit = candidate.format.effectiveSuit;
  const currentSuit = current.format.effectiveSuit;
  if (candidateSuit !== currentSuit) {
    return candidateSuit === "trump";
  }
  return compareSameSuitFormat(candidate.format, current.format) === 1;
}

export type TrickWinner = {
  winnerSeat: number;
  points: number;
  winningPlay: PlayedCards;
};

export function determineTrickWinner(
  plays: readonly PlayedCards[],
  trump: TrumpSpec,
): TrickWinner {
  const lead = plays[0];
  if (lead === undefined || !lead.eligibleToWin || lead.format === null) {
    throw new RangeError("A trick must begin with an eligible lead play");
  }
  let winningPlay = lead;
  for (const play of plays.slice(1)) {
    if (beats(play, winningPlay, trump)) winningPlay = play;
  }
  return {
    winnerSeat: winningPlay.seat,
    points: sumCardPoints(plays.flatMap(({ cards }) => cards)),
    winningPlay,
  };
}
