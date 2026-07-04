import type { CardInstance } from "@shengji/protocol";
import { describe, expect, it } from "vitest";
import { capCardSelection, toggleCardSelection } from "./use-card-selection";

function card(id: string): CardInstance {
  return {
    id,
    deckIndex: 0,
    face: { kind: "standard", rank: "2", suit: "spades" },
  };
}

const cards = ["a", "b", "c", "d"].map(card);

describe("card selection limits", () => {
  it("does not select more cards than a trick requires", () => {
    const pair = new Set(["a", "b"]);
    const next = toggleCardSelection({
      selected: pair,
      cards,
      card: cards[2]!,
      index: 2,
      shift: false,
      lastIndex: 1,
      limit: 2,
    });

    expect([...next]).toEqual(["a", "b"]);
  });

  it("allows replacing a card after deselection", () => {
    const deselected = toggleCardSelection({
      selected: new Set(["a", "b"]),
      cards,
      card: cards[0]!,
      index: 0,
      shift: false,
      lastIndex: 1,
      limit: 2,
    });
    const replaced = toggleCardSelection({
      selected: deselected,
      cards,
      card: cards[2]!,
      index: 2,
      shift: false,
      lastIndex: 0,
      limit: 2,
    });

    expect([...replaced]).toEqual(["b", "c"]);
  });

  it("caps a shift-click range at the available slots", () => {
    const next = toggleCardSelection({
      selected: new Set(["a"]),
      cards,
      card: cards[3]!,
      index: 3,
      shift: true,
      lastIndex: 0,
      limit: 2,
    });

    expect([...next]).toEqual(["a", "b"]);
  });

  it("prunes an existing selection when the required count decreases", () => {
    expect([...capCardSelection(new Set(["d", "b", "c"]), cards, 2)]).toEqual([
      "b",
      "c",
    ]);
  });
});
