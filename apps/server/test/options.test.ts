import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { listPresets, OPTION_METADATA } from "@shengji/engine";
import {
  PROTOCOL_VERSION,
  type ServerEnvelope,
  type WireClientCommand,
} from "@shengji/protocol";
import { SqliteStore } from "../src/persistence/sqlite-store.js";
import { RoomManager, RulesetResolutionError } from "../src/room-manager.js";
import type { Room } from "../src/room.js";

const now = "2026-07-10T12:00:00.000Z";
const EXPERIMENTAL_6P = "shengji-6p-3d-fixed-experimental";

class FakeSocket extends EventEmitter {
  readyState: number = WebSocket.OPEN;
  readonly received: ServerEnvelope[] = [];

  send(data: string): void {
    this.received.push(JSON.parse(data) as ServerEnvelope);
  }

  close(): void {
    if (this.readyState === WebSocket.CLOSED) return;
    this.readyState = WebSocket.CLOSED;
    this.emit("close");
  }

  asWebSocket(): WebSocket {
    return this as unknown as WebSocket;
  }
}

async function send(
  room: Room,
  socket: FakeSocket,
  command: WireClientCommand,
): Promise<void> {
  const expectedRevision = room.state.revision;
  socket.emit(
    "message",
    Buffer.from(
      JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        roomId: room.state.roomId,
        playerToken: "token",
        requestId: randomUUID(),
        expectedRevision,
        command,
      }),
    ),
  );
  await vi.waitFor(() => expect(room.state.revision).toBeGreaterThan(expectedRevision));
}

async function sendExpectingReject(
  room: Room,
  socket: FakeSocket,
  command: WireClientCommand,
): Promise<ServerEnvelope> {
  const requestId = randomUUID();
  socket.received.length = 0;
  socket.emit(
    "message",
    Buffer.from(
      JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        roomId: room.state.roomId,
        playerToken: "token",
        requestId,
        expectedRevision: room.state.revision,
        command,
      }),
    ),
  );
  await vi.waitFor(() =>
    expect(socket.received.some(({ type }) => type === "COMMAND_REJECTED")).toBe(true),
  );
  return socket.received.find(({ type }) => type === "COMMAND_REJECTED")!;
}

describe("host-controlled lobby options", () => {
  it("applies a host UPDATE_OPTIONS, un-readies players, and syncs storage", async () => {
    const store = new SqliteStore(":memory:");
    const manager = new RoomManager(store, { timersEnabled: false });
    const room = await manager.createRoom({ at: now });
    const host = await manager.joinRoom({
      roomId: room.state.roomId,
      name: "Ada",
      at: now,
    });
    const other = await manager.joinRoom({
      roomId: room.state.roomId,
      name: "Bo",
      at: now,
    });
    expect(room.state.hostPlayerId).toBe(host.playerId);

    const hostSocket = new FakeSocket();
    const otherSocket = new FakeSocket();
    room.connect(host.playerId, hostSocket.asWebSocket());
    room.connect(other.playerId, otherSocket.asWebSocket());

    await send(room, hostSocket, { type: "SIT", seat: 0 });
    await send(room, otherSocket, { type: "SIT", seat: 1 });
    await send(room, otherSocket, { type: "READY", ready: true });
    expect(room.state.players[other.playerId]?.ready).toBe(true);

    await send(room, hostSocket, {
      type: "UPDATE_OPTIONS",
      options: { maxRedeals: 3 },
    });
    expect(room.state.rulesetSnapshot.bidding.maxRedeals).toBe(3);
    expect(room.state.rulesetId).toBe("shengji-4p-2d-fixed-v1+custom");
    expect(room.state.players[other.playerId]?.ready).toBe(false);

    // The rooms.ruleset_snapshot_json column tracks the updated snapshot.
    const rulesetColumn = store.database
      .prepare("SELECT ruleset_snapshot_json FROM rooms WHERE id = ?")
      .get(room.state.roomId) as { ruleset_snapshot_json: string };
    expect(JSON.parse(rulesetColumn.ruleset_snapshot_json)).toEqual(
      room.state.rulesetSnapshot,
    );

    manager.close();
    store.close();
  });

  it("rejects UPDATE_OPTIONS from a non-host", async () => {
    const store = new SqliteStore(":memory:");
    const manager = new RoomManager(store, { timersEnabled: false });
    const room = await manager.createRoom({ at: now });
    await manager.joinRoom({ roomId: room.state.roomId, name: "Ada", at: now });
    const other = await manager.joinRoom({
      roomId: room.state.roomId,
      name: "Bo",
      at: now,
    });

    const otherSocket = new FakeSocket();
    room.connect(other.playerId, otherSocket.asWebSocket());

    const rejected = await sendExpectingReject(room, otherSocket, {
      type: "UPDATE_OPTIONS",
      options: { maxRedeals: 3 },
    });
    expect(rejected).toMatchObject({ type: "COMMAND_REJECTED", code: "NOT_HOST" });

    manager.close();
    store.close();
  });
});

describe("createRoom with presets and options", () => {
  it("creates a room from an experimental preset", async () => {
    const store = new SqliteStore(":memory:");
    const manager = new RoomManager(store, { timersEnabled: false });
    const room = await manager.createRoom({ at: now, presetId: EXPERIMENTAL_6P });
    expect(room.state.rulesetSnapshot.players.count).toBe(6);
    expect(room.state.presetId).toBe(EXPERIMENTAL_6P);
    const summary = manager.roomSummary(room.state);
    expect(summary.ruleset).toMatchObject({
      presetId: EXPERIMENTAL_6P,
      teamsMode: "fixed",
    });

    manager.close();
    store.close();
  });

  it("applies option overrides and tags the ruleset custom", async () => {
    const store = new SqliteStore(":memory:");
    const manager = new RoomManager(store, { timersEnabled: false });
    const room = await manager.createRoom({
      at: now,
      presetId: EXPERIMENTAL_6P,
      options: { bottomSize: 12 },
    });
    expect(room.state.rulesetSnapshot.bottom.size).toBe(12);
    expect(room.state.rulesetId).toBe(`${EXPERIMENTAL_6P}+custom`);

    manager.close();
    store.close();
  });

  it("rejects unresolvable options with a RulesetResolutionError", async () => {
    const store = new SqliteStore(":memory:");
    const manager = new RoomManager(store, { timersEnabled: false });
    await expect(
      manager.createRoom({ at: now, options: { bottomSize: 5 } }),
    ).rejects.toBeInstanceOf(RulesetResolutionError);

    manager.close();
    store.close();
  });

  it("projects the presets endpoint payload", () => {
    const payload = {
      presets: listPresets().map(({ id, ruleset, description }) => ({
        id,
        name: ruleset.name,
        players: ruleset.players.count,
        decks: ruleset.decks.count,
        teamsMode: ruleset.teams.mode,
        description,
      })),
      optionMetadata: OPTION_METADATA,
    };
    expect(payload.presets).toContainEqual(
      expect.objectContaining({
        id: "shengji-4p-2d-fixed-v1",
        players: 4,
        decks: 2,
        teamsMode: "fixed",
      }),
    );
    // Experimental presets stay out of the production listing.
    expect(payload.presets.some(({ id }) => id === EXPERIMENTAL_6P)).toBe(false);
    expect(
      payload.optionMetadata.some(({ key }) => key === "timers.playTimeoutSeconds"),
    ).toBe(true);
  });
});
