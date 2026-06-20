import type { ShengJiRuleset } from "../rulesets/schema.js";
import type { PlayedCards, TrickFormat } from "../tricks/types.js";
import type {
  Bid,
  CardInstance,
  CardInstanceId,
  PlayerId,
  Rank,
  RoundOutcome,
  SeatIndex,
  TeamId,
  TrumpSpec,
} from "../types.js";

export type GamePhase =
  | "lobby"
  | "dealing"
  | "post-deal-bidding"
  | "bottom-exchange"
  | "playing"
  | "round-scoring"
  | "game-over";

export type PlayerState = {
  id: PlayerId;
  name: string;
  seat: SeatIndex | null;
  ready: boolean;
  connected: boolean;
};

export type TrickState = {
  leadSeat: SeatIndex;
  ledFormat: TrickFormat;
  plays: PlayedCards[];
};

export type TrickResult = {
  leadSeat: SeatIndex;
  winnerSeat: SeatIndex;
  points: number;
  plays: PlayedCards[];
};

export type RoundState = {
  roundNumber: number;
  trumpRank: Rank;
  trumpSpec?: TrumpSpec;
  currentBid?: Bid;
  biddingDeadline?: string;
  passedBidSeats: SeatIndex[];
  deckSeed: string;
  cards: Record<CardInstanceId, CardInstance>;
  undealt: CardInstanceId[];
  bottom: CardInstanceId[];
  buriedBottom?: CardInstanceId[];
  hands: Record<SeatIndex, CardInstanceId[]>;
  currentTurnSeat?: SeatIndex;
  currentTrick?: TrickState;
  completedTricks: TrickResult[];
  attackerPoints: number;
  throwPenaltyAdjustment: number;
  lastThrow?: {
    kind: "successful" | "failed";
    seat: SeatIndex;
    explanation: string;
    pointDeltaToAttackers: number;
  };
  finalTrickWinnerSeat?: SeatIndex;
  outcome?: RoundOutcome;
};

export type GameState = {
  roomId: string;
  revision: number;
  rulesetId: string;
  rulesetSnapshot: ShengJiRuleset;
  phase: GamePhase;
  players: Record<PlayerId, PlayerState>;
  seats: Record<SeatIndex, PlayerId | null>;
  ranks: Record<PlayerId, Rank>;
  dealerSeat?: SeatIndex;
  leaderSeat?: SeatIndex;
  defendingTeamId?: TeamId;
  attackingTeamId?: TeamId;
  round?: RoundState;
  createdAt: string;
  updatedAt: string;
};

export type ClientCommand =
  | { type: "SIT"; seat: SeatIndex }
  | { type: "READY"; ready?: boolean }
  | { type: "BID"; cards: CardInstanceId[] }
  | { type: "PASS_BID" }
  | { type: "BURY_BOTTOM"; cards: CardInstanceId[] }
  | {
      type: "PLAY_CARDS";
      cards: CardInstanceId[];
      intent: "normal" | "throw";
    }
  | { type: "START_NEXT_ROUND" };

export type GameEvent =
  | { type: "PLAYER_JOINED"; playerId: PlayerId; name: string; at: string }
  | {
      type: "PLAYER_CONNECTION_CHANGED";
      playerId: PlayerId;
      connected: boolean;
      at: string;
    }
  | { type: "PLAYER_SEATED"; playerId: PlayerId; seat: SeatIndex; at: string }
  | { type: "PLAYER_READY_CHANGED"; playerId: PlayerId; ready: boolean; at: string }
  | {
      type: "ROUND_STARTED";
      seed: string;
      roundNumber: number;
      trumpRank: Rank;
      leaderSeat?: SeatIndex;
      at: string;
    }
  | { type: "CARD_DEALT"; seat: SeatIndex; card: CardInstanceId; at: string }
  | { type: "DEAL_FINISHED"; bottom: CardInstanceId[]; at: string }
  | { type: "BID_PLACED"; seat: SeatIndex; bid: Bid; at: string }
  | { type: "BID_PASSED"; seat: SeatIndex; at: string }
  | { type: "BID_TIMER_STARTED"; deadline: string; at: string }
  | {
      type: "TRUMP_FINALIZED";
      trumpSpec: TrumpSpec;
      winningBid: Bid;
      at: string;
    }
  | { type: "LEADER_SET"; seat: SeatIndex; at: string }
  | { type: "BOTTOM_PICKED_UP"; seat: SeatIndex; at: string }
  | {
      type: "BOTTOM_BURIED";
      seat: SeatIndex;
      cards: CardInstanceId[];
      at: string;
    }
  | { type: "TRICK_STARTED"; leadSeat: SeatIndex; format: TrickFormat; at: string }
  | { type: "CARDS_PLAYED"; play: PlayedCards; at: string }
  | {
      type: "THROW_SUCCEEDED";
      seat: SeatIndex;
      cards: CardInstanceId[];
      format: TrickFormat;
      at: string;
    }
  | {
      type: "THROW_FAILED";
      seat: SeatIndex;
      attemptedCards: CardInstanceId[];
      forcedCards: CardInstanceId[];
      pointDeltaToAttackers: number;
      explanation: string;
      at: string;
    }
  | { type: "TRICK_WON"; result: TrickResult; at: string }
  | {
      type: "BOTTOM_REVEALED";
      cards: CardInstanceId[];
      multiplier: number;
      pointsAwarded: number;
      at: string;
    }
  | { type: "ROUND_SCORED"; outcome: RoundOutcome; at: string }
  | { type: "RANKS_UPDATED"; ranks: Record<PlayerId, Rank>; at: string }
  | {
      type: "TEAMS_UPDATED";
      defendingTeamId: TeamId;
      attackingTeamId: TeamId;
      leaderSeat: SeatIndex;
      at: string;
    }
  | { type: "GAME_ENDED"; winnerTeamId: TeamId; at: string };
