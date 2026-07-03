import { sumCardPoints } from "../cards/deck.js";
import { getEffectiveRankGroup, isTrump } from "../trump/trump.js";
import type { CardInstance, TrumpSpec } from "../types.js";
import type { BotConfig } from "./types.js";

export type BotCandidateScoreInput = {
  cards: readonly CardInstance[];
  trump: TrumpSpec;
  config: BotConfig;
  winProbability: number;
  trickPoints: number;
  partnerWinning: boolean;
  givesPointsToPartner: boolean;
  isLastTrick: boolean;
  leadValue?: number;
};

function cardEquity(card: CardInstance, trump: TrumpSpec): number {
  const order = getEffectiveRankGroup(card, trump).order;
  return order / 14 + (isTrump(card, trump) ? 0.9 : 0);
}

/** Shared utility score used by lead and follow candidate selection. */
export function scoreBotCandidate(input: BotCandidateScoreInput): number {
  const points = sumCardPoints(input.cards);
  const spend = input.cards.reduce(
    (total, card) => total + cardEquity(card, input.trump),
    0,
  );
  const winValue =
    input.winProbability * (1.4 + input.trickPoints / 10 + (input.leadValue ?? 0));
  const pointValue = input.config.pointManagement
    ? input.givesPointsToPartner
      ? points / 5
      : -points / 8
    : 0;
  const partnerValue =
    input.config.teamCoordination === "none"
      ? 0
      : input.partnerWinning
        ? 1.2 + (input.givesPointsToPartner ? points / 4 : 0)
        : 0;
  const spendCost = input.config.trumpConservation ? spend * 0.65 : spend * 0.15;
  const endgame =
    input.config.endgameAwareness && input.isLastTrick
      ? input.winProbability * (1 + input.cards.length * 0.8)
      : 0;
  return winValue + pointValue + partnerValue + endgame - spendCost;
}
