import { createAndValidateBid } from "../bidding/bidding.js";
import { cardFaceKey, sameCardFace, sumCardPoints } from "../cards/deck.js";
import { resolveRuleset } from "../rulesets/options.js";
import { diffOptionKeys, editableOptionKeySet } from "../rulesets/options-metadata.js";
import { DEFAULT_PRESET_ID } from "../rulesets/registry.js";
import { advanceRank, isSuccessfulDefenseAtGameRank } from "../scoring/ranks.js";
import { getBottomMultiplier, scoreRound } from "../scoring/scoring.js";
import { resolveThrowAttempt } from "../throws/throws.js";
import { validateFollow, validateLead } from "../tricks/legality.js";
import { determineTrickWinner } from "../tricks/winner.js";
import type { PlayedCards, TrickComponent, TrickFormat } from "../tricks/types.js";
import type {
  Bid,
  CardInstance,
  Rank,
  RoundOutcome,
  SeatIndex,
  StandardCardFace,
  TrumpSpec,
} from "../types.js";
import type { ClientCommand, FriendCall, GameEvent, GameState } from "./model.js";
import { applyEvent, replayEvents } from "./reducer.js";
import { finalTeamIdForSeat, knownTeamIdForSeat, teamIdForSeat } from "./teams.js";

export type CommandErrorCode =
  | "UNKNOWN_PLAYER"
  | "PLAYER_NOT_SEATED"
  | "SEAT_OUT_OF_RANGE"
  | "SEAT_OCCUPIED"
  | "INVALID_PHASE"
  | "NOT_LEADER"
  | "NOT_HOST"
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

function nextRoundEvents(state: GameState, seed: string, at: string): GameEvent[] {
  const strategy = state.rulesetSnapshot.roundFlow.laterRoundLeader;
  switch (strategy) {
    case "round-progression": {
      const seat = state.leaderSeat;
      const playerId = seat === undefined ? undefined : state.seats[seat];
      const trumpRank =
        playerId === null || playerId === undefined ? undefined : state.ranks[playerId];
      if (trumpRank === undefined) throw new Error("Leader rank is unavailable");
      return [
        roundStartedEvent({
          state,
          seed,
          roundNumber: (state.round?.roundNumber ?? 0) + 1,
          trumpRank,
          at,
        }),
      ];
    }
    case "rebid-each-round": {
      // The previous declarer (still the leader through round-scoring) starts
      // the next round. Its trump rank is provisional — the declarer's current
      // rank, only seeding bidding display and the redeal-cap fallback — and
      // TRUMP_FINALIZED replaces it with the actual winning bidder's rank.
      const seat = state.leaderSeat;
      const playerId = seat === undefined ? undefined : state.seats[seat];
      const trumpRank =
        playerId === null || playerId === undefined ? undefined : state.ranks[playerId];
      if (trumpRank === undefined) {
        throw new Error("Previous declarer rank is unavailable");
      }
      return [
        roundStartedEvent({
          state,
          seed,
          roundNumber: (state.round?.roundNumber ?? 0) + 1,
          trumpRank,
          at,
        }),
      ];
    }
    default: {
      const exhaustive: never = strategy;
      throw new Error(`Unsupported laterRoundLeader: ${String(exhaustive)}`);
    }
  }
}

/**
 * Starts the next round on the leader's behalf when their window expires,
 * so a disconnected leader cannot lock the table in round-scoring.
 */
export function getAutoStartNextRoundEvents(
  state: GameState,
  at: string,
  seed: string,
): GameEvent[] {
  if (
    state.phase !== "round-scoring" ||
    state.round?.outcome === undefined ||
    state.leaderSeat === undefined
  ) {
    return [];
  }
  return nextRoundEvents(state, seed, at);
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

/** Copies of a face already played this round, in event order. */
function countCopiesPlayed(state: GameState, face: StandardCardFace): number {
  const round = state.round;
  if (round === undefined) return 0;
  const plays = [
    ...round.completedTricks.flatMap(({ plays: trickPlays }) => trickPlays),
    ...(round.currentTrick?.plays ?? []),
  ];
  let count = 0;
  for (const play of plays) {
    for (const card of play.cards) if (sameCardFace(card.face, face)) count += 1;
  }
  return count;
}

/**
 * Engine-derived friend reveals for one play: crossing a call's copyIndex
 * threshold reveals it, and a multi-card play can reveal several calls at
 * once. `state` must be the pre-play state so the cumulative count excludes
 * the play itself.
 */
function friendRevealEvents(
  state: GameState,
  play: PlayedCards,
  at: string,
): GameEvent[] {
  const round = state.round;
  if (
    state.rulesetSnapshot.teams.mode !== "finding-friends" ||
    round?.friendCalls === undefined
  ) {
    return [];
  }
  const trickNumber = round.completedTricks.length + 1;
  const events: GameEvent[] = [];
  round.friendCalls.forEach((call, callIndex) => {
    if (call.revealed !== undefined) return;
    const playedBefore = countCopiesPlayed(state, call.face);
    const playedNow = play.cards.filter((card) =>
      sameCardFace(card.face, call.face),
    ).length;
    if (playedBefore < call.copyIndex && call.copyIndex <= playedBefore + playedNow) {
      events.push({
        type: "FRIEND_REVEALED",
        seat: play.seat,
        callIndex,
        trickNumber,
        at,
      });
    }
  });
  return events;
}

function fixedTeamIds(state: GameState): string[] {
  if (state.rulesetSnapshot.teams.mode !== "fixed") {
    throw new Error("Fixed team ids require fixed teams");
  }
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

/**
 * Finding-friends round completion after ROUND_SCORED: the declarer's rank
 * gates the game end, each player advances individually by final membership,
 * and no TEAMS_UPDATED is emitted — FF teams are round-scoped, the next
 * round's roles come from its own bidding, and the leader (still the
 * declarer) starts it.
 */
function finishFindingFriendsRoundEvents(
  state: GameState,
  outcome: RoundOutcome,
  at: string,
): GameEvent[] {
  const declarerSeat = state.round?.declarerSeat;
  if (declarerSeat === undefined) {
    throw new Error("Finding-friends round ended without a declarer");
  }
  const declarerPlayer = state.seats[declarerSeat];
  const declarerRank =
    declarerPlayer === null || declarerPlayer === undefined
      ? undefined
      : state.ranks[declarerPlayer];
  if (
    declarerRank !== undefined &&
    isSuccessfulDefenseAtGameRank(
      declarerRank,
      outcome.winner,
      state.rulesetSnapshot.ranks,
    )
  ) {
    return [{ type: "GAME_ENDED", winnerTeamId: "defenders", at }];
  }

  const winningTeamId = outcome.winner === "defenders" ? "defenders" : "attackers";
  const updatedRanks = { ...state.ranks };
  const rankAdvancement = state.rulesetSnapshot.roundFlow.rankAdvancement;
  switch (rankAdvancement) {
    // Constant-true today: the enum has one member; the switch keeps future
    // additions a compile error via the never check below.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    case "winning-team-members": {
      for (let seat = 0; seat < state.rulesetSnapshot.players.count; seat += 1) {
        const finalTeamId = finalTeamIdForSeat(state, seat);
        if (finalTeamId !== winningTeamId) continue;
        const playerId = state.seats[seat];
        if (playerId === null || playerId === undefined) continue;
        updatedRanks[playerId] = advanceRank(
          updatedRanks[playerId]!,
          outcome.levelDelta,
          state.rulesetSnapshot.ranks,
          { wasDefender: finalTeamId === "defenders" },
        );
      }
      break;
    }
    default: {
      const exhaustive: never = rankAdvancement;
      throw new Error(`Unsupported rankAdvancement: ${String(exhaustive)}`);
    }
  }
  return [{ type: "RANKS_UPDATED", ranks: updatedRanks, at }];
}

/**
 * The round is over exactly when every hand is empty after a completed
 * trick. The final winner is re-derived from the last completed trick
 * rather than gated on `finalTrickWinnerSeat`, so any path that empties
 * the hands (normal play, forced play, state recovery) finishes the round.
 */
export function finishRoundEvents(state: GameState, at: string): GameEvent[] {
  const round = state.round;
  if (
    round === undefined ||
    round.buriedBottom === undefined ||
    round.currentTrick !== undefined ||
    round.outcome !== undefined ||
    round.completedTricks.length === 0 ||
    Object.values(round.hands).some((hand) => hand.length > 0)
  ) {
    return [];
  }
  const lastTrick = round.completedTricks.at(-1);
  const ledFormat = lastTrick?.plays[0]?.format;
  if (lastTrick === undefined || ledFormat === null || ledFormat === undefined) {
    throw new Error("Completed round is missing its final led format");
  }
  const finalWinnerSeat = round.finalTrickWinnerSeat ?? lastTrick.winnerSeat;
  const teamsConfig = state.rulesetSnapshot.teams;
  const isFindingFriends = teamsConfig.mode === "finding-friends";

  const multiplier = getBottomMultiplier(ledFormat, state.rulesetSnapshot.bottom);
  // "Attackers won the last trick" resolves with final membership: in
  // finding-friends a still-unrevealed winner counts as an attacker.
  const attackersWonLast = isFindingFriends
    ? finalTeamIdForSeat(state, finalWinnerSeat) === "attackers"
    : teamIdForSeat(finalWinnerSeat, state.rulesetSnapshot) === state.attackingTeamId;
  const bottomPoints = sumCardPoints(cardsById(state, round.buriedBottom));
  const bottomAward = attackersWonLast ? bottomPoints * multiplier : 0;
  const bottomEvent: GameEvent = {
    type: "BOTTOM_REVEALED",
    cards: [...round.buriedBottom],
    multiplier,
    pointsAwarded: bottomAward,
    at,
  };
  const finalAttackerPoints = (() => {
    if (isFindingFriends) {
      // pointsBySeat is the accounting source of truth; the running
      // attackerPoints is only a provisional display value.
      let trickPoints = 0;
      for (const [seat, points] of Object.entries(round.pointsBySeat ?? {})) {
        if (finalTeamIdForSeat(state, Number(seat)) === "attackers") {
          trickPoints += points;
        }
      }
      return trickPoints + bottomAward + round.throwPenaltyAdjustment;
    }
    const afterBottomRound = applyEvent(state, bottomEvent).round!;
    return afterBottomRound.attackerPoints + afterBottomRound.throwPenaltyAdjustment;
  })();
  const outcome = scoreRound(finalAttackerPoints, state.rulesetSnapshot.scoring);
  const scoreEvent: GameEvent = { type: "ROUND_SCORED", outcome, at };
  const events: GameEvent[] = [bottomEvent, scoreEvent];

  if (isFindingFriends) {
    events.push(...finishFindingFriendsRoundEvents(state, outcome, at));
    return events;
  }

  const defendingTeamId = state.defendingTeamId;
  const attackingTeamId = state.attackingTeamId;
  if (defendingTeamId === undefined || attackingTeamId === undefined) {
    throw new Error("Round ended before team roles were assigned");
  }
  const winningTeamId =
    outcome.winner === "defenders" ? defendingTeamId : attackingTeamId;
  const defendingSeat =
    teamsConfig.teams[Number.parseInt(defendingTeamId.replace("team-", ""), 10)]?.[0];
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
  const rankAdvancement = state.rulesetSnapshot.roundFlow.rankAdvancement;
  switch (rankAdvancement) {
    // Constant-true today: the enum has one member; the switch keeps future
    // additions a compile error via the never check below.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    case "winning-team-members": {
      for (let seat = 0; seat < state.rulesetSnapshot.players.count; seat += 1) {
        if (teamIdForSeat(seat, state.rulesetSnapshot) !== winningTeamId) continue;
        const playerId = state.seats[seat];
        if (playerId === null || playerId === undefined) continue;
        updatedRanks[playerId] = advanceRank(
          updatedRanks[playerId]!,
          outcome.levelDelta,
          state.rulesetSnapshot.ranks,
          {
            wasDefender: teamIdForSeat(seat, state.rulesetSnapshot) === defendingTeamId,
          },
        );
      }
      break;
    }
    default: {
      const exhaustive: never = rankAdvancement;
      throw new Error(`Unsupported rankAdvancement: ${String(exhaustive)}`);
    }
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
      // A seat not publicly known to defend (an unrevealed friend included)
      // takes the attacker penalty.
      const throwingTeam = knownTeamIdForSeat(state, seat);
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
          throwingTeam !== undefined && throwingTeam === state.defendingTeamId
            ? "defenders"
            : "attackers",
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
          ...friendRevealEvents(state, forcedPlay, at),
        ];
      }
      const throwPlay = { seat, ...lead };
      return [
        {
          type: "THROW_SUCCEEDED",
          seat,
          cards: [...command.cards],
          format: resolution.trickFormat,
          at,
        },
        { type: "TRICK_STARTED", leadSeat: seat, format: resolution.trickFormat, at },
        { type: "CARDS_PLAYED", play: throwPlay, at },
        ...friendRevealEvents(state, throwPlay, at),
      ];
    }

    const leadPlay = { seat, ...lead };
    return [
      { type: "TRICK_STARTED", leadSeat: seat, format: lead.format, at },
      { type: "CARDS_PLAYED", play: leadPlay, at },
      ...friendRevealEvents(state, leadPlay, at),
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
  const events: GameEvent[] = [
    { type: "CARDS_PLAYED", play, at },
    ...friendRevealEvents(state, play, at),
  ];
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
          trumpRank:
            preview.rulesetSnapshot.ranks.startingRank ??
            preview.rulesetSnapshot.ranks.sequence[0]!,
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
      if (state.phase === "post-deal-bidding" && round.passedBidSeats.includes(seat)) {
        throw new CommandValidationError(
          "INVALID_COMMAND",
          "You already passed; wait for another bid",
        );
      }
      const declareRankSource = state.rulesetSnapshot.bidding.declareRankSource;
      let currentRank: Rank;
      switch (declareRankSource) {
        case "round-rank":
          currentRank = round.trumpRank;
          break;
        case "bidder-own-rank": {
          // Each player bids cards of their own level; comparison across
          // different ranks is unchanged (count, then tier).
          const ownRank = state.ranks[actor];
          if (ownRank === undefined) throw new Error("Bidder rank is unavailable");
          currentRank = ownRank;
          break;
        }
        default: {
          const exhaustive: never = declareRankSource;
          throw new Error(`Unsupported declareRankSource: ${String(exhaustive)}`);
        }
      }
      const bid = createAndValidateBid({
        seat,
        cards: cardsById(state, command.cards),
        hand: handCards(state, seat),
        currentRank,
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
      const seat = actorSeat(state, actor);
      if (state.round?.passedBidSeats.includes(seat) === true) {
        throw new CommandValidationError(
          "INVALID_COMMAND",
          "You already passed this bid",
        );
      }
      return [{ type: "BID_PASSED", seat, at: context.now }];
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
    case "CALL_FRIENDS": {
      const teams = state.rulesetSnapshot.teams;
      if (state.phase !== "friend-calling" || teams.mode !== "finding-friends") {
        throw new CommandValidationError(
          "INVALID_PHASE",
          "Friends cannot be called now",
        );
      }
      const seat = actorSeat(state, actor);
      const round = state.round!;
      if (seat !== round.declarerSeat) {
        throw new CommandValidationError(
          "NOT_LEADER",
          "Only the declarer calls friends",
        );
      }
      if (command.calls.length !== teams.friends.callCount) {
        throw new CommandValidationError(
          "INVALID_COMMAND",
          `Exactly ${teams.friends.callCount} friend call(s) must be made`,
        );
      }
      const callableCards = teams.friends.callableCards;
      const calls: FriendCall[] = [];
      const seenCalls = new Set<string>();
      for (const call of command.calls) {
        // A FriendCall can never name a joker under any callable strategy.
        const face = call.face;
        if (face.kind !== "standard") {
          throw new CommandValidationError(
            "INVALID_COMMAND",
            "Jokers cannot be called",
          );
        }
        switch (callableCards) {
          // Constant-true today: the enum has one member; the switch keeps
          // future additions a compile error via the never check below.
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          case "any-non-trump": {
            if (face.rank === round.trumpRank) {
              throw new CommandValidationError(
                "INVALID_COMMAND",
                "Level-rank cards cannot be called",
              );
            }
            if (
              round.trumpSpec?.mode === "suit" &&
              face.suit === round.trumpSpec.suit
            ) {
              throw new CommandValidationError(
                "INVALID_COMMAND",
                "Trump-suit cards cannot be called",
              );
            }
            break;
          }
          default: {
            const exhaustive: never = callableCards;
            throw new Error(`Unsupported callableCards: ${String(exhaustive)}`);
          }
        }
        if (
          !Number.isInteger(call.copyIndex) ||
          call.copyIndex < 1 ||
          call.copyIndex > state.rulesetSnapshot.decks.count
        ) {
          throw new CommandValidationError(
            "INVALID_COMMAND",
            `Copy index must be between 1 and ${state.rulesetSnapshot.decks.count}`,
          );
        }
        const callKey = `${cardFaceKey(face)}#${call.copyIndex}`;
        if (seenCalls.has(callKey)) {
          throw new CommandValidationError(
            "INVALID_COMMAND",
            "Friend calls must be distinct",
          );
        }
        seenCalls.add(callKey);
        calls.push({ face: { ...face }, copyIndex: call.copyIndex });
      }
      return [{ type: "FRIENDS_CALLED", seat, calls, at: context.now }];
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
      return nextRoundEvents(state, requireRoundSeed(context), context.now);
    }
    case "UPDATE_OPTIONS": {
      if (state.phase === "game-over") {
        throw new CommandValidationError(
          "INVALID_PHASE",
          "Options cannot be changed after the game has ended",
        );
      }
      if (state.hostPlayerId === undefined || state.hostPlayerId !== actor) {
        throw new CommandValidationError(
          "NOT_HOST",
          "Only the host can change the game options",
        );
      }
      if (state.phase !== "lobby") {
        // Mid-game, only keys OPTION_METADATA marks in-game-safe (timers today)
        // may change; everything else would invalidate the live round. A
        // preset switch is inherently structural, so it is rejected outright.
        const requestedPresetId =
          command.presetId ?? state.presetId ?? DEFAULT_PRESET_ID;
        if (requestedPresetId !== (state.presetId ?? DEFAULT_PRESET_ID)) {
          throw new CommandValidationError(
            "INVALID_PHASE",
            "Cannot change the preset outside the lobby",
          );
        }
        const editableKeys = editableOptionKeySet(state.phase);
        const changedKeys = diffOptionKeys(state.pendingOptions ?? {}, command.options);
        const offendingKeys = changedKeys.filter((key) => !editableKeys.has(key));
        if (offendingKeys.length > 0) {
          throw new CommandValidationError(
            "INVALID_PHASE",
            `Cannot change ${offendingKeys.join(", ")} outside the lobby`,
          );
        }
      }
      const presetId = command.presetId ?? state.presetId ?? DEFAULT_PRESET_ID;
      const result = resolveRuleset(presetId, command.options);
      if (!result.ok) {
        throw new CommandValidationError(
          "INVALID_COMMAND",
          result.issues[0]?.message ?? "Invalid options",
        );
      }
      const newCount = result.ruleset.players.count;
      const conflictingSeats = Object.entries(state.seats)
        .filter(([seat, occupant]) => occupant !== null && Number(seat) >= newCount)
        .map(([seat]) => Number(seat))
        .sort((a, b) => a - b);
      if (conflictingSeats.length > 0) {
        throw new CommandValidationError(
          "INVALID_COMMAND",
          `Cannot shrink to ${newCount} players while seat(s) ${conflictingSeats.join(", ")} are occupied`,
        );
      }
      const joinedPlayerCount = Object.keys(state.players).length;
      if (newCount < joinedPlayerCount) {
        throw new CommandValidationError(
          "INVALID_COMMAND",
          `Cannot shrink to ${newCount} players while ${joinedPlayerCount} players have joined`,
        );
      }
      return [
        {
          type: "OPTIONS_UPDATED",
          presetId,
          options: command.options,
          ruleset: result.ruleset,
          at: context.now,
        },
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

function trumpFinalizedEvents(input: {
  state: GameState;
  trumpSpec: TrumpSpec;
  leaderSeat: number;
  winningBid?: Bid;
  now: string;
}): GameEvent[] {
  const { state, trumpSpec, leaderSeat, winningBid, now } = input;
  const isFindingFriends = state.rulesetSnapshot.teams.mode === "finding-friends";
  const events: GameEvent[] = [
    {
      type: "TRUMP_FINALIZED",
      trumpSpec,
      at: now,
      ...(winningBid === undefined ? {} : { winningBid }),
      // The declared spec always carries the declarer's rank, and the round's
      // provisional rank must follow it so effective-suit and tuple logic
      // agree with the trump spec.
      ...(isFindingFriends
        ? { trumpRank: trumpSpec.rank, declarerSeat: leaderSeat }
        : {}),
    },
  ];
  if (isFindingFriends) {
    // Every FF round re-assigns roles at finalize under the round-scoped
    // team ids; the declarer's side defends.
    events.push(
      { type: "LEADER_SET", seat: leaderSeat, at: now },
      {
        type: "TEAMS_UPDATED",
        defendingTeamId: "defenders",
        attackingTeamId: "attackers",
        leaderSeat,
        at: now,
      },
    );
  } else if (state.round?.roundNumber === 1) {
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

/**
 * Deterministic fallback once the redeal cap is reached: the first card of
 * the bottom declares trump at the given rank (a joker declares no-trump).
 */
function forcedTrumpFromBottom(state: GameState, trumpRank: Rank): TrumpSpec {
  const strategy = state.rulesetSnapshot.bidding.noBidFallback;
  switch (strategy) {
    // Constant-true today: the enum has one member; the switch keeps future
    // additions a compile error via the never check below.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    case "bottom-card-declares": {
      const round = state.round!;
      const firstBottomCard = round.cards[round.bottom[0] ?? ""];
      if (firstBottomCard === undefined) {
        throw new Error("Cannot force trump from an empty bottom");
      }
      return firstBottomCard.face.kind === "joker"
        ? { mode: "no-trump", rank: trumpRank }
        : { mode: "suit", rank: trumpRank, suit: firstBottomCard.face.suit };
    }
    default: {
      const exhaustive: never = strategy;
      throw new Error(`Unsupported noBidFallback: ${String(exhaustive)}`);
    }
  }
}

/**
 * Declarer seat when the redeal cap is reached without a bid. Round
 * progression keeps the current leader (seat 0 on round 1); rebid-each-round
 * rotates deterministically to the seat after the previous declarer.
 */
function forcedDeclarerSeat(state: GameState): SeatIndex {
  const strategy = state.rulesetSnapshot.roundFlow.laterRoundLeader;
  switch (strategy) {
    case "round-progression":
      return state.round?.roundNumber === 1 ? 0 : (state.leaderSeat ?? 0);
    case "rebid-each-round": {
      if (state.round?.roundNumber === 1 || state.leaderSeat === undefined) return 0;
      return (state.leaderSeat + 1) % state.rulesetSnapshot.players.count;
    }
    default: {
      const exhaustive: never = strategy;
      throw new Error(`Unsupported laterRoundLeader: ${String(exhaustive)}`);
    }
  }
}

/** Called when the server-authoritative post-deal deadline expires. */
export function getFinalizeBiddingEvents(
  state: GameState,
  now: string,
  redealSeed?: string,
): GameEvent[] {
  if (state.phase !== "post-deal-bidding" || state.round === undefined) return [];
  const declareRankSource = state.rulesetSnapshot.bidding.declareRankSource;
  const bid = state.round.currentBid;
  if (bid === undefined) {
    if (state.round.redealCount >= state.rulesetSnapshot.bidding.maxRedeals) {
      const leaderSeat = forcedDeclarerSeat(state);
      let trumpRank: Rank;
      switch (declareRankSource) {
        case "round-rank":
          trumpRank = state.round.trumpRank;
          break;
        case "bidder-own-rank": {
          const playerId = state.seats[leaderSeat];
          const ownRank =
            playerId === null || playerId === undefined
              ? undefined
              : state.ranks[playerId];
          if (ownRank === undefined) {
            throw new Error("Fallback declarer rank is unavailable");
          }
          trumpRank = ownRank;
          break;
        }
        default: {
          const exhaustive: never = declareRankSource;
          throw new Error(`Unsupported declareRankSource: ${String(exhaustive)}`);
        }
      }
      return trumpFinalizedEvents({
        state,
        trumpSpec: forcedTrumpFromBottom(state, trumpRank),
        leaderSeat,
        now,
      });
    }
    if (redealSeed === undefined || redealSeed.length === 0) {
      throw new CommandValidationError(
        "NO_BID",
        "No player bid; provide a fresh seed to redeal the round",
      );
    }
    // A redeal keeps the provisional round rank regardless of rank source.
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

  const laterRoundLeader = state.rulesetSnapshot.roundFlow.laterRoundLeader;
  let leaderSeat: SeatIndex;
  switch (laterRoundLeader) {
    case "round-progression": {
      const progressed = state.round.roundNumber === 1 ? bid.seat : state.leaderSeat;
      if (progressed === undefined)
        throw new Error("Later round is missing its progressed leader");
      leaderSeat = progressed;
      break;
    }
    case "rebid-each-round":
      leaderSeat = bid.seat;
      break;
    default: {
      const exhaustive: never = laterRoundLeader;
      throw new Error(`Unsupported laterRoundLeader: ${String(exhaustive)}`);
    }
  }
  return trumpFinalizedEvents({
    state,
    trumpSpec: bid.declares,
    leaderSeat,
    winningBid: bid,
    now,
  });
}
