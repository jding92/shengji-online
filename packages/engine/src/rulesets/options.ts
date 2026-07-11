import { z } from "zod";
import { RANKS } from "../types.js";
import {
  defaultBottomSize,
  defaultFixedTeams,
  defaultThresholds,
  thresholdsForBand,
} from "./derive.js";
import { getPreset } from "./registry.js";
import { shengJiRulesetSchema, type ShengJiRuleset } from "./schema.js";

/**
 * Sparse, user-facing house-rule overrides. Every field is optional; the
 * absent fields inherit from the chosen preset. `resolveRuleset` is the only
 * composer that turns this bag plus a preset id into a dense `ShengJiRuleset`.
 */
export const gameOptionsSchema = z.object({
  playerCount: z.number().int().min(4).max(12).optional(),
  deckCount: z.number().int().positive().optional(),
  teamsMode: z.enum(["fixed", "finding-friends"]).optional(),
  /** Finding-friends only; validated in Phase 3. */
  friendCallCount: z.number().int().positive().optional(),
  bottomSize: z.number().int().nonnegative().optional(),
  startingRank: z.enum(RANKS).optional(),
  gameEndsOnSuccessfulDefenseAt: z.enum(RANKS).optional(),
  mustDefendRanks: z.array(z.enum(RANKS)).optional(),
  /** `bandSize` regenerates the whole scoring threshold ladder. */
  scoring: z.object({ bandSize: z.number().int().positive().optional() }).optional(),
  throwPenalty: z
    .object({
      defenderFailedThrow: z.number().int(),
      attackerFailedThrow: z.number().int(),
    })
    .optional(),
  allowNoTrumpJokerBid: z.boolean().optional(),
  minimumJokerBidCount: z.number().int().positive().optional(),
  maxRedeals: z.number().int().nonnegative().optional(),
  timers: z
    .object({
      playTimeoutSeconds: z.number().int().positive().optional(),
      disconnectedTimeoutSeconds: z.number().int().positive().optional(),
      postDealWindowSeconds: z.number().int().positive().optional(),
      responseWindowSeconds: z.number().int().positive().optional(),
    })
    .optional(),
});

export type GameOptions = z.infer<typeof gameOptionsSchema>;

export type ResolveIssue = { path: string; message: string };

export type ResolveResult =
  | { ok: true; ruleset: ShengJiRuleset }
  | { ok: false; issues: ResolveIssue[] };

/** True when any override leaf is present, so a resolved id can be tagged custom. */
function hasAnyOverride(options: GameOptions): boolean {
  return Object.values(options).some((value) => {
    if (value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") {
      return Object.values(value).some((leaf) => leaf !== undefined);
    }
    return true;
  });
}

/**
 * The single composer: deep-clone the preset, apply overrides, re-derive
 * dependent fields the user did not pin, tag a custom id when anything changed,
 * and validate through `shengJiRulesetSchema`. Zod issues map 1:1 to
 * user-facing messages; there is no second validation system.
 */
export function resolveRuleset(presetId: string, options: GameOptions): ResolveResult {
  const preset = getPreset(presetId);
  if (preset === undefined) {
    return {
      ok: false,
      issues: [{ path: "presetId", message: `Unknown preset ${presetId}` }],
    };
  }

  // Finding-friends is not composable yet (Phase 3); reject any FF intent.
  if (
    options.teamsMode === "finding-friends" ||
    options.friendCallCount !== undefined
  ) {
    return {
      ok: false,
      issues: [{ path: "teamsMode", message: "finding-friends is not yet available" }],
    };
  }

  let working: ShengJiRuleset;
  try {
    working = structuredClone(preset.ruleset);
    const originalPlayerCount = working.players.count;
    const originalDeckCount = working.decks.count;

    if (options.playerCount !== undefined) working.players.count = options.playerCount;
    if (options.deckCount !== undefined) working.decks.count = options.deckCount;
    if (options.teamsMode !== undefined) working.teams.mode = options.teamsMode;
    if (options.startingRank !== undefined) {
      working.ranks.startingRank = options.startingRank;
    }
    if (options.gameEndsOnSuccessfulDefenseAt !== undefined) {
      working.ranks.gameEndsOnSuccessfulDefenseAt =
        options.gameEndsOnSuccessfulDefenseAt;
    }
    if (options.mustDefendRanks !== undefined) {
      working.ranks.mustDefendRanks = [...options.mustDefendRanks];
    }
    if (options.throwPenalty !== undefined) {
      working.throws.failedThrowAttackerPointDelta = { ...options.throwPenalty };
    }
    if (options.allowNoTrumpJokerBid !== undefined) {
      working.bidding.allowNoTrumpJokerBid = options.allowNoTrumpJokerBid;
    }
    if (options.minimumJokerBidCount !== undefined) {
      working.bidding.minimumJokerBidCount = options.minimumJokerBidCount;
    }
    if (options.maxRedeals !== undefined)
      working.bidding.maxRedeals = options.maxRedeals;
    if (options.timers !== undefined) {
      const timers = options.timers;
      if (timers.playTimeoutSeconds !== undefined) {
        working.turns.playTimeoutSeconds = timers.playTimeoutSeconds;
      }
      if (timers.disconnectedTimeoutSeconds !== undefined) {
        working.turns.disconnectedTimeoutSeconds = timers.disconnectedTimeoutSeconds;
      }
      if (timers.postDealWindowSeconds !== undefined) {
        working.bidding.postDealWindowSeconds = timers.postDealWindowSeconds;
      }
      if (timers.responseWindowSeconds !== undefined) {
        working.bidding.responseWindowSeconds = timers.responseWindowSeconds;
      }
    }

    const playerCountChanged =
      options.playerCount !== undefined && options.playerCount !== originalPlayerCount;
    const deckCountChanged =
      options.deckCount !== undefined && options.deckCount !== originalDeckCount;

    // Re-derive fixed team layout for the new seat count when it can (even
    // counts); odd counts leave the stale layout so the schema surfaces the
    // "assign every seat exactly once" issue rather than throwing here.
    if (
      working.teams.mode === "fixed" &&
      playerCountChanged &&
      working.players.count % 2 === 0
    ) {
      working.teams.teams = defaultFixedTeams(working.players.count);
    }

    // Bottom: an explicit pin wins; otherwise re-derive when the deal shape changes.
    if (options.bottomSize !== undefined) {
      working.bottom.size = options.bottomSize;
    } else if (playerCountChanged || deckCountChanged) {
      working.bottom.size = defaultBottomSize(working.players.count, working.decks);
    }

    // Scoring: an explicit band wins; otherwise re-derive from the deck count.
    if (options.scoring?.bandSize !== undefined) {
      working.scoring.thresholds = thresholdsForBand(options.scoring.bandSize);
    } else if (deckCountChanged) {
      working.scoring.thresholds = defaultThresholds(working.decks.count);
    }

    if (hasAnyOverride(options)) {
      working.id = `${preset.ruleset.id}+custom`;
    }
  } catch (error) {
    return {
      ok: false,
      issues: [
        {
          path: "options",
          message: error instanceof Error ? error.message : "Invalid options",
        },
      ],
    };
  }

  const parsed = shengJiRulesetSchema.safeParse(working);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }
  return { ok: true, ruleset: parsed.data };
}
