import { ART, art2x } from "./art";

/**
 * V1 table portraits are deliberately assigned to physical seats, not player
 * accounts. This keeps private rooms and practice bots visually consistent
 * without introducing a profile or character-selection system.
 */
export const SEAT_PORTRAIT_IDS = [
  "hadesKingYan",
  "persephonePlumBlossom",
  "poseidonDragonKing",
  "athenaGrandStrategist",
] as const;

export type SeatPortraitId = (typeof SEAT_PORTRAIT_IDS)[number];

export function portraitForSeat(seat: number): {
  id: SeatPortraitId;
  src: string;
  src2x: string;
} {
  const id = SEAT_PORTRAIT_IDS[seat % SEAT_PORTRAIT_IDS.length]!;
  return { id, src: ART.avatars[id], src2x: art2x(ART.avatars[id]) };
}
