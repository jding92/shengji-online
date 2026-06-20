import { cardFaceKey } from "../cards/deck.js";
import { getEffectiveRankGroup, getEffectiveSuit } from "../trump/trump.js";
import type { CardInstance, EffectiveSuit, TrumpSpec } from "../types.js";
import { parseThrow, parseTrickFormat, TrickFormatError } from "./formats.js";
import type { TrickComponent, TrickFormat } from "./types.js";

export type PlayErrorCode =
  | "NOT_YOUR_TURN"
  | "CARDS_NOT_OWNED"
  | "WRONG_CARD_COUNT"
  | "MUST_FOLLOW_SUIT"
  | "MUST_MATCH_FORMAT"
  | "INVALID_LEAD"
  | "THROW_NOT_ALLOWED";

export class PlayValidationError extends Error {
  constructor(
    readonly code: PlayErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PlayValidationError";
  }
}

export type ValidatedPlay = {
  cards: CardInstance[];
  format: TrickFormat | null;
  eligibleToWin: boolean;
};

type CardGroup = {
  key: string;
  order: number;
  cards: CardInstance[];
};

function validateOwnership(
  cards: readonly CardInstance[],
  hand: readonly CardInstance[],
): void {
  const handIds = new Set(hand.map(({ id }) => id));
  const playedIds = new Set(cards.map(({ id }) => id));
  if (
    cards.length === 0 ||
    playedIds.size !== cards.length ||
    cards.some(({ id }) => !handIds.has(id))
  ) {
    throw new PlayValidationError(
      "CARDS_NOT_OWNED",
      "Every played card must be a distinct card in your hand",
    );
  }
}

function groupsFor(cards: readonly CardInstance[], trump: TrumpSpec): CardGroup[] {
  const groups = new Map<string, CardInstance[]>();
  for (const card of cards) {
    const key = cardFaceKey(card.face);
    const existing = groups.get(key);
    if (existing === undefined) groups.set(key, [card]);
    else existing.push(card);
  }
  return [...groups.entries()].map(([key, groupedCards]) => ({
    key,
    cards: groupedCards,
    order: getEffectiveRankGroup(groupedCards[0]!, trump).order,
  }));
}

function longestConsecutiveRun(orders: readonly number[]): number {
  const unique = [...new Set(orders)].sort((a, b) => a - b);
  let longest = unique.length === 0 ? 0 : 1;
  let current = longest;
  for (let index = 1; index < unique.length; index += 1) {
    if (unique[index] === unique[index - 1]! + 1) current += 1;
    else current = 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

function tractorProfile(
  cards: readonly CardInstance[],
  tupleSize: number,
  runLength: number,
  trump: TrumpSpec,
): [tupleGroups: number, longestRun: number] {
  const groups = groupsFor(cards, trump).filter(
    ({ cards: groupedCards }) => groupedCards.length >= tupleSize,
  );
  const tupleCapacity = Math.min(
    runLength,
    groups.length,
    Math.floor(cards.length / tupleSize),
  );
  return [
    tupleCapacity,
    Math.min(tupleCapacity, longestConsecutiveRun(groups.map(({ order }) => order))),
  ];
}

function tupleProfile(
  cards: readonly CardInstance[],
  tupleSize: number,
  trump: TrumpSpec,
): number {
  return Math.min(
    tupleSize,
    Math.max(0, ...groupsFor(cards, trump).map(({ cards: group }) => group.length)),
  );
}

function sameProfile(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function normalMatchProfile(
  cards: readonly CardInstance[],
  ledFormat: TrickFormat,
  trump: TrumpSpec,
): number[] {
  const component = ledFormat.components[0];
  if (component === undefined || ledFormat.kind === "single") return [];
  if (component.kind === "tuple") {
    return [tupleProfile(cards, component.tupleSize, trump)];
  }
  return tractorProfile(cards, component.tupleSize, component.runLength, trump);
}

function chooseConsecutiveGroups(
  groups: readonly CardGroup[],
  tupleSize: number,
  maxGroups: number,
): CardGroup[] {
  const eligible = groups
    .filter(({ cards }) => cards.length >= tupleSize)
    .sort((a, b) => a.order - b.order);
  let best: CardGroup[] = [];
  let run: CardGroup[] = [];
  for (const group of eligible) {
    const previous = run.at(-1);
    if (previous === undefined || group.order === previous.order + 1) run.push(group);
    else if (group.order !== previous.order) run = [group];
    if (
      run.length > best.length ||
      (run.length === best.length &&
        (run.at(-1)?.order ?? -1) > (best.at(-1)?.order ?? -1))
    ) {
      best = [...run];
    }
  }
  return best.slice(-maxGroups);
}

/**
 * Computes a lexicographic "match as fully as possible" profile for throws.
 * Components are allocated in their canonical parse order, so the same cards
 * cannot satisfy multiple led components.
 */
function throwMatchProfile(
  cards: readonly CardInstance[],
  ledFormat: TrickFormat,
  trump: TrumpSpec,
): number[] {
  const groups = groupsFor(cards, trump).map((group) => ({
    ...group,
    cards: [...group.cards],
  }));
  const profile: number[] = [];

  for (const component of ledFormat.components) {
    if (component.kind === "tractor") {
      const eligible = groups.filter(
        ({ cards: group }) => group.length >= component.tupleSize,
      );
      const capacity = Math.min(component.runLength, eligible.length);
      const consecutive = chooseConsecutiveGroups(
        eligible,
        component.tupleSize,
        capacity,
      );
      const chosen = [...consecutive];
      for (const group of eligible.sort((a, b) => b.order - a.order)) {
        if (chosen.length >= capacity) break;
        if (!chosen.some(({ key }) => key === group.key)) chosen.push(group);
      }
      profile.push(chosen.length, consecutive.length);
      for (const chosenGroup of chosen) {
        groups
          .find(({ key }) => key === chosenGroup.key)!
          .cards.splice(0, component.tupleSize);
      }
    } else {
      const best = groups.sort((a, b) => {
        if (a.cards.length !== b.cards.length) return b.cards.length - a.cards.length;
        return b.order - a.order;
      })[0];
      const matched = Math.min(component.tupleSize, best?.cards.length ?? 0);
      profile.push(matched);
      best?.cards.splice(0, matched);
    }
  }
  return profile;
}

function formatShapeMatches(candidate: TrickFormat, led: TrickFormat): boolean {
  if (
    candidate.kind !== led.kind ||
    candidate.components.length !== led.components.length
  ) {
    return false;
  }
  return candidate.components.every((component, index) => {
    const ledComponent = led.components[index];
    if (ledComponent === undefined || component.kind !== ledComponent.kind)
      return false;
    if (component.kind === "tuple" && ledComponent.kind === "tuple") {
      return component.tupleSize === ledComponent.tupleSize;
    }
    return (
      component.kind === "tractor" &&
      ledComponent.kind === "tractor" &&
      component.tupleSize === ledComponent.tupleSize &&
      component.runLength === ledComponent.runLength
    );
  });
}

function parseFollowerFormat(
  cards: readonly CardInstance[],
  trump: TrumpSpec,
  ledKind: TrickFormat["kind"],
): TrickFormat | null {
  try {
    return ledKind === "throw"
      ? parseThrow(cards, trump)
      : parseTrickFormat(cards, trump);
  } catch (error) {
    if (error instanceof TrickFormatError) return null;
    throw error;
  }
}

export function validateLead(input: {
  cards: readonly CardInstance[];
  hand: readonly CardInstance[];
  trump: TrumpSpec;
  intent: "normal" | "throw";
  throwsEnabled: boolean;
}): ValidatedPlay {
  validateOwnership(input.cards, input.hand);
  if (input.intent === "throw" && !input.throwsEnabled) {
    throw new PlayValidationError("THROW_NOT_ALLOWED", "Throws are disabled");
  }
  try {
    const format =
      input.intent === "throw"
        ? parseThrow(input.cards, input.trump)
        : parseTrickFormat(input.cards, input.trump);
    return { cards: [...input.cards], format, eligibleToWin: true };
  } catch (error) {
    if (error instanceof TrickFormatError) {
      throw new PlayValidationError("INVALID_LEAD", error.message);
    }
    throw error;
  }
}

export function validateFollow(input: {
  cards: readonly CardInstance[];
  hand: readonly CardInstance[];
  ledFormat: TrickFormat;
  trump: TrumpSpec;
}): ValidatedPlay {
  const { cards, hand, ledFormat, trump } = input;
  validateOwnership(cards, hand);
  if (cards.length !== ledFormat.cardCount) {
    throw new PlayValidationError(
      "WRONG_CARD_COUNT",
      `This trick requires exactly ${ledFormat.cardCount} cards`,
    );
  }

  const cardsInLedSuit = (source: readonly CardInstance[]) =>
    source.filter((card) => getEffectiveSuit(card, trump) === ledFormat.effectiveSuit);
  const handLedSuit = cardsInLedSuit(hand);
  const playedLedSuit = cardsInLedSuit(cards);
  const requiredSuitCount = Math.min(handLedSuit.length, ledFormat.cardCount);
  if (playedLedSuit.length !== requiredSuitCount) {
    throw new PlayValidationError(
      "MUST_FOLLOW_SUIT",
      `You must play ${requiredSuitCount} card(s) in the led effective suit`,
    );
  }

  const handProfile =
    ledFormat.kind === "throw"
      ? throwMatchProfile(handLedSuit, ledFormat, trump)
      : normalMatchProfile(handLedSuit, ledFormat, trump);
  const playedProfile =
    ledFormat.kind === "throw"
      ? throwMatchProfile(playedLedSuit, ledFormat, trump)
      : normalMatchProfile(playedLedSuit, ledFormat, trump);
  if (!sameProfile(handProfile, playedProfile)) {
    throw new PlayValidationError(
      "MUST_MATCH_FORMAT",
      "The selected cards do not match the led structure as fully as your hand can",
    );
  }

  const format = parseFollowerFormat(cards, trump, ledFormat.kind);
  const allOneSuit = cards.every(
    (card) => getEffectiveSuit(card, trump) === getEffectiveSuit(cards[0]!, trump),
  );
  const playedSuit = allOneSuit ? getEffectiveSuit(cards[0]!, trump) : null;
  const canRuff = handLedSuit.length === 0 && playedSuit === "trump";
  const isLedSuit = playedSuit === ledFormat.effectiveSuit;
  const eligibleToWin =
    format !== null && formatShapeMatches(format, ledFormat) && (isLedSuit || canRuff);

  return { cards: [...cards], format, eligibleToWin };
}

export function getComponentMatchProfile(
  cards: readonly CardInstance[],
  component: TrickComponent,
  trump: TrumpSpec,
): readonly number[] {
  return component.kind === "tuple"
    ? [tupleProfile(cards, component.tupleSize, trump)]
    : tractorProfile(cards, component.tupleSize, component.runLength, trump);
}

export function filterEffectiveSuit(
  cards: readonly CardInstance[],
  effectiveSuit: EffectiveSuit,
  trump: TrumpSpec,
): CardInstance[] {
  return cards.filter((card) => getEffectiveSuit(card, trump) === effectiveSuit);
}
