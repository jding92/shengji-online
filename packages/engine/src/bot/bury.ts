import { getCardPoints } from "../cards/deck.js";
import { groupsFor } from "../tricks/legality.js";
import { getEffectiveRankGroup, getEffectiveSuit, isTrump } from "../trump/trump.js";
import type { ClientCommand } from "../state/model.js";
import type { CardInstance } from "../types.js";
import type { BotObservation } from "./observation.js";
import { noisyPick, type BotRng } from "./rng.js";
import type { BotConfig } from "./types.js";

function expendability(
  card: CardInstance,
  hand: readonly CardInstance[],
  observation: BotObservation,
  config: BotConfig,
): number {
  const trump = observation.round!.trumpSpec!;
  const points = getCardPoints(card);
  const rank = getEffectiveRankGroup(card, trump).order;
  const suit = getEffectiveSuit(card, trump);
  const suitCount = hand.filter(
    (held) => getEffectiveSuit(held, trump) === suit,
  ).length;
  const groupSize =
    groupsFor(hand, trump).find((group) => group.cards.some(({ id }) => id === card.id))
      ?.cards.length ?? 1;
  let score = 5 - rank * 0.2;
  if (isTrump(card, trump)) score -= config.buryQuality === "basic" ? 0.5 : 4;
  if (config.buryQuality !== "basic") score -= points * 0.7;
  if (config.buryQuality === "voids" || config.buryQuality === "endgame") {
    if (suit !== "trump" && suitCount <= 2) score += 2.2 / suitCount;
    if (groupSize >= 2) score -= 1.4;
  }
  if (config.buryQuality === "endgame" && rank >= 11) score -= 2;
  return score;
}

export function decideBuryAction(
  observation: BotObservation,
  config: BotConfig,
  rng: BotRng,
): ClientCommand | null {
  const trump = observation.round?.trumpSpec;
  if (
    observation.phase !== "bottom-exchange" ||
    trump === undefined ||
    observation.ownSeat === null ||
    observation.ownSeat !== observation.leaderSeat
  ) {
    return null;
  }
  const remaining = [...observation.ownHand];
  const chosen: CardInstance[] = [];
  while (chosen.length < observation.ruleset.bottom.size) {
    const card = noisyPick(
      remaining,
      remaining.map((candidate) =>
        expendability(candidate, observation.ownHand, observation, config),
      ),
      config.temperature,
      config.blunderRate,
      rng,
    );
    if (card === undefined) return null;
    chosen.push(card);
    remaining.splice(
      remaining.findIndex(({ id }) => id === card.id),
      1,
    );
  }
  return { type: "BURY_BOTTOM", cards: chosen.map(({ id }) => id) };
}
