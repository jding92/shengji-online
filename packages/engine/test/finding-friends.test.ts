import fc from "fast-check";
import { describe, expect, it } from "vitest";
import * as engine from "../src/index.js";
import {
  applyEvent,
  createDeck,
  createGameState,
  fivePlayerTwoDeckFindingFriendsRuleset,
  getFinalizeBiddingEvents,
  getForcedPlayEvents,
  getNextDealEvents,
  knownTeamIdForSeat,
  parseTrickFormat,
  RANKS,
  replayEvents,
  resolveRuleset,
  seatRole,
  sixPlayerThreeDeckFindingFriendsRuleset,
  SUITS,
  sumCardPoints,
  validateCommand,
  type CardInstance,
  type FriendCall,
  type GameEvent,
  type GameState,
  type Rank,
  type ShengJiRuleset,
  type TrumpSpec,
} from "../src/index.js";
import { finalTeamIdForSeat } from "../src/state/teams.js";

const now = "2026-07-11T12:00:00.000Z";

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

/** Seats five (or six) players and returns a lobby-phase state. */
function seatedState(ruleset: ShengJiRuleset): GameState {
  let state = createGameState({ roomId: "FFROOM", ruleset, createdAt: now });
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
  return state;
}

const ffTrump: TrumpSpec = { mode: "suit", rank: "3", suit: "hearts" };

/**
 * Hand-crafted mid-round finding-friends state (round-end.test.ts style):
 * trump hearts at rank 3, declarer seat 0, round-scoped teams assigned.
 */
function craftedRound(input: {
  ruleset?: ShengJiRuleset;
  phase: GameState["phase"];
  hands: Record<number, CardInstance[]>;
  friendCalls?: FriendCall[];
  pointsBySeat?: Record<number, number>;
  attackerPoints?: number;
  buriedBottom?: CardInstance[];
  currentTurnSeat?: number;
  currentTrick?: { leadSeat: number; cards: CardInstance[][] };
  ranks?: Record<string, Rank>;
}): GameState {
  const ruleset = input.ruleset ?? fivePlayerTwoDeckFindingFriendsRuleset;
  const state = seatedState(ruleset);
  const deck = createDeck(ruleset.decks.count);
  const hands: Record<number, string[]> = {};
  for (let seat = 0; seat < ruleset.players.count; seat += 1) {
    hands[seat] = (input.hands[seat] ?? []).map(({ id }) => id);
  }
  state.phase = input.phase;
  state.leaderSeat = 0;
  state.defendingTeamId = "defenders";
  state.attackingTeamId = "attackers";
  if (input.ranks !== undefined) {
    state.ranks = { ...state.ranks, ...input.ranks };
  }
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
    attackerPoints: input.attackerPoints ?? 0,
    throwPenaltyAdjustment: 0,
    ...(input.friendCalls === undefined ? {} : { friendCalls: input.friendCalls }),
    ...(input.pointsBySeat === undefined ? {} : { pointsBySeat: input.pointsBySeat }),
    ...(input.buriedBottom === undefined
      ? {}
      : { buriedBottom: input.buriedBottom.map(({ id }) => id) }),
    ...(input.currentTurnSeat === undefined
      ? {}
      : { currentTurnSeat: input.currentTurnSeat }),
    ...(input.currentTrick === undefined
      ? {}
      : {
          currentTrick: {
            leadSeat: input.currentTrick.leadSeat,
            ledFormat: parseTrickFormat(input.currentTrick.cards[0]!, ffTrump),
            plays: input.currentTrick.cards.map((cards, offset) => ({
              seat: (input.currentTrick!.leadSeat + offset) % ruleset.players.count,
              cards,
              format: parseTrickFormat(cards, ffTrump),
              eligibleToWin: true,
            })),
          },
        }),
  };
  return state;
}

const pointlessBottom = (deck: readonly CardInstance[]): CardInstance[] => [
  standardCard(deck, "diamonds", "2"),
  standardCard(deck, "diamonds", "4"),
  standardCard(deck, "diamonds", "6"),
  standardCard(deck, "diamonds", "7"),
  standardCard(deck, "diamonds", "8"),
  standardCard(deck, "diamonds", "9"),
  standardCard(deck, "diamonds", "J"),
  standardCard(deck, "diamonds", "Q"),
];

/**
 * Final-trick fixture: seats 0-3 have played clubs, seat 4 holds the last
 * club. The winner is whoever holds the club ace (seat 0 when the defender
 * should win, seat 1 otherwise). The final trick is worth zero points so
 * totals come purely from the piles and the bottom.
 */
function finalTrickRound(input: {
  friendCalls: FriendCall[];
  pointsBySeat: Record<number, number>;
  defenderWinsLast: boolean;
  buriedCards: CardInstance[];
  ranks?: Record<string, Rank>;
}): GameState {
  const deck = createDeck(2);
  const lead = input.defenderWinsLast
    ? standardCard(deck, "clubs", "A")
    : standardCard(deck, "clubs", "4");
  const second = input.defenderWinsLast
    ? standardCard(deck, "clubs", "4")
    : standardCard(deck, "clubs", "A");
  return craftedRound({
    phase: "playing",
    hands: { 4: [standardCard(deck, "clubs", "9")] },
    friendCalls: input.friendCalls,
    pointsBySeat: input.pointsBySeat,
    buriedBottom: input.buriedCards,
    currentTurnSeat: 4,
    currentTrick: {
      leadSeat: 0,
      cards: [
        [lead],
        [second],
        [standardCard(deck, "clubs", "6")],
        [standardCard(deck, "clubs", "8")],
      ],
    },
    ...(input.ranks === undefined ? {} : { ranks: input.ranks }),
  });
}

function playFinalCard(state: GameState): GameEvent[] {
  return validateCommand(
    state,
    "p4",
    { type: "PLAY_CARDS", cards: [state.round!.hands[4]![0]!], intent: "normal" },
    { now },
  );
}

describe("CALL_FRIENDS validation", () => {
  const deck = createDeck(2);
  const callingState = () =>
    craftedRound({
      phase: "friend-calling",
      hands: { 0: [standardCard(deck, "clubs", "4")] },
      buriedBottom: pointlessBottom(deck),
      // BOTTOM_BURIED leaves the declarer on turn; FRIENDS_CALLED keeps it.
      currentTurnSeat: 0,
    });
  const spadeAce = { kind: "standard", suit: "spades", rank: "A" } as const;

  it("rejects calls outside the friend-calling phase", () => {
    const state = callingState();
    state.phase = "playing";
    expect(() =>
      validateCommand(
        state,
        "p0",
        { type: "CALL_FRIENDS", calls: [{ face: spadeAce, copyIndex: 1 }] },
        { now },
      ),
    ).toThrow("Friends cannot be called now");
  });

  it("rejects calls from anyone but the declarer", () => {
    expect(() =>
      validateCommand(
        callingState(),
        "p1",
        { type: "CALL_FRIENDS", calls: [{ face: spadeAce, copyIndex: 1 }] },
        { now },
      ),
    ).toThrow("Only the declarer calls friends");
  });

  it("rejects the wrong number of calls", () => {
    for (const calls of [
      [],
      [
        { face: spadeAce, copyIndex: 1 },
        { face: spadeAce, copyIndex: 2 },
      ],
    ]) {
      expect(() =>
        validateCommand(callingState(), "p0", { type: "CALL_FRIENDS", calls }, { now }),
      ).toThrow("Exactly 1 friend call(s) must be made");
    }
  });

  it("rejects jokers, level-rank faces, and trump-suit faces", () => {
    const cases: { face: (typeof deck)[number]["face"]; message: string }[] = [
      { face: { kind: "joker", joker: "big" }, message: "Jokers cannot be called" },
      {
        face: { kind: "standard", suit: "spades", rank: "3" },
        message: "Level-rank cards cannot be called",
      },
      {
        face: { kind: "standard", suit: "hearts", rank: "A" },
        message: "Trump-suit cards cannot be called",
      },
    ];
    for (const { face, message } of cases) {
      expect(() =>
        validateCommand(
          callingState(),
          "p0",
          { type: "CALL_FRIENDS", calls: [{ face, copyIndex: 1 }] },
          { now },
        ),
      ).toThrow(message);
    }
  });

  it("rejects copy indexes outside 1..decks", () => {
    for (const copyIndex of [0, 3, 1.5]) {
      expect(() =>
        validateCommand(
          callingState(),
          "p0",
          { type: "CALL_FRIENDS", calls: [{ face: spadeAce, copyIndex }] },
          { now },
        ),
      ).toThrow("Copy index must be between 1 and 2");
    }
  });

  it("rejects duplicate (face, copyIndex) pairs", () => {
    const sixDeck = createDeck(3);
    const state = craftedRound({
      ruleset: sixPlayerThreeDeckFindingFriendsRuleset,
      phase: "friend-calling",
      hands: { 0: [standardCard(sixDeck, "clubs", "4")] },
    });
    expect(() =>
      validateCommand(
        state,
        "p0",
        {
          type: "CALL_FRIENDS",
          calls: [
            { face: spadeAce, copyIndex: 1 },
            { face: spadeAce, copyIndex: 1 },
          ],
        },
        { now },
      ),
    ).toThrow("Friend calls must be distinct");
  });

  it("accepts a valid call and enters the playing phase", () => {
    const state = callingState();
    const events = validateCommand(
      state,
      "p0",
      { type: "CALL_FRIENDS", calls: [{ face: spadeAce, copyIndex: 2 }] },
      { now },
    );
    expect(events).toEqual([
      {
        type: "FRIENDS_CALLED",
        seat: 0,
        calls: [{ face: spadeAce, copyIndex: 2 }],
        at: now,
      },
    ]);
    const next = replayEvents(state, events);
    expect(next.phase).toBe("playing");
    expect(next.round!.friendCalls).toEqual([{ face: spadeAce, copyIndex: 2 }]);
    expect(next.round!.currentTurnSeat).toBe(0);
  });
});

describe("friend reveals", () => {
  const deck = createDeck(2);
  const spadeKingFace = { kind: "standard", suit: "spades", rank: "K" } as const;

  it("reveals the friend when the called copy is played as a follow", () => {
    const state = craftedRound({
      phase: "playing",
      hands: {
        1: [standardCard(deck, "spades", "4")],
        2: [standardCard(deck, "spades", "K")],
        3: [standardCard(deck, "clubs", "6")],
      },
      friendCalls: [{ face: spadeKingFace, copyIndex: 1 }],
      currentTurnSeat: 1,
    });
    expect(seatRole(state, 2)).toBe("unknown");
    expect(knownTeamIdForSeat(state, 2)).toBeUndefined();

    const leadEvents = validateCommand(
      state,
      "p1",
      { type: "PLAY_CARDS", cards: [state.round!.hands[1]![0]!], intent: "normal" },
      { now },
    );
    expect(leadEvents.some((event) => event.type === "FRIEND_REVEALED")).toBe(false);
    const afterLead = replayEvents(state, leadEvents);

    const followEvents = validateCommand(
      afterLead,
      "p2",
      {
        type: "PLAY_CARDS",
        cards: [afterLead.round!.hands[2]![0]!],
        intent: "normal",
      },
      { now },
    );
    expect(followEvents).toContainEqual({
      type: "FRIEND_REVEALED",
      seat: 2,
      callIndex: 0,
      trickNumber: 1,
      at: now,
    });
    const revealed = replayEvents(afterLead, followEvents);
    expect(revealed.round!.friendCalls![0]!.revealed).toEqual({
      seat: 2,
      trickNumber: 1,
      at: now,
    });
    expect(seatRole(revealed, 2)).toBe("friend");
    expect(knownTeamIdForSeat(revealed, 2)).toBe("defenders");
  });

  it("does not reveal below the copy threshold and reveals when a later play crosses it", () => {
    const state = craftedRound({
      phase: "playing",
      hands: {
        1: [standardCard(deck, "spades", "K", 0)],
        2: [standardCard(deck, "spades", "K", 1)],
      },
      friendCalls: [{ face: spadeKingFace, copyIndex: 2 }],
      currentTurnSeat: 1,
    });
    const leadEvents = validateCommand(
      state,
      "p1",
      { type: "PLAY_CARDS", cards: [state.round!.hands[1]![0]!], intent: "normal" },
      { now },
    );
    expect(leadEvents.some((event) => event.type === "FRIEND_REVEALED")).toBe(false);
    const afterLead = replayEvents(state, leadEvents);

    const followEvents = validateCommand(
      afterLead,
      "p2",
      {
        type: "PLAY_CARDS",
        cards: [afterLead.round!.hands[2]![0]!],
        intent: "normal",
      },
      { now },
    );
    expect(followEvents).toContainEqual({
      type: "FRIEND_REVEALED",
      seat: 2,
      callIndex: 0,
      trickNumber: 1,
      at: now,
    });
  });

  it("reveals when a pair crosses the copy threshold inside one play", () => {
    const state = craftedRound({
      phase: "playing",
      hands: {
        1: [standardCard(deck, "spades", "K", 0), standardCard(deck, "spades", "K", 1)],
      },
      friendCalls: [{ face: spadeKingFace, copyIndex: 2 }],
      currentTurnSeat: 1,
    });
    const events = validateCommand(
      state,
      "p1",
      { type: "PLAY_CARDS", cards: [...state.round!.hands[1]!], intent: "normal" },
      { now },
    );
    expect(events).toContainEqual({
      type: "FRIEND_REVEALED",
      seat: 1,
      callIndex: 0,
      trickNumber: 1,
      at: now,
    });
  });

  it("reveals two calls at once when one play crosses both thresholds", () => {
    const sixDeck = createDeck(3);
    const clubKingFace = { kind: "standard", suit: "clubs", rank: "K" } as const;
    const state = craftedRound({
      ruleset: sixPlayerThreeDeckFindingFriendsRuleset,
      phase: "playing",
      hands: {
        1: [
          standardCard(sixDeck, "clubs", "K", 0),
          standardCard(sixDeck, "clubs", "K", 1),
        ],
      },
      friendCalls: [
        { face: clubKingFace, copyIndex: 1 },
        { face: clubKingFace, copyIndex: 2 },
      ],
      currentTurnSeat: 1,
    });
    const events = validateCommand(
      state,
      "p1",
      { type: "PLAY_CARDS", cards: [...state.round!.hands[1]!], intent: "normal" },
      { now },
    );
    const reveals = events.filter((event) => event.type === "FRIEND_REVEALED");
    expect(reveals).toEqual([
      { type: "FRIEND_REVEALED", seat: 1, callIndex: 0, trickNumber: 1, at: now },
      { type: "FRIEND_REVEALED", seat: 1, callIndex: 1, trickNumber: 1, at: now },
    ]);
  });

  it("treats a declarer self-call reveal as a membership no-op", () => {
    const state = craftedRound({
      phase: "playing",
      hands: { 0: [standardCard(deck, "spades", "K")] },
      friendCalls: [{ face: spadeKingFace, copyIndex: 1 }],
      pointsBySeat: { 3: 15 },
      attackerPoints: 15,
      currentTurnSeat: 0,
    });
    const events = validateCommand(
      state,
      "p0",
      { type: "PLAY_CARDS", cards: [state.round!.hands[0]![0]!], intent: "normal" },
      { now },
    );
    expect(events).toContainEqual({
      type: "FRIEND_REVEALED",
      seat: 0,
      callIndex: 0,
      trickNumber: 1,
      at: now,
    });
    const revealed = replayEvents(state, events);
    expect(revealed.round!.friendCalls![0]!.revealed?.seat).toBe(0);
    expect(seatRole(revealed, 0)).toBe("declarer");
    expect(knownTeamIdForSeat(revealed, 0)).toBe("defenders");
    // No pile moved: seat 3 is still unknown, so the provisional total holds.
    expect(revealed.round!.attackerPoints).toBe(15);
  });

  it("moves a revealed friend's pile out of the provisional attacker total", () => {
    const state = craftedRound({
      phase: "playing",
      hands: {
        2: [standardCard(deck, "spades", "K")],
        3: [standardCard(deck, "clubs", "6")],
      },
      friendCalls: [{ face: spadeKingFace, copyIndex: 1 }],
      pointsBySeat: { 2: 25, 3: 10 },
      attackerPoints: 35,
      currentTurnSeat: 2,
    });
    const events = validateCommand(
      state,
      "p2",
      { type: "PLAY_CARDS", cards: [state.round!.hands[2]![0]!], intent: "normal" },
      { now },
    );
    const revealed = replayEvents(state, events);
    // Seat 2's 25 points retroactively become defender points.
    expect(revealed.round!.attackerPoints).toBe(10);
    expect(revealed.round!.pointsBySeat).toEqual({ 2: 25, 3: 10 });
  });
});

describe("finding-friends round completion", () => {
  const deck = createDeck(2);
  const spadeKingFace = { kind: "standard", suit: "spades", rank: "K" } as const;

  it("scores an unrevealed friend (called copy buried) as an attacker", () => {
    const buried = [
      standardCard(deck, "spades", "K", 0),
      standardCard(deck, "spades", "K", 1),
      ...pointlessBottom(deck).slice(0, 6),
    ];
    const state = finalTrickRound({
      friendCalls: [{ face: spadeKingFace, copyIndex: 1 }],
      pointsBySeat: { 1: 80, 2: 40 },
      defenderWinsLast: false,
      buriedCards: buried,
    });
    expect(finalTeamIdForSeat(state, 1)).toBe("attackers");

    const events = playFinalCard(state);
    // Attackers (seat 1, unknown) win the last trick: 20 buried points x2.
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "BOTTOM_REVEALED",
        multiplier: 2,
        pointsAwarded: 40,
      }),
    );
    // 80 + 40 piles + 40 bottom = 160 -> attackers win at +2.
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "ROUND_SCORED",
        outcome: { attackerPoints: 160, winner: "attackers", levelDelta: 2 },
      }),
    );
    const completed = replayEvents(state, events);
    // The would-be friend stayed unknown all round: every non-declarer
    // advances as an attacker; the declarer does not.
    expect(completed.ranks).toEqual({ p0: "2", p1: "4", p2: "4", p3: "4", p4: "4" });
    expect(completed.round!.friendCalls![0]!.revealed).toBeUndefined();
    expect(completed.roundHistory).toEqual([
      expect.objectContaining({
        defendingTeamId: "defenders",
        attackingTeamId: "attackers",
        winningTeamId: "attackers",
        defenderSeats: [0],
      }),
    ]);
    // No TEAMS_UPDATED at round end: FF teams are round-scoped and the
    // declarer keeps the leader seat to start the next round.
    expect(events.some((event) => event.type === "TEAMS_UPDATED")).toBe(false);
    expect(completed.leaderSeat).toBe(0);
    // The buried called copies are publicly auditable at round end.
    expect(completed.round!.bottomReveal!.cards).toContain(
      standardCard(deck, "spades", "K", 0).id,
    );
  });

  it("advances each winning defender individually across mixed ranks", () => {
    const state = finalTrickRound({
      friendCalls: [
        {
          face: spadeKingFace,
          copyIndex: 1,
          revealed: { seat: 1, trickNumber: 1, at: now },
        },
      ],
      pointsBySeat: { 2: 20 },
      defenderWinsLast: true,
      buriedCards: pointlessBottom(deck),
      ranks: { p0: "5", p1: "3" },
    });
    const events = playFinalCard(state);
    // 20 attacker points inside [1, 40): defenders +2.
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "ROUND_SCORED",
        outcome: { attackerPoints: 20, winner: "defenders", levelDelta: 2 },
      }),
    );
    const completed = replayEvents(state, events);
    expect(completed.ranks).toEqual({ p0: "7", p1: "5", p2: "2", p3: "2", p4: "2" });
    expect(completed.roundHistory![0]!.defenderSeats).toEqual([0, 1]);
  });

  it("ends the game when the declarer defends at the game-ending rank", () => {
    const state = finalTrickRound({
      friendCalls: [
        {
          face: spadeKingFace,
          copyIndex: 1,
          revealed: { seat: 1, trickNumber: 1, at: now },
        },
      ],
      pointsBySeat: {},
      defenderWinsLast: true,
      buriedCards: pointlessBottom(deck),
      ranks: { p0: "A" },
    });
    const events = playFinalCard(state);
    expect(events).toContainEqual({
      type: "GAME_ENDED",
      winnerTeamId: "defenders",
      at: now,
    });
    expect(events.some((event) => event.type === "RANKS_UPDATED")).toBe(false);
    expect(replayEvents(state, events).phase).toBe("game-over");
  });
});

/** Deals the round out and returns the post-deal state. */
function dealOut(state: GameState, events: GameEvent[]): GameState {
  while (state.phase === "dealing") {
    const dealEvents = getNextDealEvents(state, now);
    expect(dealEvents.length).toBeGreaterThan(0);
    events.push(...dealEvents);
    state = replayEvents(state, dealEvents);
  }
  return state;
}

/** First callable faces for the declarer: skip jokers, trump suit, level rank. */
function validCalls(
  state: GameState,
  count: number,
): {
  face: { kind: "standard"; suit: (typeof SUITS)[number]; rank: Rank };
  copyIndex: number;
}[] {
  const round = state.round!;
  const spec = round.trumpSpec!;
  const calls: ReturnType<typeof validCalls> = [];
  for (const suit of SUITS) {
    if (spec.mode === "suit" && suit === spec.suit) continue;
    for (const rank of RANKS) {
      if (rank === round.trumpRank) continue;
      calls.push({ face: { kind: "standard", suit, rank }, copyIndex: 1 });
      if (calls.length === count) return calls;
    }
  }
  throw new Error("No callable faces available");
}

/** Buries, calls friends, and plays the round out to round-scoring. */
function playRoundOut(state: GameState, events: GameEvent[]): GameState {
  expect(state.phase).toBe("bottom-exchange");
  const buryEvents = getForcedPlayEvents(state, now);
  expect(buryEvents.length).toBeGreaterThan(0);
  events.push(...buryEvents);
  state = replayEvents(state, buryEvents);

  expect(state.phase).toBe("friend-calling");
  const declarerSeat = state.round!.declarerSeat!;
  const declarerId = state.seats[declarerSeat]!;
  const callCount =
    state.rulesetSnapshot.teams.mode === "finding-friends"
      ? state.rulesetSnapshot.teams.friends.callCount
      : 0;
  const callEvents = validateCommand(
    state,
    declarerId,
    { type: "CALL_FRIENDS", calls: validCalls(state, callCount) },
    { now },
  );
  events.push(...callEvents);
  state = replayEvents(state, callEvents);
  expect(state.phase).toBe("playing");

  while (state.phase === "playing") {
    const playEvents = getForcedPlayEvents(state, now);
    expect(playEvents.length).toBeGreaterThan(0);
    events.push(...playEvents);
    state = replayEvents(state, playEvents);
  }
  expect(state.phase).toBe("round-scoring");
  return state;
}

function readyAll(state: GameState, events: GameEvent[], seed: string): GameState {
  for (let seat = 0; seat < state.rulesetSnapshot.players.count; seat += 1) {
    const readyEvents = validateCommand(
      state,
      `p${seat}`,
      { type: "READY" },
      { now, roundSeed: seed },
    );
    events.push(...readyEvents);
    state = replayEvents(state, readyEvents);
  }
  expect(state.phase).toBe("dealing");
  return state;
}

describe("finding-friends round flow", () => {
  it("forces the no-bid fallback at the fallback declarer's own rank and rotates it next round", () => {
    const resolved = resolveRuleset("shengji-ff-5p-2d-v1", { maxRedeals: 0 });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) throw new Error("expected ok");
    const initial = seatedState(resolved.ruleset);
    const events: GameEvent[] = [];
    let state = readyAll(initial, events, "ff-no-bid-round-one");
    state = dealOut(state, events);

    // Round 1 all-pass: seat 0 becomes declarer at their own rank.
    const forced = getFinalizeBiddingEvents(state, now);
    expect(forced[0]).toMatchObject({
      type: "TRUMP_FINALIZED",
      declarerSeat: 0,
      trumpRank: "2",
    });
    expect(forced).toContainEqual({
      type: "TEAMS_UPDATED",
      defendingTeamId: "defenders",
      attackingTeamId: "attackers",
      leaderSeat: 0,
      at: now,
    });
    // Determinism: the same state produces the same forced finalization.
    expect(getFinalizeBiddingEvents(state, now)).toEqual(forced);
    events.push(...forced);
    state = replayEvents(state, forced);
    expect(state.round!.declarerSeat).toBe(0);
    expect(state.round!.trumpSpec!.rank).toBe("2");

    state = playRoundOut(state, events);

    // Accounting invariant: piles plus the buried bottom cover every point.
    const round = state.round!;
    const pileTotal = Object.values(round.pointsBySeat ?? {}).reduce(
      (sum, points) => sum + points,
      0,
    );
    const buriedPoints = sumCardPoints(
      round.buriedBottom!.map((id) => round.cards[id]!),
    );
    expect(pileTotal + buriedPoints).toBe(200);

    // Full-log replay reproduces the state bit-for-bit (reveals included).
    expect(replayEvents(initial, events)).toEqual(state);

    // The previous declarer starts round 2 at their current rank.
    const startEvents = validateCommand(
      state,
      "p0",
      { type: "START_NEXT_ROUND" },
      { now, roundSeed: "ff-no-bid-round-two" },
    );
    expect(startEvents[0]).toMatchObject({
      type: "ROUND_STARTED",
      roundNumber: 2,
      trumpRank: state.ranks.p0,
    });
    events.push(...startEvents);
    state = replayEvents(state, startEvents);
    state = dealOut(state, events);

    // Round 2 all-pass: the declarer rotates to seat 1 at seat 1's rank.
    const forcedRoundTwo = getFinalizeBiddingEvents(state, now);
    expect(forcedRoundTwo[0]).toMatchObject({
      type: "TRUMP_FINALIZED",
      declarerSeat: 1,
      trumpRank: state.ranks.p1,
    });
    const finalized = replayEvents(state, forcedRoundTwo);
    expect(finalized.leaderSeat).toBe(1);
    expect(finalized.round!.trumpRank).toBe(state.ranks.p1);
  });

  it("rebids each round: the winning bidder declares at their own rank", () => {
    const ruleset = fivePlayerTwoDeckFindingFriendsRuleset;
    const initial = seatedState(ruleset);
    const events: GameEvent[] = [];
    let state = readyAll(initial, events, "ff-rebid-round-one");
    state = dealOut(state, events);

    // Round 1: every player is on rank 2; any seat holding a 2 may bid.
    const findBidder = (candidate: GameState): { seat: number; card: string } => {
      for (let seat = 0; seat < 5; seat += 1) {
        const playerId = candidate.seats[seat]!;
        const ownRank = candidate.ranks[playerId]!;
        const card = candidate.round!.hands[seat]!.find((id) => {
          const face = candidate.round!.cards[id]!.face;
          return face.kind === "standard" && face.rank === ownRank;
        });
        if (card !== undefined) return { seat, card };
      }
      throw new Error("No seat can bid at its own rank");
    };
    const roundOneBidder = findBidder(state);
    const bidEvents = validateCommand(
      state,
      state.seats[roundOneBidder.seat]!,
      { type: "BID", cards: [roundOneBidder.card] },
      { now },
    );
    events.push(...bidEvents);
    state = replayEvents(state, bidEvents);

    const finalizeEvents = getFinalizeBiddingEvents(state, now);
    expect(finalizeEvents[0]).toMatchObject({
      type: "TRUMP_FINALIZED",
      declarerSeat: roundOneBidder.seat,
      trumpRank: "2",
    });
    events.push(...finalizeEvents);
    state = replayEvents(state, finalizeEvents);
    expect(state.leaderSeat).toBe(roundOneBidder.seat);

    state = playRoundOut(state, events);
    const declarerId = state.seats[roundOneBidder.seat]!;

    // The previous declarer starts round 2; the provisional rank is theirs.
    const startEvents = validateCommand(
      state,
      declarerId,
      { type: "START_NEXT_ROUND" },
      { now, roundSeed: "ff-rebid-round-two" },
    );
    expect(startEvents[0]).toMatchObject({
      type: "ROUND_STARTED",
      roundNumber: 2,
      trumpRank: state.ranks[declarerId],
    });
    events.push(...startEvents);
    state = replayEvents(state, startEvents);
    state = dealOut(state, events);

    // Round 2: ranks now differ; the bid validates against the bidder's own.
    const roundTwoBidder = findBidder(state);
    const bidderId = state.seats[roundTwoBidder.seat]!;
    const roundTwoBids = validateCommand(
      state,
      bidderId,
      { type: "BID", cards: [roundTwoBidder.card] },
      { now },
    );
    events.push(...roundTwoBids);
    state = replayEvents(state, roundTwoBids);
    const roundTwoFinalize = getFinalizeBiddingEvents(state, now);
    events.push(...roundTwoFinalize);
    state = replayEvents(state, roundTwoFinalize);
    expect(state.round!.declarerSeat).toBe(roundTwoBidder.seat);
    expect(state.round!.trumpRank).toBe(state.ranks[bidderId]);
    expect(state.round!.trumpSpec!.rank).toBe(state.ranks[bidderId]);

    // Full-log determinism across two rounds of rebid flow.
    expect(replayEvents(initial, events)).toEqual(state);
  });
});

describe("finding-friends accounting property", () => {
  it("conserves every point between seat piles and the buried bottom", () => {
    const resolved = resolveRuleset("shengji-ff-5p-2d-v1", { maxRedeals: 0 });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) throw new Error("expected ok");
    const ruleset = resolved.ruleset;

    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 24 }), (seed) => {
        const events: GameEvent[] = [];
        let state = readyAll(seatedState(ruleset), events, `pts-${seed}`);
        state = dealOut(state, events);
        const forced = getFinalizeBiddingEvents(state, now);
        events.push(...forced);
        state = replayEvents(state, forced);
        state = playRoundOut(state, events);

        const round = state.round!;
        const pileTotal = Object.values(round.pointsBySeat ?? {}).reduce(
          (sum, points) => sum + points,
          0,
        );
        const buriedPoints = sumCardPoints(
          round.buriedBottom!.map((id) => round.cards[id]!),
        );
        expect(pileTotal + buriedPoints).toBe(100 * ruleset.decks.count);
        // The scored total never exceeds what the attackers could have taken.
        expect(round.outcome!.attackerPoints).toBeLessThanOrEqual(
          pileTotal + buriedPoints * getBottomCap(round),
        );
      }),
      { numRuns: 5 },
    );
  });
});

function getBottomCap(round: NonNullable<GameState["round"]>): number {
  return round.bottomReveal === undefined
    ? 1
    : Math.max(1, round.bottomReveal.multiplier);
}

describe("finding-friends presets", () => {
  it("validates every FF preset with the expected shape", () => {
    const expectations = [
      { id: "shengji-ff-5p-2d-v1", players: 5, decks: 2, bottom: 8, calls: 1 },
      { id: "shengji-ff-6p-3d-v1", players: 6, decks: 3, bottom: 6, calls: 2 },
      { id: "shengji-ff-7p-3d-v1", players: 7, decks: 3, bottom: 8, calls: 2 },
      { id: "shengji-ff-8p-4d-v1", players: 8, decks: 4, bottom: 8, calls: 3 },
    ];
    for (const expected of expectations) {
      const preset = engine.getPreset(expected.id);
      expect(preset?.visibility).toBe("experimental");
      const ruleset = preset!.ruleset;
      expect(engine.validateRuleset(ruleset).success).toBe(true);
      expect(ruleset.players.count).toBe(expected.players);
      expect(ruleset.decks.count).toBe(expected.decks);
      expect(ruleset.bottom.size).toBe(expected.bottom);
      expect(ruleset.teams).toMatchObject({
        mode: "finding-friends",
        friends: { callCount: expected.calls },
      });
      // The deal always comes out even: e.g. 7p/3d = 162 cards, bottom 8,
      // 154 / 7 = 22 cards each.
      const total = engine.totalCards(ruleset.decks);
      expect((total - ruleset.bottom.size) % ruleset.players.count).toBe(0);
    }
  });
});

describe("hidden-information discipline", () => {
  it("does not export finalTeamIdForSeat from the package index", () => {
    expect("finalTeamIdForSeat" in engine).toBe(false);
    expect("knownTeamIdForSeat" in engine).toBe(true);
  });
});
