import { describe, expect, test } from "vitest";
import { teamClassForTeamId, teamLabelForTeamId } from "./strings";

describe("team display helpers", () => {
  test("maps fixed team IDs without relying on seat parity", () => {
    expect(teamLabelForTeamId("team-0")).toBe("Blue");
    expect(teamLabelForTeamId("team-1")).toBe("Red");
    expect(teamClassForTeamId("team-0")).toBe("team-blue");
    expect(teamClassForTeamId("team-1")).toBe("team-red");
  });

  test("keeps hidden or non-fixed membership neutral", () => {
    expect(teamLabelForTeamId(undefined)).toBeNull();
    expect(teamLabelForTeamId("defenders")).toBeNull();
    expect(teamClassForTeamId(undefined)).toBe("team-neutral");
    expect(teamClassForTeamId("defenders")).toBe("team-red");
    expect(teamClassForTeamId("attackers")).toBe("team-neutral");
  });
});
