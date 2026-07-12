import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import {
  applyEvent,
  createGameState,
  fourPlayerTwoDeckFixedTeamRuleset,
  getFinalizeBiddingEvents,
  getNextDealEvents,
  listPresets,
  OPTION_METADATA,
  replayEvents,
  validateCommand,
  type GameState,
} from "@shengji/engine";
import {
  PROTOCOL_VERSION,
  type ServerEnvelope,
  type WireClientCommand,
} from "@shengji/protocol";
import { SqliteStore } from "../src/persistence/sqlite-store.js";
import { RoomManager, RulesetResolutionError } from "../src/room-manager.js";
import { Room } from "../src/room.js";

const now = "2026-07-10T12:00:00.000Z";
const SIX_PLAYER_PRESET_ID = "shengji-6p-3d-fixed-v1";

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
  it("creates a room from a non-default (6p/3d) preset", async () => {
    const store = new SqliteStore(":memory:");
    const manager = new RoomManager(store, { timersEnabled: false });
    const room = await manager.createRoom({ at: now, presetId: SIX_PLAYER_PRESET_ID });
    expect(room.state.rulesetSnapshot.players.count).toBe(6);
    expect(room.state.presetId).toBe(SIX_PLAYER_PRESET_ID);
    const summary = manager.roomSummary(room.state);
    expect(summary.ruleset).toMatchObject({
      presetId: SIX_PLAYER_PRESET_ID,
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
      presetId: SIX_PLAYER_PRESET_ID,
      options: { bottomSize: 12 },
    });
    expect(room.state.rulesetSnapshot.bottom.size).toBe(12);
    expect(room.state.rulesetId).toBe(`${SIX_PLAYER_PRESET_ID}+custom`);

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
    // The promoted 6p/3d preset (and the other Phase 2 multi-deck presets)
    // are production, so they surface in the listing.
    expect(payload.presets.some(({ id }) => id === SIX_PLAYER_PRESET_ID)).toBe(true);
    expect(payload.presets.some(({ id }) => id === "shengji-4p-3d-fixed-v1")).toBe(
      true,
    );
    expect(payload.presets.some(({ id }) => id === "shengji-8p-4d-fixed-v1")).toBe(
      true,
    );
    // Finding-friends presets are production as of Phase 3c and surface here.
    expect(
      payload.presets.some(
        ({ id, teamsMode }) =>
          id === "shengji-ff-5p-2d-v1" && teamsMode === "finding-friends",
      ),
    ).toBe(true);
    expect(
      payload.optionMetadata.some(({ key }) => key === "timers.playTimeoutSeconds"),
    ).toBe(true);
  });
});

/**
 * Drives a fresh 4p/2d game (no sockets) to `bottom-exchange`, with the
 * winning bidder — who becomes both round leader and room host — returned
 * alongside the state so a Phase 4 in-game UPDATE_OPTIONS can be sent as an
 * authenticated host action over a real Room/socket.
 */
function stateAtBottomExchangeWithHost(
  roomId: string,
  seed: string,
): { state: GameState; hostId: string } {
  let state = createGameState({
    roomId,
    ruleset: structuredClone(fourPlayerTwoDeckFixedTeamRuleset),
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
  for (let seat = 0; seat < 4; seat += 1) {
    state = replayEvents(
      state,
      validateCommand(state, `p${seat}`, { type: "READY" }, { now, roundSeed: seed }),
    );
  }
  while (state.phase === "dealing") {
    state = replayEvents(state, getNextDealEvents(state, now));
  }

  const bidderSeat = [0, 1, 2, 3].find((seat) =>
    state.round!.hands[seat]!.some((id) => {
      const face = state.round!.cards[id]!.face;
      return face.kind === "standard" && face.rank === state.round!.trumpRank;
    }),
  )!;
  const bidCard = state.round!.hands[bidderSeat]!.find((id) => {
    const face = state.round!.cards[id]!.face;
    return face.kind === "standard" && face.rank === state.round!.trumpRank;
  })!;
  state = replayEvents(
    state,
    validateCommand(
      state,
      `p${bidderSeat}`,
      { type: "BID", cards: [bidCard] },
      { now },
    ),
  );
  state = replayEvents(state, getFinalizeBiddingEvents(state, now));
  const hostId = `p${bidderSeat}`;
  state = applyEvent(state, { type: "HOST_CHANGED", playerId: hostId, at: now });
  return { state, hostId };
}

describe("in-game option editing (Phase 4)", () => {
  it("applies a mid-round timer change and the next reschedule uses the shorter window", async () => {
    const store = new SqliteStore(":memory:");
    const { state, hostId } = stateAtBottomExchangeWithHost(
      "TIMER-OPTS",
      "phase4-timer-seed",
    );
    expect(state.phase).toBe("bottom-exchange");
    store.createRoom(state);

    // No turnTimeoutMsOverride: the real ruleset seconds must govern the
    // leader's bottom-exchange deadline for this to prove anything.
    const room = new Room(state, store, { timersEnabled: true });
    const hostSocket = new FakeSocket();
    room.connect(hostId, hostSocket.asWebSocket());

    await send(room, hostSocket, {
      type: "UPDATE_OPTIONS",
      options: { timers: { playTimeoutSeconds: 1 } },
    });
    expect(room.state.rulesetSnapshot.turns.playTimeoutSeconds).toBe(1);
    // Seats and readiness are untouched by an in-game options change.
    expect(room.state.phase).toBe("bottom-exchange");

    // The post-commit reschedule recomputes the leader's bottom-exchange
    // deadline from the new 1-second window (was the ruleset's 60-second
    // default), so the bottom gets force-buried and the round advances well
    // within this wait — proving the changed timer actually took effect.
    await vi.waitFor(() => expect(room.state.phase).toBe("playing"), {
      timeout: 5_000,
      interval: 20,
    });

    room.close();
    store.close();
  }, 10_000);

  it("rejects an in-game options change from a non-host", async () => {
    const store = new SqliteStore(":memory:");
    const { state, hostId } = stateAtBottomExchangeWithHost(
      "TIMER-OPTS-NONHOST",
      "phase4-nonhost-seed",
    );
    store.createRoom(state);
    const room = new Room(state, store, { timersEnabled: false });
    const otherId = Object.keys(state.players).find((id) => id !== hostId)!;
    const otherSocket = new FakeSocket();
    room.connect(otherId, otherSocket.asWebSocket());

    const rejected = await sendExpectingReject(room, otherSocket, {
      type: "UPDATE_OPTIONS",
      options: { timers: { playTimeoutSeconds: 5 } },
    });
    expect(rejected).toMatchObject({ type: "COMMAND_REJECTED", code: "NOT_HOST" });

    room.close();
    store.close();
  });

  it("rejects a structural in-game change over the socket, naming the offending key", async () => {
    const store = new SqliteStore(":memory:");
    const { state, hostId } = stateAtBottomExchangeWithHost(
      "TIMER-OPTS-STRUCT",
      "phase4-struct-seed",
    );
    store.createRoom(state);
    const room = new Room(state, store, { timersEnabled: false });
    const hostSocket = new FakeSocket();
    room.connect(hostId, hostSocket.asWebSocket());

    const rejected = await sendExpectingReject(room, hostSocket, {
      type: "UPDATE_OPTIONS",
      options: { maxRedeals: 5 },
    });
    expect(rejected).toMatchObject({ type: "COMMAND_REJECTED", code: "INVALID_PHASE" });
    if (rejected.type !== "COMMAND_REJECTED")
      throw new Error("expected COMMAND_REJECTED");
    expect(rejected.message).toContain("maxRedeals");

    room.close();
    store.close();
  });
});
