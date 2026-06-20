import { createAndValidateBid } from "../bidding/bidding.js";
import { sumCardPoints } from "../cards/deck.js";
import { advanceRank, isSuccessfulDefenseAtGameRank } from "../scoring/ranks.js";
import { getBottomMultiplier, scoreRound } from "../scoring/scoring.js";
import { resolveThrowAttempt } from "../throws/throws.js";
import { validateFollow, validateLead } from "../tricks/legality.js";
import { determineTrickWinner } from "../tricks/winner.js";
import type { TrickComponent, TrickFormat } from "../tricks/types.js";
import type { CardInstance, Rank } from "../types.js";
import type { ClientCommand, GameEvent, GameState } from "./model.js";
import { applyEvent, replayEvents, teamIdForSeat } from "./reducer.js";

export type CommandErrorCode =
  | "UNKNOWN_PLAYER"
  | "PLAYER_NOT_SEATED"
  | "SEAT_OUT_OF_RANGE"
  | "SEAT_OCCUPIED"
  | "INVALID_PHASE"
  | "NOT_LEADER"
  | "NOT_YOUR_TURN"
  | "UNKNOWN_CARD"
  | "NO_BID"
  | "SEED_REQUIRED"
  | "INVALID_COMMAND";

export class CommandValidationError extends Error {
  constructor(
    readonly code: CommandErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CommandValidationError";
  }
}

export type CommandContext = {
  now: string;
  /** Required when READY or START_NEXT_ROUND needs to create a shuffled round. */
  roundSeed?: string;
};

function deadline(now: string, seconds: number): string {
  const time = Date.parse(now);
  if (!Number.isFinite(time))
    throw new RangeError("Command time must be an ISO timestamp");
  return new Date(time + seconds * 1_000).toISOString();
}

function actorSeat(state: GameState, actor: string): number {
  const player = state.players[actor];
  if (player === undefined) {
    throw new CommandValidationError("UNKNOWN_PLAYER", `Unknown player ${actor}`);
  }
  if (player.seat === null) {
    throw new CommandValidationError("PLAYER_NOT_SEATED", "Choose a seat first");
  }
  return player.seat;
}

function cardsById(state: GameState, ids: readonly string[]): CardInstance[] {
  const round = state.round;
  if (round === undefined) {
    throw new CommandValidationError("INVALID_PHASE", "There is no active round");
  }
  return ids.map((id) => {
    const card = round.cards[id];
    if (card === undefined) {
      throw new CommandValidationError("UNKNOWN_CARD", `Unknown card ${id}`);
    }
    return card;
  });
}

function handCards(state: GameState, seat: number): CardInstance[] {
  const round = state.round;
  if (round === undefined) return [];
  return cardsById(state, round.hands[seat] ?? []);
}

function requireRoundSeed(context: CommandContext): string {
  if (context.roundSeed === undefined || context.roundSeed.length === 0) {
    throw new CommandValidationError(
      "SEED_REQUIRED",
      "The server must provide a fresh random round seed",
    );
  }
  return context.roundSeed;
}

function areAllSeatsReady(state: GameState): boolean {
  return Object.values(state.seats).every((playerId) => {
    if (playerId === null) return false;
    return state.players[playerId]?.ready === true;
  });
}

function roundStartedEvent(input: {
  state: GameState;
  seed: string;
  roundNumber: number;
  trumpRank: Rank;
  at: string;
}): GameEvent {
  return {
    type: "ROUND_STARTED",
    seed: input.seed,
    roundNumber: input.roundNumber,
    trumpRank: input.trumpRank,
    ...(input.state.leaderSeat === undefined
      ? {}
      : { leaderSeat: input.state.leaderSeat }),
    at: input.at,
  };
}

function componentFormat(component: TrickComponent): TrickFormat {
  return {
    kind:
      component.kind === "tractor"
        ? "tractor"
        : component.tupleSize === 1
          ? "single"
          : "tuple",
    cardCount: component.cardCount,
    effectiveSuit: component.effectiveSuit,
    components: [component],
  };
}

function fixedTeamIds(state: GameState): string[] {
  return state.rulesetSnapshot.teams.teams.map((_, index) => `team-${index}`);
}

function oppositeTeam(state: GameState, teamId: string): string {
  const other = fixedTeamIds(state).find((candidate) => candidate !== teamId);
  if (other === undefined) {
    throw new Error("The v1 round flow requires at least two teams");
  }
  return other;
}

function nextLeaderOnTeam(state: GameState, teamId: string): number {
  const current = state.leaderSeat ?? 0;
  for (let offset = 1; offset <= state.rulesetSnapshot.players.count; offset += 1) {
    const candidate = (current + offset) % state.rulesetSnapshot.players.count;
    if (teamIdForSeat(candidate, state.rulesetSnapshot) === teamId) return candidate;
  }
  throw new Error(`No seat belongs to ${teamId}`);
}

function longestThrowComponent(format: TrickFormat): "single" | "pair" | "tractor" {
  const longest = [...format.components].sort((a, b) => b.cardCount - a.cardCount)[0];
  if (longest?.kind === "tractor") return "tractor";
  if (longest?.kind === "tuple" && longest.tupleSize >= 2) return "pair";
  return "single";
}

function finishRoundEvents(state: GameState, at: string): GameEvent[] {
  const round = state.round;
  if (
    round === undefined ||
    round.finalTrickWinnerSeat === undefined ||
    round.buriedBottom === undefined ||
    round.currentTrick !== undefined
  ) {
    return [];
  }
  const lastTrick = round.completedTricks.at(-1);
  const ledFormat = lastTrick?.plays[0]?.format;
  if (lastTrick === undefined || ledFormat === null || ledFormat === undefined) {
    throw new Error("Completed round is missing its final led format");
  }

  const multiplier = getBottomMultiplier(
    ledFormat.kind === "single"
      ? { kind: "single" }
      : ledFormat.kind === "tractor"
        ? { kind: "tractor" }
        : ledFormat.kind === "tuple"
          ? {
              kind: "tuple",
              tupleSize:
                ledFormat.components[0]?.kind === "tuple"
                  ? ledFormat.components[0].tupleSize
                  : 1,
            }
          : { kind: "throw", longestComponent: longestThrowComponent(ledFormat) },
    state.rulesetSnapshot.bottom,
  );
  const attackersWonLast =
    teamIdForSeat(round.finalTrickWinnerSeat, state.rulesetSnapshot) ===
    state.attackingTeamId;
  const bottomPoints = sumCardPoints(cardsById(state, round.buriedBottom));
  const bottomEvent: GameEvent = {
    type: "BOTTOM_REVEALED",
    cards: [...round.buriedBottom],
    multiplier,
    pointsAwarded: attackersWonLast ? bottomPoints * multiplier : 0,
    at,
  };
  const afterBottom = applyEvent(state, bottomEvent);
  const afterBottomRound = afterBottom.round!;
  const finalAttackerPoints = Math.max(
    0,
    afterBottomRound.attackerPoints + afterBottomRound.throwPenaltyAdjustment,
  );
  const outcome = scoreRound(finalAttackerPoints, state.rulesetSnapshot.scoring);
  const scoreEvent: GameEvent = { type: "ROUND_SCORED", outcome, at };
  const events: GameEvent[] = [bottomEvent, scoreEvent];

  const defendingTeamId = state.defendingTeamId;
  const attackingTeamId = state.attackingTeamId;
  if (defendingTeamId === undefined || attackingTeamId === undefined) {
    throw new Error("Round ended before team roles were assigned");
  }
  const winningTeamId =
    outcome.winner === "defenders" ? defendingTeamId : attackingTeamId;
  const defendingSeat =
    state.rulesetSnapshot.teams.teams[
      Number.parseInt(defendingTeamId.replace("team-", ""), 10)
    ]?.[0];
  const defendingPlayer =
    defendingSeat === undefined ? undefined : state.seats[defendingSeat];
  const defendingRank =
    defendingPlayer === null ? undefined : state.ranks[defendingPlayer ?? ""];
  if (
    defendingRank !== undefined &&
    isSuccessfulDefenseAtGameRank(
      defendingRank,
      outcome.winner,
      state.rulesetSnapshot.ranks,
    )
  ) {
    events.push({ type: "GAME_ENDED", winnerTeamId: defendingTeamId, at });
    return events;
  }

  const updatedRanks = { ...state.ranks };
  for (let seat = 0; seat < state.rulesetSnapshot.players.count; seat += 1) {
    if (teamIdForSeat(seat, state.rulesetSnapshot) !== winningTeamId) continue;
    const playerId = state.seats[seat];
    if (playerId === null || playerId === undefined) continue;
    updatedRanks[playerId] = advanceRank(
      updatedRanks[playerId]!,
      outcome.levelDelta,
      state.rulesetSnapshot.ranks,
    );
  }
  const nextLeader = nextLeaderOnTeam(state, winningTeamId);
  events.push(
    { type: "RANKS_UPDATED", ranks: updatedRanks, at },
    {
      type: "TEAMS_UPDATED",
      defendingTeamId: winningTeamId,
      attackingTeamId: oppositeTeam(state, winningTeamId),
      leaderSeat: nextLeader,
      at,
    },
  );
  return events;
}

function validatePlayCommand(
  state: GameState,
  seat: number,
  command: Extract<ClientCommand, { type: "PLAY_CARDS" }>,
  at: string,
): GameEvent[] {
  const round = state.round;
  if (state.phase !== "playing" || round?.trumpSpec === undefined) {
    throw new CommandValidationError("INVALID_PHASE", "Cards cannot be played now");
  }
  if (round.currentTurnSeat !== seat) {
    throw new CommandValidationError("NOT_YOUR_TURN", "It is not your turn");
  }
  const selected = cardsById(state, command.cards);
  const hand = handCards(state, seat);

  if (round.currentTrick === undefined) {
    const lead = validateLead({
      cards: selected,
      hand,
      trump: round.trumpSpec,
      intent: command.intent,
      throwsEnabled: state.rulesetSnapshot.throws.enabled,
    });
    if (lead.format === null) throw new Error("A validated lead must have a format");

    if (command.intent === "throw") {
      const throwingTeam = teamIdForSeat(seat, state.rulesetSnapshot);
      const resolution = resolveThrowAttempt({
        cards: selected,
        opponents: Object.entries(round.hands)
          .filter(([opponentSeat]) => Number(opponentSeat) !== seat)
          .map(([opponentSeat, cardIds]) => ({
            seat: Number(opponentSeat),
            hand: cardsById(state, cardIds),
          })),
        trump: round.trumpSpec,
        throwingRole:
          throwingTeam === state.defendingTeamId ? "defenders" : "attackers",
        rules: state.rulesetSnapshot.throws,
      });
      if (resolution.kind === "failed") {
        const forcedFormat = componentFormat(resolution.forcedComponent);
        const forcedPlay = {
          seat,
          cards: resolution.forcedComponent.cards,
          format: forcedFormat,
          eligibleToWin: true,
        };
        const beatingSeat = resolution.failingComponents.find(
          ({ component }) => component === resolution.forcedComponent,
        )?.beatBySeat;
        return [
          {
            type: "THROW_FAILED",
            seat,
            attemptedCards: [...command.cards],
            forcedCards: forcedPlay.cards.map(({ id }) => id),
            pointDeltaToAttackers: resolution.pointDeltaToAttackers,
            explanation: `Throw failed${beatingSeat === undefined ? "" : `: seat ${beatingSeat} can beat the forced component`}`,
            at,
          },
          { type: "TRICK_STARTED", leadSeat: seat, format: forcedFormat, at },
          { type: "CARDS_PLAYED", play: forcedPlay, at },
        ];
      }
      return [
        {
          type: "THROW_SUCCEEDED",
          seat,
          cards: [...command.cards],
          format: resolution.trickFormat,
          at,
        },
        { type: "TRICK_STARTED", leadSeat: seat, format: resolution.trickFormat, at },
        { type: "CARDS_PLAYED", play: { seat, ...lead }, at },
      ];
    }

    return [
      { type: "TRICK_STARTED", leadSeat: seat, format: lead.format, at },
      { type: "CARDS_PLAYED", play: { seat, ...lead }, at },
    ];
  }

  if (command.intent === "throw") {
    throw new CommandValidationError(
      "INVALID_COMMAND",
      "Only a trick leader can throw",
    );
  }
  const follow = validateFollow({
    cards: selected,
    hand,
    ledFormat: round.currentTrick.ledFormat,
    trump: round.trumpSpec,
  });
  const play = { seat, ...follow };
  const events: GameEvent[] = [{ type: "CARDS_PLAYED", play, at }];
  const plays = [...round.currentTrick.plays, play];
  if (plays.length === state.rulesetSnapshot.players.count) {
    const winner = determineTrickWinner(plays, round.trumpSpec);
    const result = {
      leadSeat: round.currentTrick.leadSeat,
      winnerSeat: winner.winnerSeat,
      points: winner.points,
      plays,
    };
    events.push({ type: "TRICK_WON", result, at });
    const preview = replayEvents(state, events);
    events.push(...finishRoundEvents(preview, at));
  }
  return events;
}

export function validateCommand(
  state: GameState,
  actor: string,
  command: ClientCommand,
  context: CommandContext,
): GameEvent[] {
  const player = state.players[actor];
  if (player === undefined) {
    throw new CommandValidationError("UNKNOWN_PLAYER", `Unknown player ${actor}`);
  }

  switch (command.type) {
    case "SIT": {
      if (state.phase !== "lobby") {
        throw new CommandValidationError(
          "INVALID_PHASE",
          "Seats are locked after play starts",
        );
      }
      if (
        !Number.isInteger(command.seat) ||
        command.seat < 0 ||
        command.seat >= state.rulesetSnapshot.players.count
      ) {
        throw new CommandValidationError(
          "SEAT_OUT_OF_RANGE",
          "That seat does not exist",
        );
      }
      const occupant = state.seats[command.seat];
      if (occupant !== null && occupant !== undefined && occupant !== actor) {
        throw new CommandValidationError("SEAT_OCCUPIED", "That seat is occupied");
      }
      return [
        { type: "PLAYER_SEATED", playerId: actor, seat: command.seat, at: context.now },
      ];
    }
    case "READY": {
      if (state.phase !== "lobby") {
        throw new CommandValidationError(
          "INVALID_PHASE",
          "The lobby is already closed",
        );
      }
      actorSeat(state, actor);
      const readyEvent: GameEvent = {
        type: "PLAYER_READY_CHANGED",
        playerId: actor,
        ready: command.ready ?? true,
        at: context.now,
      };
      const preview = applyEvent(state, readyEvent);
      if (!areAllSeatsReady(preview)) return [readyEvent];
      return [
        readyEvent,
        roundStartedEvent({
          state: preview,
          seed: requireRoundSeed(context),
          roundNumber: 1,
          trumpRank: preview.rulesetSnapshot.ranks.sequence[0]!,
          at: context.now,
        }),
      ];
    }
    case "BID": {
      if (state.phase !== "dealing" && state.phase !== "post-deal-bidding") {
        throw new CommandValidationError("INVALID_PHASE", "Bidding is closed");
      }
      const seat = actorSeat(state, actor);
      const round = state.round!;
      const bid = createAndValidateBid({
        seat,
        cards: cardsById(state, command.cards),
        hand: handCards(state, seat),
        currentRank: round.trumpRank,
        ...(round.currentBid === undefined ? {} : { currentBid: round.currentBid }),
        placedAt: context.now,
        rules: state.rulesetSnapshot.bidding,
      });
      const events: GameEvent[] = [{ type: "BID_PLACED", seat, bid, at: context.now }];
      if (state.phase === "post-deal-bidding") {
        events.push({
          type: "BID_TIMER_STARTED",
          deadline: deadline(
            context.now,
            state.rulesetSnapshot.bidding.responseWindowSeconds,
          ),
          at: context.now,
        });
      }
      return events;
    }
    case "PASS_BID": {
      if (state.phase !== "post-deal-bidding") {
        throw new CommandValidationError(
          "INVALID_PHASE",
          "Passing is only available after the deal",
        );
      }
      return [{ type: "BID_PASSED", seat: actorSeat(state, actor), at: context.now }];
    }
    case "BURY_BOTTOM": {
      if (state.phase !== "bottom-exchange") {
        throw new CommandValidationError(
          "INVALID_PHASE",
          "The bottom cannot be buried now",
        );
      }
      const seat = actorSeat(state, actor);
      if (seat !== state.leaderSeat) {
        throw new CommandValidationError(
          "NOT_LEADER",
          "Only the leader can bury the bottom",
        );
      }
      if (command.cards.length !== state.rulesetSnapshot.bottom.size) {
        throw new CommandValidationError(
          "INVALID_COMMAND",
          `Exactly ${state.rulesetSnapshot.bottom.size} cards must be buried`,
        );
      }
      cardsById(state, command.cards);
      const handIds = new Set(state.round!.hands[seat]);
      const selectedIds = new Set(command.cards);
      if (
        selectedIds.size !== command.cards.length ||
        command.cards.some((card) => !handIds.has(card))
      ) {
        throw new CommandValidationError(
          "INVALID_COMMAND",
          "Every buried card must be a distinct card in the leader's hand",
        );
      }
      return [
        { type: "BOTTOM_BURIED", seat, cards: [...command.cards], at: context.now },
      ];
    }
    case "PLAY_CARDS":
      return validatePlayCommand(state, actorSeat(state, actor), command, context.now);
    case "START_NEXT_ROUND": {
      if (state.phase !== "round-scoring" || state.round?.outcome === undefined) {
        throw new CommandValidationError(
          "INVALID_PHASE",
          "The current round is not finished",
        );
      }
      const seat = actorSeat(state, actor);
      if (seat !== state.leaderSeat) {
        throw new CommandValidationError(
          "NOT_LEADER",
          "The next leader starts the next round",
        );
      }
      const playerId = state.seats[seat];
      const trumpRank =
        playerId === null || playerId === undefined ? undefined : state.ranks[playerId];
      if (trumpRank === undefined) throw new Error("Leader rank is unavailable");
      return [
        roundStartedEvent({
          state,
          seed: requireRoundSeed(context),
          roundNumber: state.round.roundNumber + 1,
          trumpRank,
          at: context.now,
        }),
      ];
    }
  }
}

/** Called by the authoritative room timer once per visual deal step. */
export function getNextDealEvents(state: GameState, now: string): GameEvent[] {
  const round = state.round;
  if (state.phase !== "dealing" || round === undefined) return [];
  if (round.undealt.length > state.rulesetSnapshot.bottom.size) {
    const totalCards = Object.keys(round.cards).length;
    const dealtCount = totalCards - round.undealt.length;
    return [
      {
        type: "CARD_DEALT",
        seat: dealtCount % state.rulesetSnapshot.players.count,
        card: round.undealt[0]!,
        at: now,
      },
    ];
  }
  return [
    { type: "DEAL_FINISHED", bottom: [...round.undealt], at: now },
    {
      type: "BID_TIMER_STARTED",
      deadline: deadline(now, state.rulesetSnapshot.bidding.postDealWindowSeconds),
      at: now,
    },
  ];
}

/** Called when the server-authoritative post-deal deadline expires. */
export function getFinalizeBiddingEvents(
  state: GameState,
  now: string,
  redealSeed?: string,
): GameEvent[] {
  if (state.phase !== "post-deal-bidding" || state.round === undefined) return [];
  const bid = state.round.currentBid;
  if (bid === undefined) {
    if (redealSeed === undefined || redealSeed.length === 0) {
      throw new CommandValidationError(
        "NO_BID",
        "No player bid; provide a fresh seed to redeal the round",
      );
    }
    return [
      roundStartedEvent({
        state,
        seed: redealSeed,
        roundNumber: state.round.roundNumber,
        trumpRank: state.round.trumpRank,
        at: now,
      }),
    ];
  }

  const leaderSeat = state.round.roundNumber === 1 ? bid.seat : state.leaderSeat;
  if (leaderSeat === undefined)
    throw new Error("Later round is missing its progressed leader");
  const events: GameEvent[] = [
    { type: "TRUMP_FINALIZED", trumpSpec: bid.declares, winningBid: bid, at: now },
  ];
  if (state.round.roundNumber === 1) {
    const defendingTeamId = teamIdForSeat(leaderSeat, state.rulesetSnapshot);
    events.push(
      { type: "LEADER_SET", seat: leaderSeat, at: now },
      {
        type: "TEAMS_UPDATED",
        defendingTeamId,
        attackingTeamId: oppositeTeam(state, defendingTeamId),
        leaderSeat,
        at: now,
      },
    );
  }
  events.push({ type: "BOTTOM_PICKED_UP", seat: leaderSeat, at: now });
  return events;
}
