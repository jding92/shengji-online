import { DEFAULT_PRESET_ID, resolveRuleset, type GameOptions } from "@shengji/engine";
import type { PrivateGameView } from "@shengji/protocol";
import { describe, expect, test } from "vitest";
import {
  canonicalStringify,
  clearOption,
  adjustedPlayerCountForMode,
  describeRules,
  effectiveValue,
  mapIssuesToFields,
  OPTION_FIELDS,
  outcomeTeamForRound,
  resolveViewRuleset,
  rulesetSignature,
  setOption,
  snapToBestPreset,
  type OptionFieldKey,
} from "./rules";

function view(
  presetId = DEFAULT_PRESET_ID,
  options: GameOptions = {},
  overrides: Partial<PrivateGameView> = {},
): PrivateGameView {
  const resolved = resolveRuleset(presetId, options);
  if (!resolved.ok) throw new Error(resolved.issues[0]?.message ?? "Invalid fixture");
  return {
    roomId: "ABC123",
    revision: 1,
    hostPlayerId: "p0",
    joinedPlayerCount: resolved.ruleset.players.count,
    ruleset: {
      id: resolved.ruleset.id,
      name: resolved.ruleset.name,
      players: resolved.ruleset.players.count,
      decks: resolved.ruleset.decks.count,
      bottomSize: resolved.ruleset.bottom.size,
      presetId,
      teamsMode: resolved.ruleset.teams.mode,
      options,
    },
    phase: "round-scoring",
    you: { playerId: "p0", seat: 0, hand: [] },
    seats: [],
    publicRound: {
      roundNumber: 1,
      trumpRank: "2",
      leaderSeat: 0,
      attackerPoints: 0,
      throwPenaltyAdjustment: 0,
      cardCountsBySeat: {},
      completedTricksSummary: [],
      roundStats: { roundsWonByTeam: {} },
      bottomCount: resolved.ruleset.bottom.size,
      buriedBottomCount: resolved.ruleset.bottom.size,
      outcome: { attackerPoints: 0, winner: "defenders", levelDelta: 0 },
    },
    legalActions: [],
    ...overrides,
  };
}

describe("rules helpers", () => {
  test("assigns the primary and advanced tiers to every option field", () => {
    const primary = [
      "teamsMode",
      "playerCount",
      "deckCount",
      "friendCallCount",
      "scoring.bandSize",
      "timers.playTimeoutSeconds",
      "timers.disconnectedTimeoutSeconds",
      "timers.postDealWindowSeconds",
      "timers.responseWindowSeconds",
    ];
    const advanced = [
      "bottomSize",
      "startingRank",
      "gameEndsOnSuccessfulDefenseAt",
      "mustDefendRanks",
      "throwPenalty",
      "allowNoTrumpJokerBid",
      "minimumJokerBidCount",
      "maxRedeals",
    ];

    expect(OPTION_FIELDS).toHaveLength(17);
    expect(OPTION_FIELDS.map((field) => [field.key, field.tier])).toEqual([
      ["playerCount", "primary"],
      ["deckCount", "primary"],
      ["teamsMode", "primary"],
      ["friendCallCount", "primary"],
      ["bottomSize", "advanced"],
      ["startingRank", "advanced"],
      ["gameEndsOnSuccessfulDefenseAt", "advanced"],
      ["mustDefendRanks", "advanced"],
      ["scoring.bandSize", "primary"],
      ["throwPenalty", "advanced"],
      ["allowNoTrumpJokerBid", "advanced"],
      ["minimumJokerBidCount", "advanced"],
      ["maxRedeals", "advanced"],
      ["timers.playTimeoutSeconds", "primary"],
      ["timers.disconnectedTimeoutSeconds", "primary"],
      ["timers.postDealWindowSeconds", "primary"],
      ["timers.responseWindowSeconds", "primary"],
    ]);
    expect(
      OPTION_FIELDS.filter((field) => field.tier === "primary")
        .map((field) => field.key)
        .sort(),
    ).toEqual([...primary].sort());
    expect(
      OPTION_FIELDS.filter((field) => field.tier === "advanced")
        .map((field) => field.key)
        .sort(),
    ).toEqual([...advanced].sort());
  });

  test("adjusts player counts to the selected team mode and occupancy", () => {
    expect(adjustedPlayerCountForMode("fixed", 5, 0)).toBe(6);
    expect(adjustedPlayerCountForMode("fixed", 7, 0)).toBe(8);
    expect(adjustedPlayerCountForMode("finding-friends", 4, 0)).toBe(5);
    expect(adjustedPlayerCountForMode("fixed", 5, 7)).toBe(8);
    expect(adjustedPlayerCountForMode("finding-friends", 6, 0)).toBe(6);
    expect(adjustedPlayerCountForMode("fixed", 4, 99)).toBe(8);
  });

  test("snaps identity options to the closest production preset", () => {
    expect(
      snapToBestPreset({ presetId: DEFAULT_PRESET_ID, options: { playerCount: 6 } }),
    ).toEqual({ presetId: "shengji-6p-3d-fixed-v1", options: {} });
    expect(
      snapToBestPreset({
        presetId: DEFAULT_PRESET_ID,
        options: { teamsMode: "finding-friends", playerCount: 5 },
      }),
    ).toEqual({ presetId: "shengji-ff-5p-2d-v1", options: {} });
    expect(
      snapToBestPreset({ presetId: DEFAULT_PRESET_ID, options: { deckCount: 4 } }),
    ).toEqual({
      presetId: "shengji-4p-3d-fixed-v1",
      options: { deckCount: 4 },
    });
    expect(
      snapToBestPreset({
        presetId: "shengji-6p-3d-fixed-v1",
        options: { playerCount: 4 },
      }),
    ).toEqual({ presetId: "shengji-4p-3d-fixed-v1", options: {} });
  });

  test("removes fixed-mode friend calls and preserves non-identity overrides", () => {
    const switched = snapToBestPreset({
      presetId: "shengji-ff-6p-3d-v1",
      options: { teamsMode: "fixed", friendCallCount: 2 },
    });
    expect(switched).toEqual({
      presetId: "shengji-6p-3d-fixed-v1",
      options: {},
    });
    expect(resolveRuleset(switched.presetId, switched.options).ok).toBe(true);

    let options: GameOptions = { playerCount: 6 };
    options = setOption(options, "scoring.bandSize", 25);
    options = setOption(options, "timers.playTimeoutSeconds", 45);
    expect(snapToBestPreset({ presetId: DEFAULT_PRESET_ID, options })).toEqual({
      presetId: "shengji-6p-3d-fixed-v1",
      options: {
        scoring: { bandSize: 25 },
        timers: { playTimeoutSeconds: 45 },
      },
    });
  });

  test("canonicalizes key order and treats absent options like an empty bag", () => {
    expect(canonicalStringify({ b: 2, a: { d: 4, c: 3 } })).toBe(
      '{"a":{"c":3,"d":4},"b":2}',
    );
    const withoutOptions = { ...view().ruleset };
    Reflect.deleteProperty(withoutOptions, "options");
    expect(rulesetSignature({ ...view().ruleset, options: {} })).toBe(
      rulesetSignature(withoutOptions),
    );
    expect(
      rulesetSignature({
        ...view().ruleset,
        options: { timers: { playTimeoutSeconds: 60 } },
      }),
    ).toBe(
      rulesetSignature({
        ...view().ruleset,
        options: { timers: { playTimeoutSeconds: 60 } },
      }),
    );
    const first = resolveViewRuleset({ ...view().ruleset, options: { deckCount: 2 } });
    const second = resolveViewRuleset({ ...view().ruleset, options: { deckCount: 2 } });
    expect(first).toBe(second);
  });

  test("describes fixed, finding-friends, and custom rules", () => {
    const fixed = resolveViewRuleset(view().ruleset);
    expect(describeRules(fixed, view().ruleset)).toEqual([
      "4 PLAYERS · 4人",
      "2 DECKS · 2副牌",
      "FIXED TEAMS · 固定队",
      "BOTTOM 8 · 底牌 8",
    ]);

    const ffView = view("shengji-ff-5p-2d-v1");
    expect(describeRules(resolveViewRuleset(ffView.ruleset), ffView.ruleset)).toContain(
      "FINDING FRIENDS · 找朋友",
    );
    expect(describeRules(resolveViewRuleset(ffView.ruleset), ffView.ruleset)).toContain(
      "FRIEND CALLS 1 · 叫朋友 1",
    );

    const custom = view(DEFAULT_PRESET_ID, { playerCount: 6, deckCount: 3 });
    expect(describeRules(resolveViewRuleset(custom.ruleset), custom.ruleset)).toContain(
      "CUSTOM · 自定义",
    );
  });

  test("identifies the local side for current and previous scored rounds", () => {
    const fixed = view();
    expect(outcomeTeamForRound(fixed)).toBe("defenders");
    expect(
      outcomeTeamForRound({
        ...fixed,
        you: { ...fixed.you, seat: 1, teamId: "team-1" },
      }),
    ).toBe("attackers");

    const ff = view("shengji-ff-5p-2d-v1");
    expect(
      outcomeTeamForRound({ ...ff, you: { ...ff.you, teamId: "defenders" } }),
    ).toBe("defenders");
    expect(outcomeTeamForRound(ff)).toBe("attackers");

    const previousRound = {
      roundNumber: 1,
      winningTeamId: "defenders" as const,
      winner: "defenders" as const,
      attackerPoints: 0,
      levelDelta: 1,
      defenderSeats: [1, 3],
    };
    expect(outcomeTeamForRound(fixed, previousRound)).toBe("attackers");
    expect(
      outcomeTeamForRound(
        {
          ...fixed,
          you: { ...fixed.you, seat: 1 },
        },
        previousRound,
      ),
    ).toBe("defenders");
  });

  test("maps every editable field's resolver path to that field", () => {
    const invalid: Partial<Record<OptionFieldKey, GameOptions>> = {
      playerCount: { playerCount: 0 },
      deckCount: { deckCount: 0 },
      teamsMode: { teamsMode: "finding-friends" },
      friendCallCount: { friendCallCount: 0, teamsMode: "finding-friends" },
      bottomSize: { bottomSize: -1 },
      startingRank: { startingRank: "not-a-rank" as never },
      gameEndsOnSuccessfulDefenseAt: {
        gameEndsOnSuccessfulDefenseAt: "not-a-rank" as never,
      },
      mustDefendRanks: { mustDefendRanks: ["not-a-rank" as never] },
      "scoring.bandSize": { scoring: { bandSize: 0 } },
      throwPenalty: {
        throwPenalty: { defenderFailedThrow: "bad" as never, attackerFailedThrow: 0 },
      },
      allowNoTrumpJokerBid: { allowNoTrumpJokerBid: "bad" as never },
      minimumJokerBidCount: { minimumJokerBidCount: 0 },
      maxRedeals: { maxRedeals: -1 },
      "timers.playTimeoutSeconds": { timers: { playTimeoutSeconds: 0 } },
      "timers.disconnectedTimeoutSeconds": {
        timers: { disconnectedTimeoutSeconds: 0 },
      },
      "timers.postDealWindowSeconds": { timers: { postDealWindowSeconds: 0 } },
      "timers.responseWindowSeconds": { timers: { responseWindowSeconds: 0 } },
    };

    for (const field of OPTION_FIELDS) {
      const options = invalid[field.key];
      expect(options, `missing invalid fixture for ${field.key}`).toBeDefined();
      const result = resolveRuleset(
        field.key === "friendCallCount" ? "shengji-ff-5p-2d-v1" : DEFAULT_PRESET_ID,
        options ?? {},
      );
      expect(result.ok, `expected ${field.key} to be rejected`).toBe(false);
      if (result.ok) continue;
      const mapped = mapIssuesToFields(result.issues);
      expect(mapped.byField[field.key], field.key).toBeDefined();
    }
  });

  test("keeps sparse bags sparse and re-derives dependent values", () => {
    let options: GameOptions = {};
    options = setOption(options, "playerCount", 6);
    expect(options).toEqual({ playerCount: 6 });
    const resolved = resolveViewRuleset(view(DEFAULT_PRESET_ID, options).ruleset);
    expect(resolved.bottom.size).not.toBe(8);
    expect(effectiveValue(resolved, "bottomSize")).toBe(resolved.bottom.size);

    options = setOption(options, "timers.playTimeoutSeconds", 45);
    expect(options).toEqual({
      playerCount: 6,
      timers: { playTimeoutSeconds: 45 },
    });
    options = clearOption(options, "timers.playTimeoutSeconds");
    expect(options).toEqual({ playerCount: 6 });
    expect(clearOption({}, "timers.playTimeoutSeconds")).toEqual({});
  });
});
