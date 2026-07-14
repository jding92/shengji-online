/** User-facing names for the two fixed teams. */
export const TEAM_LABELS = ["Blue", "Red"] as const;

type FixedTeamIndex = 0 | 1;

function fixedTeamIndex(teamId: string | undefined): FixedTeamIndex | null {
  if (teamId === "team-0") return 0;
  if (teamId === "team-1") return 1;
  return null;
}

/** Returns a fixed-team label, or null when membership is not public. */
export function teamLabelForTeamId(
  teamId: string | undefined,
): (typeof TEAM_LABELS)[number] | null {
  const index = fixedTeamIndex(teamId);
  return index === null ? null : TEAM_LABELS[index];
}

/** CSS modifier for a public team, with a neutral treatment for unknown sides. */
export function teamClassForTeamId(
  teamId: string | undefined,
): "team-blue" | "team-red" | "team-neutral" {
  const index = fixedTeamIndex(teamId);
  return index === 0 ? "team-blue" : index === 1 ? "team-red" : "team-neutral";
}
