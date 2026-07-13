import type { GameOptions } from "../rulesets/options.js";
import type { ShengJiRuleset } from "../rulesets/schema.js";
import type { PlayedCards, TrickFormat } from "../tricks/types.js";
import type { BotDifficulty } from "../bot/types.js";
import type {
  Bid,
  CardFace,
  CardInstance,
  CardInstanceId,
  PlayerId,
  Rank,
  RoundOutcome,
  SeatIndex,
  StandardCardFace,
  TeamId,
  TrumpSpec,
} from "../types.js";

export type GamePhase =
  | "lobby"
  | "dealing"
  | "post-deal-bidding"
  | "bottom-exchange"
  | "friend-calling"
  | "playing"
  | "round-scoring"
  | "game-over";

export type PlayerState = {
  id: PlayerId;
  name: string;
  seat: SeatIndex | null;
  ready: boolean;
  connected: boolean;
  bot?: { difficulty: BotDifficulty };
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

/** A declarer's call for the Nth played copy of a face (finding-friends only). */
export type FriendCall = {
  face: StandardCardFace;
  /** 1-based; 1 = "first ♠K played"; at most decks.count. */
  copyIndex: number;
  /** Set by FRIEND_REVEALED when the called copy is played. */
  revealed?: { seat: SeatIndex; trickNumber: number; at: string };
};

export type RoundState = {
  roundNumber: number;
  /** How many times this round number has been redealt after an all-pass. */
  redealCount: number;
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
  /** Winning bidder in finding-friends rounds; set by TRUMP_FINALIZED. */
  declarerSeat?: SeatIndex;
  /** Finding-friends only; absent until FRIENDS_CALLED. */
  friendCalls?: FriendCall[];
  /** Per-seat captured trick points — the finding-friends accounting source of truth. */
  pointsBySeat?: Record<SeatIndex, number>;
  /**
   * Fixed mode: attacking team's running total. Finding-friends: a derived
   * provisional display value — the sum over seats not publicly known to be
   * defenders — recomputed on TRICK_WON and FRIEND_REVEALED.
   */
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
  /** Set when the round ends: the buried bottom revealed to everyone. */
  bottomReveal?: {
    cards: string[];
    multiplier: number;
    pointsAwarded: number;
  };
};

export type RoundHistoryEntry = {
  roundNumber: number;
  defendingTeamId: TeamId;
  attackingTeamId: TeamId;
  winningTeamId: TeamId;
  outcome: RoundOutcome;
  /** The seats that defended this completed round. */
  defenderSeats?: SeatIndex[];
};

export type GameState = {
  roomId: string;
  revision: number;
  rulesetId: string;
  rulesetSnapshot: ShengJiRuleset;
  /** Snapshot compatibility version; backfilled to 1 on load for old rooms. */
  schemaVersion?: number;
  /** Room creator / current option authority; bots are never host. */
  hostPlayerId?: PlayerId;
  /** The base preset the current options resolve against, for lobby re-editing. */
  presetId?: string;
  /** The raw options the host last applied, so the lobby can re-edit from them. */
  pendingOptions?: GameOptions;
  phase: GamePhase;
  players: Record<PlayerId, PlayerState>;
  seats: Record<SeatIndex, PlayerId | null>;
  ranks: Record<PlayerId, Rank>;
  dealerSeat?: SeatIndex;
  leaderSeat?: SeatIndex;
  defendingTeamId?: TeamId;
  attackingTeamId?: TeamId;
  /** Public, durable summaries of completed rounds. */
  roundHistory?: RoundHistoryEntry[];
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
  // Faces stay the wide CardFace here: calls come from clients, so joker
  // rejection is a runtime validation, not a type assumption.
  | { type: "CALL_FRIENDS"; calls: { face: CardFace; copyIndex: number }[] }
  | {
      type: "PLAY_CARDS";
      cards: CardInstanceId[];
      intent: "normal" | "throw";
    }
  | { type: "START_NEXT_ROUND" }
  | { type: "UPDATE_OPTIONS"; presetId?: string; options: GameOptions };

export type GameEvent =
  | {
      type: "PLAYER_JOINED";
      playerId: PlayerId;
      name: string;
      bot?: { difficulty: BotDifficulty };
      at: string;
    }
  | {
      type: "PLAYER_CONTROL_CHANGED";
      playerId: PlayerId;
      bot?: { difficulty: BotDifficulty };
      at: string;
    }
  | { type: "PLAYER_REMOVED"; playerId: PlayerId; at: string }
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
      /** Absent when trump was forced from the bottom after the redeal cap. */
      winningBid?: Bid;
      /** Present when the declared rank replaces the provisional round rank (finding-friends). */
      trumpRank?: Rank;
      /** Present in finding-friends: the winning bidder becomes the declarer. */
      declarerSeat?: SeatIndex;
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
  | { type: "FRIENDS_CALLED"; seat: SeatIndex; calls: FriendCall[]; at: string }
  | {
      type: "FRIEND_REVEALED";
      seat: SeatIndex;
      callIndex: number;
      trickNumber: number;
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
  | { type: "GAME_ENDED"; winnerTeamId: TeamId; at: string }
  | {
      type: "OPTIONS_UPDATED";
      presetId: string;
      options: GameOptions;
      ruleset: ShengJiRuleset;
      at: string;
    }
  | { type: "HOST_CHANGED"; playerId: PlayerId; at: string }
  | {
      type: "BOT_DIFFICULTY_CHANGED";
      playerId: PlayerId;
      difficulty: BotDifficulty;
      at: string;
    };
