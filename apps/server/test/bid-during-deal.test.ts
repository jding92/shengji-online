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
    this.readyState = WebSocket.CLOSED;
    this.emit("close");
  }
  asWebSocket(): WebSocket {
    return this as unknown as WebSocket;
  }
}

/** Deals cards until some seat holds a card of the trump rank. */
function midDealStateWithBidder(): { state: GameState; bidderSeat: number } {
  let state = createGameState({
    roomId: "MIDDEAL",
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
  for (let seat = 0; seat < 4; seat += 1) {
    state = replayEvents(
      state,
      validateCommand(
        state,
        `p${seat}`,
        { type: "READY" },
        { now, roundSeed: "mid-deal-seed" },
      ),
    );
  }
  const bidderOf = (current: GameState): number | undefined =>
    [0, 1, 2, 3].find((seat) =>
      current.round!.hands[seat]!.some((id) => {
        const face = current.round!.cards[id]!.face;
        return face.kind === "standard" && face.rank === current.round!.trumpRank;
      }),
    );
  while (state.phase === "dealing" && bidderOf(state) === undefined) {
    state = replayEvents(state, getNextDealEvents(state, now));
  }
  expect(state.phase).toBe("dealing");
  return { state, bidderSeat: bidderOf(state)! };
}

describe("bidding while cards are still being dealt", () => {
  it("accepts a bid with a stale revision during the deal", async () => {
    const { state, bidderSeat } = midDealStateWithBidder();
    const store = new SqliteStore(":memory:");
    store.createRoom(state);
    const room = new Room(state, store, { timersEnabled: false });

    const bidCard = state.round!.hands[bidderSeat]!.find((id) => {
      const face = state.round!.cards[id]!.face;
      return face.kind === "standard" && face.rank === state.round!.trumpRank;
    })!;
    const socket = new FakeSocket();
    room.connect(`p${bidderSeat}`, socket.asWebSocket());
    await vi.waitFor(() =>
      expect(socket.received.some(({ type }) => type === "SNAPSHOT")).toBe(true),
    );

    // Deliberately stale: the deal has advanced the revision far past this.
    socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          protocolVersion: PROTOCOL_VERSION,
          roomId: room.state.roomId,
          playerToken: "test-token",
          requestId: "mid-deal-bid",
          expectedRevision: Math.max(0, room.state.revision - 20),
          command: { type: "BID", cards: [bidCard] },
        }),
      ),
    );

    await vi.waitFor(() => expect(room.state.round?.currentBid?.seat).toBe(bidderSeat));
    expect(socket.received.some(({ type }) => type === "COMMAND_REJECTED")).toBe(false);

    room.close();
    store.close();
  });
});
