import { describe, expect, it } from "vitest";
import { artNumberRank, artSuitIcon } from "./art";
import { portraitForSeat } from "./seat-portraits";

describe("v1 seat portraits", () => {
  it("uses a stable four-seat roster for people and practice bots", () => {
    expect([0, 1, 2, 3].map((seat) => portraitForSeat(seat).id)).toEqual([
      "hadesKingYan",
      "persephonePlumBlossom",
      "poseidonDragonKing",
      "athenaGrandStrategist",
    ]);
    expect(portraitForSeat(4)).toEqual(portraitForSeat(0));
    expect(portraitForSeat(0)).toMatchObject({
      assetId: "portrait.hades-king-yan",
      src: "/art/avatars/hades-king-yan.webp",
      src2x: "/art/avatars/hades-king-yan@2x.webp",
    });
  });
});

describe("number-card indices", () => {
  it("maps numbered ranks and House suits to borderless art assets", () => {
    expect(artNumberRank("2", false)).toBe("/art/cards/indices/rank-black-2.webp");
    expect(artNumberRank("10", true)).toBe("/art/cards/indices/rank-red-10.webp");
    expect(artSuitIcon("hearts")).toBe("/art/cards/indices/suit-hearts.webp");
    expect(artSuitIcon("clubs")).toBe("/art/cards/indices/suit-clubs.webp");
  });
});
