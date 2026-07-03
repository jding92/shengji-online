import { botConfigForDifficulty } from "../bot/difficulty.js";
import { deriveBotObservation } from "../bot/observation.js";
import { decideBotAction } from "../bot/policy.js";
import type { BotDifficulty } from "../bot/types.js";
import { fourPlayerTwoDeckFixedTeamRuleset } from "../rulesets/four-player-two-deck.js";
import {
  getFinalizeBiddingEvents,
  getNextDealEvents,
  validateCommand,
} from "../state/commands.js";
import type { GameEvent, GameState } from "../state/model.js";
import { applyEvent, createGameState, replayEvents } from "../state/reducer.js";
import type { RoundOutcome, TeamId } from "../types.js";

export type BotMatchSimulation = {
  state: GameState;
  events: GameEvent[];
  outcomes: RoundOutcome[];
  winnerTeamIds: TeamId[];
};

export type BotMatchSimulationOptions = {
  difficulties?: readonly [BotDifficulty, BotDifficulty, BotDifficulty, BotDifficulty];
  maxRounds?: number;
};

/**
 * Deterministic bot harness. Every action goes through the production command
 * validator, making this useful both for policy legality checks and ladder
 * experiments.
 */
export function simulateBotMatch(
  seed: string,
  options: BotMatchSimulationOptions = {},
): BotMatchSimulation {
  const difficulties = options.difficulties ?? [
    "intermediate",
    "intermediate",
    "intermediate",
    "intermediate",
  ];
  const maxRounds = options.maxRounds ?? 200;
  const at = "2026-01-01T00:00:00.000Z";
  let state = createGameState({
    roomId: "BOT-SIMULATION",
    ruleset: fourPlayerTwoDeckFixedTeamRuleset,
    createdAt: at,
  });
  const events: GameEvent[] = [];
  const outcomes: RoundOutcome[] = [];
  const winnerTeamIds: TeamId[] = [];
  let roundSeedIndex = 0;
  let decisionIndex = 0;
  const nextRoundSeed = () => `${seed}:round:${roundSeedIndex++}`;
  const commit = (nextEvents: readonly GameEvent[]) => {
    events.push(...nextEvents);
    state = replayEvents(state, nextEvents);
  };
  const decideFor = (seat: number): boolean => {
    const playerId = `bot-${seat}`;
    const command = decideBotAction(
      deriveBotObservation(state, playerId),
      botConfigForDifficulty(difficulties[seat]!),
      `${seed}:decision:${decisionIndex++}:${state.revision}:${playerId}`,
    );
    if (command === null) return false;
    commit(
      validateCommand(state, playerId, command, {
        now: at,
        roundSeed: nextRoundSeed(),
      }),
    );
    return true;
  };

  for (let seat = 0; seat < 4; seat += 1) {
    const playerId = `bot-${seat}`;
    const joined: GameEvent = {
      type: "PLAYER_JOINED",
      playerId,
      name: `Bot ${seat + 1}`,
      bot: { difficulty: difficulties[seat]! },
      at,
    };
    events.push(joined);
    state = applyEvent(state, joined);
    commit(validateCommand(state, playerId, { type: "SIT", seat }, { now: at }));
  }
  for (let seat = 0; seat < 4; seat += 1) {
    commit(
      validateCommand(
        state,
        `bot-${seat}`,
        { type: "READY" },
        {
          now: at,
          roundSeed: nextRoundSeed(),
        },
      ),
    );
  }

  let iterations = 0;
  let recordedRound = 0;
  while (state.phase !== "game-over" && outcomes.length < maxRounds) {
    iterations += 1;
    if (iterations > 250_000) {
      throw new Error("Bot simulation exceeded its decision budget");
    }

    if (state.phase === "dealing") {
      const dealtOneCard =
        state.round !== undefined &&
        state.round.undealt.length > state.rulesetSnapshot.bottom.size;
      commit(getNextDealEvents(state, at));
      if (dealtOneCard) {
        for (let seat = 0; seat < 4; seat += 1) decideFor(seat);
      }
      continue;
    }
    if (state.phase === "post-deal-bidding") {
      for (let pass = 0; pass < 32; pass += 1) {
        let acted = false;
        for (let seat = 0; seat < 4; seat += 1) {
          acted = decideFor(seat) || acted;
        }
        if (!acted) break;
        const bid = state.round?.currentBid;
        const requiredPasses = bid === undefined ? 4 : 3;
        if ((state.round?.passedBidSeats.length ?? 0) >= requiredPasses) break;
      }
      commit(getFinalizeBiddingEvents(state, at, nextRoundSeed()));
      continue;
    }
    if (state.phase === "bottom-exchange") {
      if (state.leaderSeat === undefined || !decideFor(state.leaderSeat)) {
        throw new Error("Bot leader did not bury the bottom");
      }
      continue;
    }
    if (state.phase === "playing") {
      const seat = state.round?.currentTurnSeat;
      if (seat === undefined || !decideFor(seat)) {
        throw new Error("Bot did not produce a legal play");
      }
      continue;
    }
    if (state.phase === "round-scoring") {
      const round = state.round;
      if (round?.outcome !== undefined && round.roundNumber !== recordedRound) {
        outcomes.push(round.outcome);
        if (state.defendingTeamId === undefined) {
          throw new Error("Scored bot round is missing its winning team");
        }
        winnerTeamIds.push(state.defendingTeamId);
        recordedRound = round.roundNumber;
      }
      if (outcomes.length >= maxRounds) break;
      if (state.leaderSeat === undefined || !decideFor(state.leaderSeat)) {
        throw new Error("Bot leader did not start the next round");
      }
      continue;
    }
    throw new Error(`Unexpected bot simulation phase: ${state.phase}`);
  }

  return { state, events, outcomes, winnerTeamIds };
}
