import Fastify from "fastify";
import { z } from "zod";
import { WebSocketServer } from "ws";
import { SqliteStore } from "./persistence/sqlite-store.js";
import { RoomManager } from "./room-manager.js";

const createRoomBodySchema = z.object({}).optional();
const joinRoomBodySchema = z.object({
  name: z.string().max(64).default("Player"),
  resumeToken: z.string().min(1).optional(),
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
  const room = rooms.createRoom();
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
      return rooms.joinRoom({
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
