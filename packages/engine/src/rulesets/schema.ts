import { z } from "zod";
import { RANKS } from "../types.js";

const bidTierSchema = z.enum(["level-card", "small-joker", "big-joker"]);

const scoringThresholdSchema = z.object({
  min: z.number().int().nonnegative(),
  maxExclusive: z.number().int().positive().optional(),
  winner: z.enum(["defenders", "attackers"]),
  levelDelta: z.number().int().nonnegative(),
});

export const shengJiRulesetSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.string().min(1),
    players: z.object({
      count: z.number().int().min(4).max(12),
      seatOrder: z.literal("counterclockwise"),
    }),
    decks: z.object({
      count: z.number().int().positive(),
      includeJokers: z.boolean(),
    }),
    teams: z.object({
      mode: z.enum(["fixed", "finding-friends"]),
      teams: z.array(z.array(z.number().int().nonnegative()).min(1)).min(1),
    }),
    ranks: z.object({
      sequence: z.array(z.enum(RANKS)).min(2),
      gameEndsOnSuccessfulDefenseAt: z.enum(RANKS),
    }),
    bidding: z.object({
      duringDeal: z.boolean(),
      postDealWindowSeconds: z.number().int().positive(),
      responseWindowSeconds: z.number().int().positive(),
      sameTierCounterbidAllowed: z.boolean(),
      samePlayerReinforceAllowed: z.boolean(),
      strengthOrder: z.tuple([z.literal("count"), z.literal("tier")]),
      allowNoTrumpJokerBid: z.boolean(),
      minimumJokerBidCount: z.number().int().positive(),
      tiers: z.array(bidTierSchema).min(1),
    }),
    trump: z.object({
      jokersAlwaysTrump: z.literal(true),
      levelCardsAlwaysTrump: z.literal(true),
    }),
    bottom: z.object({
      size: z.number().int().nonnegative(),
      lastTrickMultipliers: z.object({
        single: z.number().int().positive(),
        pair: z.number().int().positive(),
        tractor: z.number().int().positive(),
      }),
      throwMultiplierStrategy: z.literal("longest-component"),
    }),
    trickPlay: z.object({
      formats: z.array(z.enum(["single", "tuple", "tractor", "throw"])).min(1),
      mustFollowEffectiveSuit: z.boolean(),
      mustMatchFormat: z.boolean(),
    }),
    throws: z.object({
      enabled: z.boolean(),
      failedThrowResolution: z.literal("force-smallest-failing-component"),
      failedThrowAttackerPointDelta: z.object({
        defenderFailedThrow: z.number().int(),
        attackerFailedThrow: z.number().int(),
      }),
    }),
    scoring: z.object({
      model: z.literal("thresholds"),
      thresholds: z.array(scoringThresholdSchema).min(1),
    }),
    roundFlow: z.object({
      firstRoundLeader: z.literal("winning-bidder"),
      laterRoundLeader: z.literal("round-progression"),
    }),
  })
  .superRefine((ruleset, context) => {
    const rankSet = new Set(ruleset.ranks.sequence);
    if (rankSet.size !== ruleset.ranks.sequence.length) {
      context.addIssue({
        code: "custom",
        path: ["ranks", "sequence"],
        message: "Rank sequence cannot contain duplicates",
      });
    }
    if (!rankSet.has(ruleset.ranks.gameEndsOnSuccessfulDefenseAt)) {
      context.addIssue({
        code: "custom",
        path: ["ranks", "gameEndsOnSuccessfulDefenseAt"],
        message: "Game-ending rank must appear in the rank sequence",
      });
    }

    const tierSet = new Set(ruleset.bidding.tiers);
    if (tierSet.size !== ruleset.bidding.tiers.length) {
      context.addIssue({
        code: "custom",
        path: ["bidding", "tiers"],
        message: "Bid tiers cannot contain duplicates",
      });
    }

    const totalCards =
      ruleset.decks.count * (52 + (ruleset.decks.includeJokers ? 2 : 0));
    const dealtCards = totalCards - ruleset.bottom.size;
    if (dealtCards <= 0 || dealtCards % ruleset.players.count !== 0) {
      context.addIssue({
        code: "custom",
        path: ["bottom", "size"],
        message: "Cards remaining after the bottom must divide evenly among players",
      });
    }

    if (ruleset.teams.mode === "fixed") {
      const seats = ruleset.teams.teams.flat().sort((a, b) => a - b);
      const expectedSeats = Array.from(
        { length: ruleset.players.count },
        (_, seat) => seat,
      );
      if (
        seats.length !== expectedSeats.length ||
        seats.some((seat, index) => seat !== expectedSeats[index])
      ) {
        context.addIssue({
          code: "custom",
          path: ["teams", "teams"],
          message: "Fixed teams must assign every seat exactly once",
        });
      }
    }

    const thresholds = ruleset.scoring.thresholds;
    for (let index = 0; index < thresholds.length; index += 1) {
      const threshold = thresholds[index];
      if (threshold === undefined) continue;
      if (index === 0 && threshold.min !== 0) {
        context.addIssue({
          code: "custom",
          path: ["scoring", "thresholds", index, "min"],
          message: "Scoring thresholds must start at 0",
        });
      }
      const next = thresholds[index + 1];
      if (next !== undefined && threshold.maxExclusive !== next.min) {
        context.addIssue({
          code: "custom",
          path: ["scoring", "thresholds", index, "maxExclusive"],
          message: "Scoring thresholds must be contiguous",
        });
      }
      if (next !== undefined && threshold.maxExclusive === undefined) {
        context.addIssue({
          code: "custom",
          path: ["scoring", "thresholds", index, "maxExclusive"],
          message: "Only the final threshold may be open-ended",
        });
      }
      if (next === undefined && threshold.maxExclusive !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["scoring", "thresholds", index, "maxExclusive"],
          message: "The final threshold must be open-ended",
        });
      }
    }
  });

export type ShengJiRuleset = z.infer<typeof shengJiRulesetSchema>;

export function validateRuleset(ruleset: unknown) {
  return shengJiRulesetSchema.safeParse(ruleset);
}

export function loadRuleset(ruleset: unknown): ShengJiRuleset {
  return shengJiRulesetSchema.parse(ruleset);
}
