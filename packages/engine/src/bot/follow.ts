import { getCardPoints } from "../cards/deck.js";
import { selectForcedFollow } from "../state/autoplay.js";
import type { ClientCommand } from "../state/model.js";
import { validateFollow } from "../tricks/legality.js";
import { determineTrickWinner } from "../tricks/winner.js";
import { getEffectiveRankGroup } from "../trump/trump.js";
import type { CardInstance, SeatIndex } from "../types.js";
import {
  alliedSeats,
  currentWinningSeat,
  deriveCardKnowledge,
  inferVoidSuits,
  isKnownBoss,
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

function seatsYetToPlay(
  currentSeat: SeatIndex,
  playedCount: number,
  playerCount: number,
): SeatIndex[] {
  return Array.from(
    { length: Math.max(0, playerCount - playedCount - 1) },
    (_, offset) => (currentSeat + offset + 1) % playerCount,
  );
}

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
  // Allies fold in the finding-friends secret-friend inference; every other
  // seat — unknown seats included — is read as an opponent.
  const allies = alliedSeats(observation);
  const knowledge = deriveCardKnowledge(observation, config);
  const inferredVoids = inferVoidSuits(observation, config);
  const laterSeats = seatsYetToPlay(
    observation.ownSeat,
    trick.plays.length,
    observation.ruleset.players.count,
  );
  const laterVoidOpponents =
    trick.ledFormat.effectiveSuit === "trump"
      ? []
      : laterSeats.filter(
          (seat) =>
            !allies.includes(seat) &&
            inferredVoids.get(seat)?.has(trick.ledFormat.effectiveSuit) === true,
        );
  const currentWinnerIsTeammate =
    currentWinner !== undefined && allies.includes(currentWinner);
  const winningTeammatePlay = trick.plays.find(({ seat }) => seat === currentWinner);
  const teammateHasControl =
    currentWinnerIsTeammate &&
    winningTeammatePlay !== undefined &&
    winningTeammatePlay.cards.length > 0 &&
    winningTeammatePlay.cards.every((card) =>
      isKnownBoss(card, observation, knowledge),
    );
  const teammateControlIsSecure =
    currentWinnerIsTeammate &&
    (laterSeats.length === 0 ||
      (teammateHasControl && laterVoidOpponents.length === 0));
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
      const teammateWinning = allies.includes(winner.winnerSeat);
      // Points land on the bot's side when itself or an ally takes the trick;
      // the team comparison keeps the fixed-mode reading and never matches
      // when both sides are undefined (unknown finding-friends seats).
      const givesPointsToPartner =
        wins || teammateWinning || (winnerTeam !== undefined && winnerTeam === ownTeam);
      const actsLast = trick.plays.length + 1 === observation.ruleset.players.count;
      const controlled =
        play.cards.length > 0 &&
        play.cards.every((card) => isKnownBoss(card, observation, knowledge));
      const baseWinProbability = wins
        ? actsLast
          ? 1
          : controlled
            ? 0.98
            : config.cardCounting
              ? 0.58
              : config.difficulty === "intermediate"
                ? 0.72
                : 0.82
        : teammateWinning
          ? 0.6
          : 0;
      const ruffRisk =
        wins && config.voidInference
          ? laterVoidOpponents.length * (config.difficulty === "expert" ? 0.3 : 0.22)
          : 0;
      const winProbability = Math.max(wins ? 0.15 : 0, baseWinProbability - ruffRisk);
      const teammateProtection =
        config.teamCoordination === "full" && wins && teammateControlIsSecure ? 1.4 : 0;
      candidates.push({
        cards,
        score:
          scoreBotCandidate({
            cards,
            trump,
            config,
            winProbability,
            trickPoints: winner.points,
            partnerWinning: teammateWinning,
            givesPointsToPartner,
            isLastTrick: observation.ownHand.length === cards.length,
          }) - teammateProtection,
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
