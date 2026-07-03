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
import { SqliteStore } from "../src/persistence/sqlite-store.js";
import { RoomManager } from "../src/room-manager.js";
import { Room } from "../src/room.js";

const now = "2026-07-03T12:00:00.000Z";

class FakeSocket extends EventEmitter {
  readyState: number = WebSocket.OPEN;

  send(): void {}

  close(): void {
    if (this.readyState === WebSocket.CLOSED) return;
    this.readyState = WebSocket.CLOSED;
    this.emit("close");
  }

  asWebSocket(): WebSocket {
    return this as unknown as WebSocket;
  }
}

function fourPlayerState(input: {
  roomId: string;
  bots?: readonly number[];
  fastBidding?: boolean;
}): GameState {
  const ruleset = structuredClone(fourPlayerTwoDeckFixedTeamRuleset);
  if (input.fastBidding === true) {
    ruleset.bidding.postDealWindowSeconds = 0.02;
    ruleset.bidding.responseWindowSeconds = 0.02;
  }
  let state = createGameState({
    roomId: input.roomId,
    ruleset,
    createdAt: now,
  });
  for (let seat = 0; seat < 4; seat += 1) {
    const playerId = `p${seat}`;
    state = applyEvent(state, {
      type: "PLAYER_JOINED",
      playerId,
      name: `P${seat}`,
      ...(input.bots?.includes(seat) === true
        ? { bot: { difficulty: "intermediate" as const } }
        : {}),
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
      validateCommand(
        state,
        `p${seat}`,
        { type: "READY" },
        {
          now,
          roundSeed: "server-bot-seed",
        },
      ),
    );
  }
  return state;
}

function postDealState(roomId: string): GameState {
  let state = fourPlayerState({ roomId });
  while (state.phase === "dealing") {
    state = replayEvents(state, getNextDealEvents(state, now));
  }
  return state;
}

describe("server bot orchestration", () => {
  it("creates practice rooms with three ready sessionless bots", () => {
    const store = new SqliteStore(":memory:");
    const manager = new RoomManager(store, { timersEnabled: false });
    const room = manager.createRoom({
      at: now,
      practice: true,
      botDifficulty: "advanced",
    });

    const bots = Object.values(room.state.players);
    expect(bots).toHaveLength(3);
    expect(bots.map(({ seat }) => seat)).toEqual([1, 2, 3]);
    expect(
      bots.every(
        ({ bot, connected, ready }) =>
          bot?.difficulty === "advanced" && connected && ready,
      ),
    ).toBe(true);
    const sessionCount = store.database
      .prepare("SELECT COUNT(*) AS count FROM player_sessions")
      .get() as { count: number };
    expect(sessionCount.count).toBe(0);
    expect(manager.roomSummary(room.state).seats.slice(1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ isBot: true, occupied: true }),
      ]),
    );

    manager.close();
    store.close();
  });

  it("runs bots and timeout-backed human turns through a complete round", async () => {
    const store = new SqliteStore(":memory:");
    const state = fourPlayerState({
      roomId: "BOT-ROUND",
      bots: [1, 2, 3],
      fastBidding: true,
    });
    store.createRoom(state);
    const room = new Room(state, store, {
      timersEnabled: true,
      dealIntervalMs: 0,
      botDelayMsOverride: { min: 0, max: 0 },
      botNextRoundDelayMs: 0,
      turnTimeoutMsOverride: { connected: 5, disconnected: 5 },
    });

    await vi.waitFor(() => expect(room.state.round?.roundNumber).toBe(2), {
      timeout: 15_000,
      interval: 20,
    });

    room.close();
    store.close();
  }, 20_000);

  it("reclaims control on reconnect and cancels the pending bot action", async () => {
    const store = new SqliteStore(":memory:");
    let state = postDealState("BOT-RECLAIM");
    state = applyEvent(state, {
      type: "PLAYER_CONNECTION_CHANGED",
      playerId: "p1",
      connected: false,
      at: now,
    });
    store.createRoom(state);
    const room = new Room(state, store, {
      timersEnabled: true,
      botDelayMsOverride: { min: 80, max: 80 },
    });
    room.takeoverByBot("p1", "expert", now);
    expect(room.state.players["p1"]?.bot?.difficulty).toBe("expert");

    const socket = new FakeSocket();
    room.connect("p1", socket.asWebSocket());
    await vi.waitFor(() => expect(room.state.players["p1"]?.bot).toBeUndefined());
    const reclaimedRevision = room.state.revision;
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(room.state.revision).toBe(reclaimedRevision);

    room.close();
    store.close();
  });

  it("reschedules a bot decision when a room is restored", async () => {
    const store = new SqliteStore(":memory:");
    let state = postDealState("BOT-RESTORE");
    state = applyEvent(state, {
      type: "PLAYER_CONTROL_CHANGED",
      playerId: "p2",
      bot: { difficulty: "intermediate" },
      at: now,
    });
    store.createRoom(state);
    const revision = state.revision;
    const room = new Room(state, store, {
      timersEnabled: true,
      botDelayMsOverride: { min: 0, max: 0 },
    });

    await vi.waitFor(() => expect(room.state.revision).toBeGreaterThan(revision));

    room.close();
    store.close();
  });

  it("enforces lobby removal and disconnected-human takeover guards", () => {
    const store = new SqliteStore(":memory:");
    const manager = new RoomManager(store, { timersEnabled: false });
    const room = manager.createRoom({ at: now });
    const human = manager.joinRoom({
      roomId: room.state.roomId,
      name: "Ada",
      at: now,
    });
    const botId = manager.addBot(room.state.roomId, 1, "beginner", now);
    expect(() => room.takeoverByBot(human.playerId, "expert", now)).toThrow(
      "only available during a game",
    );
    expect(() => room.removeBot(human.playerId, now)).toThrow("Player is not a bot");
    room.removeBot(botId, now);
    expect(room.state.players[botId]).toBeUndefined();

    manager.close();
    store.close();
  });
});
