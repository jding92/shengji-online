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
    expect(result.ruleset.teams).toEqual({
      mode: "fixed",
      teams: defaultFixedTeams(6),
    });
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

  it("composes finding-friends from a fixed preset, forcing the FF strategies", () => {
    const result = resolveRuleset(DEFAULT_PRESET_ID, {
      teamsMode: "finding-friends",
      playerCount: 5,
      deckCount: 2,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.ruleset.teams).toEqual({
      mode: "finding-friends",
      friends: { callCount: 1, callableCards: "any-non-trump", allowOwnCardCall: true },
    });
    expect(result.ruleset.roundFlow.laterRoundLeader).toBe("rebid-each-round");
    expect(result.ruleset.bidding.declareRankSource).toBe("bidder-own-rank");
    expect(result.ruleset.id).toBe(`${DEFAULT_PRESET_ID}+custom`);
  });

  it("pins an explicit friend call count within the schema cap", () => {
    const pinned = resolveRuleset(DEFAULT_PRESET_ID, {
      teamsMode: "finding-friends",
      playerCount: 8,
      friendCallCount: 2,
    });
    expect(pinned.ok).toBe(true);
    if (!pinned.ok) throw new Error("expected ok");
    expect(pinned.ruleset.teams).toMatchObject({
      mode: "finding-friends",
      friends: { callCount: 2 },
    });

    const overCap = resolveRuleset(DEFAULT_PRESET_ID, {
      teamsMode: "finding-friends",
      playerCount: 5,
      friendCallCount: 2,
    });
    expect(overCap.ok).toBe(false);
    if (overCap.ok) throw new Error("expected failure");
    expect(overCap.issues[0]?.path).toBe("teams.friends.callCount");
  });

  it("rejects finding-friends below five players", () => {
    const result = resolveRuleset(DEFAULT_PRESET_ID, {
      teamsMode: "finding-friends",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.issues[0]?.path).toBe("players.count");
  });

  it("rejects friendCallCount for fixed-team compositions", () => {
    const result = resolveRuleset(DEFAULT_PRESET_ID, { friendCallCount: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.issues[0]?.path).toBe("friendCallCount");
  });

  it("switches an FF preset back to fixed teams with classic strategies", () => {
    const result = resolveRuleset("shengji-ff-6p-3d-v1", { teamsMode: "fixed" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.ruleset.teams).toEqual({
      mode: "fixed",
      teams: defaultFixedTeams(6),
    });
    expect(result.ruleset.roundFlow.laterRoundLeader).toBe("round-progression");
    expect(result.ruleset.bidding.declareRankSource).toBe("round-rank");
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
