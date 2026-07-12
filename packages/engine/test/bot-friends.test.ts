import { describe, expect, it } from "vitest";
import {
  applyEvent,
  botConfigForDifficulty,
  chooseFriendCallsForHand,
  createDeck,
  createGameState,
  decideBotAction,
  deriveBotObservation,
  fivePlayerTwoDeckFindingFriendsRuleset,
  getForcedFriendCallEvents,
  replayEvents,
  sixPlayerThreeDeckFindingFriendsRuleset,
  validateCommand,
  type CardInstance,
  type GameState,
  type ShengJiRuleset,
} from "../src/index.js";

const now = "2026-07-11T12:00:00.000Z";
const ffTrump = { mode: "suit", rank: "3", suit: "hearts" } as const;

function faceOf(suit: string, rank: string) {
  return { kind: "standard", suit, rank } as const;
}

function standardCard(
  deck: readonly CardInstance[],
  suit: string,
  rank: string,
  deckIndex = 0,
): CardInstance {
  const card = deck.find(
    (candidate) =>
      candidate.deckIndex === deckIndex &&
      candidate.face.kind === "standard" &&
      candidate.face.suit === suit &&
      candidate.face.rank === rank,
  );
  if (card === undefined) throw new Error(`Missing ${suit} ${rank} #${deckIndex}`);
  return card;
}

/** Friend-calling state with declarer seat 0 holding the given cards. */
function friendCallingState(
  declarerHand: CardInstance[],
  ruleset: ShengJiRuleset = fivePlayerTwoDeckFindingFriendsRuleset,
): GameState {
  let state = createGameState({ roomId: "FF-CALLS", ruleset, createdAt: now });
  for (let seat = 0; seat < ruleset.players.count; seat += 1) {
    state = applyEvent(state, {
      type: "PLAYER_JOINED",
      playerId: `p${seat}`,
      name: `Player ${seat}`,
      at: now,
    });
    state = applyEvent(state, {
      type: "PLAYER_SEATED",
      playerId: `p${seat}`,
      seat,
      at: now,
    });
  }
  const deck = createDeck(ruleset.decks.count);
  const hands: Record<number, string[]> = {};
  for (let seat = 0; seat < ruleset.players.count; seat += 1) hands[seat] = [];
  hands[0] = declarerHand.map(({ id }) => id);
  state.phase = "friend-calling";
  state.leaderSeat = 0;
  state.defendingTeamId = "defenders";
  state.attackingTeamId = "attackers";
  state.round = {
    roundNumber: 1,
    redealCount: 0,
    trumpRank: "3",
    trumpSpec: ffTrump,
    deckSeed: "crafted",
    cards: Object.fromEntries(deck.map((card) => [card.id, card])),
    undealt: [],
    bottom: [],
    hands,
    passedBidSeats: [],
    completedTricks: [],
    declarerSeat: 0,
    currentTurnSeat: 0,
    attackerPoints: 0,
    throwPenaltyAdjustment: 0,
  };
  return state;
}

describe("chooseFriendCallsForHand", () => {
  const deck = createDeck(2);

  it("calls the first copy of the highest callable face the hand lacks", () => {
    const calls = chooseFriendCallsForHand({
      hand: [standardCard(deck, "clubs", "4"), standardCard(deck, "spades", "7")],
      trumpSpec: ffTrump,
      callCount: 1,
    });
    expect(calls).toEqual([{ face: faceOf("spades", "A"), copyIndex: 1 }]);
  });

  it("skips absent faces the hand fully holds and continues down the ranking", () => {
    const calls = chooseFriendCallsForHand({
      hand: [
        standardCard(deck, "spades", "A", 0),
        standardCard(deck, "spades", "A", 1),
      ],
      trumpSpec: ffTrump,
      callCount: 2,
    });
    expect(calls).toEqual([
      { face: faceOf("clubs", "A"), copyIndex: 1 },
      { face: faceOf("diamonds", "A"), copyIndex: 1 },
    ]);
  });

  it("prefers a fully absent lower face over a held ace", () => {
    const calls = chooseFriendCallsForHand({
      hand: [
        standardCard(deck, "spades", "A"),
        standardCard(deck, "clubs", "A"),
        standardCard(deck, "diamonds", "A"),
      ],
      trumpSpec: ffTrump,
      callCount: 1,
    });
    expect(calls).toEqual([{ face: faceOf("spades", "K"), copyIndex: 1 }]);
  });

  it("never proposes trump-suit or level-rank faces", () => {
    const calls = chooseFriendCallsForHand({
      hand: [],
      trumpSpec: { mode: "suit", rank: "A", suit: "hearts" },
      callCount: 3,
    });
    expect(calls).toEqual([
      { face: faceOf("spades", "K"), copyIndex: 1 },
      { face: faceOf("clubs", "K"), copyIndex: 1 },
      { face: faceOf("diamonds", "K"), copyIndex: 1 },
    ]);
  });

  it("allows every suit under no-trump", () => {
    const calls = chooseFriendCallsForHand({
      hand: [],
      trumpSpec: { mode: "no-trump", rank: "3" },
      callCount: 2,
    });
    expect(calls).toEqual([
      { face: faceOf("spades", "A"), copyIndex: 1 },
      { face: faceOf("hearts", "A"), copyIndex: 1 },
    ]);
  });

  it("falls back to the highest face held in the fewest copies when nothing is absent", () => {
    const everyCallableOnce = deck.filter(
      (card) =>
        card.deckIndex === 0 &&
        card.face.kind === "standard" &&
        card.face.suit !== "hearts" &&
        card.face.rank !== "3",
    );
    const calls = chooseFriendCallsForHand({
      hand: [...everyCallableOnce, standardCard(deck, "diamonds", "Q", 1)],
      trumpSpec: ffTrump,
      callCount: 2,
    });
    expect(calls).toEqual([
      { face: faceOf("spades", "A"), copyIndex: 1 },
      { face: faceOf("clubs", "A"), copyIndex: 1 },
    ]);
  });
});

describe("friend-calling bot policy", () => {
  const deck = createDeck(2);
  const config = botConfigForDifficulty("intermediate");

  it("has the declarer bot emit a CALL_FRIENDS the engine accepts", () => {
    const state = friendCallingState([
      standardCard(deck, "clubs", "4"),
      standardCard(deck, "hearts", "9"),
    ]);
    const command = decideBotAction(
      deriveBotObservation(state, "p0"),
      config,
      "friends-policy-seed",
    );
    expect(command).toEqual({
      type: "CALL_FRIENDS",
      calls: [{ face: faceOf("spades", "A"), copyIndex: 1 }],
    });
    const next = replayEvents(state, validateCommand(state, "p0", command!, { now }));
    expect(next.phase).toBe("playing");
    expect(next.round!.friendCalls).toEqual([
      { face: faceOf("spades", "A"), copyIndex: 1 },
    ]);
  });

  it("produces the ruleset's call count for multi-call presets", () => {
    const sixDeck = createDeck(3);
    const state = friendCallingState(
      [standardCard(sixDeck, "clubs", "4")],
      sixPlayerThreeDeckFindingFriendsRuleset,
    );
    const command = decideBotAction(
      deriveBotObservation(state, "p0"),
      config,
      "friends-policy-seed",
    );
    if (command?.type !== "CALL_FRIENDS") {
      throw new Error(`Expected CALL_FRIENDS, got ${JSON.stringify(command)}`);
    }
    expect(command.calls).toHaveLength(2);
    expect(() => validateCommand(state, "p0", command, { now })).not.toThrow();
  });

  it("keeps every non-declarer bot silent during friend-calling", () => {
    const state = friendCallingState([standardCard(deck, "clubs", "4")]);
    for (const playerId of ["p1", "p2", "p3", "p4"]) {
      expect(
        decideBotAction(
          deriveBotObservation(state, playerId),
          config,
          "friends-policy-seed",
        ),
      ).toBeNull();
    }
  });
});

describe("getForcedFriendCallEvents", () => {
  const deck = createDeck(2);

  it("auto-calls deterministically through the production command path", () => {
    const state = friendCallingState([
      standardCard(deck, "clubs", "4"),
      standardCard(deck, "spades", "7"),
    ]);
    const events = getForcedFriendCallEvents(state, now);
    expect(events).toEqual([
      {
        type: "FRIENDS_CALLED",
        seat: 0,
        calls: [{ face: faceOf("spades", "A"), copyIndex: 1 }],
        at: now,
      },
    ]);
    expect(getForcedFriendCallEvents(state, now)).toEqual(events);
    expect(replayEvents(state, events).phase).toBe("playing");
  });

  it("is inert outside the friend-calling phase", () => {
    const state = friendCallingState([standardCard(deck, "clubs", "4")]);
    state.phase = "playing";
    expect(getForcedFriendCallEvents(state, now)).toEqual([]);
  });
});
