import { createDeck } from "../cards/deck.js";
import { shuffleDeck } from "../cards/shuffle.js";
import type { ShengJiRuleset } from "../rulesets/schema.js";
import type { GameEvent, GameState, RoundState } from "./model.js";

export function teamIdForSeat(seat: number, ruleset: ShengJiRuleset): string {
  const teamIndex = ruleset.teams.teams.findIndex((team) => team.includes(seat));
  if (teamIndex < 0) throw new RangeError(`Seat ${seat} is not assigned to a team`);
  return `team-${teamIndex}`;
}

export function createGameState(input: {
  roomId: string;
  ruleset: ShengJiRuleset;
  createdAt: string;
}): GameState {
  const seats: Record<number, null> = {};
  for (let seat = 0; seat < input.ruleset.players.count; seat += 1) seats[seat] = null;
  return {
    roomId: input.roomId,
    revision: 0,
    rulesetId: input.ruleset.id,
    rulesetSnapshot: structuredClone(input.ruleset),
    phase: "lobby",
    players: {},
    seats,
    ranks: {},
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

function requireRound(state: GameState): RoundState {
  if (state.round === undefined)
    throw new Error("Round event received without a round");
  return state.round;
}

function removeCards(source: string[], cards: readonly string[]): void {
  for (const card of cards) {
    const index = source.indexOf(card);
    if (index < 0) throw new Error(`Card ${card} is not in the expected zone`);
    source.splice(index, 1);
  }
}

function nextSeat(seat: number, state: GameState): number {
  return (seat + 1) % state.rulesetSnapshot.players.count;
}

export function applyEvent(state: GameState, event: GameEvent): GameState {
  const next = structuredClone(state);
  next.revision += 1;
  next.updatedAt = event.at;

  switch (event.type) {
    case "PLAYER_JOINED": {
      if (next.players[event.playerId] !== undefined) {
        throw new Error(`Player ${event.playerId} has already joined`);
      }
      next.players[event.playerId] = {
        id: event.playerId,
        name: event.name,
        seat: null,
        ready: false,
        connected: true,
      };
      next.ranks[event.playerId] = next.rulesetSnapshot.ranks.sequence[0]!;
      break;
    }
    case "PLAYER_CONNECTION_CHANGED": {
      const player = next.players[event.playerId];
      if (player === undefined) throw new Error(`Unknown player ${event.playerId}`);
      player.connected = event.connected;
      break;
    }
    case "PLAYER_SEATED": {
      const player = next.players[event.playerId];
      if (player === undefined) throw new Error(`Unknown player ${event.playerId}`);
      if (player.seat !== null) next.seats[player.seat] = null;
      const occupant = next.seats[event.seat];
      if (occupant !== null && occupant !== event.playerId) {
        throw new Error(`Seat ${event.seat} is occupied`);
      }
      next.seats[event.seat] = event.playerId;
      player.seat = event.seat;
      player.ready = false;
      break;
    }
    case "PLAYER_READY_CHANGED": {
      const player = next.players[event.playerId];
      if (player === undefined) throw new Error(`Unknown player ${event.playerId}`);
      player.ready = event.ready;
      break;
    }
    case "ROUND_STARTED": {
      const shuffled = shuffleDeck(
        createDeck(
          next.rulesetSnapshot.decks.count,
          next.rulesetSnapshot.decks.includeJokers,
        ),
        event.seed,
      );
      const hands: Record<number, string[]> = {};
      for (let seat = 0; seat < next.rulesetSnapshot.players.count; seat += 1) {
        hands[seat] = [];
      }
      next.round = {
        roundNumber: event.roundNumber,
        trumpRank: event.trumpRank,
        deckSeed: event.seed,
        cards: Object.fromEntries(shuffled.map((card) => [card.id, card])),
        undealt: shuffled.map(({ id }) => id),
        bottom: [],
        hands,
        passedBidSeats: [],
        completedTricks: [],
        attackerPoints: 0,
        throwPenaltyAdjustment: 0,
      };
      next.phase = "dealing";
      if (event.leaderSeat !== undefined) next.leaderSeat = event.leaderSeat;
      for (const player of Object.values(next.players)) player.ready = false;
      break;
    }
    case "CARD_DEALT": {
      const round = requireRound(next);
      removeCards(round.undealt, [event.card]);
      round.hands[event.seat]!.push(event.card);
      break;
    }
    case "DEAL_FINISHED": {
      const round = requireRound(next);
      if (
        round.undealt.length !== event.bottom.length ||
        event.bottom.some((card) => !round.undealt.includes(card))
      ) {
        throw new Error("Deal-finished bottom does not match the undealt cards");
      }
      round.bottom = [...event.bottom];
      round.undealt = [];
      next.phase = "post-deal-bidding";
      break;
    }
    case "BID_PLACED": {
      const round = requireRound(next);
      round.currentBid = event.bid;
      round.passedBidSeats = [];
      break;
    }
    case "BID_PASSED": {
      const round = requireRound(next);
      if (!round.passedBidSeats.includes(event.seat))
        round.passedBidSeats.push(event.seat);
      break;
    }
    case "BID_TIMER_STARTED": {
      requireRound(next).biddingDeadline = event.deadline;
      break;
    }
    case "TRUMP_FINALIZED": {
      const round = requireRound(next);
      round.trumpSpec = event.trumpSpec;
      round.currentBid = event.winningBid;
      delete round.biddingDeadline;
      break;
    }
    case "LEADER_SET": {
      next.leaderSeat = event.seat;
      break;
    }
    case "BOTTOM_PICKED_UP": {
      const round = requireRound(next);
      round.hands[event.seat]!.push(...round.bottom);
      round.bottom = [];
      next.phase = "bottom-exchange";
      break;
    }
    case "BOTTOM_BURIED": {
      const round = requireRound(next);
      removeCards(round.hands[event.seat]!, event.cards);
      round.buriedBottom = [...event.cards];
      round.currentTurnSeat = event.seat;
      next.phase = "playing";
      break;
    }
    case "TRICK_STARTED": {
      const round = requireRound(next);
      round.currentTrick = {
        leadSeat: event.leadSeat,
        ledFormat: event.format,
        plays: [],
      };
      round.currentTurnSeat = event.leadSeat;
      break;
    }
    case "CARDS_PLAYED": {
      const round = requireRound(next);
      if (round.currentTrick === undefined)
        throw new Error("Cards played outside a trick");
      removeCards(
        round.hands[event.play.seat]!,
        event.play.cards.map(({ id }) => id),
      );
      round.currentTrick.plays.push(event.play);
      round.currentTurnSeat = nextSeat(event.play.seat, next);
      break;
    }
    case "THROW_SUCCEEDED": {
      requireRound(next).lastThrow = {
        kind: "successful",
        seat: event.seat,
        explanation: `Seat ${event.seat + 1} completed a throw`,
        pointDeltaToAttackers: 0,
      };
      break;
    }
    case "THROW_FAILED": {
      const round = requireRound(next);
      round.throwPenaltyAdjustment += event.pointDeltaToAttackers;
      round.lastThrow = {
        kind: "failed",
        seat: event.seat,
        explanation: event.explanation,
        pointDeltaToAttackers: event.pointDeltaToAttackers,
      };
      break;
    }
    case "TRICK_WON": {
      const round = requireRound(next);
      round.completedTricks.push(event.result);
      if (
        teamIdForSeat(event.result.winnerSeat, next.rulesetSnapshot) ===
        next.attackingTeamId
      ) {
        round.attackerPoints += event.result.points;
      }
      round.currentTurnSeat = event.result.winnerSeat;
      delete round.currentTrick;
      if (Object.values(round.hands).every((hand) => hand.length === 0)) {
        round.finalTrickWinnerSeat = event.result.winnerSeat;
      }
      break;
    }
    case "BOTTOM_REVEALED": {
      requireRound(next).attackerPoints += event.pointsAwarded;
      break;
    }
    case "ROUND_SCORED": {
      const round = requireRound(next);
      round.outcome = event.outcome;
      next.phase = "round-scoring";
      break;
    }
    case "RANKS_UPDATED": {
      next.ranks = { ...event.ranks };
      break;
    }
    case "TEAMS_UPDATED": {
      next.defendingTeamId = event.defendingTeamId;
      next.attackingTeamId = event.attackingTeamId;
      next.leaderSeat = event.leaderSeat;
      break;
    }
    case "GAME_ENDED": {
      next.phase = "game-over";
      break;
    }
  }

  return next;
}

export function replayEvents(
  initial: GameState,
  events: readonly GameEvent[],
): GameState {
  return events.reduce(applyEvent, initial);
}
