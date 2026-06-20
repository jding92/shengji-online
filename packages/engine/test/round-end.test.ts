import { describe, expect, it } from "vitest";
import {
  applyEvent,
  createDeck,
  createGameState,
  fourPlayerTwoDeckFixedTeamRuleset,
  parseTrickFormat,
  replayEvents,
  validateCommand,
  type CardInstance,
  type GameEvent,
  type GameState,
  type Rank,
} from "../src/index.js";

const now = "2026-06-19T12:00:00.000Z";

function finalTrickState(input: {
  defendingRank?: Rank;
  defenderWinsLast?: boolean;
}): GameState {
  let state = createGameState({
    roomId: "ENDING",
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
    state = applyEvent(state, {
      type: "PLAYER_SEATED",
      playerId,
      seat,
      at: now,
    });
  }
  if (input.defendingRank !== undefined) {
    state.ranks.p0 = input.defendingRank;
    state.ranks.p2 = input.defendingRank;
  }

  const deck = createDeck(2);
  const standard = (suit: string, rank: string, deckIndex = 0): CardInstance =>
    deck.find(
      (card) =>
        card.deckIndex === deckIndex &&
        card.face.kind === "standard" &&
        card.face.suit === suit &&
        card.face.rank === rank,
    )!;
  const trump = { mode: "suit", rank: "3", suit: "hearts" } as const;
  const lead = input.defenderWinsLast ? standard("clubs", "A") : standard("clubs", "4");
  const second = input.defenderWinsLast
    ? standard("clubs", "4")
    : standard("clubs", "A");
  const third = standard("clubs", "6");
  const final = standard("clubs", "8");
  const format = (card: CardInstance) => parseTrickFormat([card], trump);
  const buried = [
    standard("spades", "K", 0),
    standard("spades", "K", 1),
    standard("diamonds", "2", 0),
    standard("diamonds", "4", 0),
    standard("diamonds", "6", 0),
    standard("diamonds", "7", 0),
    standard("diamonds", "8", 0),
    standard("diamonds", "9", 0),
  ];
  state.phase = "playing";
  state.leaderSeat = 0;
  state.defendingTeamId = "team-0";
  state.attackingTeamId = "team-1";
  state.round = {
    roundNumber: 1,
    trumpRank: "3",
    trumpSpec: trump,
    deckSeed: "fixture",
    cards: Object.fromEntries(deck.map((card) => [card.id, card])),
    undealt: [],
    bottom: [],
    buriedBottom: buried.map(({ id }) => id),
    hands: { 0: [], 1: [], 2: [], 3: [final.id] },
    passedBidSeats: [],
    currentTurnSeat: 3,
    currentTrick: {
      leadSeat: 0,
      ledFormat: format(lead),
      plays: [
        { seat: 0, cards: [lead], format: format(lead), eligibleToWin: true },
        { seat: 1, cards: [second], format: format(second), eligibleToWin: true },
        { seat: 2, cards: [third], format: format(third), eligibleToWin: true },
      ],
    },
    completedTricks: [],
    attackerPoints: 0,
    throwPenaltyAdjustment: 0,
  };
  return state;
}

describe("round completion", () => {
  it("awards a 2x bottom when attackers take the last single trick", () => {
    const state = finalTrickState({});
    const finalCard = state.round!.hands[3]![0]!;
    const events = validateCommand(
      state,
      "p3",
      { type: "PLAY_CARDS", cards: [finalCard], intent: "normal" },
      { now },
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "BOTTOM_REVEALED",
        multiplier: 2,
        pointsAwarded: 40,
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "ROUND_SCORED",
        outcome: { attackerPoints: 40, winner: "defenders", levelDelta: 1 },
      }),
    );
    const completed = replayEvents(state, events);
    expect(completed.phase).toBe("round-scoring");
    expect(completed.ranks).toMatchObject({ p0: "3", p2: "3" });
    expect(completed.leaderSeat).toBe(2);
  });

  it("ends the game when the A-level defenders hold", () => {
    const state = finalTrickState({ defendingRank: "A", defenderWinsLast: true });
    const events = validateCommand(
      state,
      "p3",
      {
        type: "PLAY_CARDS",
        cards: [state.round!.hands[3]![0]!],
        intent: "normal",
      },
      { now },
    );
    expect(events).toContainEqual({
      type: "GAME_ENDED",
      winnerTeamId: "team-0",
      at: now,
    });
    expect(replayEvents(state, events).phase).toBe("game-over");
  });
});
