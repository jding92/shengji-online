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
      expect(view.joinedPlayerCount).toBe(4);
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

  it("removes bid controls after the player passes", () => {
    let state = dealtState();
    expect(derivePrivateView(state, "p0").legalActions).toEqual(["bid", "pass-bid"]);

    state = replayEvents(
      state,
      validateCommand(state, "p0", { type: "PASS_BID" }, { now }),
    );

    expect(derivePrivateView(state, "p0").legalActions).toEqual([]);
    expect(derivePrivateView(state, "p1").legalActions).toEqual(["bid", "pass-bid"]);
  });

  it("exposes bot identity without widening the card boundary", () => {
    let state = dealtState();
    state = applyEvent(state, {
      type: "PLAYER_CONTROL_CHANGED",
      playerId: "p1",
      bot: { difficulty: "expert" },
      at: now,
    });

    const view = derivePrivateView(state, "p0");
    expect(view.seats[1]).toMatchObject({
      isBot: true,
      botDifficulty: "expert",
      connected: true,
    });
    expect(view.seats[0]).toMatchObject({ isBot: false });
    const serialized = JSON.stringify(view);
    for (const cardId of state.round!.hands[1]!) {
      expect(serialized).not.toContain(cardId);
    }
  });

  it("shows a buried bottom only to the leader until round scoring", () => {
    const state = dealtState();
    const buried = [...state.round!.bottom];
    state.round!.bottom = [];
    state.round!.buriedBottom = buried;
    state.leaderSeat = 0;
    state.phase = "playing";
    // The leader buried these from their own hand, so their view echoes them.
    const leaderView = derivePrivateView(state, "p0");
    expect(leaderView.you.buried?.map(({ id }) => id)).toEqual(buried);
    for (let seat = 1; seat < 4; seat += 1) {
      const serialized = JSON.stringify(derivePrivateView(state, `p${seat}`));
      for (const cardId of buried) expect(serialized).not.toContain(cardId);
    }
  });

  it("exposes only public completed plays and durable round summaries", () => {
    const state = dealtState();
    const plays = Array.from({ length: 4 }, (_, seat) => {
      const cardId = state.round!.hands[seat]!.shift()!;
      return {
        seat,
        cards: [state.round!.cards[cardId]!],
        format: null,
        eligibleToWin: true,
      };
    });
    state.round!.completedTricks.push({
      leadSeat: 0,
      winnerSeat: 2,
      points: 15,
      plays,
    });
    state.roundHistory = [
      {
        roundNumber: 1,
        defendingTeamId: "team-0",
        attackingTeamId: "team-1",
        winningTeamId: "team-1",
        outcome: { attackerPoints: 125, winner: "attackers", levelDelta: 1 },
        defenderSeats: [0, 2],
      },
    ];

    const view = derivePrivateView(state, "p0");
    expect(view.publicRound?.lastCompletedTrick).toMatchObject({
      leadSeat: 0,
      winnerSeat: 2,
      points: 15,
    });
    expect(view.publicRound?.lastCompletedTrick?.plays).toHaveLength(4);
    expect(view.publicRound?.roundStats).toEqual({
      roundsWonByTeam: { "team-0": 0, "team-1": 1 },
      previousRound: {
        roundNumber: 1,
        winningTeamId: "team-1",
        winner: "attackers",
        attackerPoints: 125,
        levelDelta: 1,
        defenderSeats: [0, 2],
      },
    });

    const serialized = JSON.stringify(view);
    for (let seat = 1; seat < 4; seat += 1) {
      for (const cardId of state.round!.hands[seat]!) {
        expect(serialized).not.toContain(cardId);
      }
    }
  });
});
