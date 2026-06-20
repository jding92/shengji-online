import type {
  Bid,
  CardInstance,
  GamePhase,
  Rank,
  TeamId,
  TrickResult,
  TrumpSpec,
} from "@shengji/engine";

export type { CardInstance } from "@shengji/engine";

export type LegalAction =
  | "sit"
  | "ready"
  | "bid"
  | "pass-bid"
  | "bury-bottom"
  | "play-cards"
  | "attempt-throw"
  | "start-next-round";

export type SeatView = {
  seat: number;
  playerId: string | null;
  name: string | null;
  connected: boolean;
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
  ruleset: {
    id: string;
    name: string;
    players: number;
    decks: number;
    bottomSize: number;
  };
  phase: GamePhase;
  you: {
    playerId: string;
    seat: number | null;
    hand: CardInstance[];
    teamId?: TeamId;
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
    completedTricksSummary: Array<
      Pick<TrickResult, "leadSeat" | "winnerSeat" | "points">
    >;
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
  };
  legalActions: LegalAction[];
};
