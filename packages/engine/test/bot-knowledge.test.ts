import { describe, expect, it } from "vitest";
import {
  bidScoreThreshold,
  BOT_CONFIGS,
  createDeck,
  fourPlayerTwoDeckFixedTeamRuleset,
  inferVoidSuits,
  parseTrickFormat,
  partnerSeat,
  scoreBotCandidate,
  sixPlayerThreeDeckFixedTeamRuleset,
  teammateSeats,
  type BotConfig,
  type BotObservation,
  type CardInstance,
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
