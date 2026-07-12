import { sumCardPoints } from "../cards/deck.js";
import type { ClientCommand } from "../state/model.js";
import { parseThrow } from "../tricks/formats.js";
import { groupsFor, validateLead } from "../tricks/legality.js";
import { getEffectiveRankGroup, getEffectiveSuit } from "../trump/trump.js";
import type { CardInstance, EffectiveSuit } from "../types.js";
import {
  alliedSeats,
  deriveCardKnowledge,
  inferVoidSuits,
  isKnownBoss,
} from "./knowledge.js";
import type { BotObservation } from "./observation.js";
import { noisyPick, type BotRng } from "./rng.js";
import { scoreBotCandidate } from "./score.js";
import type { BotConfig } from "./types.js";

type LeadCandidate = {
  cards: CardInstance[];
  intent: "normal" | "throw";
  score: number;
};

function candidateKey(cards: readonly CardInstance[], intent: string): string {
  return `${intent}:${cards
    .map(({ id }) => id)
    .sort()
    .join(",")}`;
}

function normalLeadCards(
  hand: readonly CardInstance[],
  observation: BotObservation,
): CardInstance[][] {
  const trump = observation.round!.trumpSpec!;
  const candidates: CardInstance[][] = hand.map((card) => [card]);
  const bySuit = new Map<EffectiveSuit, ReturnType<typeof groupsFor>>();
  for (const group of groupsFor(hand, trump)) {
    const suit = getEffectiveSuit(group.cards[0]!, trump);
    bySuit.set(suit, [...(bySuit.get(suit) ?? []), group]);
    for (let size = 2; size <= group.cards.length; size += 1) {
      candidates.push(group.cards.slice(0, size));
    }
  }
  for (const groups of bySuit.values()) {
    const pairs = groups
      .filter(({ cards }) => cards.length >= 2)
      .sort((a, b) => a.order - b.order);
    for (let start = 0; start < pairs.length; start += 1) {
      const run = [pairs[start]!];
      for (let index = start + 1; index < pairs.length; index += 1) {
        if (pairs[index]!.order !== run.at(-1)!.order + 1) break;
        run.push(pairs[index]!);
        if (run.length >= 2) {
          candidates.push(run.flatMap(({ cards }) => cards.slice(0, 2)));
        }
      }
    }
  }
  return candidates;
}

function safeThrowCards(
  hand: readonly CardInstance[],
  observation: BotObservation,
  config: BotConfig,
): CardInstance[][] {
  if (config.throws === "never") return [];
  const trump = observation.round!.trumpSpec!;
  const knowledge = deriveCardKnowledge(observation, config);
  const safeGroups = groupsFor(hand, trump).filter(({ cards }) =>
    isKnownBoss(cards[0]!, observation, knowledge),
  );
  const bySuit = new Map<EffectiveSuit, CardInstance[][]>();
  for (const group of safeGroups) {
    const suit = getEffectiveSuit(group.cards[0]!, trump);
    bySuit.set(suit, [...(bySuit.get(suit) ?? []), group.cards]);
  }
  const throws: CardInstance[][] = [];
  for (const groups of bySuit.values()) {
    if (groups.length < 2) continue;
    const limit = config.throws === "safe-limited" ? 2 : Math.min(4, groups.length);
    const cards = groups
      .sort(
        (a, b) =>
          getEffectiveRankGroup(b[0]!, trump).order -
          getEffectiveRankGroup(a[0]!, trump).order,
      )
      .slice(0, limit)
      .flat();
    try {
      parseThrow(cards, trump);
      throws.push(cards);
    } catch {
      // Only canonical multi-component throws are candidates.
    }
  }
  return throws;
}

export function decideLeadAction(
  observation: BotObservation,
  config: BotConfig,
  rng: BotRng,
): ClientCommand | null {
  const round = observation.round;
  const trump = round?.trumpSpec;
  if (
    observation.phase !== "playing" ||
    round === undefined ||
    trump === undefined ||
    observation.ownSeat === null ||
    round.currentTurnSeat !== observation.ownSeat ||
    round.currentTrick !== undefined
  ) {
    return null;
  }
  const knowledge = deriveCardKnowledge(observation, config);
  const inferredVoids = inferVoidSuits(observation, config);
  // Allies fold in the finding-friends secret-friend inference; every other
  // seat — unknown seats included — is read as an opponent.
  const allies = alliedSeats(observation);
  const seen = new Set<string>();
  const candidates: LeadCandidate[] = [];
  const add = (cards: CardInstance[], intent: "normal" | "throw") => {
    const key = candidateKey(cards, intent);
    if (seen.has(key)) return;
    try {
      validateLead({
        cards,
        hand: observation.ownHand,
        trump,
        intent,
        throwsEnabled: observation.ruleset.throws.enabled,
      });
    } catch {
      return;
    }
    seen.add(key);
    const boss = cards.every((card) => isKnownBoss(card, observation, knowledge));
    const strength =
      cards.reduce(
        (total, card) => total + getEffectiveRankGroup(card, trump).order,
        0,
      ) / Math.max(1, cards.length * 14);
    const effectiveSuit = getEffectiveSuit(cards[0]!, trump);
    const teammateCanRuff =
      config.teamCoordination === "full" &&
      effectiveSuit !== "trump" &&
      allies.some((seat) => inferredVoids.get(seat)?.has(effectiveSuit) === true);
    const voidOpponents = observation.seats.filter(
      ({ seat }) =>
        seat !== observation.ownSeat &&
        !allies.includes(seat) &&
        inferredVoids.get(seat)?.has(effectiveSuit) === true,
    ).length;
    const voidLeadValue =
      config.voidInference && effectiveSuit !== "trump"
        ? (teammateCanRuff ? 0.9 : 0) -
          voidOpponents * (config.difficulty === "expert" ? 0.55 : 0.4)
        : 0;
    candidates.push({
      cards,
      intent,
      score: scoreBotCandidate({
        cards,
        trump,
        config,
        winProbability: boss ? 0.96 : 0.25 + strength * 0.45,
        trickPoints: sumCardPoints(cards),
        partnerWinning: false,
        givesPointsToPartner: false,
        isLastTrick: observation.ownHand.length === cards.length,
        leadValue: cards.length * 0.15 + voidLeadValue,
      }),
    });
  };
  normalLeadCards(observation.ownHand, observation).forEach((cards) =>
    add(cards, "normal"),
  );
  safeThrowCards(observation.ownHand, observation, config).forEach((cards) =>
    add(cards, "throw"),
  );
  const available =
    config.candidateLimit === undefined
      ? candidates
      : [...candidates]
          .sort((a, b) => {
            if (a.cards.length !== b.cards.length) {
              return a.cards.length - b.cards.length;
            }
            return a.score - b.score;
          })
          .slice(0, config.candidateLimit);
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
        intent: chosen.intent,
      };
}
