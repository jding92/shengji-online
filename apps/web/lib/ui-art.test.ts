import path from "node:path";

import sharp from "sharp";
import { describe, expect, test } from "vitest";

const sourceRing = path.resolve(
  process.cwd(),
  "../../assets/12-ui-primitives/table-ring-ornament.png",
);
const sourceRoleBadges = ["attack", "defend"].map((role) =>
  path.resolve(
    process.cwd(),
    `../../assets/06-ui-gameplay/06-ui-gameplay-${role}-badge.png`,
  ),
);
const sourcePlayerBadgeIcons = [
  "player-round-leader",
  "player-role-attack",
  "player-role-defend",
  "player-type-human",
  "player-type-bot",
].map((icon) =>
  path.resolve(process.cwd(), `../../assets/14-player-badge-icons/${icon}.png`),
);
const publicUiRoot = path.resolve(process.cwd(), "public/art/ui");

interface Region {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function alphaMetrics(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  region: Region,
) {
  let transparent = 0;
  let partial = 0;
  let opaque = 0;
  let darkVisible = 0;
  let total = 0;

  for (
    let y = Math.floor(region.top * height);
    y < Math.ceil(region.bottom * height);
    y += 1
  ) {
    for (
      let x = Math.floor(region.left * width);
      x < Math.ceil(region.right * width);
      x += 1
    ) {
      const offset = (y * width + x) * channels;
      const red = data[offset] ?? 0;
      const green = data[offset + 1] ?? 0;
      const blue = data[offset + 2] ?? 0;
      const alpha = data[offset + 3] ?? 0;
      if (alpha === 0) transparent += 1;
      else if (alpha === 255) opaque += 1;
      else partial += 1;
      if (alpha > 0 && Math.max(red, green, blue) < 88) darkVisible += 1;
      total += 1;
    }
  }

  return { transparent, partial, opaque, darkVisible, total };
}

function visibleBounds(data: Buffer, width: number, height: number, channels: number) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * channels + 3] ?? 0;
      if (alpha <= 24) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  return { left, top, right, bottom };
}

async function readMetrics(file: string) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  return {
    info,
    bounds: visibleBounds(data, info.width, info.height, info.channels),
    whole: alphaMetrics(data, info.width, info.height, info.channels, {
      left: 0,
      top: 0,
      right: 1,
      bottom: 1,
    }),
    center: alphaMetrics(data, info.width, info.height, info.channels, {
      left: 0.36,
      top: 0.36,
      right: 0.64,
      bottom: 0.64,
    }),
    corners: [
      { left: 0, top: 0, right: 0.08, bottom: 0.08 },
      { left: 0.92, top: 0, right: 1, bottom: 0.08 },
      { left: 0, top: 0.92, right: 0.08, bottom: 1 },
      { left: 0.92, top: 0.92, right: 1, bottom: 1 },
    ].map((region) =>
      alphaMetrics(data, info.width, info.height, info.channels, region),
    ),
  };
}

describe("generated UI art", () => {
  test("role badge masters have transparent compositing space", async () => {
    for (const file of sourceRoleBadges) {
      const metrics = await readMetrics(file);
      const visible = metrics.whole.partial + metrics.whole.opaque;
      expect(metrics.info).toMatchObject({ width: 1254, height: 1254, channels: 4 });
      expect(
        metrics.corners.reduce(
          (sum, corner) => sum + corner.partial + corner.opaque,
          0,
        ),
      ).toBeLessThan(200);
      expect(visible / metrics.whole.total).toBeGreaterThan(0.4);
      expect(visible / metrics.whole.total).toBeLessThan(0.7);
      expect(metrics.whole.partial).toBeGreaterThan(0);
    }
  });

  test("compact player badge icons keep clear silhouettes and transparent corners", async () => {
    for (const file of sourcePlayerBadgeIcons) {
      const metrics = await readMetrics(file);
      const visible = metrics.whole.partial + metrics.whole.opaque;
      const opticalWidth = metrics.bounds.right - metrics.bounds.left + 1;
      const opticalHeight = metrics.bounds.bottom - metrics.bounds.top + 1;
      expect(metrics.info).toMatchObject({ width: 1254, height: 1254, channels: 4 });
      expect(
        metrics.corners.reduce(
          (sum, corner) => sum + corner.partial + corner.opaque,
          0,
        ),
      ).toBeLessThan(1_000);
      expect(visible / metrics.whole.total).toBeGreaterThan(0.18);
      expect(visible / metrics.whole.total).toBeLessThan(0.55);
      expect(metrics.whole.partial).toBeGreaterThan(0);
      expect(
        Math.max(opticalWidth, opticalHeight) / metrics.info.width,
      ).toBeGreaterThan(0.72);
      expect(Math.max(opticalWidth, opticalHeight) / metrics.info.width).toBeLessThan(
        0.75,
      );
    }
  });

  test("table ring master has a transparent center and exterior without matte fringe", async () => {
    const metrics = await readMetrics(sourceRing);
    const visible = metrics.whole.partial + metrics.whole.opaque;
    expect(metrics.info).toMatchObject({ width: 1254, height: 1254, channels: 4 });
    expect(metrics.center.transparent).toBe(metrics.center.total);
    expect(
      metrics.corners.reduce((sum, corner) => sum + corner.partial + corner.opaque, 0),
    ).toBe(0);
    expect(visible / metrics.whole.total).toBeGreaterThan(0.12);
    expect(visible / metrics.whole.total).toBeLessThan(0.35);
    expect(metrics.whole.partial).toBeGreaterThan(0);
    expect(metrics.whole.darkVisible).toBe(0);
  });

  test("table ring public outputs preserve transparent negative space at both densities", async () => {
    for (const density of [
      { suffix: "", size: 800 },
      { suffix: "@2x", size: 1600 },
    ]) {
      const metrics = await readMetrics(
        path.join(publicUiRoot, `table-ring${density.suffix}.webp`),
      );
      const visible = metrics.whole.partial + metrics.whole.opaque;
      expect(metrics.info).toMatchObject({
        width: density.size,
        height: density.size,
        channels: 4,
      });
      expect(metrics.center.transparent).toBe(metrics.center.total);
      expect(
        metrics.corners.reduce(
          (sum, corner) => sum + corner.partial + corner.opaque,
          0,
        ),
      ).toBe(0);
      expect(visible / metrics.whole.total).toBeGreaterThan(0.12);
      expect(visible / metrics.whole.total).toBeLessThan(0.35);
      expect(metrics.center.darkVisible).toBe(0);
    }
  });
});
