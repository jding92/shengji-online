import type { GameEvent } from "@shengji/engine";
import { z } from "zod";
import { clientCommandSchema, type WireClientCommand } from "./commands.js";
import type { PrivateGameView } from "./views.js";

export const PROTOCOL_VERSION = 1 as const;

export const clientEnvelopeSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  roomId: z.string().min(1),
  playerToken: z.string().min(1),
  requestId: z.string().min(1).max(128),
  expectedRevision: z.number().int().nonnegative(),
  command: clientCommandSchema,
});

export type ClientEnvelope = Omit<z.infer<typeof clientEnvelopeSchema>, "command"> & {
  command: WireClientCommand;
};

export type ServerEnvelope =
  | {
      type: "SNAPSHOT";
      protocolVersion: typeof PROTOCOL_VERSION;
      revision: number;
      view: PrivateGameView;
    }
  | {
      type: "EVENTS";
      protocolVersion: typeof PROTOCOL_VERSION;
      fromRevision: number;
      toRevision: number;
      events: GameEvent[];
      view: PrivateGameView;
    }
  | {
      type: "COMMAND_REJECTED";
      protocolVersion: typeof PROTOCOL_VERSION;
      requestId: string;
      code: string;
      message: string;
      revision: number;
    }
  | {
      type: "TIMER_TICK";
      protocolVersion: typeof PROTOCOL_VERSION;
      deadline: string;
      serverTime: string;
    };
