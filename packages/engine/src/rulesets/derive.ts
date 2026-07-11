import { CARDS_PER_DECK } from "../types.js";
import type { ShengJiRuleset } from "./schema.js";

export { CARDS_PER_DECK };

type Decks = ShengJiRuleset["decks"];
type ScoringThreshold = ShengJiRuleset["scoring"]["thresholds"][number];

/** Largest bottom considered "sane"; larger kitties give the declarer too much. */
const MAX_SANE_BOTTOM_MULTIPLE = 2;

export function totalCards(decks: Decks): number {
  return decks.count * (CARDS_PER_DECK + (decks.includeJokers ? 2 : 0));
}

/** All sizes s where dealt = total − s > 0 divides evenly among players, s in a sane range. */
export function validBottomSizes(players: number, decks: Decks): number[] {
  const total = totalCards(decks);
  const maxBottom = Math.min(total - players, MAX_SANE_BOTTOM_MULTIPLE * players);
  const sizes: number[] = [];
  for (let size = 1; size <= maxBottom; size += 1) {
    const dealt = total - size;
    if (dealt > 0 && dealt % players === 0) sizes.push(size);
  }
  return sizes;
}

/** Smallest valid size >= 6 (falls back to the largest valid size if none qualify). */
export function defaultBottomSize(players: number, decks: Decks): number {
  const sizes = validBottomSizes(players, decks);
  const preferred = sizes.find((size) => size >= 6);
  const chosen = preferred ?? sizes.at(-1);
  if (chosen === undefined) {
    throw new Error(`No valid bottom size for ${players} players`);
  }
  return chosen;
}

/**
 * band = 20 × decks; contiguous defender bands below `2 × band`, attacker bands
 * above. Reproduces the 4p/2d (band 40) and 6p/3d (band 60) presets exactly.
 */
export function defaultThresholds(deckCount: number): ScoringThreshold[] {
  const band = 20 * deckCount;
  return [
    { maxExclusive: 1, winner: "defenders", levelDelta: 3 },
    { min: 1, maxExclusive: band, winner: "defenders", levelDelta: 2 },
    { min: band, maxExclusive: 2 * band, winner: "defenders", levelDelta: 1 },
    { min: 2 * band, maxExclusive: 3 * band, winner: "attackers", levelDelta: 0 },
    { min: 3 * band, maxExclusive: 4 * band, winner: "attackers", levelDelta: 1 },
    { min: 4 * band, maxExclusive: 5 * band, winner: "attackers", levelDelta: 2 },
    { min: 5 * band, winner: "attackers", levelDelta: 3 },
  ];
}

/** Alternating seats into two teams; even player counts only. */
export function defaultFixedTeams(players: number): number[][] {
  if (players % 2 !== 0) {
    throw new Error(`Fixed teams require an even player count, got ${players}`);
  }
  const teamA: number[] = [];
  const teamB: number[] = [];
  for (let seat = 0; seat < players; seat += 1) {
    (seat % 2 === 0 ? teamA : teamB).push(seat);
  }
  return [teamA, teamB];
}

/** floor(n/2) − 1: 5p→1, 6p→2, 7p→2, 8p→3. */
export function defaultFriendCallCount(players: number): number {
  return Math.floor(players / 2) - 1;
}
