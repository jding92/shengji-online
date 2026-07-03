import type { ShengJiRuleset } from "../rulesets/schema.js";
import { teamIdForSeat } from "../state/reducer.js";
import type { GamePhase, GameState, TrickResult, TrickState } from "../state/model.js";
import type {
  Bid,
  CardInstance,
  PlayerId,
  Rank,
  SeatIndex,
  TeamId,
  TrumpSpec,
} from "../types.js";
import type { BotDifficulty } from "./types.js";

export type BotPublicBid = Pick<
  Bid,
  "seat" | "face" | "count" | "tier" | "declares" | "placedAt"
>;

export type BotSeatObservation = {
  seat: SeatIndex;
  playerId: PlayerId | null;
  teamId: TeamId;
  connected: boolean;
  ready: boolean;
  cardCount: number;
  botDifficulty?: BotDifficulty;
};

export type BotRoundObservation = {
  roundNumber: number;
  redealCount: number;
  trumpRank: Rank;
  trumpSpec?: TrumpSpec;
  currentBid?: BotPublicBid;
  passedBidSeats: SeatIndex[];
  dealtCardCount: number;
  currentTurnSeat?: SeatIndex;
  currentTrick?: TrickState;
  completedTricks: TrickResult[];
  attackerPoints: number;
  throwPenaltyAdjustment: number;
  bottomCount: number;
  buriedBottomCount: number;
  bottomReveal?: {
    cards: CardInstance[];
    multiplier: number;
    pointsAwarded: number;
  };
};

/**
 * Policy input assembled from public zones plus the acting player's private
 * cards. Deliberately absent: the deck seed, undealt cards, unrevealed bottom,
 * and every other player's hand.
 */
export type BotObservation = {
  roomId: string;
  revision: number;
  phase: GamePhase;
  playerId: PlayerId;
  ownSeat: SeatIndex | null;
  ownTeamId?: TeamId;
  ownHand: CardInstance[];
  ownBuried?: CardInstance[];
  leaderSeat?: SeatIndex;
  defendingTeamId?: TeamId;
  attackingTeamId?: TeamId;
  seats: BotSeatObservation[];
  ruleset: ShengJiRuleset;
  round?: BotRoundObservation;
};

function cloneCard(card: CardInstance): CardInstance {
  return structuredClone(card);
}

function cloneTrick(trick: TrickState): TrickState {
  return structuredClone(trick);
}

function cloneTrickResult(result: TrickResult): TrickResult {
  return structuredClone(result);
}

export function deriveBotObservation(
  state: GameState,
  playerId: PlayerId,
): BotObservation {
  const player = state.players[playerId];
  if (player === undefined) throw new RangeError(`Unknown player ${playerId}`);
  const round = state.round;
  const ownHand =
    player.seat === null || round === undefined
      ? []
      : (round.hands[player.seat] ?? []).map((id) => cloneCard(round.cards[id]!));
  const ownBuried =
    player.seat !== null &&
    player.seat === state.leaderSeat &&
    round?.buriedBottom !== undefined
      ? round.buriedBottom.map((id) => cloneCard(round.cards[id]!))
      : undefined;

  const seats = Array.from(
    { length: state.rulesetSnapshot.players.count },
    (_, seat): BotSeatObservation => {
      const occupantId = state.seats[seat] ?? null;
      const occupant = occupantId === null ? undefined : state.players[occupantId];
      return {
        seat,
        playerId: occupantId,
        teamId: teamIdForSeat(seat, state.rulesetSnapshot),
        connected: occupant?.connected ?? false,
        ready: occupant?.ready ?? false,
        cardCount: round?.hands[seat]?.length ?? 0,
        ...(occupant?.bot === undefined
          ? {}
          : { botDifficulty: occupant.bot.difficulty }),
      };
    },
  );

  return {
    roomId: state.roomId,
    revision: state.revision,
    phase: state.phase,
    playerId,
    ownSeat: player.seat,
    ...(player.seat === null
      ? {}
      : { ownTeamId: teamIdForSeat(player.seat, state.rulesetSnapshot) }),
    ownHand,
    ...(ownBuried === undefined ? {} : { ownBuried }),
    ...(state.leaderSeat === undefined ? {} : { leaderSeat: state.leaderSeat }),
    ...(state.defendingTeamId === undefined
      ? {}
      : { defendingTeamId: state.defendingTeamId }),
    ...(state.attackingTeamId === undefined
      ? {}
      : { attackingTeamId: state.attackingTeamId }),
    seats,
    ruleset: structuredClone(state.rulesetSnapshot),
    ...(round === undefined
      ? {}
      : {
          round: {
            roundNumber: round.roundNumber,
            redealCount: round.redealCount,
            trumpRank: round.trumpRank,
            ...(round.trumpSpec === undefined
              ? {}
              : { trumpSpec: structuredClone(round.trumpSpec) }),
            ...(round.currentBid === undefined
              ? {}
              : {
                  currentBid: {
                    seat: round.currentBid.seat,
                    face: structuredClone(round.currentBid.face),
                    count: round.currentBid.count,
                    tier: round.currentBid.tier,
                    declares: structuredClone(round.currentBid.declares),
                    placedAt: round.currentBid.placedAt,
                  },
                }),
            passedBidSeats: [...round.passedBidSeats],
            dealtCardCount: Object.keys(round.cards).length - round.undealt.length,
            ...(round.currentTurnSeat === undefined
              ? {}
              : { currentTurnSeat: round.currentTurnSeat }),
            ...(round.currentTrick === undefined
              ? {}
              : { currentTrick: cloneTrick(round.currentTrick) }),
            completedTricks: round.completedTricks.map(cloneTrickResult),
            attackerPoints: round.attackerPoints,
            throwPenaltyAdjustment: round.throwPenaltyAdjustment,
            bottomCount: round.bottom.length,
            buriedBottomCount: round.buriedBottom?.length ?? 0,
            ...(round.bottomReveal === undefined
              ? {}
              : {
                  bottomReveal: {
                    cards: round.bottomReveal.cards.map((id) =>
                      cloneCard(round.cards[id]!),
                    ),
                    multiplier: round.bottomReveal.multiplier,
                    pointsAwarded: round.bottomReveal.pointsAwarded,
                  },
                }),
          },
        }),
  };
}
