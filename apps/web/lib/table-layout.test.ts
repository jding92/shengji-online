import { describe, expect, test } from "vitest";
import { relativeSeatIndex, seatSlots } from "./table-layout";

describe("radial table layout", () => {
  test("keeps the legacy four-seat winding and cardinal geometry", () => {
    const slots = seatSlots(4);

    expect(slots.map((slot) => slot.edge)).toEqual(["bottom", "right", "top", "left"]);
    expect(slots[0]!.xPct).toBeCloseTo(50);
    expect(slots[0]!.yPct).toBeGreaterThan(90);
    expect(slots[1]!.xPct).toBeGreaterThan(90);
    expect(slots[1]!.yPct).toBeCloseTo(50);
    expect(slots[2]!.xPct).toBeCloseTo(50);
    expect(slots[2]!.yPct).toBeLessThan(10);
    expect(slots[3]!.xPct).toBeLessThan(10);
    expect(slots[3]!.yPct).toBeCloseTo(50);
    expect(slots[0]!.sweep).toEqual({ x: 0, y: 300 });
    expect(slots[1]!.sweep).toEqual({ x: 340, y: 0 });
  });

  test("keeps radial slots bounded and winds to the local player's right", () => {
    for (const playerCount of [5, 6, 7, 8]) {
      const slots = seatSlots(playerCount);
      expect(slots[0]!.xPct).toBeCloseTo(50);
      expect(slots[0]!.edge).toBe("bottom");
      expect(slots[1]!.xPct).toBeGreaterThan(50);

      for (const slot of slots) {
        expect(slot.xPct).toBeGreaterThanOrEqual(0);
        expect(slot.xPct).toBeLessThanOrEqual(100);
        expect(slot.yPct).toBeGreaterThanOrEqual(0);
        expect(slot.yPct).toBeLessThanOrEqual(100);

        const outwardX = slot.xPct - 50;
        const outwardY = slot.yPct - 50;
        const outwardLength = Math.hypot(outwardX, outwardY);
        const sweepLength = Math.hypot(slot.sweep.x, slot.sweep.y);
        const alignment =
          (outwardX * slot.sweep.x + outwardY * slot.sweep.y) /
          (outwardLength * sweepLength);
        expect(alignment).toBeCloseTo(1);
      }
    }
  });

  test("wraps absolute seats around every supported table size", () => {
    for (const playerCount of [4, 5, 6, 7, 8]) {
      for (let you = 0; you < playerCount; you += 1) {
        for (let seat = -playerCount * 2; seat < playerCount * 3; seat += 1) {
          expect(relativeSeatIndex(seat, you, playerCount)).toBe(
            (((seat - you) % playerCount) + playerCount) % playerCount,
          );
        }
      }
    }
  });
});
