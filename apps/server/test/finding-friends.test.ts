import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import {
  applyEvent,
  createGameState,
  fivePlayerTwoDeckFindingFriendsRuleset,
  getFinalizeBiddingEvents,
  getNextDealEvents,
  validateCommand,
  type GameEvent,
  type GameState,
} from "@shengji/engine";
import {
  PROTOCOL_VERSION,
  type ServerEnvelope,
  type WireClientCommand,
} from "@shengji/protocol";
import { SqliteStore } from "../src/persistence/sqlite-store.js";
import { RoomManager } from "../src/room-manager.js";
import { Room } from "../src/room.js";

const now = "2026-07-12T12:00:00.000Z";
const FF_PRESET_ID = "shengji-ff-5p-2d-v1";
// defaultFriendCallCount(5) = floor(5/2) - 1 = 1.
const FF_CALL_COUNT = 1;

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

function snapshotsOf(
  socket: FakeSocket,
): Extract<ServerEnvelope, { type: "SNAPSHOT" }>[] {
  return socket.received.filter(
    (envelope): envelope is Extract<ServerEnvelope, { type: "SNAPSHOT" }> =>
      envelope.type === "SNAPSHOT",
  );
}

describe("finding-friends server integration", () => {
  it("runs a 5-bot-and-human FF room through friend-calling into a scored round", async () => {
    const store = new SqliteStore(":memory:");
    const manager = new RoomManager(store, {
      timersEnabled: true,
      dealIntervalMs: 0,
      botDelayMsOverride: { min: 0, max: 0 },
      botNextRoundDelayMs: 0,
      turnTimeoutMsOverride: { connected: 5, disconnected: 5 },
    });
    const room = await manager.createRoom({
      at: now,
      presetId: FF_PRESET_ID,
      options: { timers: { postDealWindowSeconds: 1, responseWindowSeconds: 1 } },
    });
    expect(room.state.rulesetSnapshot.players.count).toBe(5);
    expect(room.state.rulesetSnapshot.teams.mode).toBe("finding-friends");

    const human = await manager.joinRoom({
      roomId: room.state.roomId,
      name: "Ada",
      at: now,
    });
    const humanSocket = new FakeSocket();
    room.connect(human.playerId, humanSocket.asWebSocket());
    await send(room, humanSocket, { type: "SIT", seat: 0 });
    await send(room, humanSocket, { type: "READY", ready: true });

    // The host (any member, per the flagged default) adds bots to the four
    // remaining seats; the last addition fills the table and auto-starts.
    const botIds: string[] = [];
    for (let seat = 1; seat < 5; seat += 1) {
      botIds.push(await manager.addBot(room.state.roomId, seat, "intermediate", now));
    }
    expect(botIds).toHaveLength(4);
    expect(room.state.phase).not.toBe("lobby");

    await vi.waitFor(() => expect(room.state.round?.roundNumber).toBe(2), {
      timeout: 30_000,
      interval: 20,
    });

    // The human's broadcast history proves the friend-calling phase was
    // reached and the room's snapshots carried the right public fields
    // through it, regardless of whether the declarer turned out to be the
    // human or a bot.
    const snapshots = snapshotsOf(humanSocket);
    const friendCallingIndex = snapshots.findIndex(
      (envelope) => envelope.view.phase === "friend-calling",
    );
    expect(friendCallingIndex).toBeGreaterThanOrEqual(0);
    const friendCallingView = snapshots[friendCallingIndex]!.view;
    expect(friendCallingView.publicRound?.declarerSeat).toEqual(expect.any(Number));
    expect(friendCallingView.publicRound?.friendCalls).toBeUndefined();

    const postCallView = snapshots
      .slice(friendCallingIndex + 1)
      .map((envelope) => envelope.view)
      .find((view) => view.publicRound?.friendCalls !== undefined);
    expect(postCallView).toBeDefined();
    expect(postCallView!.publicRound!.friendCalls).toHaveLength(FF_CALL_COUNT);
    expect(postCallView!.publicRound!.declarerSeat).toBe(
      friendCallingView.publicRound!.declarerSeat,
    );

    // Round 1 completed with a scored outcome (win-condition accounting ran).
    expect(room.state.roundHistory).toHaveLength(1);
    expect(room.state.roundHistory![0]!.outcome).toBeDefined();

    manager.close();
    store.close();
  }, 40_000);
});

function replay(state: GameState, events: readonly GameEvent[]): GameState {
  return events.reduce((next, event) => applyEvent(next, event), state);
}

/** Drives a fresh FF game to friend-calling without any sockets. */
function stateAtFriendCalling(): GameState {
  let state = createGameState({
    roomId: "FF-TIMEOUT",
    ruleset: fivePlayerTwoDeckFindingFriendsRuleset,
    createdAt: now,
  });
  for (let seat = 0; seat < 5; seat += 1) {
    const playerId = `p${seat}`;
    state = applyEvent(state, {
      type: "PLAYER_JOINED",
      playerId,
      name: `P${seat}`,
      at: now,
    });
    state = replay(
      state,
      validateCommand(state, playerId, { type: "SIT", seat }, { now }),
    );
  }
  for (let seat = 0; seat < 5; seat += 1) {
    state = replay(
      state,
      validateCommand(
        state,
        `p${seat}`,
        { type: "READY" },
        { now, roundSeed: "ff-timeout-seed" },
      ),
    );
  }
  while (state.phase === "dealing") {
    state = replay(state, getNextDealEvents(state, now));
  }

  // Round 1's provisional rank and every player's own rank both start at the
  // ruleset's starting rank, so a single card of that rank is a valid
  // level-card bid under bidder-own-rank sourcing too.
  const bidderSeat = [0, 1, 2, 3, 4].find((seat) =>
    state.round!.hands[seat]!.some((id) => {
      const face = state.round!.cards[id]!.face;
      return face.kind === "standard" && face.rank === state.round!.trumpRank;
    }),
  )!;
  const bidCard = state.round!.hands[bidderSeat]!.find((id) => {
    const face = state.round!.cards[id]!.face;
    return face.kind === "standard" && face.rank === state.round!.trumpRank;
  })!;
  state = replay(
    state,
    validateCommand(
      state,
      `p${bidderSeat}`,
      { type: "BID", cards: [bidCard] },
      { now },
    ),
  );
  state = replay(state, getFinalizeBiddingEvents(state, now));
  expect(state.phase).toBe("bottom-exchange");
  expect(state.round?.declarerSeat).toBe(bidderSeat);

  const bottomSize = state.rulesetSnapshot.bottom.size;
  const buryCards = state.round!.hands[bidderSeat]!.slice(0, bottomSize);
  state = replay(
    state,
    validateCommand(
      state,
      `p${bidderSeat}`,
      { type: "BURY_BOTTOM", cards: buryCards },
      { now },
    ),
  );
  return state;
}

describe("finding-friends declarer timeout", () => {
  it("auto-calls friends for a stalled human declarer via the forced-event fallback", async () => {
    const store = new SqliteStore(":memory:");
    const state = stateAtFriendCalling();
    expect(state.phase).toBe("friend-calling");
    store.createRoom(state);

    const room = new Room(state, store, {
      timersEnabled: true,
      turnTimeoutMsOverride: { connected: 5, disconnected: 5 },
    });

    // FRIENDS_CALLED and the subsequent phase move to "playing" commit
    // together, and friendCalls stays set for the rest of round 1, so this
    // condition is stable even if later forced trick-plays race ahead.
    await vi.waitFor(() => expect(room.state.round?.friendCalls).toBeDefined(), {
      timeout: 5_000,
      interval: 5,
    });

    expect(room.state.phase).toBe("playing");
    const calls = room.state.round!.friendCalls!;
    expect(calls).toHaveLength(FF_CALL_COUNT);
    for (const call of calls) {
      expect(call.face.kind).toBe("standard");
      expect(call.copyIndex).toBeGreaterThanOrEqual(1);
      expect(call.copyIndex).toBeLessThanOrEqual(
        room.state.rulesetSnapshot.decks.count,
      );
    }

    room.close();
    store.close();
  });
});
