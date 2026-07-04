import Fastify from "fastify";
import { BOT_DIFFICULTIES } from "@shengji/engine";
import { z } from "zod";
import { WebSocketServer } from "ws";
import { SqliteStore } from "./persistence/sqlite-store.js";
import { RoomManager } from "./room-manager.js";

const botDifficultySchema = z.enum(BOT_DIFFICULTIES);
const createRoomBodySchema = z
  .object({
    practice: z.boolean().optional(),
    botDifficulty: botDifficultySchema.optional(),
  })
  .optional();
const joinRoomBodySchema = z.object({
  name: z.string().max(64).default("Player"),
  resumeToken: z.string().min(1).optional(),
});
const memberBodySchema = z.object({
  playerToken: z.string().min(1),
});
const addBotBodySchema = memberBodySchema.extend({
  seat: z.number().int().nonnegative(),
  difficulty: botDifficultySchema,
});
const takeoverBodySchema = memberBodySchema.extend({
  difficulty: botDifficultySchema,
});

const databasePath = process.env.DATABASE_PATH ?? "./data/shengji.sqlite";
const port = Number.parseInt(process.env.PORT ?? "3001", 10);
const host = process.env.HOST ?? "0.0.0.0";

const store = new SqliteStore(databasePath);
const rooms = new RoomManager(store);
const app = Fastify({ logger: true });
const webSockets = new WebSocketServer({ noServer: true });

app.get("/api/health", () => ({ ok: true }));

app.post("/api/rooms", async (request, reply) => {
  const parsed = createRoomBodySchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid request" });
  const room = await rooms.createRoom({
    ...(parsed.data?.practice === undefined ? {} : { practice: parsed.data.practice }),
    ...(parsed.data?.botDifficulty === undefined
      ? {}
      : { botDifficulty: parsed.data.botDifficulty }),
  });
  return reply.code(201).send({
    room: rooms.roomSummary(room.state),
    invitePath: `/room/${room.state.roomId}`,
  });
});

app.get<{ Params: { roomId: string } }>(
  "/api/rooms/:roomId",
  async (request, reply) => {
    const room = rooms.getRoom(request.params.roomId);
    if (room === null) return reply.code(404).send({ error: "Room not found" });
    return rooms.roomSummary(room.state);
  },
);

app.post<{ Params: { roomId: string } }>(
  "/api/rooms/:roomId/join",
  async (request, reply) => {
    const parsed = joinRoomBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }
    try {
      return await rooms.joinRoom({
        roomId: request.params.roomId,
        name: parsed.data.name,
        ...(parsed.data.resumeToken === undefined
          ? {}
          : { resumeToken: parsed.data.resumeToken }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to join room";
      return reply
        .code(message === "Room not found" ? 404 : 400)
        .send({ error: message });
    }
  },
);

app.post<{ Params: { roomId: string } }>(
  "/api/rooms/:roomId/bots",
  async (request, reply) => {
    const parsed = addBotBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }
    const room = rooms.getRoom(request.params.roomId);
    const requester = rooms.authenticate(
      request.params.roomId,
      parsed.data.playerToken,
    );
    if (room === null) return reply.code(404).send({ error: "Room not found" });
    if (requester === null || room.state.players[requester]?.bot !== undefined) {
      return reply.code(403).send({ error: "Room membership required" });
    }
    if (!Object.values(room.state.players).some(({ bot }) => bot === undefined)) {
      return reply.code(400).send({ error: "At least one human is required" });
    }
    try {
      const playerId = await rooms.addBot(
        room.state.roomId,
        parsed.data.seat,
        parsed.data.difficulty,
      );
      return reply.code(201).send({ playerId });
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to add bot",
      });
    }
  },
);

app.delete<{ Params: { roomId: string; botId: string } }>(
  "/api/rooms/:roomId/bots/:botId",
  async (request, reply) => {
    const parsed = memberBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }
    const room = rooms.getRoom(request.params.roomId);
    const requester = rooms.authenticate(
      request.params.roomId,
      parsed.data.playerToken,
    );
    if (room === null) return reply.code(404).send({ error: "Room not found" });
    if (requester === null || room.state.players[requester]?.bot !== undefined) {
      return reply.code(403).send({ error: "Room membership required" });
    }
    try {
      await room.removeBot(request.params.botId, new Date().toISOString());
      return reply.code(204).send();
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to remove bot",
      });
    }
  },
);

app.post<{ Params: { roomId: string; targetId: string } }>(
  "/api/rooms/:roomId/players/:targetId/bot-takeover",
  async (request, reply) => {
    const parsed = takeoverBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message });
    }
    const room = rooms.getRoom(request.params.roomId);
    const requester = rooms.authenticate(
      request.params.roomId,
      parsed.data.playerToken,
    );
    if (room === null) return reply.code(404).send({ error: "Room not found" });
    if (requester === null || room.state.players[requester]?.bot !== undefined) {
      return reply.code(403).send({ error: "Room membership required" });
    }
    try {
      await room.takeoverByBot(
        request.params.targetId,
        parsed.data.difficulty,
        new Date().toISOString(),
      );
      return reply.code(200).send({ ok: true });
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to replace player",
      });
    }
  },
);

app.server.on("upgrade", (request, socket, head) => {
  const url = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? "localhost"}`,
  );
  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }
  const roomId = url.searchParams.get("roomId")?.toUpperCase();
  const playerToken = url.searchParams.get("token");
  if (roomId === undefined || playerToken === null) {
    socket.destroy();
    return;
  }
  const room = rooms.getRoom(roomId);
  const playerId = rooms.authenticate(roomId, playerToken);
  if (room === null || playerId === null) {
    socket.destroy();
    return;
  }
  webSockets.handleUpgrade(request, socket, head, (webSocket) => {
    room.connect(playerId, webSocket);
  });
});

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, "Shutting down");
  rooms.close();
  webSockets.close();
  await app.close();
  store.close();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  rooms.close();
  store.close();
  process.exitCode = 1;
}
