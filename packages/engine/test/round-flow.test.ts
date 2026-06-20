import { describe, expect, it } from "vitest";
import {
  applyEvent,
  createGameState,
  fourPlayerTwoDeckFixedTeamRuleset,
  getEffectiveSuit,
  getFinalizeBiddingEvents,
  getNextDealEvents,
  replayEvents,
  validateCommand,
  type GameEvent,
  type GameState,
} from "../src/index.js";

const now = "2026-06-19T12:00:00.000Z";
const playerIds = ["p0", "p1", "p2", "p3"];

function setupLobby(): { initial: GameState; state: GameState; events: GameEvent[] } {
  const initial = createGameState({
    roomId: "ROOM01",
    ruleset: fourPlayerTwoDeckFixedTeamRuleset,
    createdAt: now,
  });
  let state = initial;
  const events: GameEvent[] = [];
  for (const [seat, playerId] of playerIds.entries()) {
    const joined: GameEvent = {
      type: "PLAYER_JOINED",
      playerId,
      name: `Player ${seat + 1}`,
      at: now,
    };
    events.push(joined);
    state = applyEvent(state, joined);
    const seated = validateCommand(state, playerId, { type: "SIT", seat }, { now });
    events.push(...seated);
    state = replayEvents(state, seated);
  }
  return { initial, state, events };
}

function readyAndDeal(
  setup: ReturnType<typeof setupLobby>,
): ReturnType<typeof setupLobby> {
  let { state } = setup;
  const { initial, events } = setup;
  for (const playerId of playerIds) {
    const ready = validateCommand(
      state,
      playerId,
      { type: "READY" },
      { now, roundSeed: "round-one-seed" },
    );
    events.push(...ready);
    state = replayEvents(state, ready);
  }
  expect(state.phase).toBe("dealing");

  while (state.phase === "dealing") {
    const deal = getNextDealEvents(state, now);
    expect(deal.length).toBeGreaterThan(0);
    events.push(...deal);
    state = replayEvents(state, deal);
  }
  return { initial, state, events };
}

describe("event-sourced round flow", () => {
  it("starts only after all four seated players are ready and deals 25 cards each", () => {
    const setup = readyAndDeal(setupLobby());

    expect(setup.state.phase).toBe("post-deal-bidding");
    expect(Object.values(setup.state.round!.hands).map((hand) => hand.length)).toEqual([
      25, 25, 25, 25,
    ]);
    expect(setup.state.round!.bottom).toHaveLength(8);
    expect(setup.state.round!.biddingDeadline).toBe("2026-06-19T12:00:30.000Z");
    expect(replayEvents(setup.initial, setup.events)).toEqual(setup.state);
  });

  it("bids, finalizes trump, exchanges the bottom, and completes a trick", () => {
    const setup = readyAndDeal(setupLobby());
    let { state } = setup;
    const { initial, events } = setup;

    const bidderSeat = Object.keys(state.round!.hands)
      .map(Number)
      .find((seat) =>
        state.round!.hands[seat]!.some((id) => {
          const face = state.round!.cards[id]!.face;
          return face.kind === "standard" && face.rank === "2";
        }),
      )!;
    const bidderId = state.seats[bidderSeat]!;
    const bidCard = state.round!.hands[bidderSeat]!.find((id) => {
      const face = state.round!.cards[id]!.face;
      return face.kind === "standard" && face.rank === "2";
    })!;
    const bidEvents = validateCommand(
      state,
      bidderId,
      { type: "BID", cards: [bidCard] },
      { now },
    );
    events.push(...bidEvents);
    state = replayEvents(state, bidEvents);

    const finalized = getFinalizeBiddingEvents(state, now);
    events.push(...finalized);
    state = replayEvents(state, finalized);
    expect(state.phase).toBe("bottom-exchange");
    expect(state.leaderSeat).toBe(bidderSeat);
    expect(state.round!.hands[bidderSeat]).toHaveLength(33);

    const buried = state.round!.hands[bidderSeat]!.slice(0, 8);
    const buryEvents = validateCommand(
      state,
      bidderId,
      { type: "BURY_BOTTOM", cards: buried },
      { now },
    );
    events.push(...buryEvents);
    state = replayEvents(state, buryEvents);
    expect(state.phase).toBe("playing");
    expect(state.round!.buriedBottom).toEqual(buried);
    expect(
      Object.values(state.round!.hands).reduce((sum, hand) => sum + hand.length, 0),
    ).toBe(100);

    const leadCard = state.round!.hands[bidderSeat]![0]!;
    const leadEvents = validateCommand(
      state,
      bidderId,
      { type: "PLAY_CARDS", cards: [leadCard], intent: "normal" },
      { now },
    );
    events.push(...leadEvents);
    state = replayEvents(state, leadEvents);
    const ledSuit = state.round!.currentTrick!.ledFormat.effectiveSuit;

    for (let offset = 1; offset < 4; offset += 1) {
      const seat = (bidderSeat + offset) % 4;
      const playerId = state.seats[seat]!;
      const hand = state.round!.hands[seat]!;
      const matching = hand.find(
        (id) =>
          getEffectiveSuit(state.round!.cards[id]!, state.round!.trumpSpec!) ===
          ledSuit,
      );
      const card = matching ?? hand[0]!;
      const playEvents = validateCommand(
        state,
        playerId,
        { type: "PLAY_CARDS", cards: [card], intent: "normal" },
        { now },
      );
      events.push(...playEvents);
      state = replayEvents(state, playEvents);
    }

    expect(state.round!.completedTricks).toHaveLength(1);
    expect(state.round!.currentTrick).toBeUndefined();
    expect(Object.values(state.round!.hands).every((hand) => hand.length === 24)).toBe(
      true,
    );
    expect(replayEvents(initial, events)).toEqual(state);
  });

  it("redeals the same round when the bidding timer expires without a bid", () => {
    const { state } = readyAndDeal(setupLobby());
    const events = getFinalizeBiddingEvents(state, now, "fresh-redeal-seed");
    expect(events).toMatchObject([
      { type: "ROUND_STARTED", roundNumber: 1, seed: "fresh-redeal-seed" },
    ]);
    const redealt = replayEvents(state, events);
    expect(redealt.phase).toBe("dealing");
    expect(redealt.round!.currentBid).toBeUndefined();
    expect(redealt.round!.undealt).toHaveLength(108);
  });
});
