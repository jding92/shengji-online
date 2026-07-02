import { describe, expect, it, vi } from "vitest";
import {
  applyEvent,
  createGameState,
  fourPlayerTwoDeckFixedTeamRuleset,
  getFinalizeBiddingEvents,
  getNextDealEvents,
  validateCommand,
  type GameEvent,
  type GameState,
} from "@shengji/engine";
import { SqliteStore } from "../src/persistence/sqlite-store.js";
import { Room } from "../src/room.js";

const at = "2026-06-19T12:00:00.000Z";

function replay(state: GameState, events: readonly GameEvent[]): GameState {
  return events.reduce((next, event) => applyEvent(next, event), state);
}

/** Drives a fresh game to the bottom-exchange phase without any sockets. */
function stateAtBottomExchange(): GameState {
  let state = createGameState({
    roomId: "TIMEOUT",
    ruleset: fourPlayerTwoDeckFixedTeamRuleset,
    createdAt: at,
  });
  for (let seat = 0; seat < 4; seat += 1) {
    const playerId = `p${seat}`;
    state = applyEvent(state, {
      type: "PLAYER_JOINED",
      playerId,
      name: `P${seat}`,
      at,
    });
    state = replay(
      state,
      validateCommand(state, playerId, { type: "SIT", seat }, { now: at }),
    );
  }
  for (let seat = 0; seat < 4; seat += 1) {
    state = replay(
      state,
      validateCommand(
        state,
        `p${seat}`,
        { type: "READY" },
        { now: at, roundSeed: "turn-timeout-seed" },
      ),
    );
  }
  while (state.phase === "dealing") state = replay(state, getNextDealEvents(state, at));

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
  state = replay(
    state,
    validateCommand(
      state,
      `p${bidderSeat}`,
      { type: "BID", cards: [bidCard] },
      { now: at },
    ),
  );
  return replay(state, getFinalizeBiddingEvents(state, at));
}

describe("turn timeout auto-play", () => {
  it("force-plays absent players until the round completes", async () => {
    const store = new SqliteStore(":memory:");
    const state = stateAtBottomExchange();
    expect(state.phase).toBe("bottom-exchange");
    store.createRoom(state);

    const room = new Room(state, store, {
      timersEnabled: true,
      turnTimeoutMsOverride: { connected: 5, disconnected: 5 },
    });

    await vi.waitFor(() => expect(room.state.phase).toBe("round-scoring"), {
      timeout: 20_000,
      interval: 50,
    });
    expect(room.state.round?.outcome).toBeDefined();

    room.close();
    store.close();
  }, 30_000);
});
