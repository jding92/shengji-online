import type { EffectiveRankGroup } from "../trump/trump.js";
import type { CardInstance, EffectiveSuit } from "../types.js";

export type TupleComponent = {
  kind: "tuple";
  tupleSize: number;
  cardCount: number;
  effectiveSuit: EffectiveSuit;
  rankGroup: EffectiveRankGroup;
  cards: CardInstance[];
};

export type TractorComponent = {
  kind: "tractor";
  tupleSize: number;
  runLength: number;
  cardCount: number;
  effectiveSuit: EffectiveSuit;
  rankGroups: EffectiveRankGroup[];
  cards: CardInstance[];
};

export type TrickComponent = TupleComponent | TractorComponent;

export type TrickFormat = {
  kind: "single" | "tuple" | "tractor" | "throw";
  cardCount: number;
  effectiveSuit: EffectiveSuit;
  components: TrickComponent[];
};

export type PlayedCards = {
  seat: number;
  cards: CardInstance[];
  format: TrickFormat | null;
  eligibleToWin: boolean;
};
