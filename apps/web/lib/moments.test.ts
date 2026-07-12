import type { CardInstance, PrivateGameView } from "@shengji/protocol";
import { describe, expect, it } from "vitest";
import { deriveMoments } from "./moments";

type Round = NonNullable<PrivateGameView["publicRound"]>;

function card(id: string): CardInstance {
  return {
    id,
    deckIndex: 0,
    face: { kind: "standard", rank: "2", suit: "spades" },
  };
}

function view({
  phase = "playing",
  revision = 1,
  round,
}: {
  phase?: PrivateGameView["phase"];
  revision?: number;
  round?: Partial<Round>;
} = {}): PrivateGameView {
  const publicRound: Round = {
    roundNumber: 1,
    trumpRank: "2",
    attackerPoints: 0,
    throwPenaltyAdjustment: 0,
    cardCountsBySeat: {},
    completedTricksSummary: [],
    roundStats: { roundsWonByTeam: { A: 0, B: 0 } },
    bottomCount: 8,
    buriedBottomCount: 0,
    ...round,
  };

  return {
    roomId: "ABC123",
    revision,
    hostPlayerId: null,
    ruleset: {
      id: "test",
      name: "Test",
      players: 4,
      decks: 2,
      bottomSize: 8,
      presetId: "test",
      teamsMode: "fixed",
      options: {},
    },
    phase,
    you: { playerId: "p0", seat: 0, hand: [] },
    seats: [],
    publicRound,
    legalActions: [],
  };
}

describe("deriveMoments", () => {
  it("does not replay celebrations for a fresh seed view", () => {
    expect(
      deriveMoments(
        null,
        view({
          round: {
            attackerPoints: 45,
            completedTricksSummary: [{ leadSeat: 0, winnerSeat: 2, points: 10 }],
          },
        }),
      ),
    ).toEqual([]);
  });

  it("emits one moment per newly appended play", () => {
    const first = { seat: 0, cards: [card("a")] };
    const second = { seat: 1, cards: [card("b")] };
    const third = { seat: 2, cards: [card("c")] };
    const moments = deriveMoments(
      view({ round: { currentTrick: { leadSeat: 0, cardCount: 1, plays: [first] } } }),
      view({
        revision: 2,
        round: {
          currentTrick: { leadSeat: 0, cardCount: 1, plays: [first, second, third] },
        },
      }),
    );

    expect(moments).toEqual([
      { id: "play:1:0:1", type: "CARD_PLAYED", seat: 1, cards: second.cards },
      { id: "play:1:0:2", type: "CARD_PLAYED", seat: 2, cards: third.cards },
    ]);
  });

  it("treats a reset current trick as new plays", () => {
    const nextPlay = { seat: 2, cards: [card("c")] };

    expect(
      deriveMoments(
        view({
          round: {
            completedTricksSummary: [{ leadSeat: 0, winnerSeat: 1, points: 0 }],
          },
        }),
        view({
          revision: 2,
          round: {
            completedTricksSummary: [{ leadSeat: 0, winnerSeat: 1, points: 0 }],
            currentTrick: { leadSeat: 2, cardCount: 1, plays: [nextPlay] },
          },
        }),
      ),
    ).toEqual([
      { id: "play:1:1:0", type: "CARD_PLAYED", seat: 2, cards: nextPlay.cards },
    ]);
  });

  it("emits trick completion and point delta moments", () => {
    const moments = deriveMoments(
      view({ round: { attackerPoints: 10 } }),
      view({
        revision: 2,
        round: {
          attackerPoints: 25,
          completedTricksSummary: [{ leadSeat: 0, winnerSeat: 2, points: 15 }],
          lastCompletedTrick: {
            leadSeat: 0,
            winnerSeat: 2,
            points: 15,
            plays: [],
          },
        },
      }),
    );

    expect(moments).toEqual([
      {
        id: "trick-won:1:1",
        type: "TRICK_WON",
        winnerSeat: 2,
        points: 15,
        cards: [],
      },
      {
        id: "points-captured:1:25",
        type: "POINTS_CAPTURED",
        delta: 15,
        total: 25,
      },
    ]);
  });

  it("emits a trump declaration with the declaring seat when available", () => {
    const moments = deriveMoments(
      view({
        phase: "post-deal-bidding",
        round: {
          currentBid: {
            seat: 3,
            face: { kind: "standard", rank: "2", suit: "hearts" },
            count: 1,
            tier: "level-card",
            declares: { mode: "suit", rank: "2", suit: "hearts" },
          },
        },
      }),
      view({
        phase: "bottom-exchange",
        revision: 2,
        round: {
          currentBid: {
            seat: 3,
            face: { kind: "standard", rank: "2", suit: "hearts" },
            count: 1,
            tier: "level-card",
            declares: { mode: "suit", rank: "2", suit: "hearts" },
          },
          trumpSpec: { mode: "suit", rank: "2", suit: "hearts" },
        },
      }),
    );

    expect(moments).toEqual([
      { id: "trump-declared:1", type: "TRUMP_DECLARED", seat: 3 },
    ]);
  });

  it("emits kitty reveal, round end, and game over as sticky transitions", () => {
    const kittyCards = [card("bottom-a"), card("bottom-b")];
    const moments = deriveMoments(
      view({ phase: "round-scoring", round: { attackerPoints: 80 } }),
      view({
        phase: "game-over",
        revision: 2,
        round: {
          attackerPoints: 120,
          bottomReveal: {
            cards: kittyCards,
            multiplier: 4,
            pointsAwarded: 40,
          },
          outcome: {
            attackerPoints: 120,
            winner: "attackers",
            levelDelta: 1,
          },
        },
      }),
    );

    expect(moments).toEqual([
      {
        id: "points-captured:1:120",
        type: "POINTS_CAPTURED",
        delta: 40,
        total: 120,
      },
      {
        id: "kitty-revealed:1",
        type: "KITTY_REVEALED",
        cards: kittyCards,
        multiplier: 4,
        pointsAwarded: 40,
      },
      {
        id: "round-ended:1",
        type: "ROUND_ENDED",
        winner: "attackers",
        levelDelta: 1,
        attackerPoints: 120,
      },
      { id: "game-over:1", type: "GAME_OVER", winner: "attackers" },
    ]);
  });

  it("returns only sticky moments across a resync gap", () => {
    const kittyCards = [card("bottom")];
    const moments = deriveMoments(
      view({ round: { attackerPoints: 0 } }),
      view({
        revision: 10,
        round: {
          attackerPoints: 90,
          completedTricksSummary: [
            { leadSeat: 0, winnerSeat: 1, points: 10 },
            { leadSeat: 1, winnerSeat: 3, points: 20 },
          ],
          lastCompletedTrick: {
            leadSeat: 1,
            winnerSeat: 3,
            points: 20,
            plays: [],
          },
          bottomReveal: {
            cards: kittyCards,
            multiplier: 2,
            pointsAwarded: 0,
          },
          outcome: {
            attackerPoints: 90,
            winner: "attackers",
            levelDelta: 0,
          },
        },
      }),
    );

    expect(moments).toEqual([
      {
        id: "kitty-revealed:1",
        type: "KITTY_REVEALED",
        cards: kittyCards,
        multiplier: 2,
        pointsAwarded: 0,
      },
      {
        id: "round-ended:1",
        type: "ROUND_ENDED",
        winner: "attackers",
        levelDelta: 0,
        attackerPoints: 90,
      },
    ]);
  });

  it("resets per-round comparisons on round rollover", () => {
    const moments = deriveMoments(
      view({
        phase: "round-scoring",
        round: {
          roundNumber: 1,
          attackerPoints: 120,
          completedTricksSummary: [{ leadSeat: 0, winnerSeat: 2, points: 20 }],
          outcome: {
            attackerPoints: 120,
            winner: "attackers",
            levelDelta: 1,
          },
        },
      }),
      view({
        phase: "dealing",
        revision: 2,
        round: {
          roundNumber: 2,
          attackerPoints: 0,
          completedTricksSummary: [],
          currentTrick: {
            leadSeat: 0,
            cardCount: 1,
            plays: [{ seat: 0, cards: [card("a")] }],
          },
        },
      }),
    );

    expect(moments).toEqual([]);
  });
});
