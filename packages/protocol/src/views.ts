import type {
  Bid,
  BotDifficulty,
  CardInstance,
  GameOptions,
  GamePhase,
  Rank,
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
  teamId?: TeamId;
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
      roundsWonByTeam: Record<TeamId, number>;
      previousRound?: {
        roundNumber: number;
        winningTeamId: TeamId;
        winner: "defenders" | "attackers";
        attackerPoints: number;
        levelDelta: number;
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
