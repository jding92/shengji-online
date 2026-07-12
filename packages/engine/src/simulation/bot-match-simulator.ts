import { botConfigForDifficulty } from "../bot/difficulty.js";
import { deriveBotObservation } from "../bot/observation.js";
import { decideBotAction } from "../bot/policy.js";
import type { BotDifficulty } from "../bot/types.js";
import { fourPlayerTwoDeckFixedTeamRuleset } from "../rulesets/four-player-two-deck.js";
import type { ShengJiRuleset } from "../rulesets/schema.js";
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
  /** Defaults to the 4p/2d preset. */
  ruleset?: ShengJiRuleset;
  /** Length must equal the ruleset's player count; defaults to all-intermediate. */
  difficulties?: readonly BotDifficulty[];
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
  const ruleset = options.ruleset ?? fourPlayerTwoDeckFixedTeamRuleset;
  const playerCount = ruleset.players.count;
  const difficulties =
    options.difficulties ??
    Array.from({ length: playerCount }, (): BotDifficulty => "intermediate");
  if (difficulties.length !== playerCount) {
    throw new RangeError(
      `difficulties must have exactly ${playerCount} entries, got ${difficulties.length}`,
    );
  }
  const maxRounds = options.maxRounds ?? 200;
  const at = "2026-01-01T00:00:00.000Z";
  let state = createGameState({
    roomId: "BOT-SIMULATION",
    ruleset,
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

  for (let seat = 0; seat < playerCount; seat += 1) {
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
  for (let seat = 0; seat < playerCount; seat += 1) {
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
        for (let seat = 0; seat < playerCount; seat += 1) decideFor(seat);
      }
      continue;
    }
    if (state.phase === "post-deal-bidding") {
      for (let pass = 0; pass < 32; pass += 1) {
        let acted = false;
        for (let seat = 0; seat < playerCount; seat += 1) {
          acted = decideFor(seat) || acted;
        }
        if (!acted) break;
        const bid = state.round?.currentBid;
        const requiredPasses = bid === undefined ? playerCount : playerCount - 1;
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
    if (state.phase === "friend-calling") {
      // Finding-friends only: the declarer bot calls through the same policy
      // path as every other decision (decideFriendCallAction).
      const seat = state.round?.declarerSeat;
      if (seat === undefined || !decideFor(seat)) {
        throw new Error("Bot declarer did not call friends");
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
        // The durable history entry works for both team modes: fixed rounds
        // record the persistent team id, finding-friends rounds the
        // round-scoped "defenders"/"attackers".
        const scored = state.roundHistory?.at(-1);
        if (scored === undefined || scored.roundNumber !== round.roundNumber) {
          throw new Error("Scored bot round is missing its winning team");
        }
        winnerTeamIds.push(scored.winningTeamId);
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
