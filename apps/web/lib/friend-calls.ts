import {
  RANKS,
  SUITS,
  type CardFace,
  type Rank,
  type StandardCardFace,
  type Suit,
  type TrumpSpec,
} from "@shengji/engine";
import { suitGlyph } from "./cards";

export type FriendCallInput = {
  face?: CardFace | null;
  copyIndex?: number | null;
};

export type FriendCallRules = {
  callCount: number;
  deckCount: number;
  trumpRank: Rank;
  trumpSpec: TrumpSpec;
};

export type FriendCallOptions = {
  suits: readonly Suit[];
  ranks: readonly Rank[];
  copyIndices: readonly number[];
};

export type CallValidationResult = {
  valid: boolean;
  errors: string[];
};

export type CallsValidation = {
  valid: boolean;
  errors: string[];
  perCall: CallValidationResult[];
};

/** Only non-trump suits may be named by a friend call. */
export function callableSuits(trumpSpec: TrumpSpec): readonly Suit[] {
  return trumpSpec.mode === "suit"
    ? SUITS.filter((suit) => suit !== trumpSpec.suit)
    : SUITS;
}

/** Level-rank cards are trump in every contract and cannot be named. */
export function callableRanks(trumpRank: Rank): readonly Rank[] {
  return RANKS.filter((rank) => rank !== trumpRank);
}

/** The complete finite option set used by the call panel. */
export function callOptions(rules: FriendCallRules): FriendCallOptions {
  return {
    suits: callableSuits(rules.trumpSpec),
    ranks: callableRanks(rules.trumpRank),
    copyIndices: Array.from(
      { length: Math.max(0, rules.deckCount) },
      (_, index) => index + 1,
    ),
  };
}

function faceKey(face: CardFace): string {
  return face.kind === "standard" ? `${face.suit}:${face.rank}` : `joker:${face.joker}`;
}

function copyIndexLabel(copyIndex: number): string {
  const mod100 = copyIndex % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? "th"
      : copyIndex % 10 === 1
        ? "st"
        : copyIndex % 10 === 2
          ? "nd"
          : copyIndex % 10 === 3
            ? "rd"
            : "th";
  return `${copyIndex}${suffix}`;
}

export const ordinalLabel = copyIndexLabel;

/** A compact public label, stable across the call strip and selection UI. */
export function callLabel(call: { face: StandardCardFace; copyIndex: number }): string {
  return `${suitGlyph(call.face.suit)}${call.face.rank} · ${copyIndexLabel(call.copyIndex)}`;
}

/**
 * Client-side preflight for CALL_FRIENDS. The server remains authoritative;
 * this only keeps obviously incomplete, illegal, or duplicate selections from
 * being submitted in the first place.
 */
export function validateCalls(
  calls: readonly FriendCallInput[],
  rules: FriendCallRules,
): CallsValidation {
  const perCall = calls.map<CallValidationResult>(() => ({ valid: true, errors: [] }));
  const errors: string[] = [];

  if (calls.length !== rules.callCount) {
    errors.push(`Exactly ${rules.callCount} friend call(s) are required`);
  }

  const callableSuitSet = new Set(callableSuits(rules.trumpSpec));
  const callableRankSet = new Set(callableRanks(rules.trumpRank));
  const seen = new Map<string, number[]>();

  calls.forEach((call, index) => {
    const result = perCall[index]!;
    const face = call.face;
    const copyIndex = call.copyIndex;

    if (face === undefined || face === null) {
      result.errors.push("Select a suit and rank");
    } else if (face.kind !== "standard") {
      result.errors.push("Jokers cannot be called");
    } else {
      if (!callableSuitSet.has(face.suit)) {
        result.errors.push("Choose a non-trump suit");
      }
      if (!callableRankSet.has(face.rank)) {
        result.errors.push("Choose a non-trump rank");
      }
    }

    if (copyIndex === undefined || copyIndex === null || !Number.isInteger(copyIndex)) {
      result.errors.push("Select which copy");
    } else if (copyIndex < 1 || copyIndex > rules.deckCount) {
      result.errors.push(`Copy must be between 1 and ${rules.deckCount}`);
    }

    if (
      face !== undefined &&
      face !== null &&
      copyIndex !== undefined &&
      copyIndex !== null &&
      Number.isInteger(copyIndex)
    ) {
      const key = `${faceKey(face)}#${copyIndex}`;
      seen.set(key, [...(seen.get(key) ?? []), index]);
    }
  });

  for (const duplicateIndexes of seen.values()) {
    if (duplicateIndexes.length < 2) continue;
    for (const index of duplicateIndexes) {
      perCall[index]!.errors.push("Duplicate call");
    }
  }

  for (const result of perCall) {
    result.valid = result.errors.length === 0;
  }
  const valid = errors.length === 0 && perCall.every(({ valid: rowValid }) => rowValid);
  return { valid, errors, perCall };
}
