import { describe, expect, it } from "vitest";
import {
  applyEvent,
  createGameState,
  fourPlayerTwoDeckFixedTeamRuleset,
  getFinalizeBiddingEvents,
  getForcedPlayEvents,
  getNextDealEvents,
  parseTrickFormat,
  selectForcedBury,
  selectForcedFollow,
  sumCardPoints,
  validateCommand,
  validateFollow,
  createDeck,
  type CardInstance,
  type GameEvent,
  type GameState,
  type Rank,
  type Suit,
  type TrumpSpec,
} from "../src/index.js";

const at = "2026-06-19T12:00:00.000Z";
const trump: TrumpSpec = { mode: "suit", rank: "2", suit: "hearts" };
const deck = createDeck(2);

function card(suit: Suit, rank: Rank, deckIndex = 0): CardInstance {
  return deck.find(
    (candidate) =>
      candidate.deckIndex === deckIndex &&
      candidate.face.kind === "standard" &&
      candidate.face.suit === suit &&
      candidate.face.rank === rank,
  )!;
}

function pair(suit: Suit, rank: Rank): CardInstance[] {
  return [card(suit, rank, 0), card(suit, rank, 1)];
}

describe("selectForcedFollow", () => {
  it("follows a single with the lowest card of the led suit", () => {
    const hand = [card("spades", "A"), card("spades", "4"), card("clubs", "3")];
    const led = parseTrickFormat([card("spades", "9", 1)], trump);
    const selected = selectForcedFollow(hand, led, trump);
    expect(selected.map(({ face }) => face)).toEqual([
      { kind: "standard", suit: "spades", rank: "4" },
    ]);
  });

  it("follows a pair with the lowest pair in suit", () => {
    const hand = [...pair("spades", "K"), ...pair("spades", "6"), card("spades", "3")];
    const led = parseTrickFormat(pair("spades", "9"), trump);
    const selected = selectForcedFollow(hand, led, trump);
    expect(selected).toHaveLength(2);
    expect(
      validateFollow({ cards: selected, hand, ledFormat: led, trump }),
    ).toBeTruthy();
    expect(
      selected.map(({ face }) => (face.kind === "standard" ? face.rank : "")),
    ).toEqual(["6", "6"]);
  });

  it("plays remaining suit cards plus expendable fillers when short-suited", () => {
    const hand = [card("spades", "4"), card("clubs", "5"), card("diamonds", "3")];
    const led = parseTrickFormat(pair("spades", "9"), trump);
    const selected = selectForcedFollow(hand, led, trump);
    expect(selected).toHaveLength(2);
    expect(selected.map(({ id }) => id)).toContain(card("spades", "4").id);
    // Filler avoids the point card (5 of clubs).
    expect(selected.map(({ id }) => id)).toContain(card("diamonds", "3").id);
    expect(
      validateFollow({ cards: selected, hand, ledFormat: led, trump }),
    ).toBeTruthy();
  });

  it("selects a valid follow against a tractor lead", () => {
    const hand = [
      ...pair("spades", "5"),
      ...pair("spades", "6"),
      card("spades", "10"),
      card("clubs", "3"),
    ];
    const led = parseTrickFormat(
      [...pair("spades", "8"), ...pair("spades", "9")],
      trump,
    );
    const selected = selectForcedFollow(hand, led, trump);
    expect(selected).toHaveLength(4);
    expect(
      validateFollow({ cards: selected, hand, ledFormat: led, trump }),
    ).toBeTruthy();
  });

  it("plays entirely off-suit when void in the led suit", () => {
    const hand = [card("clubs", "3"), card("diamonds", "4"), card("clubs", "8")];
    const led = parseTrickFormat([card("spades", "9")], trump);
    const selected = selectForcedFollow(hand, led, trump);
    expect(selected).toHaveLength(1);
    expect(
      validateFollow({ cards: selected, hand, ledFormat: led, trump }),
    ).toBeTruthy();
  });
});

describe("selectForcedBury", () => {
  it("buries low non-point, non-trump cards first", () => {
    const hand = [
      card("hearts", "A"), // trump suit
      card("spades", "K"), // point card
      card("spades", "3"),
      card("clubs", "4"),
      card("diamonds", "10"), // point card
      card("clubs", "J"),
    ];
    const buried = selectForcedBury(hand, 3, trump);
    expect(buried.map(({ id }) => id)).toEqual([
      card("spades", "3").id,
      card("clubs", "4").id,
      card("clubs", "J").id,
    ]);
    expect(sumCardPoints(buried)).toBe(0);
  });
});

describe("getForcedPlayEvents completes a full round without human input", () => {
  function dealAndFinalize(seed: string): GameState {
    let state = createGameState({
      roomId: "FORCED",
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
          { now: at, roundSeed: seed },
        ),
      );
    }
    while (state.phase === "dealing")
      state = replay(state, getNextDealEvents(state, at));

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

  function replay(state: GameState, events: readonly GameEvent[]): GameState {
    return events.reduce((next, event) => applyEvent(next, event), state);
  }

  it.each(["seed-a", "seed-b", "seed-c"])("with %s", (seed) => {
    let state = dealAndFinalize(seed);
    expect(state.phase).toBe("bottom-exchange");

    let safety = 0;
    while (state.phase === "bottom-exchange" || state.phase === "playing") {
      const events = getForcedPlayEvents(state, at);
      expect(events.length).toBeGreaterThan(0);
      state = replay(state, events);
      safety += 1;
      if (safety > 500) throw new Error("Forced play failed to finish the round");
    }
    expect(state.phase).toBe("round-scoring");
    expect(state.round!.outcome).toBeDefined();
  });
});
