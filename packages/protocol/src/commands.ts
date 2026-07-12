import { gameOptionsSchema, JOKERS, RANKS, SUITS } from "@shengji/engine";
import { z } from "zod";

// Re-export the engine's option schema so protocol consumers have a single
// runtime source of truth (no drift between engine and protocol mirrors).
export { gameOptionsSchema, type GameOptions } from "@shengji/engine";

const cardIds = z.array(z.string().min(1)).min(1);

// Mirrors the engine's CardFace union so CALL_FRIENDS can carry a wire-safe
// face without depending on engine-internal validation; the engine still
// re-validates the call (jokers rejected, callable-face rules) in
// validateCommand, so this schema only needs to describe the shape.
const cardFaceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("standard"), suit: z.enum(SUITS), rank: z.enum(RANKS) }),
  z.object({ kind: z.literal("joker"), joker: z.enum(JOKERS) }),
]);

export const clientCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SIT"), seat: z.number().int().nonnegative() }),
  z.object({ type: z.literal("READY"), ready: z.boolean().optional() }),
  z.object({ type: z.literal("BID"), cards: cardIds }),
  z.object({ type: z.literal("PASS_BID") }),
  z.object({ type: z.literal("BURY_BOTTOM"), cards: cardIds }),
  z.object({
    type: z.literal("CALL_FRIENDS"),
    calls: z
      .array(
        z.object({
          face: cardFaceSchema,
          copyIndex: z.number().int().positive(),
        }),
      )
      .min(1),
  }),
  z.object({
    type: z.literal("PLAY_CARDS"),
    cards: cardIds,
    intent: z.enum(["normal", "throw"]),
  }),
  z.object({ type: z.literal("START_NEXT_ROUND") }),
  z.object({
    type: z.literal("UPDATE_OPTIONS"),
    presetId: z.string().min(1).optional(),
    options: gameOptionsSchema,
  }),
]);

export type WireClientCommand = z.infer<typeof clientCommandSchema>;
