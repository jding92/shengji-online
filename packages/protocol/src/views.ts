import type {
  Bid,
  BotDifficulty,
  CardInstance,
  GameOptions,
  GamePhase,
  Rank,
  SeatRole,
  StandardCardFace,
  TeamId,
  TrickResult,
  TrumpSpec,
} from "@shengji/engine";

export type { BotDifficulty, CardInstance } from "@shengji/engine";

export type LegalAction =
  | "sit"
  | "ready"
  | "bid"
  | "pass-bid"
  | "bury-bottom"
  | "call-friends"
  | "play-cards"
  | "attempt-throw"
  | "start-next-round"
  | "update-options";

export type SeatView = {
  seat: number;
  playerId: string | null;
  name: string | null;
  connected: boolean;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
  ready: boolean;
  rank: Rank | null;
  cardCount: number;
  /**
   * Publicly known team. Always present for occupied seats in fixed mode; in
   * finding-friends only the declarer and revealed friends carry "defenders" —
   * an unrevealed friend is indistinguishable from an attacker.
   */
  teamId?: TeamId;
  /** Publicly known round role; "unknown" until roles (or reveals) resolve it. */
  role?: SeatRole;
};

/**
 * A finding-friends call as everyone at the table hears it: the declarer
 * announces the face and copy index, and the reveal seat/trick becomes public
 * the moment the called copy is played.
 */
export type PublicFriendCall = {
  face: StandardCardFace;
  copyIndex: number;
  revealed?: { seat: number; trickNumber: number };
};

export type PublicPlayedCards = {
  seat: number;
  cards: CardInstance[];
};

export type PrivateGameView = {
  roomId: string;
  revision: number;
  /** The room's option authority; null before the first human joins. */
  hostPlayerId: string | null;
  joinedPlayerCount: number;
  ruleset: {
    id: string;
    name: string;
    players: number;
    decks: number;
    bottomSize: number;
    presetId: string;
    teamsMode: "fixed" | "finding-friends";
    options: GameOptions;
  };
  phase: GamePhase;
  you: {
    playerId: string;
    seat: number | null;
    hand: CardInstance[];
    teamId?: TeamId;
    /**
     * The cards you buried in the bottom — present only for the leader, who
     * already knows them. Other players never receive them (bottomReveal at
     * round scoring is the public disclosure).
     */
    buried?: CardInstance[];
  };
  seats: SeatView[];
  publicRound?: {
    roundNumber: number;
    trumpRank: Rank;
    trumpSpec?: TrumpSpec;
    currentBid?: Pick<Bid, "seat" | "face" | "count" | "tier" | "declares">;
    leaderSeat?: number;
    /** Finding-friends: the winning bidder whose side defends this round. */
    declarerSeat?: number;
    /** Finding-friends: announced calls, present once the declarer has called. */
    friendCalls?: PublicFriendCall[];
    currentTurnSeat?: number;
    attackerPoints: number;
    throwPenaltyAdjustment: number;
    cardCountsBySeat: Record<number, number>;
    currentTrick?: {
      leadSeat: number;
      cardCount: number;
      plays: PublicPlayedCards[];
    };
    /** Most recently completed trick, retained so clients can show all plays. */
    lastCompletedTrick?: {
      leadSeat: number;
      winnerSeat: number;
      points: number;
      plays: PublicPlayedCards[];
    };
    completedTricksSummary: Array<
      Pick<TrickResult, "leadSeat" | "winnerSeat" | "points">
    >;
    roundStats: {
      /** Fixed mode: persistent team tallies. Empty in finding-friends. */
      roundsWonByTeam: Record<TeamId, number>;
      /**
       * Finding-friends: completed rounds each seat ended on the winning
       * side (teams are round-scoped, so per-team tallies are meaningless).
       */
      roundsWonBySeat?: Record<number, number>;
      previousRound?: {
        roundNumber: number;
        winningTeamId: TeamId;
        winner: "defenders" | "attackers";
        attackerPoints: number;
        levelDelta: number;
        defenderSeats: number[];
      };
    };
    biddingDeadline?: string;
    bottomCount: number;
    buriedBottomCount: number;
    lastThrow?: {
      kind: "successful" | "failed";
      seat: number;
      explanation: string;
      pointDeltaToAttackers: number;
    };
    outcome?: {
      attackerPoints: number;
      winner: "defenders" | "attackers";
      levelDelta: number;
    };
    /** The buried bottom, revealed to everyone once the round is scored. */
    bottomReveal?: {
      cards: CardInstance[];
      multiplier: number;
      pointsAwarded: number;
    };
  };
  legalActions: LegalAction[];
};
