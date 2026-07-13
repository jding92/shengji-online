import { createDeck } from "../cards/deck.js";
import { shuffleDeck } from "../cards/shuffle.js";
import type { GameOptions } from "../rulesets/options.js";
import type { ShengJiRuleset } from "../rulesets/schema.js";
import { CURRENT_SCHEMA_VERSION } from "./migrate.js";
import type { GameEvent, GameState, RoundState } from "./model.js";
import { knownTeamIdForSeat, teamIdForSeat } from "./teams.js";
import type { PlayerId } from "../types.js";

export { teamIdForSeat };

export function createGameState(input: {
  roomId: string;
  ruleset: ShengJiRuleset;
  createdAt: string;
  presetId?: string;
  pendingOptions?: GameOptions;
}): GameState {
  const seats: Record<number, null> = {};
  for (let seat = 0; seat < input.ruleset.players.count; seat += 1) seats[seat] = null;
  return {
    roomId: input.roomId,
    revision: 0,
    rulesetId: input.ruleset.id,
    rulesetSnapshot: structuredClone(input.ruleset),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ...(input.presetId === undefined ? {} : { presetId: input.presetId }),
    ...(input.pendingOptions === undefined
      ? {}
      : { pendingOptions: structuredClone(input.pendingOptions) }),
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

/**
 * Finding-friends provisional attacker total: every pile not publicly known
 * to belong to the defenders counts as attacker points until a reveal
 * retroactively moves it.
 */
function provisionalAttackerPoints(state: GameState): number {
  let total = 0;
  for (const [seat, points] of Object.entries(state.round?.pointsBySeat ?? {})) {
    if (knownTeamIdForSeat(state, Number(seat)) !== "defenders") total += points;
  }
  return total;
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
        ...(event.bot === undefined ? {} : { bot: { ...event.bot } }),
      };
      next.ranks[event.playerId] =
        next.rulesetSnapshot.ranks.startingRank ??
        next.rulesetSnapshot.ranks.sequence[0]!;
      break;
    }
    case "PLAYER_CONTROL_CHANGED": {
      const player = next.players[event.playerId];
      if (player === undefined) throw new Error(`Unknown player ${event.playerId}`);
      if (event.bot === undefined) {
        delete player.bot;
      } else {
        player.bot = { ...event.bot };
        player.connected = true;
      }
      break;
    }
    case "PLAYER_REMOVED": {
      const player = next.players[event.playerId];
      if (player === undefined) throw new Error(`Unknown player ${event.playerId}`);
      if (player.seat !== null) next.seats[player.seat] = null;
      delete next.players[event.playerId];
      delete next.ranks[event.playerId];
      break;
    }
    case "PLAYER_CONNECTION_CHANGED": {
      const player = next.players[event.playerId];
      if (player === undefined) throw new Error(`Unknown player ${event.playerId}`);
      player.connected = player.bot === undefined ? event.connected : true;
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
        redealCount:
          next.round !== undefined && next.round.roundNumber === event.roundNumber
            ? next.round.redealCount + 1
            : 0,
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
      if (event.trumpRank !== undefined) round.trumpRank = event.trumpRank;
      if (event.declarerSeat !== undefined) round.declarerSeat = event.declarerSeat;
      if (event.winningBid !== undefined) round.currentBid = event.winningBid;
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
      // The declarer calls friends knowing their final hand; called copies may
      // deliberately sit in the buried bottom.
      next.phase =
        next.rulesetSnapshot.teams.mode === "finding-friends"
          ? "friend-calling"
          : "playing";
      break;
    }
    case "FRIENDS_CALLED": {
      const round = requireRound(next);
      // Reveals only ever come from FRIEND_REVEALED, so any revealed marker on
      // the event payload is dropped.
      round.friendCalls = event.calls.map(({ face, copyIndex }) => ({
        face: { ...face },
        copyIndex,
      }));
      next.phase = "playing";
      break;
    }
    case "FRIEND_REVEALED": {
      const round = requireRound(next);
      const call = round.friendCalls?.[event.callIndex];
      if (call === undefined) {
        throw new Error(`Friend reveal for unknown call ${event.callIndex}`);
      }
      call.revealed = {
        seat: event.seat,
        trickNumber: event.trickNumber,
        at: event.at,
      };
      round.attackerPoints = provisionalAttackerPoints(next);
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
      if (next.rulesetSnapshot.teams.mode === "finding-friends") {
        const piles = round.pointsBySeat ?? {};
        piles[event.result.winnerSeat] =
          (piles[event.result.winnerSeat] ?? 0) + event.result.points;
        round.pointsBySeat = piles;
        round.attackerPoints = provisionalAttackerPoints(next);
      } else if (
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
      const round = requireRound(next);
      round.attackerPoints += event.pointsAwarded;
      round.bottomReveal = {
        cards: [...event.cards],
        multiplier: event.multiplier,
        pointsAwarded: event.pointsAwarded,
      };
      break;
    }
    case "ROUND_SCORED": {
      const round = requireRound(next);
      round.outcome = event.outcome;
      if (next.defendingTeamId === undefined || next.attackingTeamId === undefined) {
        throw new Error("Cannot record a round before team roles are assigned");
      }
      const winningTeamId =
        event.outcome.winner === "defenders"
          ? next.defendingTeamId
          : next.attackingTeamId;
      // At scoring, defender membership is final in either team mode. In
      // finding-friends this is the declarer plus every revealed friend.
      const defenderSeats =
        next.rulesetSnapshot.teams.mode === "finding-friends"
          ? Array.from(
              { length: next.rulesetSnapshot.players.count },
              (_, seat) => seat,
            ).filter((seat) => knownTeamIdForSeat(next, seat) === "defenders")
          : Array.from(
              { length: next.rulesetSnapshot.players.count },
              (_, seat) => seat,
            ).filter(
              (seat) =>
                teamIdForSeat(seat, next.rulesetSnapshot) === next.defendingTeamId,
            );
      next.roundHistory = [
        ...(next.roundHistory ?? []),
        {
          roundNumber: round.roundNumber,
          defendingTeamId: next.defendingTeamId,
          attackingTeamId: next.attackingTeamId,
          winningTeamId,
          outcome: { ...event.outcome },
          defenderSeats,
        },
      ];
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
    case "OPTIONS_UPDATED": {
      next.rulesetSnapshot = structuredClone(event.ruleset);
      next.rulesetId = event.ruleset.id;
      next.presetId = event.presetId;
      next.pendingOptions = structuredClone(event.options);
      // Mid-game, only in-game-safe keys (timers today) can have changed —
      // validateCommand guarantees it — so seats and ready state stay put and
      // the room's post-commit reschedule alone picks up the new values.
      if (next.phase === "lobby") {
        // Rebuild the seat map to the new count: keep existing assignments,
        // pad new seats with null, drop the empty tail. The command guards
        // against shrinking below an occupied seat, so no seated player is lost.
        const newCount = next.rulesetSnapshot.players.count;
        const resizedSeats: Record<number, PlayerId | null> = {};
        for (let seat = 0; seat < newCount; seat += 1) {
          resizedSeats[seat] = next.seats[seat] ?? null;
        }
        for (const [seatKey, occupant] of Object.entries(next.seats)) {
          if (Number(seatKey) < newCount || occupant === null) continue;
          const droppedPlayer = next.players[occupant];
          if (droppedPlayer !== undefined) droppedPlayer.seat = null;
        }
        next.seats = resizedSeats;
        // A rule change invalidates every prior consent; re-ready is required.
        for (const player of Object.values(next.players)) player.ready = false;
      }
      break;
    }
    case "HOST_CHANGED": {
      next.hostPlayerId = event.playerId;
      break;
    }
    case "BOT_DIFFICULTY_CHANGED": {
      const player = next.players[event.playerId];
      if (player === undefined) throw new Error(`Unknown player ${event.playerId}`);
      if (player.bot === undefined) {
        throw new Error(`Player ${event.playerId} is not a bot`);
      }
      player.bot = { ...player.bot, difficulty: event.difficulty };
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
