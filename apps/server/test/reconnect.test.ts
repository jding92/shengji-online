import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import {
  applyEvent,
  createGameState,
  fourPlayerTwoDeckFixedTeamRuleset,
  getNextDealEvents,
  replayEvents,
  validateCommand,
  type GameState,
} from "@shengji/engine";
import { PROTOCOL_VERSION, type ServerEnvelope } from "@shengji/protocol";
import { SqliteStore } from "../src/persistence/sqlite-store.js";
import { Room } from "../src/room.js";

const now = "2026-06-19T12:00:00.000Z";

class FakeSocket extends EventEmitter {
  readyState: number = WebSocket.OPEN;
  readonly received: ServerEnvelope[] = [];

  send(data: string): void {
    this.received.push(JSON.parse(data) as ServerEnvelope);
  }

  close(): void {
    this.disconnect();
  }

  disconnect(): void {
    if (this.readyState === WebSocket.CLOSED) return;
    this.readyState = WebSocket.CLOSED;
    this.emit("close");
  }

  asWebSocket(): WebSocket {
    return this as unknown as WebSocket;
  }

  lastOfType<T extends ServerEnvelope["type"]>(
    type: T,
  ): Extract<ServerEnvelope, { type: T }> | undefined {
    return this.received.findLast(
      (envelope): envelope is Extract<ServerEnvelope, { type: T }> =>
        envelope.type === type,
    );
  }
}

function seatedState(roomId: string): GameState {
  let state = createGameState({
    roomId,
    ruleset: fourPlayerTwoDeckFixedTeamRuleset,
    createdAt: now,
  });
  for (let seat = 0; seat < 4; seat += 1) {
    const playerId = `p${seat}`;
    state = applyEvent(state, {
      type: "PLAYER_JOINED",
      playerId,
      name: `P${seat}`,
      at: now,
    });
    state = replayEvents(
      state,
      validateCommand(state, playerId, { type: "SIT", seat }, { now }),
    );
  }
  return state;
}

function dealtState(roomId: string): GameState {
  let state = seatedState(roomId);
  for (let seat = 0; seat < 4; seat += 1) {
    state = replayEvents(
      state,
      validateCommand(
        state,
        `p${seat}`,
        { type: "READY" },
        { now, roundSeed: "reconnect-seed" },
      ),
    );
  }
  while (state.phase === "dealing") {
    state = replayEvents(state, getNextDealEvents(state, now));
  }
  return state;
}

function makeRoom(state: GameState): { room: Room; store: SqliteStore } {
  const store = new SqliteStore(":memory:");
  store.createRoom(state);
  return { room: new Room(state, store, { timersEnabled: false }), store };
}

describe("reconnection and session handling", () => {
  it("sends a reconnecting player a snapshot with only their own hand", async () => {
    const state = dealtState("RECON1");
    const { room, store } = makeRoom(state);
    const socket = new FakeSocket();
    room.connect("p1", socket.asWebSocket());

    await vi.waitFor(() => expect(socket.lastOfType("SNAPSHOT")).toBeDefined());
    const snapshot = socket.lastOfType("SNAPSHOT")!;
    expect(snapshot.revision).toBe(room.state.revision);
    expect(snapshot.view.you.hand).toHaveLength(25);
    const serialized = JSON.stringify(snapshot.view);
    for (const seat of [0, 2, 3]) {
      for (const cardId of state.round!.hands[seat]!) {
        expect(serialized).not.toContain(cardId);
      }
    }

    room.close();
    store.close();
  });

  it("rejects a stale revision and immediately resyncs with a snapshot", async () => {
    const state = seatedState("RECON2");
    const { room, store } = makeRoom(state);
    const socket = new FakeSocket();
    room.connect("p0", socket.asWebSocket());
    await vi.waitFor(() => expect(socket.lastOfType("SNAPSHOT")).toBeDefined());
    socket.received.length = 0;

    socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          protocolVersion: PROTOCOL_VERSION,
          roomId: room.state.roomId,
          playerToken: "test-token",
          requestId: "stale-request",
          expectedRevision: room.state.revision - 1,
          command: { type: "READY" },
        }),
      ),
    );

    await vi.waitFor(() => {
      expect(socket.lastOfType("COMMAND_REJECTED")?.code).toBe("STALE_REVISION");
      expect(socket.lastOfType("SNAPSHOT")).toBeDefined();
    });

    room.close();
    store.close();
  });

  it("replays the same request id idempotently instead of double-applying", async () => {
    const state = seatedState("RECON3");
    const { room, store } = makeRoom(state);
    const socket = new FakeSocket();
    room.connect("p0", socket.asWebSocket());
    await vi.waitFor(() => expect(socket.lastOfType("SNAPSHOT")).toBeDefined());

    const envelope = {
      protocolVersion: PROTOCOL_VERSION,
      roomId: room.state.roomId,
      playerToken: "test-token",
      requestId: "ready-once",
      expectedRevision: room.state.revision,
      command: { type: "READY" },
    };
    socket.emit("message", Buffer.from(JSON.stringify(envelope)));
    await vi.waitFor(() => expect(room.state.players["p0"]?.ready).toBe(true));
    const revisionAfterFirst = room.state.revision;

    // A retry of the same request (e.g. after a flaky network) is a no-op.
    socket.emit("message", Buffer.from(JSON.stringify(envelope)));
    await vi.waitFor(() =>
      expect(
        socket.received.filter(({ type }) => type === "SNAPSHOT").length,
      ).toBeGreaterThanOrEqual(3),
    );
    expect(room.state.revision).toBe(revisionAfterFirst);

    room.close();
    store.close();
  });

  it("keeps a player connected while any of their sockets remain open", async () => {
    const state = seatedState("RECON4");
    const { room, store } = makeRoom(state);
    const first = new FakeSocket();
    const second = new FakeSocket();
    room.connect("p2", first.asWebSocket());
    room.connect("p2", second.asWebSocket());
    await vi.waitFor(() => expect(second.lastOfType("SNAPSHOT")).toBeDefined());
    expect(room.state.players["p2"]?.connected).toBe(true);

    first.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(room.state.players["p2"]?.connected).toBe(true);

    second.disconnect();
    await vi.waitFor(() => expect(room.state.players["p2"]?.connected).toBe(false));

    room.close();
    store.close();
  });
});
