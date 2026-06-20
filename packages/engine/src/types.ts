export const SUITS = ["spades", "hearts", "clubs", "diamonds"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
] as const;
export type Rank = (typeof RANKS)[number];

export const JOKERS = ["small", "big"] as const;
export type Joker = (typeof JOKERS)[number];

export type StandardCardFace = {
  kind: "standard";
  suit: Suit;
  rank: Rank;
};

export type JokerCardFace = {
  kind: "joker";
  joker: Joker;
};

export type CardFace = StandardCardFace | JokerCardFace;

/** A physical card. `id` remains unique when multiple decks contain the same face. */
export type CardInstance = {
  id: string;
  deckIndex: number;
  face: CardFace;
};

export type CardInstanceId = CardInstance["id"];
export type SeatIndex = number;
export type PlayerId = string;
export type TeamId = string;
export type EffectiveSuit = Suit | "trump";

export type TrumpSpec =
  | { mode: "suit"; rank: Rank; suit: Suit }
  | { mode: "no-trump"; rank: Rank };

export type BidTier = "level-card" | "small-joker" | "big-joker";

export type Bid = {
  seat: SeatIndex;
  cards: CardInstanceId[];
  face: CardFace;
  count: number;
  tier: BidTier;
  declares: TrumpSpec;
  placedAt: string;
};

export type WinnerRole = "defenders" | "attackers";

export type RoundOutcome = {
  attackerPoints: number;
  winner: WinnerRole;
  levelDelta: number;
};
