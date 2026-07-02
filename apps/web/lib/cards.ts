import type { CardInstance } from "@shengji/protocol";

export const RANK_DISPLAY_ORDER = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
] as const;

export const SUIT_DISPLAY_ORDER = ["clubs", "diamonds", "spades", "hearts"] as const;

/** Stable display order for a hand: suits grouped, ranks ascending, jokers last. */
export function compareCardsForHand(a: CardInstance, b: CardInstance): number {
  if (a.face.kind === "joker" && b.face.kind !== "joker") return 1;
  if (a.face.kind !== "joker" && b.face.kind === "joker") return -1;
  if (a.face.kind === "joker" && b.face.kind === "joker") {
    return a.face.joker === b.face.joker
      ? a.id.localeCompare(b.id)
      : a.face.joker === "small"
        ? -1
        : 1;
  }
  if (a.face.kind === "standard" && b.face.kind === "standard") {
    const suit =
      SUIT_DISPLAY_ORDER.indexOf(a.face.suit) - SUIT_DISPLAY_ORDER.indexOf(b.face.suit);
    if (suit !== 0) return suit;
    const rank =
      RANK_DISPLAY_ORDER.indexOf(a.face.rank) - RANK_DISPLAY_ORDER.indexOf(b.face.rank);
    return rank !== 0 ? rank : a.id.localeCompare(b.id);
  }
  return 0;
}

export type TablePosition = "south" | "east" | "north" | "west";

/** Rotates absolute seat indexes so the local player is always south. */
export function relativeSeatPosition(seat: number, you: number | null): TablePosition {
  const relative = you === null ? seat : (seat - you + 4) % 4;
  return (["south", "east", "north", "west"] as const)[relative] ?? "north";
}
