import { describe, expect, test } from "vitest";
import {
  callLabel,
  callOptions,
  callableRanks,
  callableSuits,
  validateCalls,
} from "./friend-calls";

const rules = {
  callCount: 2,
  deckCount: 2,
  trumpRank: "7" as const,
  trumpSpec: { mode: "suit" as const, rank: "7" as const, suit: "hearts" as const },
};

const firstCall = {
  face: { kind: "standard" as const, suit: "spades" as const, rank: "K" as const },
  copyIndex: 1,
};

describe("friend call options", () => {
  test("excludes the trump suit and level rank", () => {
    expect(callableSuits(rules.trumpSpec)).toEqual(["spades", "clubs", "diamonds"]);
    expect(callableRanks(rules.trumpRank)).not.toContain("7");
    expect(callOptions(rules).copyIndices).toEqual([1, 2]);
  });

  test("labels a call with the suit glyph and ordinal copy", () => {
    expect(callLabel(firstCall)).toBe("♠K · 1st");
    expect(callLabel({ ...firstCall, copyIndex: 12 })).toBe("♠K · 12th");
  });
});

describe("validateCalls", () => {
  test("reports missing fields and the required count", () => {
    const validation = validateCalls([{ face: null, copyIndex: null }], rules);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("Exactly 2 friend call(s) are required");
    expect(validation.perCall[0]).toEqual({
      valid: false,
      errors: ["Select a suit and rank", "Select which copy"],
    });
  });

  test("marks both rows when the face and copy pair is duplicated", () => {
    const validation = validateCalls([firstCall, { ...firstCall }], rules);

    expect(validation.valid).toBe(false);
    expect(validation.perCall.map(({ errors }) => errors)).toEqual([
      ["Duplicate call"],
      ["Duplicate call"],
    ]);
  });

  test("rejects level cards, trump-suit cards, and out-of-range copies", () => {
    const validation = validateCalls(
      [
        {
          face: { kind: "standard", suit: "hearts", rank: "K" },
          copyIndex: 3,
        },
        {
          face: { kind: "standard", suit: "spades", rank: "7" },
          copyIndex: 1,
        },
      ],
      rules,
    );

    expect(validation.valid).toBe(false);
    expect(validation.perCall[0]?.errors).toEqual([
      "Choose a non-trump suit",
      "Copy must be between 1 and 2",
    ]);
    expect(validation.perCall[1]?.errors).toEqual(["Choose a non-trump rank"]);
  });

  test("accepts distinct callable calls", () => {
    const validation = validateCalls(
      [
        firstCall,
        {
          face: { kind: "standard", suit: "clubs", rank: "A" },
          copyIndex: 2,
        },
      ],
      rules,
    );

    expect(validation).toEqual({
      valid: true,
      errors: [],
      perCall: [
        { valid: true, errors: [] },
        { valid: true, errors: [] },
      ],
    });
  });
});
