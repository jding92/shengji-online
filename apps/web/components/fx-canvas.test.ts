import { describe, expect, test } from "vitest";
import type { GameMoment } from "../lib/moments";
import { shouldCreateFxBurst } from "./fx-canvas";

describe("FxCanvas", () => {
  test("does not create effects for point-bearing tricks", () => {
    const pointTrick: GameMoment = {
      id: "trick-won:1:8",
      type: "TRICK_WON",
      winnerSeat: 2,
      points: 20,
      cards: [],
    };

    expect(shouldCreateFxBurst(pointTrick, true)).toBe(false);
  });

  test("retains the non-point victory effect", () => {
    const victory: GameMoment = {
      id: "game-over:1",
      type: "GAME_OVER",
      winner: "defenders",
    };

    expect(shouldCreateFxBurst(victory, true)).toBe(true);
    expect(shouldCreateFxBurst(victory, false)).toBe(false);
  });
});
