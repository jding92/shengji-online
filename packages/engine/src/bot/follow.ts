import { getCardPoints } from "../cards/deck.js";
import { selectForcedFollow } from "../state/autoplay.js";
import type { ClientCommand } from "../state/model.js";
import { validateFollow } from "../tricks/legality.js";
import { determineTrickWinner } from "../tricks/winner.js";
import { getEffectiveRankGroup } from "../trump/trump.js";
import type { CardInstance } from "../types.js";
import {
  currentWinningSeat,
  deriveCardKnowledge,
  isKnownBoss,
  partnerSeat,
  teamForSeat,
} from "./knowledge.js";
import type { BotObservation } from "./observation.js";
import { noisyPick, type BotRng } from "./rng.js";
import { scoreBotCandidate } from "./score.js";
import type { BotConfig } from "./types.js";

type FollowCandidate = {
  cards: CardInstance[];
  score: number;
};

function combinations(
  cards: readonly CardInstance[],
  count: number,
  limit: number,
): CardInstance[][] {
  const output: CardInstance[][] = [];
  const current: CardInstance[] = [];
  const visit = (start: number) => {
    if (output.length >= limit) return;
    if (current.length === count) {
      output.push([...current]);
      return;
    }
    for (let index = start; index < cards.length; index += 1) {
      current.push(cards[index]!);
      visit(index + 1);
      current.pop();
      if (output.length >= limit) return;
    }
  };
  visit(0);
  return output;
}

function candidateSelections(
  hand: readonly CardInstance[],
  count: number,
  trump: NonNullable<BotObservation["round"]>["trumpSpec"],
  forced: readonly CardInstance[],
): CardInstance[][] {
  if (trump === undefined) return [];
  const selections = [[...forced]];
  if (count <= 3) {
    selections.push(...combinations(hand, count, 6_000));
    return selections;
  }
  const byStrength = [...hand].sort(
    (a, b) =>
      getEffectiveRankGroup(a, trump).order - getEffectiveRankGroup(b, trump).order,
  );
  selections.push(
    byStrength.slice(0, count),
    byStrength.slice(-count),
    [...byStrength].sort((a, b) => getCardPoints(a) - getCardPoints(b)).slice(0, count),
    [...byStrength].sort((a, b) => getCardPoints(b) - getCardPoints(a)).slice(0, count),
  );
  const forcedIds = new Set(forced.map(({ id }) => id));
  for (let index = 0; index < forced.length; index += 1) {
    for (const replacement of hand) {
      if (forcedIds.has(replacement.id)) continue;
      const swapped = [...forced];
      swapped[index] = replacement;
      selections.push(swapped);
    }
  }
  return selections;
}

export function decideFollowAction(
  observation: BotObservation,
  config: BotConfig,
  rng: BotRng,
): ClientCommand | null {
  const round = observation.round;
  const trick = round?.currentTrick;
  const trump = round?.trumpSpec;
  if (
    observation.phase !== "playing" ||
    round === undefined ||
    trump === undefined ||
    trick === undefined ||
    observation.ownSeat === null ||
    round.currentTurnSeat !== observation.ownSeat
  ) {
    return null;
  }
  const forced = selectForcedFollow(observation.ownHand, trick.ledFormat, trump);
  const seen = new Set<string>();
  const candidates: FollowCandidate[] = [];
  const currentWinner = currentWinningSeat(observation);
  const partner = partnerSeat(observation);
  const knowledge = deriveCardKnowledge(observation, config);
  for (const cards of candidateSelections(
    observation.ownHand,
    trick.ledFormat.cardCount,
    trump,
    forced,
  )) {
    const key = cards
      .map(({ id }) => id)
      .sort()
      .join(",");
    if (seen.has(key)) continue;
    try {
      const play = validateFollow({
        cards,
        hand: observation.ownHand,
        ledFormat: trick.ledFormat,
        trump,
      });
      seen.add(key);
      const winner = determineTrickWinner(
        [...trick.plays, { seat: observation.ownSeat, ...play }],
        trump,
      );
      const winnerTeam = teamForSeat(observation, winner.winnerSeat);
      const ownTeam = observation.ownTeamId;
      const wins = winner.winnerSeat === observation.ownSeat;
      const partnerWinning = currentWinner === partner;
      const givesPointsToPartner =
        winner.winnerSeat === partner ||
        (winnerTeam !== undefined && winnerTeam === ownTeam);
      const actsLast = trick.plays.length + 1 === observation.ruleset.players.count;
      const controlled =
        play.cards.length > 0 &&
        play.cards.every((card) => isKnownBoss(card, observation, knowledge));
      const winProbability = wins
        ? actsLast
          ? 1
          : controlled
            ? 0.98
            : config.cardCounting
              ? 0.58
              : config.difficulty === "intermediate"
                ? 0.72
                : 0.82
        : winnerTeam === ownTeam
          ? 0.6
          : 0;
      candidates.push({
        cards,
        score: scoreBotCandidate({
          cards,
          trump,
          config,
          winProbability,
          trickPoints: winner.points,
          partnerWinning,
          givesPointsToPartner,
          isLastTrick: observation.ownHand.length === cards.length,
        }),
      });
    } catch {
      // Candidate construction intentionally overproduces; legality is final.
    }
  }
  const available =
    config.candidateLimit === undefined
      ? candidates
      : [
          candidates[0],
          candidates.length > 1
            ? candidates[Math.floor(rng() * (candidates.length - 1)) + 1]
            : undefined,
        ].filter((candidate): candidate is FollowCandidate => candidate !== undefined);
  const chosen = noisyPick(
    available,
    available.map(({ score }) => score),
    config.temperature,
    config.blunderRate,
    rng,
  );
  return chosen === undefined
    ? null
    : {
        type: "PLAY_CARDS",
        cards: chosen.cards.map(({ id }) => id),
        intent: "normal",
      };
}
