import {
  applyEvent,
  createGameState,
  fourPlayerTwoDeckFixedTeamRuleset,
  getNextDealEvents,
  replayEvents,
  validateCommand,
  type GameEvent,
} from "@shengji/engine";
import { describe, expect, it } from "vitest";
import { derivePrivateView } from "../src/private-views/derive-private-view.js";

const now = "2026-06-19T12:00:00.000Z";

function dealtState() {
  let state = createGameState({
    roomId: "PRIVATE",
    ruleset: fourPlayerTwoDeckFixedTeamRuleset,
    createdAt: now,
  });
  for (let seat = 0; seat < 4; seat += 1) {
    const playerId = `p${seat}`;
    const joined: GameEvent = {
      type: "PLAYER_JOINED",
      playerId,
      name: `Player ${seat}`,
      at: now,
    };
    state = applyEvent(state, joined);
    state = replayEvents(
      state,
      validateCommand(state, playerId, { type: "SIT", seat }, { now }),
    );
  }
  for (let seat = 0; seat < 4; seat += 1) {
    const playerId = `p${seat}`;
    state = replayEvents(
      state,
      validateCommand(
        state,
        playerId,
        { type: "READY" },
        { now, roundSeed: "private-view-seed" },
      ),
    );
  }
  while (state.phase === "dealing") {
    state = replayEvents(state, getNextDealEvents(state, now));
  }
  return state;
}

describe("private views", () => {
  it("shows each player only their own hand", () => {
    const state = dealtState();
    for (let seat = 0; seat < 4; seat += 1) {
      const view = derivePrivateView(state, `p${seat}`);
      expect(view.you.hand).toHaveLength(25);
      expect(view.seats.map(({ cardCount }) => cardCount)).toEqual([25, 25, 25, 25]);
      const serialized = JSON.stringify(view);
      for (let otherSeat = 0; otherSeat < 4; otherSeat += 1) {
        if (otherSeat === seat) continue;
        for (const cardId of state.round!.hands[otherSeat]!) {
          expect(serialized).not.toContain(cardId);
        }
      }
    }
  });

  it("does not expose the deck seed or bottom cards", () => {
    const state = dealtState();
    const serialized = JSON.stringify(derivePrivateView(state, "p0"));
    expect(serialized).not.toContain(state.round!.deckSeed);
    for (const cardId of state.round!.bottom) expect(serialized).not.toContain(cardId);
    expect(derivePrivateView(state, "p0").publicRound?.bottomCount).toBe(8);
  });

  it("keeps a buried bottom private until round scoring", () => {
    const state = dealtState();
    const buried = [...state.round!.bottom];
    state.round!.bottom = [];
    state.round!.buriedBottom = buried;
    state.phase = "playing";
    for (let seat = 0; seat < 4; seat += 1) {
      const serialized = JSON.stringify(derivePrivateView(state, `p${seat}`));
      for (const cardId of buried) expect(serialized).not.toContain(cardId);
    }
  });
});
