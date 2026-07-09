import { describe, expect, it } from "vitest";
import { portraitForSeat } from "./seat-portraits";
import { numberPipLayout } from "../components/card";

describe("v1 seat portraits", () => {
  it("uses a stable four-seat roster for people and practice bots", () => {
    expect([0, 1, 2, 3].map((seat) => portraitForSeat(seat).id)).toEqual([
      "hadesKingYan",
      "persephonePlumBlossom",
      "poseidonDragonKing",
      "athenaGrandStrategist",
    ]);
    expect(portraitForSeat(4)).toEqual(portraitForSeat(0));
  });
});

describe("number-card layouts", () => {
  it("uses one pip per numbered rank value and no pips for courts", () => {
    expect(numberPipLayout("2")).toHaveLength(2);
    expect(numberPipLayout("7")).toHaveLength(7);
    expect(numberPipLayout("10")).toHaveLength(10);
    expect(numberPipLayout("A")).toBeUndefined();
    expect(numberPipLayout("K")).toBeUndefined();
  });
});
