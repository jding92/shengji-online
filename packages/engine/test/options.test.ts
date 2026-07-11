import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRESET_ID,
  defaultBottomSize,
  defaultFixedTeams,
  defaultThresholds,
  getPreset,
  resolveRuleset,
  thresholdsForBand,
} from "../src/index.js";

const threeDecks = { count: 3, includeJokers: true };

describe("resolveRuleset", () => {
  it("returns the preset unchanged for empty options, id preserved", () => {
    const result = resolveRuleset(DEFAULT_PRESET_ID, {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.ruleset.id).toBe(DEFAULT_PRESET_ID);
    expect(result.ruleset).toEqual(getPreset(DEFAULT_PRESET_ID)!.ruleset);
  });

  it("re-derives teams, bottom, and thresholds when player/deck counts change", () => {
    const result = resolveRuleset(DEFAULT_PRESET_ID, { playerCount: 6, deckCount: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.ruleset.players.count).toBe(6);
    expect(result.ruleset.decks.count).toBe(3);
    expect(result.ruleset.teams.teams).toEqual(defaultFixedTeams(6));
    expect(result.ruleset.bottom.size).toBe(defaultBottomSize(6, threeDecks));
    expect(result.ruleset.scoring.thresholds).toEqual(defaultThresholds(3));
    // Any override tags the id custom while keeping the preset name.
    expect(result.ruleset.id).toBe(`${DEFAULT_PRESET_ID}+custom`);
    expect(result.ruleset.name).toBe(getPreset(DEFAULT_PRESET_ID)!.ruleset.name);
  });

  it("respects a pinned bottom size instead of re-deriving it", () => {
    const result = resolveRuleset(DEFAULT_PRESET_ID, { deckCount: 3, bottomSize: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.ruleset.bottom.size).toBe(2);
  });

  it("regenerates the scoring ladder from an explicit band size", () => {
    const result = resolveRuleset(DEFAULT_PRESET_ID, { scoring: { bandSize: 50 } });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.ruleset.scoring.thresholds).toEqual(thresholdsForBand(50));
  });

  it("surfaces zod issues for an invalid deal shape", () => {
    const result = resolveRuleset(DEFAULT_PRESET_ID, { bottomSize: 5 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.issues).toContainEqual({
      path: "bottom.size",
      message: "Cards remaining after the bottom must divide evenly among players",
    });
  });

  it("rejects finding-friends until it ships", () => {
    for (const options of [
      { teamsMode: "finding-friends" as const },
      { friendCallCount: 2 },
    ]) {
      const result = resolveRuleset(DEFAULT_PRESET_ID, options);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected failure");
      expect(result.issues[0]?.message).toBe("finding-friends is not yet available");
    }
  });

  it("rejects an unknown preset id", () => {
    const result = resolveRuleset("does-not-exist", {});
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.issues[0]?.path).toBe("presetId");
  });

  it("keeps the preset id when nothing is overridden but tags custom otherwise", () => {
    expect(resolveRuleset(DEFAULT_PRESET_ID, {}).ok).toBe(true);
    const custom = resolveRuleset(DEFAULT_PRESET_ID, { maxRedeals: 4 });
    expect(custom.ok).toBe(true);
    if (!custom.ok) throw new Error("expected ok");
    expect(custom.ruleset.id).toBe(`${DEFAULT_PRESET_ID}+custom`);
    expect(custom.ruleset.bidding.maxRedeals).toBe(4);
  });
});
