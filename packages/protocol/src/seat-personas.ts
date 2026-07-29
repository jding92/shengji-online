/** Mythic persona names, indexed by physical seat, matching the web app's
 * seat-portrait roster (apps/web/lib/seat-portraits.ts). Bots seated at a
 * seat take its persona name. */
export const SEAT_PERSONA_NAMES = [
  "Hades",
  "Persephone",
  "Poseidon",
  "Athena",
  "Thor",
  "Freyja",
  "Anubis",
  "Chang'e",
] as const;

export function personaNameForSeat(seat: number): string {
  const rosterIndex =
    ((seat % SEAT_PERSONA_NAMES.length) + SEAT_PERSONA_NAMES.length) %
    SEAT_PERSONA_NAMES.length;
  return SEAT_PERSONA_NAMES[rosterIndex]!;
}
