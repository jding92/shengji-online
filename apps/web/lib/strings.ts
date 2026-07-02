/** User-facing team names; even seats are one team, odd seats the other. */
export const TEAM_LABELS = ["Gold", "Ember"] as const;

export function teamLabelForSeat(seat: number): (typeof TEAM_LABELS)[number] {
  return TEAM_LABELS[seat % 2]!;
}
