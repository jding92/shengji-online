export type SeatEdge = "bottom" | "right" | "top" | "left";

export type SeatSlot = {
  xPct: number;
  yPct: number;
  edge: SeatEdge;
  /** Pixels for four-player tables; percentages of the trick box for radial tables. */
  sweep: { x: number; y: number };
};

const ELLIPSE_RADIUS_X = 50;
const ELLIPSE_RADIUS_Y = 48;
const RADIAL_SWEEP_PCT = 80;
const SIDE_SECTOR_SIN = Math.sin((35 * Math.PI) / 180);

function edgeForVector(x: number, y: number): SeatEdge {
  if (Math.abs(y) <= SIDE_SECTOR_SIN) return x > 0 ? "right" : "left";
  return y > 0 ? "bottom" : "top";
}

/**
 * The four-player animation used slightly longer horizontal sweeps. Keep
 * those exact offsets so the tuned table feels unchanged while radial tables
 * use one consistent distance in the direction of their seat.
 */
function sweepForVector(
  x: number,
  y: number,
  relativeIndex: number,
  playerCount: number,
): { x: number; y: number } {
  if (playerCount === 4) {
    switch (relativeIndex) {
      case 0:
        return { x: 0, y: 300 };
      case 1:
        return { x: 340, y: 0 };
      case 2:
        return { x: 0, y: -300 };
      case 3:
        return { x: -340, y: 0 };
    }
  }

  const length = Math.hypot(x, y) || 1;
  return {
    x: (x / length) * RADIAL_SWEEP_PCT,
    y: (y / length) * RADIAL_SWEEP_PCT,
  };
}

/**
 * Returns seats around the table from the local player's point of view.
 * Relative index 0 is the bottom seat, then the winding proceeds to the
 * right, top, and left. The y-axis is inverted when converting the usual
 * mathematical angle to screen coordinates.
 */
export function seatSlots(playerCount: number): SeatSlot[] {
  if (!Number.isInteger(playerCount) || playerCount < 1) {
    throw new RangeError(`playerCount must be a positive integer, got ${playerCount}`);
  }

  return Array.from({ length: playerCount }, (_, relativeIndex) => {
    const step = 360 / playerCount;
    const gap = Math.max(step, 60);
    const arc = 360 - 2 * gap;
    const phi =
      relativeIndex === 0
        ? 0
        : gap + ((relativeIndex - 1) * arc) / Math.max(1, playerCount - 2);
    const theta = ((-90 + phi) * Math.PI) / 180;
    const x = Math.cos(theta);
    const y = -Math.sin(theta);
    const xPct = 50 + ELLIPSE_RADIUS_X * x;
    const yPct = 50 + ELLIPSE_RADIUS_Y * y;

    return {
      xPct,
      yPct,
      edge: edgeForVector(x, y),
      sweep: sweepForVector(x, y, relativeIndex, playerCount),
    };
  });
}

/** Rotates an absolute seat index so the local player is relative index 0. */
export function relativeSeatIndex(
  seat: number,
  you: number,
  playerCount: number,
): number {
  if (!Number.isInteger(playerCount) || playerCount < 1) {
    throw new RangeError(`playerCount must be a positive integer, got ${playerCount}`);
  }
  return (((seat - you) % playerCount) + playerCount) % playerCount;
}
