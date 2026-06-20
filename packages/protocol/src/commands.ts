import { z } from "zod";

const cardIds = z.array(z.string().min(1)).min(1);

export const clientCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SIT"), seat: z.number().int().nonnegative() }),
  z.object({ type: z.literal("READY"), ready: z.boolean().optional() }),
  z.object({ type: z.literal("BID"), cards: cardIds }),
  z.object({ type: z.literal("PASS_BID") }),
  z.object({ type: z.literal("BURY_BOTTOM"), cards: cardIds }),
  z.object({
    type: z.literal("PLAY_CARDS"),
    cards: cardIds,
    intent: z.enum(["normal", "throw"]),
  }),
  z.object({ type: z.literal("START_NEXT_ROUND") }),
]);

export type WireClientCommand = z.infer<typeof clientCommandSchema>;
