import { cardFaceKey } from "../cards/deck.js";
import {
  getEffectiveRankGroup,
  getEffectiveSuit,
  type EffectiveRankGroup,
} from "../trump/trump.js";
import type { CardInstance, EffectiveSuit, TrumpSpec } from "../types.js";
import type {
  TractorComponent,
  TrickComponent,
  TrickFormat,
  TupleComponent,
} from "./types.js";

export class TrickFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrickFormatError";
  }
}

type FaceGroup = {
  key: string;
  cards: CardInstance[];
  rankGroup: EffectiveRankGroup;
};

function assertOneEffectiveSuit(
  cards: readonly CardInstance[],
  trump: TrumpSpec,
): EffectiveSuit {
  const first = cards[0];
  if (first === undefined) throw new TrickFormatError("At least one card is required");
  const effectiveSuit = getEffectiveSuit(first, trump);
  if (cards.some((card) => getEffectiveSuit(card, trump) !== effectiveSuit)) {
    throw new TrickFormatError("All lead cards must share one effective suit");
  }
  return effectiveSuit;
}

function groupByFace(cards: readonly CardInstance[], trump: TrumpSpec): FaceGroup[] {
  const grouped = new Map<string, CardInstance[]>();
  for (const card of cards) {
    const key = cardFaceKey(card.face);
    const group = grouped.get(key);
    if (group === undefined) grouped.set(key, [card]);
    else group.push(card);
  }

  return [...grouped.entries()].map(([key, groupedCards]) => ({
    key,
    cards: groupedCards,
    rankGroup: getEffectiveRankGroup(groupedCards[0]!, trump),
  }));
}

function asTuple(
  cards: readonly CardInstance[],
  effectiveSuit: EffectiveSuit,
  trump: TrumpSpec,
): TupleComponent | null {
  const groups = groupByFace(cards, trump);
  const group = groups[0];
  if (groups.length !== 1 || group === undefined) return null;
  return {
    kind: "tuple",
    tupleSize: cards.length,
    cardCount: cards.length,
    effectiveSuit,
    rankGroup: group.rankGroup,
    cards: [...cards],
  };
}

function asTractor(
  cards: readonly CardInstance[],
  effectiveSuit: EffectiveSuit,
  trump: TrumpSpec,
): TractorComponent | null {
  const groups = groupByFace(cards, trump).sort(
    (a, b) => a.rankGroup.order - b.rankGroup.order,
  );
  if (groups.length < 2) return null;
  const tupleSize = groups[0]?.cards.length ?? 0;
  if (tupleSize < 2 || groups.some((group) => group.cards.length !== tupleSize)) {
    return null;
  }

  for (let index = 1; index < groups.length; index += 1) {
    const previous = groups[index - 1];
    const current = groups[index];
    if (
      previous === undefined ||
      current === undefined ||
      current.rankGroup.order !== previous.rankGroup.order + 1
    ) {
      return null;
    }
  }

  return {
    kind: "tractor",
    tupleSize,
    runLength: groups.length,
    cardCount: cards.length,
    effectiveSuit,
    rankGroups: groups.map(({ rankGroup }) => rankGroup),
    cards: groups.flatMap(({ cards: groupCards }) => groupCards),
  };
}

export function parseTrickFormat(
  cards: readonly CardInstance[],
  trump: TrumpSpec,
): TrickFormat {
  const effectiveSuit = assertOneEffectiveSuit(cards, trump);
  if (cards.length === 1) {
    return {
      kind: "single",
      cardCount: 1,
      effectiveSuit,
      components: [asTuple(cards, effectiveSuit, trump)!],
    };
  }

  const tuple = asTuple(cards, effectiveSuit, trump);
  if (tuple !== null) {
    return {
      kind: "tuple",
      cardCount: cards.length,
      effectiveSuit,
      components: [tuple],
    };
  }

  const tractor = asTractor(cards, effectiveSuit, trump);
  if (tractor !== null) {
    return {
      kind: "tractor",
      cardCount: cards.length,
      effectiveSuit,
      components: [tractor],
    };
  }

  throw new TrickFormatError("Cards do not form a single, identical tuple, or tractor");
}

type TractorCandidate = {
  tupleSize: number;
  groups: FaceGroup[];
  cardCount: number;
};

function findBestTractor(groups: readonly FaceGroup[]): TractorCandidate | null {
  const maxTupleSize = Math.max(0, ...groups.map(({ cards }) => cards.length));
  const candidates: TractorCandidate[] = [];

  for (let tupleSize = 2; tupleSize <= maxTupleSize; tupleSize += 1) {
    const eligible = groups
      .filter(({ cards }) => cards.length >= tupleSize)
      .sort((a, b) => a.rankGroup.order - b.rankGroup.order);
    let run: FaceGroup[] = [];
    for (const group of eligible) {
      const previous = run.at(-1);
      if (
        previous === undefined ||
        group.rankGroup.order === previous.rankGroup.order + 1
      ) {
        run.push(group);
      } else if (group.rankGroup.order === previous.rankGroup.order) {
        if (run.length >= 2) {
          candidates.push({
            tupleSize,
            groups: run,
            cardCount: tupleSize * run.length,
          });
        }
        run = [group];
      } else {
        if (run.length >= 2) {
          candidates.push({
            tupleSize,
            groups: run,
            cardCount: tupleSize * run.length,
          });
        }
        run = [group];
      }
    }
    if (run.length >= 2) {
      candidates.push({ tupleSize, groups: run, cardCount: tupleSize * run.length });
    }
  }

  return (
    candidates.sort((a, b) => {
      if (a.cardCount !== b.cardCount) return b.cardCount - a.cardCount;
      if (a.tupleSize !== b.tupleSize) return b.tupleSize - a.tupleSize;
      return (
        (b.groups.at(-1)?.rankGroup.order ?? 0) -
        (a.groups.at(-1)?.rankGroup.order ?? 0)
      );
    })[0] ?? null
  );
}

export function parseThrow(
  cards: readonly CardInstance[],
  trump: TrumpSpec,
): TrickFormat {
  const effectiveSuit = assertOneEffectiveSuit(cards, trump);
  try {
    parseTrickFormat(cards, trump);
    throw new TrickFormatError("A throw must contain more than one component");
  } catch (error) {
    if (
      error instanceof TrickFormatError &&
      error.message === "A throw must contain more than one component"
    ) {
      throw error;
    }
  }

  const groups = groupByFace(cards, trump).map((group) => ({
    ...group,
    cards: [...group.cards],
  }));
  const components: TrickComponent[] = [];

  let candidate = findBestTractor(groups);
  while (candidate !== null) {
    const tractorCards: CardInstance[] = [];
    for (const candidateGroup of candidate.groups) {
      const group = groups.find(({ key }) => key === candidateGroup.key)!;
      tractorCards.push(...group.cards.splice(0, candidate.tupleSize));
    }
    components.push({
      kind: "tractor",
      tupleSize: candidate.tupleSize,
      runLength: candidate.groups.length,
      cardCount: tractorCards.length,
      effectiveSuit,
      rankGroups: candidate.groups.map(({ rankGroup }) => rankGroup),
      cards: tractorCards,
    });
    candidate = findBestTractor(groups);
  }

  for (const group of groups) {
    if (group.cards.length === 0) continue;
    if (group.cards.length === 1) {
      components.push({
        kind: "tuple",
        tupleSize: 1,
        cardCount: 1,
        effectiveSuit,
        rankGroup: group.rankGroup,
        cards: [...group.cards],
      });
      continue;
    }
    components.push({
      kind: "tuple",
      tupleSize: group.cards.length,
      cardCount: group.cards.length,
      effectiveSuit,
      rankGroup: group.rankGroup,
      cards: [...group.cards],
    });
  }

  components.sort((a, b) => {
    if (a.cardCount !== b.cardCount) return b.cardCount - a.cardCount;
    if (a.kind !== b.kind) return a.kind === "tractor" ? -1 : 1;
    const highA = a.kind === "tractor" ? a.rankGroups.at(-1)?.order : a.rankGroup.order;
    const highB = b.kind === "tractor" ? b.rankGroups.at(-1)?.order : b.rankGroup.order;
    return (highB ?? 0) - (highA ?? 0);
  });

  if (components.length < 2) {
    throw new TrickFormatError("A throw must contain more than one component");
  }

  return {
    kind: "throw",
    cardCount: cards.length,
    effectiveSuit,
    components,
  };
}

export function componentHighRank(component: TrickComponent): number {
  return component.kind === "tractor"
    ? (component.rankGroups.at(-1)?.order ?? -1)
    : component.rankGroup.order;
}
