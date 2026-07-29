import { describe, expect, it } from "vitest";
import {
  applyEvent,
  createGameState,
  fourPlayerTwoDeckFixedTeamRuleset,
  replayEvents,
  type GameEvent,
} from "../src/index.js";

const at = "2026-07-03T12:00:00.000Z";

function initialState() {
  return createGameState({
    roomId: "BOT-EVENTS",
    ruleset: fourPlayerTwoDeckFixedTeamRuleset,
    createdAt: at,
  });
}

describe("bot player events", () => {
  it("replays a bot join with durable control metadata", () => {
    const state = applyEvent(initialState(), {
      type: "PLAYER_JOINED",
      playerId: "bot-1",
      name: "Hades",
      bot: { difficulty: "advanced" },
      at,
    });

    expect(state.players["bot-1"]).toMatchObject({
      connected: true,
      bot: { difficulty: "advanced" },
    });
    expect(state.ranks["bot-1"]).toBe("2");
  });

  it("round-trips human takeover and token-backed reclaim", () => {
    const events: GameEvent[] = [
      { type: "PLAYER_JOINED", playerId: "human-1", name: "Ada", at },
      {
        type: "PLAYER_CONNECTION_CHANGED",
        playerId: "human-1",
        connected: false,
        at,
      },
      {
        type: "PLAYER_CONTROL_CHANGED",
        playerId: "human-1",
        bot: { difficulty: "expert" },
        at,
      },
      {
        type: "PLAYER_CONNECTION_CHANGED",
        playerId: "human-1",
        connected: false,
        at,
      },
      { type: "PLAYER_CONTROL_CHANGED", playerId: "human-1", at },
    ];

    const state = replayEvents(initialState(), events);

    expect(state.players["human-1"]).toEqual({
      id: "human-1",
      name: "Ada",
      seat: null,
      ready: false,
      connected: true,
    });
    expect(state.revision).toBe(events.length);
  });

  it("removes a lobby bot from its seat, rank map, and player map", () => {
    const events: GameEvent[] = [
      {
        type: "PLAYER_JOINED",
        playerId: "bot-1",
        name: "Poseidon",
        bot: { difficulty: "beginner" },
        at,
      },
      { type: "PLAYER_SEATED", playerId: "bot-1", seat: 2, at },
      { type: "PLAYER_READY_CHANGED", playerId: "bot-1", ready: true, at },
      { type: "PLAYER_REMOVED", playerId: "bot-1", at },
    ];

    const state = replayEvents(initialState(), events);

    expect(state.players["bot-1"]).toBeUndefined();
    expect(state.ranks["bot-1"]).toBeUndefined();
    expect(state.seats[2]).toBeNull();
  });
});
