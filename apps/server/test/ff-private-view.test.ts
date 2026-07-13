import {
  applyEvent,
  createDeck,
  createGameState,
  fivePlayerTwoDeckFindingFriendsRuleset,
  type CardInstance,
  type FriendCall,
  type GameState,
} from "@shengji/engine";
import { describe, expect, it } from "vitest";
import { derivePrivateView } from "../src/private-views/derive-private-view.js";

const now = "2026-07-11T12:00:00.000Z";
const ffTrump = { mode: "suit", rank: "3", suit: "hearts" } as const;
const spadeKingFace = { kind: "standard", suit: "spades", rank: "K" } as const;

function standardCard(
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
 * hands and calls supplied by the test so hidden placement is exact.
 */
function craftedFfState(input: {
  phase?: GameState["phase"];
  hands: Record<number, CardInstance[]>;
  friendCalls?: FriendCall[];
  roundHistory?: GameState["roundHistory"];
}): GameState {
  const ruleset = fivePlayerTwoDeckFindingFriendsRuleset;
  let state = createGameState({ roomId: "FF-VIEW", ruleset, createdAt: now });
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
  state.phase = input.phase ?? "playing";
  state.leaderSeat = 0;
  state.defendingTeamId = "defenders";
  state.attackingTeamId = "attackers";
  if (input.roundHistory !== undefined) state.roundHistory = input.roundHistory;
  state.round = {
    roundNumber: (input.roundHistory?.length ?? 0) + 1,
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
    ...(input.friendCalls === undefined
      ? {}
      : { friendCalls: structuredClone(input.friendCalls) }),
  };
  return state;
}

/**
 * Two states identical except for the hidden placement of the called ♠K
 * copy, swapped between the seat-1 and seat-2 hands.
 */
function calledCopyPlacements(): { holderAtOne: GameState; holderAtTwo: GameState } {
  const deck = createDeck(2);
  const calledCopy = standardCard(deck, "spades", "K");
  const decoy = standardCard(deck, "clubs", "9");
  const sharedHands = {
    0: [standardCard(deck, "hearts", "A"), standardCard(deck, "clubs", "4")],
    3: [standardCard(deck, "spades", "4"), standardCard(deck, "clubs", "J")],
    4: [standardCard(deck, "diamonds", "J"), standardCard(deck, "spades", "6")],
  };
  const friendCalls: FriendCall[] = [{ face: spadeKingFace, copyIndex: 1 }];
  return {
    holderAtOne: craftedFfState({
      hands: {
        ...sharedHands,
        1: [calledCopy, standardCard(deck, "diamonds", "5")],
        2: [decoy, standardCard(deck, "diamonds", "8")],
      },
      friendCalls,
    }),
    holderAtTwo: craftedFfState({
      hands: {
        ...sharedHands,
        1: [decoy, standardCard(deck, "diamonds", "5")],
        2: [calledCopy, standardCard(deck, "diamonds", "8")],
      },
      friendCalls,
    }),
  };
}

describe("finding-friends private-view leak-freedom", () => {
  it("produces byte-identical views for uninvolved players across hidden placements", () => {
    const { holderAtOne, holderAtTwo } = calledCopyPlacements();
    for (const observer of ["p0", "p3", "p4"]) {
      expect(JSON.stringify(derivePrivateView(holderAtOne, observer))).toBe(
        JSON.stringify(derivePrivateView(holderAtTwo, observer)),
      );
    }
  });

  it("differs for the involved players only in their own hand", () => {
    const { holderAtOne, holderAtTwo } = calledCopyPlacements();
    for (const observer of ["p1", "p2"]) {
      const first = derivePrivateView(holderAtOne, observer);
      const second = derivePrivateView(holderAtTwo, observer);
      expect(first.you.hand).not.toEqual(second.you.hand);
      expect(JSON.stringify({ ...first, you: { ...first.you, hand: null } })).toBe(
        JSON.stringify({ ...second, you: { ...second.you, hand: null } }),
      );
    }
  });

  it("never exposes other hands' card ids in a finding-friends view", () => {
    const { holderAtOne } = calledCopyPlacements();
    for (let seat = 0; seat < 5; seat += 1) {
      const serialized = JSON.stringify(derivePrivateView(holderAtOne, `p${seat}`));
      for (let otherSeat = 0; otherSeat < 5; otherSeat += 1) {
        if (otherSeat === seat) continue;
        for (const cardId of holderAtOne.round!.hands[otherSeat]!) {
          expect(serialized).not.toContain(cardId);
        }
      }
    }
  });
});

describe("finding-friends redaction", () => {
  it("shows the declarer and public calls while every unrevealed seat stays teamless", () => {
    const { holderAtOne } = calledCopyPlacements();
    const view = derivePrivateView(holderAtOne, "p3");
    expect(view.joinedPlayerCount).toBe(5);
    expect(view.publicRound?.roundStats.previousRound).toBeUndefined();
    expect(view.seats[0]).toMatchObject({ teamId: "defenders", role: "declarer" });
    for (let seat = 1; seat < 5; seat += 1) {
      expect("teamId" in view.seats[seat]!).toBe(false);
      expect(view.seats[seat]!.role).toBe("unknown");
    }
    expect(view.publicRound?.declarerSeat).toBe(0);
    expect(view.publicRound?.friendCalls).toEqual([
      { face: spadeKingFace, copyIndex: 1 },
    ]);
    expect(view.publicRound?.roundStats.roundsWonByTeam).toEqual({});
    expect(view.publicRound?.roundStats.roundsWonBySeat).toEqual({
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
    });
    // The holder of the called copy sees no team on their own view either:
    // the secret-friend inference lives client-side, from their own hand.
    expect(derivePrivateView(holderAtOne, "p1").you.teamId).toBeUndefined();
  });

  it("grants the revealed seat its team and role without leaking the reveal timestamp", () => {
    const deck = createDeck(2);
    const state = craftedFfState({
      hands: { 2: [standardCard(deck, "diamonds", "8")] },
      friendCalls: [
        {
          face: spadeKingFace,
          copyIndex: 1,
          revealed: { seat: 2, trickNumber: 3, at: now },
        },
      ],
    });
    const view = derivePrivateView(state, "p4");
    expect(view.seats[2]).toMatchObject({ teamId: "defenders", role: "friend" });
    expect(view.seats[0]).toMatchObject({ teamId: "defenders", role: "declarer" });
    expect("teamId" in view.seats[1]!).toBe(false);
    expect(view.publicRound?.friendCalls).toEqual([
      {
        face: spadeKingFace,
        copyIndex: 1,
        revealed: { seat: 2, trickNumber: 3 },
      },
    ]);
  });

  it("offers call-friends to exactly the declarer during friend-calling", () => {
    const deck = createDeck(2);
    const state = craftedFfState({
      phase: "friend-calling",
      hands: { 0: [standardCard(deck, "clubs", "4")] },
    });
    expect(derivePrivateView(state, "p0").legalActions).toEqual(["call-friends"]);
    for (const playerId of ["p1", "p2", "p3", "p4"]) {
      expect(derivePrivateView(state, playerId).legalActions).toEqual([]);
    }
  });

  it("tallies per-seat round wins from the durable history", () => {
    const outcomeFor = (winner: "defenders" | "attackers") => ({
      attackerPoints: winner === "defenders" ? 20 : 120,
      winner,
      levelDelta: 1,
    });
    const state = craftedFfState({
      hands: {},
      roundHistory: [
        {
          roundNumber: 1,
          defendingTeamId: "defenders",
          attackingTeamId: "attackers",
          winningTeamId: "defenders",
          outcome: outcomeFor("defenders"),
          defenderSeats: [0, 2],
        },
        {
          roundNumber: 2,
          defendingTeamId: "defenders",
          attackingTeamId: "attackers",
          winningTeamId: "attackers",
          outcome: outcomeFor("attackers"),
          defenderSeats: [1],
        },
      ],
    });
    const view = derivePrivateView(state, "p0");
    // Round 1: defenders {0,2} won. Round 2: attackers {0,2,3,4} won.
    expect(view.publicRound?.roundStats.roundsWonBySeat).toEqual({
      0: 2,
      1: 0,
      2: 2,
      3: 1,
      4: 1,
    });
    expect(view.publicRound?.roundStats.previousRound).toMatchObject({
      roundNumber: 2,
      winningTeamId: "attackers",
      winner: "attackers",
    });
  });
});
