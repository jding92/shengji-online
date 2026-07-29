import {
  DEFAULT_PRESET_ID,
  editableOptionKeySet,
  getPreset,
  listPresets,
  OPTION_METADATA,
  RANKS,
  resolveRuleset,
  type GameOptions,
  type OptionEditability,
  type ResolveIssue,
  type ShengJiRuleset,
} from "@shengji/engine";
import type { PrivateGameView } from "@shengji/protocol";

type ViewRuleset = Omit<PrivateGameView["ruleset"], "options"> & {
  options?: GameOptions;
};
export type OptionsEditorValue = {
  presetId: string;
  options: GameOptions;
};

type PreviousRound = NonNullable<
  NonNullable<PrivateGameView["publicRound"]>["roundStats"]["previousRound"]
>;

/** Stable JSON for the small JSON-safe option bag sent by the server. */
export function canonicalStringify(value: unknown): string {
  function canonicalize(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(canonicalize);
    if (typeof input === "object" && input !== null) {
      const record = input as Record<string, unknown>;
      return Object.fromEntries(
        Object.keys(record)
          .filter((key) => record[key] !== undefined)
          .sort()
          .map((key) => [key, canonicalize(record[key])]),
      );
    }
    return input;
  }

  return JSON.stringify(canonicalize(value) ?? null);
}

/** The cache/signature key deliberately ignores object identity and absent `{}` noise. */
export function rulesetSignature(rs: ViewRuleset): string {
  return `${rs.presetId}:${canonicalStringify(rs.options ?? {})}`;
}

let lastRulesetKey: string | null = null;
let lastResolvedRuleset: ShengJiRuleset | null = null;

export function resolveViewRuleset(rs: ViewRuleset): ShengJiRuleset {
  const key = rulesetSignature(rs);
  if (lastRulesetKey === key && lastResolvedRuleset !== null) {
    return lastResolvedRuleset;
  }

  const resolved = resolveRuleset(rs.presetId, rs.options ?? {});
  if (resolved.ok) {
    lastRulesetKey = key;
    lastResolvedRuleset = resolved.ruleset;
    return resolved.ruleset;
  }

  console.warn("Could not resolve the view ruleset; using the bare preset", {
    presetId: rs.presetId,
    issues: resolved.issues,
  });
  const fallbackPresetId =
    getPreset(rs.presetId) === undefined ? DEFAULT_PRESET_ID : rs.presetId;
  const fallback = resolveRuleset(fallbackPresetId, {});
  const fallbackRuleset = fallback.ok
    ? fallback.ruleset
    : getPreset(DEFAULT_PRESET_ID)?.ruleset;
  if (fallbackRuleset === undefined) {
    throw new Error("The default Sheng Ji ruleset is unavailable");
  }

  lastRulesetKey = key;
  lastResolvedRuleset = fallbackRuleset;
  return fallbackRuleset;
}

export function describeRules(resolved: ShengJiRuleset, rs?: ViewRuleset): string[] {
  void rs;
  const ribbons = [
    `${resolved.players.count} PLAYERS · ${resolved.players.count}人`,
    `${resolved.decks.count} DECKS · ${resolved.decks.count}副牌`,
    resolved.teams.mode === "fixed"
      ? "FIXED TEAMS · 固定队"
      : "FINDING FRIENDS · 找朋友",
    `BOTTOM ${resolved.bottom.size} · 底牌 ${resolved.bottom.size}`,
  ];
  if (resolved.teams.mode === "finding-friends") {
    ribbons.push(
      `FRIEND CALLS ${resolved.teams.friends.callCount} · 叫朋友 ${resolved.teams.friends.callCount}`,
    );
  }
  if (resolved.id.endsWith("+custom")) ribbons.push("CUSTOM · 自定义");
  return ribbons;
}

export type OutcomeTeam = "defenders" | "attackers";

function fixedTeamIdForSeat(seat: number, ruleset: ShengJiRuleset): string | undefined {
  if (ruleset.teams.mode !== "fixed") return undefined;
  const teamIndex = ruleset.teams.teams.findIndex((team) => team.includes(seat));
  return teamIndex < 0 ? undefined : `team-${teamIndex}`;
}

function outcomeTeamForCurrentRound(
  view: PrivateGameView,
  resolved: ShengJiRuleset = resolveViewRuleset(view.ruleset),
): OutcomeTeam {
  const localTeamId = view.you.teamId;
  if (resolved.teams.mode === "finding-friends") {
    return localTeamId === "defenders" ? "defenders" : "attackers";
  }

  const defendingSeat =
    view.publicRound?.leaderSeat ?? view.publicRound?.currentBid?.seat;
  const defendingTeamId =
    defendingSeat === undefined
      ? undefined
      : fixedTeamIdForSeat(defendingSeat, resolved);
  const localFixedTeamId =
    localTeamId ??
    (view.you.seat === null ? undefined : fixedTeamIdForSeat(view.you.seat, resolved));
  return localFixedTeamId !== undefined && localFixedTeamId === defendingTeamId
    ? "defenders"
    : "attackers";
}

export function outcomeTeamForPreviousRound(
  view: PrivateGameView,
  previousRound: PreviousRound,
): OutcomeTeam {
  return view.you.seat !== null && previousRound.defenderSeats.includes(view.you.seat)
    ? "defenders"
    : "attackers";
}

/**
 * Returns the local side for either the currently scored round or a previous
 * round. The second argument may be a dense ruleset (current round) or the
 * previous-round summary (historical round); the object form is also useful to
 * callers that already have both values.
 */
export function outcomeTeamForRound(
  view: PrivateGameView,
  context?: ShengJiRuleset | PreviousRound,
): OutcomeTeam;
export function outcomeTeamForRound(input: {
  view: PrivateGameView;
  resolved?: ShengJiRuleset;
  previousRound?: PreviousRound;
}): OutcomeTeam;
export function outcomeTeamForRound(
  viewOrInput:
    | PrivateGameView
    | {
        view: PrivateGameView;
        resolved?: ShengJiRuleset;
        previousRound?: PreviousRound;
      },
  context?: ShengJiRuleset | PreviousRound,
): OutcomeTeam {
  if ("view" in viewOrInput) {
    if (viewOrInput.previousRound !== undefined) {
      return outcomeTeamForPreviousRound(viewOrInput.view, viewOrInput.previousRound);
    }
    return outcomeTeamForCurrentRound(viewOrInput.view, viewOrInput.resolved);
  }
  if (context !== undefined && "defenderSeats" in context) {
    return outcomeTeamForPreviousRound(viewOrInput, context);
  }
  return outcomeTeamForCurrentRound(viewOrInput, context);
}

export type OptionFieldKey =
  | "playerCount"
  | "deckCount"
  | "teamsMode"
  | "friendCallCount"
  | "bottomSize"
  | "startingRank"
  | "gameEndsOnSuccessfulDefenseAt"
  | "mustDefendRanks"
  | "scoring.bandSize"
  | "throwPenalty"
  | "allowNoTrumpJokerBid"
  | "minimumJokerBidCount"
  | "maxRedeals"
  | "timers.playTimeoutSeconds"
  | "timers.disconnectedTimeoutSeconds"
  | "timers.postDealWindowSeconds"
  | "timers.responseWindowSeconds";

export type OptionFieldControl =
  | "segmented-number"
  | "number"
  | "rank"
  | "rank-multi"
  | "toggle"
  | "pair";

export type OptionFieldGroup = "TABLE" | "CLIMB" | "SCORING" | "BIDDING" | "TIMERS";
export type OptionFieldTier = "primary" | "advanced";

export type OptionField = {
  key: OptionFieldKey;
  label: string;
  group: OptionFieldGroup;
  control: OptionFieldControl;
  metadataKey: OptionEditability["key"];
  tier: OptionFieldTier;
};

export const OPTION_FIELDS: readonly OptionField[] = [
  {
    key: "playerCount",
    label: "PLAYERS · 玩家数",
    group: "TABLE",
    control: "segmented-number",
    metadataKey: "playerCount",
    tier: "primary",
  },
  {
    key: "deckCount",
    label: "DECKS · 牌副数",
    group: "TABLE",
    control: "segmented-number",
    metadataKey: "deckCount",
    tier: "primary",
  },
  {
    key: "teamsMode",
    label: "TEAMS · 队伍模式",
    group: "TABLE",
    control: "segmented-number",
    metadataKey: "teamsMode",
    tier: "primary",
  },
  {
    key: "friendCallCount",
    label: "FRIEND CALLS · 叫朋友数",
    group: "TABLE",
    control: "number",
    metadataKey: "friendCallCount",
    tier: "primary",
  },
  {
    key: "bottomSize",
    label: "BOTTOM · 底牌数",
    group: "TABLE",
    control: "number",
    metadataKey: "bottomSize",
    tier: "advanced",
  },
  {
    key: "startingRank",
    label: "STARTING RANK · 起始级牌",
    group: "CLIMB",
    control: "rank",
    metadataKey: "startingRank",
    tier: "advanced",
  },
  {
    key: "gameEndsOnSuccessfulDefenseAt",
    label: "GAME END RANK · 终局级牌",
    group: "CLIMB",
    control: "rank",
    metadataKey: "gameEndsOnSuccessfulDefenseAt",
    tier: "advanced",
  },
  {
    key: "mustDefendRanks",
    label: "MUST-DEFEND RANKS · 必守级牌",
    group: "CLIMB",
    control: "rank-multi",
    metadataKey: "mustDefendRanks",
    tier: "advanced",
  },
  {
    key: "scoring.bandSize",
    label: "SCORING BAND · 计分档距",
    group: "SCORING",
    control: "number",
    metadataKey: "scoring",
    tier: "primary",
  },
  {
    key: "throwPenalty",
    label: "THROW PENALTY · 甩牌罚分",
    group: "SCORING",
    control: "pair",
    metadataKey: "throwPenalty",
    tier: "advanced",
  },
  {
    key: "allowNoTrumpJokerBid",
    label: "NO-TRUMP JOKER BID · 无主王牌叫牌",
    group: "BIDDING",
    control: "toggle",
    metadataKey: "allowNoTrumpJokerBid",
    tier: "advanced",
  },
  {
    key: "minimumJokerBidCount",
    label: "MIN JOKER BID · 最少王牌叫牌",
    group: "BIDDING",
    control: "number",
    metadataKey: "minimumJokerBidCount",
    tier: "advanced",
  },
  {
    key: "maxRedeals",
    label: "MAX REDEALS · 最多重发",
    group: "BIDDING",
    control: "number",
    metadataKey: "maxRedeals",
    tier: "advanced",
  },
  {
    key: "timers.playTimeoutSeconds",
    label: "PLAY TIMEOUT · 出牌时限",
    group: "TIMERS",
    control: "number",
    metadataKey: "timers.playTimeoutSeconds",
    tier: "primary",
  },
  {
    key: "timers.disconnectedTimeoutSeconds",
    label: "DISCONNECTED TIMEOUT · 离线时限",
    group: "TIMERS",
    control: "number",
    metadataKey: "timers.disconnectedTimeoutSeconds",
    tier: "primary",
  },
  {
    key: "timers.postDealWindowSeconds",
    label: "POST-DEAL WINDOW · 发牌后时限",
    group: "TIMERS",
    control: "number",
    metadataKey: "timers.postDealWindowSeconds",
    tier: "primary",
  },
  {
    key: "timers.responseWindowSeconds",
    label: "RESPONSE WINDOW · 响应时限",
    group: "TIMERS",
    control: "number",
    metadataKey: "timers.responseWindowSeconds",
    tier: "primary",
  },
];

export type IssueFieldKey = OptionFieldKey | "presetId";

/** Every resolver path that can be tied to an editable field, including indexed Zod paths. */
export const ISSUE_PATH_MAP: Readonly<Record<string, IssueFieldKey>> = {
  presetId: "presetId",
  options: "scoring.bandSize",
  playerCount: "playerCount",
  deckCount: "deckCount",
  teamsMode: "teamsMode",
  friendCallCount: "friendCallCount",
  bottomSize: "bottomSize",
  scoring: "scoring.bandSize",
  "scoring.bandSize": "scoring.bandSize",
  throwPenalty: "throwPenalty",
  "throwPenalty.defenderFailedThrow": "throwPenalty",
  "throwPenalty.attackerFailedThrow": "throwPenalty",
  "timers.playTimeoutSeconds": "timers.playTimeoutSeconds",
  "timers.disconnectedTimeoutSeconds": "timers.disconnectedTimeoutSeconds",
  "timers.postDealWindowSeconds": "timers.postDealWindowSeconds",
  "timers.responseWindowSeconds": "timers.responseWindowSeconds",
  "players.count": "playerCount",
  "decks.count": "deckCount",
  "teams.mode": "teamsMode",
  "teams.teams": "playerCount",
  "teams.friends.callCount": "friendCallCount",
  "ranks.sequence": "startingRank",
  "ranks.gameEndsOnSuccessfulDefenseAt": "gameEndsOnSuccessfulDefenseAt",
  "ranks.startingRank": "startingRank",
  "ranks.mustDefendRanks": "mustDefendRanks",
  "ranks.mustDefendRanks.*": "mustDefendRanks",
  "ranks.*": "startingRank",
  "bidding.postDealWindowSeconds": "timers.postDealWindowSeconds",
  "bidding.responseWindowSeconds": "timers.responseWindowSeconds",
  "bidding.allowNoTrumpJokerBid": "allowNoTrumpJokerBid",
  "bidding.minimumJokerBidCount": "minimumJokerBidCount",
  "bidding.maxRedeals": "maxRedeals",
  "bidding.tiers": "minimumJokerBidCount",
  "bidding.duringDeal": "timers.postDealWindowSeconds",
  "bidding.sameTierCounterbidAllowed": "allowNoTrumpJokerBid",
  "bidding.samePlayerReinforceAllowed": "allowNoTrumpJokerBid",
  "bidding.strengthOrder": "minimumJokerBidCount",
  "bidding.noBidFallback": "maxRedeals",
  "bidding.declareRankSource": "teamsMode",
  "bidding.*": "maxRedeals",
  "bottom.size": "bottomSize",
  "bottom.lastTrickMultiplier.perCard": "bottomSize",
  "turns.playTimeoutSeconds": "timers.playTimeoutSeconds",
  "turns.disconnectedTimeoutSeconds": "timers.disconnectedTimeoutSeconds",
  "throws.failedThrowAttackerPointDelta": "throwPenalty",
  "throws.failedThrowAttackerPointDelta.defenderFailedThrow": "throwPenalty",
  "throws.failedThrowAttackerPointDelta.attackerFailedThrow": "throwPenalty",
  "throws.enabled": "throwPenalty",
  "throws.failedThrowResolution": "throwPenalty",
  "throws.*": "throwPenalty",
  "turns.*": "timers.playTimeoutSeconds",
  "scoring.model": "scoring.bandSize",
  "scoring.*": "scoring.bandSize",
  "scoring.thresholds": "scoring.bandSize",
  "scoring.thresholds.*.min": "scoring.bandSize",
  "scoring.thresholds.*.maxExclusive": "scoring.bandSize",
  "scoring.thresholds.*.winner": "scoring.bandSize",
  "scoring.thresholds.*.levelDelta": "scoring.bandSize",
  "roundFlow.laterRoundLeader": "teamsMode",
};

function normalizedIssuePath(path: string): string {
  return path
    .split(".")
    .map((segment) => (/^\d+$/.test(segment) ? "*" : segment))
    .join(".");
}

export type MappedIssues = {
  byField: Partial<Record<IssueFieldKey, ResolveIssue[]>>;
  /** Aliases keep the result pleasant for both form code and tests. */
  fields: Partial<Record<IssueFieldKey, ResolveIssue[]>>;
  fieldIssues: Partial<Record<IssueFieldKey, ResolveIssue[]>>;
  unmapped: ResolveIssue[];
};

export function mapIssuesToFields(issues: readonly ResolveIssue[]): MappedIssues {
  const byField: Partial<Record<IssueFieldKey, ResolveIssue[]>> = {};
  const unmapped: ResolveIssue[] = [];
  for (const issue of issues) {
    const field =
      ISSUE_PATH_MAP[issue.path] ??
      ISSUE_PATH_MAP[normalizedIssuePath(issue.path)] ??
      ISSUE_PATH_MAP[`${issue.path.split(".")[0] ?? ""}.*`];
    if (field === undefined) {
      unmapped.push(issue);
      continue;
    }
    byField[field] = [...(byField[field] ?? []), issue];

    // These structural errors can be caused by switching the teams mode as
    // well as by the field named in the schema path. Keep both controls
    // visibly actionable when the resolver has only one path to report.
    if (
      (issue.path === "players.count" &&
        issue.message.toLowerCase().includes("finding friends")) ||
      (issue.path === "teams.friends.callCount" &&
        issue.message.toLowerCase().includes("friend"))
    ) {
      byField.teamsMode = [...(byField.teamsMode ?? []), issue];
    }
    if (issue.path === "options") {
      for (const ambiguousField of [
        "playerCount",
        "deckCount",
        "scoring.bandSize",
        "teamsMode",
      ] as const) {
        if (ambiguousField === field) continue;
        byField[ambiguousField] = [...(byField[ambiguousField] ?? []), issue];
      }
    }
  }
  return { byField, fields: byField, fieldIssues: byField, unmapped };
}

export function hasOptionOverride(bag: GameOptions, key: OptionFieldKey): boolean {
  if (key.startsWith("timers.")) {
    const timerKey = key.slice("timers.".length) as keyof NonNullable<
      GameOptions["timers"]
    >;
    return bag.timers?.[timerKey] !== undefined;
  }
  if (key === "scoring.bandSize") return bag.scoring?.bandSize !== undefined;
  return Object.prototype.hasOwnProperty.call(bag, key);
}

export function setOption(
  bag: GameOptions,
  key: OptionFieldKey,
  value: unknown,
): GameOptions {
  const next = { ...bag };
  if (key.startsWith("timers.")) {
    const timerKey = key.slice("timers.".length) as keyof NonNullable<
      GameOptions["timers"]
    >;
    next.timers = { ...(bag.timers ?? {}), [timerKey]: value as number };
    return next;
  }
  if (key === "scoring.bandSize") {
    next.scoring = { ...(bag.scoring ?? {}), bandSize: value as number };
    return next;
  }
  (next as Record<string, unknown>)[key] = value;
  return next;
}

export function clearOption(bag: GameOptions, key: OptionFieldKey): GameOptions {
  const next = { ...bag };
  if (key.startsWith("timers.")) {
    const timerKey = key.slice("timers.".length) as keyof NonNullable<
      GameOptions["timers"]
    >;
    const timers = { ...(bag.timers ?? {}) };
    delete timers[timerKey];
    if (Object.keys(timers).length === 0) delete next.timers;
    else next.timers = timers;
    return next;
  }
  if (key === "scoring.bandSize") {
    const scoring = { ...(bag.scoring ?? {}) };
    delete scoring.bandSize;
    if (Object.keys(scoring).length === 0) delete next.scoring;
    else next.scoring = scoring;
    return next;
  }
  delete (next as Partial<Record<OptionFieldKey, unknown>>)[key];
  return next;
}

export function adjustedPlayerCountForMode(
  mode: "fixed" | "finding-friends",
  players: number,
  minimumPlayers: number,
): number {
  let adjusted = mode === "fixed" && players % 2 !== 0 ? players + 1 : players;
  if (mode === "finding-friends" && adjusted < 5) adjusted = 5;
  if (adjusted < minimumPlayers) adjusted = minimumPlayers;
  if (mode === "fixed" && adjusted % 2 !== 0) adjusted += 1;
  if (mode === "finding-friends" && adjusted < 5) adjusted = 5;
  return Math.min(8, Math.max(4, adjusted));
}

export function snapToBestPreset(value: OptionsEditorValue): OptionsEditorValue {
  const base = getPreset(value.presetId) ?? getPreset(DEFAULT_PRESET_ID);
  if (base === undefined) return value;

  const players = value.options.playerCount ?? base.ruleset.players.count;
  const decks = value.options.deckCount ?? base.ruleset.decks.count;
  const mode = value.options.teamsMode ?? base.ruleset.teams.mode;
  const deckPinned = hasOptionOverride(value.options, "deckCount");
  const candidates = listPresets().filter(
    (entry) =>
      entry.ruleset.teams.mode === mode && entry.ruleset.players.count === players,
  );
  if (candidates.length === 0) return value;

  const firstCandidate = candidates[0];
  if (firstCandidate === undefined) return value;
  let chosen = firstCandidate;
  for (const candidate of candidates.slice(1)) {
    if (
      Math.abs(candidate.ruleset.decks.count - decks) <
      Math.abs(chosen.ruleset.decks.count - decks)
    ) {
      chosen = candidate;
    }
  }

  let options = value.options;
  options =
    players === chosen.ruleset.players.count
      ? clearOption(options, "playerCount")
      : setOption(options, "playerCount", players);
  options =
    mode === chosen.ruleset.teams.mode
      ? clearOption(options, "teamsMode")
      : setOption(options, "teamsMode", mode);
  if (deckPinned) {
    options =
      decks === chosen.ruleset.decks.count
        ? clearOption(options, "deckCount")
        : setOption(options, "deckCount", decks);
  } else {
    options = clearOption(options, "deckCount");
  }
  if (mode === "fixed") options = clearOption(options, "friendCallCount");

  return { presetId: chosen.id, options };
}

export function effectiveValue(resolved: ShengJiRuleset, key: OptionFieldKey): unknown {
  switch (key) {
    case "playerCount":
      return resolved.players.count;
    case "deckCount":
      return resolved.decks.count;
    case "teamsMode":
      return resolved.teams.mode;
    case "friendCallCount":
      return resolved.teams.mode === "finding-friends"
        ? resolved.teams.friends.callCount
        : undefined;
    case "bottomSize":
      return resolved.bottom.size;
    case "startingRank":
      return resolved.ranks.startingRank ?? resolved.ranks.sequence[0];
    case "gameEndsOnSuccessfulDefenseAt":
      return resolved.ranks.gameEndsOnSuccessfulDefenseAt;
    case "mustDefendRanks":
      return resolved.ranks.mustDefendRanks;
    case "scoring.bandSize":
      return (
        resolved.scoring.thresholds[1]?.maxExclusive ??
        resolved.scoring.thresholds[2]?.min
      );
    case "throwPenalty":
      return resolved.throws.failedThrowAttackerPointDelta;
    case "allowNoTrumpJokerBid":
      return resolved.bidding.allowNoTrumpJokerBid;
    case "minimumJokerBidCount":
      return resolved.bidding.minimumJokerBidCount;
    case "maxRedeals":
      return resolved.bidding.maxRedeals;
    case "timers.playTimeoutSeconds":
      return resolved.turns.playTimeoutSeconds;
    case "timers.disconnectedTimeoutSeconds":
      return resolved.turns.disconnectedTimeoutSeconds;
    case "timers.postDealWindowSeconds":
      return resolved.bidding.postDealWindowSeconds;
    case "timers.responseWindowSeconds":
      return resolved.bidding.responseWindowSeconds;
  }
}

export { OPTION_METADATA, RANKS, editableOptionKeySet };
