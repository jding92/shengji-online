/**
 * User-facing team names; even seats are one team, odd seats the other.
 * Named after the seat-plaque border colors so the labels and the visual
 * coding reinforce each other.
 */
export const TEAM_LABELS = ["Blue", "Red"] as const;

export function teamLabelForSeat(seat: number): (typeof TEAM_LABELS)[number] {
  return TEAM_LABELS[seat % 2]!;
}

/** CSS modifier for a seat's team, used for the plaque border color. */
export function teamClassForSeat(seat: number): "team-blue" | "team-red" {
  return seat % 2 === 0 ? "team-blue" : "team-red";
}
