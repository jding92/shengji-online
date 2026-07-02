import type { CardFace } from "@shengji/engine";

const SUIT_GLYPHS = { spades: "♠", hearts: "♥", clubs: "♣", diamonds: "♦" } as const;

/** Short display for a card face, e.g. "2♠" or "小王". */
export function cardFaceLabel(face: CardFace): string {
  if (face.kind === "joker") return face.joker === "big" ? "大王" : "小王";
  return `${face.rank}${SUIT_GLYPHS[face.suit]}`;
}

export type TablePosition = "south" | "east" | "north" | "west";

/** Rotates absolute seat indexes so the local player is always south. */
export function relativeSeatPosition(seat: number, you: number | null): TablePosition {
  const relative = you === null ? seat : (seat - you + 4) % 4;
  return (["south", "east", "north", "west"] as const)[relative] ?? "north";
}
