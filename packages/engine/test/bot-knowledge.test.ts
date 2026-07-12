import { describe, expect, it } from "vitest";
import {
  alliedSeats,
  applyEvent,
  bidScoreThreshold,
  BOT_CONFIGS,
  createDeck,
  createGameState,
  deriveBotObservation,
  fivePlayerTwoDeckFindingFriendsRuleset,
  fourPlayerTwoDeckFixedTeamRuleset,
  inferVoidSuits,
  isSecretFriend,
  knownTeamIdForSeat,
  parseTrickFormat,
  partnerSeat,
  scoreBotCandidate,
  seatRole,
  sixPlayerThreeDeckFixedTeamRuleset,
  teammateSeats,
  type BotConfig,
  type BotObservation,
  type CardInstance,
  type FriendCall,
  type GameState,
} from "../src/index.js";

const trump = { mode: "suit", rank: "2", suit: "spades" } as const;

function card(suit: "hearts" | "clubs", rank: "3" | "5"): CardInstance {
  return createDeck(1).find(
    (candidate) =>
      candidate.face.kind === "standard" &&
      candidate.face.suit === suit &&
      candidate.face.rank === rank,
  )!;
}

function observationWithHeartVoid(): BotObservation {
  const heart = card("hearts", "3");
  const club = card("clubs", "3");
  return {
    roomId: "KNOWLEDGE",
    revision: 1,
    phase: "playing",
    playerId: "p0",
    ownSeat: 0,
    ownTeamId: "team-0",
    ownHand: [],
    leaderSeat: 0,
    defendingTeamId: "team-0",
    attackingTeamId: "team-1",
    seats: Array.from({ length: 4 }, (_, seat) => ({
      seat,
      playerId: `p${seat}`,
      teamId: `team-${seat % 2}`,
      role: (["declarer", "attacker", "friend", "attacker"] as const)[seat]!,
      connected: true,
      ready: false,
      cardCount: 1,
    })),
    ruleset: structuredClone(fourPlayerTwoDeckFixedTeamRuleset),
    round: {
      roundNumber: 1,
      redealCount: 0,
      trumpRank: "2",
      trumpSpec: trump,
      passedBidSeats: [],
      dealtCardCount: 108,
      currentTurnSeat: 0,
      completedTricks: [
        {
          leadSeat: 0,
          winnerSeat: 0,
          points: 0,
          plays: [
            {
              seat: 0,
              cards: [heart],
              format: parseTrickFormat([heart], trump),
              eligibleToWin: true,
            },
            {
              seat: 1,
              cards: [club],
              format: parseTrickFormat([club], trump),
              eligibleToWin: false,
            },
          ],
        },
      ],
      attackerPoints: 0,
      throwPenaltyAdjustment: 0,
      bottomCount: 0,
      buriedBottomCount: 8,
    },
  };
}

function seatsFor(playerCount: number, teams: number[][]): BotObservation["seats"] {
  const teamOf = new Map<number, string>();
  teams.forEach((team, index) =>
    team.forEach((seat) => teamOf.set(seat, `team-${index}`)),
  );
  return Array.from({ length: playerCount }, (_, seat) => ({
    seat,
    playerId: `p${seat}`,
    teamId: teamOf.get(seat)!,
    role: "unknown" as const,
    connected: true,
    ready: false,
    cardCount: 0,
  }));
}

function baseObservation(overrides: Partial<BotObservation>): BotObservation {
  return {
    roomId: "TEAMMATES",
    revision: 1,
    phase: "playing",
    playerId: "p0",
    ownSeat: 0,
    ownHand: [],
    seats: [],
    ruleset: structuredClone(fourPlayerTwoDeckFixedTeamRuleset),
    ...overrides,
  };
}

describe("teammateSeats", () => {
  it("returns the single partner for a 2-member (4p) team, matching the deprecated partnerSeat", () => {
    const observation = baseObservation({
      ownSeat: 0,
      ownTeamId: "team-0",
      seats: seatsFor(4, [
        [0, 2],
        [1, 3],
      ]),
    });
    expect(teammateSeats(observation)).toEqual([2]);
    expect(partnerSeat(observation)).toBe(2);
  });

  it("returns every other seat on a 3-member (6p) team", () => {
    const observation = baseObservation({
      ownSeat: 0,
      ownTeamId: "team-0",
      seats: seatsFor(6, [
        [0, 2, 4],
        [1, 3, 5],
      ]),
      ruleset: structuredClone(sixPlayerThreeDeckFixedTeamRuleset),
    });
    expect(teammateSeats(observation)).toEqual([2, 4]);
    // The deprecated shim only ever surfaces the first teammate.
    expect(partnerSeat(observation)).toBe(2);
  });

  it("is empty when the seat or team is unknown", () => {
    const noSeat = baseObservation({
      ownSeat: null,
      seats: seatsFor(4, [
        [0, 2],
        [1, 3],
      ]),
    });
    expect(teammateSeats(noSeat)).toEqual([]);
    const noTeam = baseObservation({
      ownSeat: 0,
      seats: seatsFor(4, [
        [0, 2],
        [1, 3],
      ]),
    });
    expect(teammateSeats(noTeam)).toEqual([]);
  });
});

describe("bot knowledge configuration", () => {
  it("infers void suits only for configurations that enable the module", () => {
    const observation = observationWithHeartVoid();

    expect(
      inferVoidSuits(observation, BOT_CONFIGS.advanced).get(1)?.has("hearts"),
    ).toBe(true);
    expect(inferVoidSuits(observation, BOT_CONFIGS.intermediate).size).toBe(0);
  });

  it("gives full coordination extra value when the partner keeps control", () => {
    const pointCard = card("hearts", "5");
    const winnerConfig: BotConfig = {
      ...BOT_CONFIGS.advanced,
      teamCoordination: "winner",
    };
    const fullConfig: BotConfig = {
      ...winnerConfig,
      teamCoordination: "full",
    };
    const input = {
      cards: [pointCard],
      trump,
      winProbability: 0.6,
      trickPoints: 5,
      partnerWinning: true,
      givesPointsToPartner: true,
      isLastTrick: false,
    };

    expect(scoreBotCandidate({ ...input, config: fullConfig })).toBeGreaterThan(
      scoreBotCandidate({ ...input, config: winnerConfig }),
    );
  });

  it("maps every difficulty's aggression knob into its bid gate", () => {
    expect(bidScoreThreshold(BOT_CONFIGS.beginner)).toBeCloseTo(5);
    expect(bidScoreThreshold(BOT_CONFIGS.intermediate)).toBeCloseTo(7.505);
    expect(bidScoreThreshold(BOT_CONFIGS.advanced)).toBeCloseTo(8.495);
    expect(bidScoreThreshold(BOT_CONFIGS.expert)).toBeCloseTo(9.5);
  });
});

const now = "2026-07-11T12:00:00.000Z";
const ffTrump = { mode: "suit", rank: "3", suit: "hearts" } as const;
const spadeKingFace = { kind: "standard", suit: "spades", rank: "K" } as const;

function ffCard(
  deck: readonly CardInstance[],
  suit: string,
  rank: string,
): CardInstance {
  return deck.find(
    (candidate) =>
      candidate.deckIndex === 0 &&
      candidate.face.kind === "standard" &&
      candidate.face.suit === suit &&
      candidate.face.rank === rank,
  )!;
}

/**
 * Mid-round finding-friends state: declarer seat 0, trump hearts at rank 3,
 * every hand and call supplied by the test so hidden placement is exact.
 */
function craftedFfState(input: {
  hands: Record<number, CardInstance[]>;
  friendCalls: FriendCall[];
}): GameState {
  const ruleset = fivePlayerTwoDeckFindingFriendsRuleset;
  let state = createGameState({ roomId: "FF-LEAK", ruleset, createdAt: now });
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
  for (let seat = 0; seat < ruleset.players.count; seat += 1) {
    hands[seat] = (input.hands[seat] ?? []).map(({ id }) => id);
  }
  state.phase = "playing";
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
    friendCalls: structuredClone(input.friendCalls),
    attackerPoints: 0,
    throwPenaltyAdjustment: 0,
  };
  return state;
}

/**
 * Two states identical except for the hidden placement of the called ♠K
 * copy, swapped between the seat-1 and seat-2 hands.
 */
function calledCopyPlacements(): { holderAtOne: GameState; holderAtTwo: GameState } {
  const deck = createDeck(2);
  const calledCopy = ffCard(deck, "spades", "K");
  const decoy = ffCard(deck, "clubs", "9");
  const sharedHands = {
    0: [ffCard(deck, "hearts", "A"), ffCard(deck, "clubs", "4")],
    3: [ffCard(deck, "spades", "4"), ffCard(deck, "clubs", "J")],
    4: [ffCard(deck, "diamonds", "J"), ffCard(deck, "spades", "6")],
  };
  const friendCalls: FriendCall[] = [{ face: spadeKingFace, copyIndex: 1 }];
  return {
    holderAtOne: craftedFfState({
      hands: {
        ...sharedHands,
        1: [calledCopy, ffCard(deck, "diamonds", "5")],
        2: [decoy, ffCard(deck, "diamonds", "8")],
      },
      friendCalls,
    }),
    holderAtTwo: craftedFfState({
      hands: {
        ...sharedHands,
        1: [decoy, ffCard(deck, "diamonds", "5")],
        2: [calledCopy, ffCard(deck, "diamonds", "8")],
      },
      friendCalls,
    }),
  };
}

describe("finding-friends observation leak-freedom", () => {
  it("produces byte-identical observations for uninvolved seats across hidden placements", () => {
    const { holderAtOne, holderAtTwo } = calledCopyPlacements();
    for (const observer of ["p0", "p3", "p4"]) {
      expect(JSON.stringify(deriveBotObservation(holderAtOne, observer))).toBe(
        JSON.stringify(deriveBotObservation(holderAtTwo, observer)),
      );
    }
  });

  it("differs for the involved seats only in their own hand", () => {
    const { holderAtOne, holderAtTwo } = calledCopyPlacements();
    for (const observer of ["p1", "p2"]) {
      const first = deriveBotObservation(holderAtOne, observer);
      const second = deriveBotObservation(holderAtTwo, observer);
      expect(first.ownHand).not.toEqual(second.ownHand);
      expect(JSON.stringify({ ...first, ownHand: null })).toBe(
        JSON.stringify({ ...second, ownHand: null }),
      );
    }
  });

  it("keeps an unrevealed holder of the called copy publicly unknown", () => {
    const { holderAtOne, holderAtTwo } = calledCopyPlacements();
    expect(knownTeamIdForSeat(holderAtOne, 1)).toBeUndefined();
    expect(seatRole(holderAtOne, 1)).toBe("unknown");
    expect(knownTeamIdForSeat(holderAtTwo, 2)).toBeUndefined();
    expect(seatRole(holderAtTwo, 2)).toBe("unknown");
    // The observation mirrors the helper: no teamId on any unrevealed seat.
    const observation = deriveBotObservation(holderAtOne, "p3");
    for (const seat of observation.seats) {
      if (seat.seat === 0) {
        expect(seat.teamId).toBe("defenders");
        expect(seat.role).toBe("declarer");
      } else {
        expect("teamId" in seat).toBe(false);
        expect(seat.role).toBe("unknown");
      }
    }
    expect("ownTeamId" in deriveBotObservation(holderAtOne, "p1")).toBe(false);
  });
});

describe("isSecretFriend and alliedSeats", () => {
  const deck = createDeck(2);

  it("detects an unrevealed called copy in the bot's own hand and allies it with the declarer's side", () => {
    const state = calledCopyPlacements().holderAtOne;
    const holder = deriveBotObservation(state, "p1");
    expect(isSecretFriend(holder)).toBe(true);
    expect(teammateSeats(holder)).toEqual([]);
    expect(alliedSeats(holder)).toEqual([0]);

    const bystander = deriveBotObservation(state, "p3");
    expect(isSecretFriend(bystander)).toBe(false);
    expect(alliedSeats(bystander)).toEqual([]);
  });

  it("is not secret once the call is revealed, and revealed friends ally through teammateSeats", () => {
    const revealed = craftedFfState({
      hands: {
        1: [ffCard(deck, "spades", "K"), ffCard(deck, "diamonds", "5")],
      },
      friendCalls: [
        {
          face: spadeKingFace,
          copyIndex: 1,
          revealed: { seat: 1, trickNumber: 1, at: now },
        },
      ],
    });
    const friend = deriveBotObservation(revealed, "p1");
    expect(isSecretFriend(friend)).toBe(false);
    expect(friend.ownTeamId).toBe("defenders");
    expect(teammateSeats(friend)).toEqual([0]);
    expect(alliedSeats(friend)).toEqual([0]);
  });

  it("never fires in fixed mode", () => {
    const observation = observationWithHeartVoid();
    expect(isSecretFriend(observation)).toBe(false);
    expect(alliedSeats(observation)).toEqual(teammateSeats(observation));
  });
});
