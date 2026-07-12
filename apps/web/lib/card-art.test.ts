import { readdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, test } from "vitest";

const artRoot = path.resolve(process.cwd(), "public/art/cards");
const primitiveSourceRoot = path.resolve(
  process.cwd(),
  "../../assets/12-card-primitives",
);
const rankSourceRoot = path.resolve(
  process.cwd(),
  "../../assets/13-rank-index-typography",
);
const rankNames = ["2", "3", "4", "5", "6", "7", "8", "9", "10"] as const;
const rankColors = {
  black: [0x17, 0x13, 0x0f],
  red: [0x9c, 0x17, 0x24],
} as const;

const frameQualityBounds = {
  hearts: {
    outer: { left: 0.022, top: 0.024, right: 0.978, bottom: 0.976 },
    aperture: { left: 0.105, top: 0.085, right: 0.895, bottom: 0.915 },
  },
  spades: {
    outer: { left: 0.018, top: 0.012, right: 0.982, bottom: 0.988 },
    aperture: { left: 0.11, top: 0.1, right: 0.89, bottom: 0.9 },
  },
  diamonds: {
    outer: { left: 0.02, top: 0.026, right: 0.98, bottom: 0.974 },
    aperture: { left: 0.105, top: 0.09, right: 0.895, bottom: 0.91 },
  },
  clubs: {
    outer: { left: 0.04, top: 0.035, right: 0.96, bottom: 0.965 },
    aperture: { left: 0.105, top: 0.09, right: 0.895, bottom: 0.91 },
  },
} as const;

interface NormalizedRegion {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function opaqueComponents(mask: Buffer, width: number, height: number) {
  const visited = new Uint8Array(mask.length);
  const components: Array<{
    pixels: number;
    left: number;
    top: number;
    right: number;
    bottom: number;
  }> = [];

  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] !== 255 || visited[start] === 1) continue;
    const queue = [start];
    visited[start] = 1;
    let pixels = 0;
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;
    while (queue.length > 0) {
      const pixel = queue.pop();
      if (pixel === undefined) break;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      pixels += 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      for (const neighbor of [
        x > 0 ? pixel - 1 : -1,
        x + 1 < width ? pixel + 1 : -1,
        y > 0 ? pixel - width : -1,
        y + 1 < height ? pixel + width : -1,
      ]) {
        if (neighbor >= 0 && mask[neighbor] === 255 && visited[neighbor] === 0) {
          visited[neighbor] = 1;
          queue.push(neighbor);
        }
      }
    }
    components.push({ pixels, left, top, right, bottom });
  }

  return components.sort((left, right) => right.pixels - left.pixels);
}

function countAlpha(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  region: NormalizedRegion,
): {
  nonTransparent: number;
  partial: number;
  alphaSum: number;
  total: number;
} {
  let nonTransparent = 0;
  let partial = 0;
  let alphaSum = 0;
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
      const alpha = data[(y * width + x) * channels + 3] ?? 0;
      if (alpha > 0) nonTransparent += 1;
      if (alpha > 0 && alpha < 255) partial += 1;
      alphaSum += alpha;
      total += 1;
    }
  }
  return { nonTransparent, partial, alphaSum, total };
}

describe("generated card art", () => {
  test("rank masters are flat binary-alpha glyphs with shared red/black geometry", async () => {
    const files = (await readdir(rankSourceRoot)).filter((file) =>
      /^rank-(black|red)-(?:10|[2-9])\.png$/.test(file),
    );
    expect(files).toHaveLength(18);

    for (const rank of rankNames) {
      const masks: Partial<Record<"black" | "red", Buffer>> = {};
      for (const tone of ["black", "red"] as const) {
        const file = path.join(rankSourceRoot, `rank-${tone}-${rank}.png`);
        const { data, info } = await sharp(file)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        expect(info).toMatchObject({ width: 512, height: 640, channels: 4 });

        let transparent = 0;
        let opaque = 0;
        let partial = 0;
        let wrongColor = 0;
        const mask = Buffer.alloc(info.width * info.height);
        for (let offset = 0; offset < data.length; offset += info.channels) {
          const red = data[offset] ?? 0;
          const green = data[offset + 1] ?? 0;
          const blue = data[offset + 2] ?? 0;
          const alpha = data[offset + 3] ?? 0;
          if (alpha !== 0 && alpha !== 255) partial += 1;
          mask[offset / info.channels] = alpha;
          if (alpha === 0) {
            transparent += 1;
          } else {
            opaque += 1;
            const [expectedRed, expectedGreen, expectedBlue] = rankColors[tone];
            if (
              red !== expectedRed ||
              green !== expectedGreen ||
              blue !== expectedBlue
            ) {
              wrongColor += 1;
            }
          }
        }
        expect(partial, `${file} has partial alpha`).toBe(0);
        expect(wrongColor, `${file} has non-flat glyph color`).toBe(0);
        expect(transparent, `${file} needs transparent canvas`).toBeGreaterThan(opaque);
        expect(opaque, `${file} needs a visible glyph`).toBeGreaterThan(0);
        const components = opaqueComponents(mask, info.width, info.height);
        expect(components, `${file} has disconnected decorative rails`).toHaveLength(
          rank === "10" ? 2 : 1,
        );
        for (const component of components) {
          const componentWidth = component.right - component.left + 1;
          const componentHeight = component.bottom - component.top + 1;
          expect(
            componentWidth / componentHeight,
            `${file} contains a thin side-rail component`,
          ).toBeGreaterThan(0.12);
        }
        masks[tone] = mask;
      }
      expect(
        masks.red?.equals(masks.black ?? Buffer.alloc(0)),
        `rank ${rank} red/black geometry differs`,
      ).toBe(true);
    }
  });

  test("index canvases contain only transparent or fully opaque pixels", async () => {
    const indexRoot = path.join(artRoot, "indices");
    const files = (await readdir(indexRoot)).filter((file) => file.endsWith(".webp"));

    expect(files).toHaveLength(44);
    for (const file of files) {
      const { data, info } = await sharp(path.join(indexRoot, file))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      let transparent = 0;
      let opaque = 0;
      for (let offset = 3; offset < data.length; offset += info.channels) {
        const alpha = data[offset];
        expect(alpha === 0 || alpha === 255, `${file} has partial alpha`).toBe(true);
        if (alpha === 0) transparent += 1;
        if (alpha === 255) opaque += 1;
      }

      expect(transparent, `${file} needs transparent canvas space`).toBeGreaterThan(0);
      expect(opaque, `${file} needs an opaque glyph`).toBeGreaterThan(0);
      const cornerAlphas = [
        data[3],
        data[(info.width - 1) * info.channels + 3],
        data[(info.height - 1) * info.width * info.channels + 3],
        data[(info.width * info.height - 1) * info.channels + 3],
      ];
      expect(cornerAlphas, `${file} must have transparent corners`).toEqual([
        0, 0, 0, 0,
      ]);
      expect(
        transparent,
        `${file} must not contain a backing rectangle`,
      ).toBeGreaterThan((transparent + opaque) * 0.1);
    }
  });

  test("all rank outputs exist at both densities with exact tone geometry", async () => {
    const indexRoot = path.join(artRoot, "indices");
    const rankFiles = (await readdir(indexRoot)).filter((file) =>
      /^rank-(black|red)-(?:10|[2-9])(?:@2x)?\.webp$/.test(file),
    );
    expect(rankFiles).toHaveLength(36);

    for (const rank of rankNames) {
      for (const density of [
        { suffix: "", width: 64, height: 80 },
        { suffix: "@2x", width: 128, height: 160 },
      ]) {
        const masks: Partial<Record<"black" | "red", Buffer>> = {};
        for (const tone of ["black", "red"] as const) {
          const file = path.join(
            indexRoot,
            `rank-${tone}-${rank}${density.suffix}.webp`,
          );
          const { data, info } = await sharp(file)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
          expect(info).toMatchObject({
            width: density.width,
            height: density.height,
            channels: 4,
          });
          let partial = 0;
          let wrongColor = 0;
          const mask = Buffer.alloc(info.width * info.height);
          for (let offset = 0; offset < data.length; offset += info.channels) {
            const red = data[offset] ?? 0;
            const green = data[offset + 1] ?? 0;
            const blue = data[offset + 2] ?? 0;
            const alpha = data[offset + 3] ?? 0;
            if (alpha !== 0 && alpha !== 255) partial += 1;
            mask[offset / info.channels] = alpha;
            if (alpha === 255) {
              const [expectedRed, expectedGreen, expectedBlue] = rankColors[tone];
              if (
                red !== expectedRed ||
                green !== expectedGreen ||
                blue !== expectedBlue
              ) {
                wrongColor += 1;
              }
            }
          }
          expect(partial, `${file} has partial alpha`).toBe(0);
          expect(wrongColor, `${file} has color or chroma fringe`).toBe(0);
          masks[tone] = mask;
        }
        expect(
          masks.red?.equals(masks.black ?? Buffer.alloc(0)),
          `rank ${rank}${density.suffix} red/black geometry differs`,
        ).toBe(true);
      }
    }
  });

  test("suit icons retain no visible magenta chroma pixels", async () => {
    const indexRoot = path.join(artRoot, "indices");
    const files = (await readdir(indexRoot)).filter(
      (file) => file.startsWith("suit-") && file.endsWith(".webp"),
    );

    for (const file of files) {
      const { data, info } = await sharp(path.join(indexRoot, file))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      let chromaPixels = 0;
      for (let offset = 0; offset < data.length; offset += info.channels) {
        const red = data[offset] ?? 0;
        const green = data[offset + 1] ?? 0;
        const blue = data[offset + 2] ?? 0;
        const alpha = data[offset + 3] ?? 0;
        if (
          alpha === 255 &&
          red > 130 &&
          blue > 130 &&
          green < 100 &&
          Math.abs(red - blue) < 50
        ) {
          chromaPixels += 1;
        }
      }
      expect(chromaPixels, `${file} retains chroma fringe`).toBe(0);
    }
  });

  test("all point-card treasures exist at both opaque densities", async () => {
    for (const suit of ["hearts", "spades", "diamonds", "clubs"]) {
      for (const rank of ["five", "ten"]) {
        for (const density of [
          { suffix: "", width: 256, height: 384 },
          { suffix: "@2x", width: 512, height: 768 },
        ]) {
          const file = path.join(
            artRoot,
            "illustrations",
            `${suit}-${rank}-treasure${density.suffix}.webp`,
          );
          const image = sharp(file);
          const metadata = await image.metadata();
          const stats = await image.stats();
          expect(metadata.width).toBe(density.width);
          expect(metadata.height).toBe(density.height);
          expect(stats.isOpaque, file).toBe(true);
        }
      }
    }
  });

  test("card primitives enforce opaque parchment and clean frame mattes", async () => {
    const parchment = sharp(path.join(primitiveSourceRoot, "parchment-surface.png"));
    const parchmentMetadata = await parchment.metadata();
    const parchmentStats = await parchment.stats();
    expect(parchmentMetadata).toMatchObject({ width: 1024, height: 1536 });
    expect(parchmentStats.isOpaque).toBe(true);

    for (const [house, bounds] of Object.entries(frameQualityBounds)) {
      const { data, info } = await sharp(
        path.join(primitiveSourceRoot, `frame-${house}.png`),
      )
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const center = countAlpha(data, info.width, info.height, info.channels, {
        left: bounds.aperture.left + 0.01,
        top: bounds.aperture.top + 0.01,
        right: bounds.aperture.right - 0.01,
        bottom: bounds.aperture.bottom - 0.01,
      });
      const corners = [
        { left: 0, top: 0, right: 0.012, bottom: 0.012 },
        { left: 0.988, top: 0, right: 1, bottom: 0.012 },
        { left: 0, top: 0.988, right: 0.012, bottom: 1 },
        { left: 0.988, top: 0.988, right: 1, bottom: 1 },
      ].map((region) =>
        countAlpha(data, info.width, info.height, info.channels, region),
      );
      const exterior = [
        { left: 0, top: 0, right: 1, bottom: bounds.outer.top - 0.004 },
        { left: 0, top: bounds.outer.bottom + 0.004, right: 1, bottom: 1 },
        { left: 0, top: 0, right: bounds.outer.left - 0.004, bottom: 1 },
        { left: bounds.outer.right + 0.004, top: 0, right: 1, bottom: 1 },
      ].map((region) =>
        countAlpha(data, info.width, info.height, info.channels, region),
      );
      const indexZones = [
        { left: 0.035, top: 0.025, right: 0.275, bottom: 0.295 },
        { left: 0.725, top: 0.705, right: 0.965, bottom: 0.975 },
      ].map((region) =>
        countAlpha(data, info.width, info.height, info.channels, region),
      );
      const controlZones = [
        { left: 0.725, top: 0.025, right: 0.965, bottom: 0.295 },
        { left: 0.035, top: 0.705, right: 0.275, bottom: 0.975 },
      ].map((region) =>
        countAlpha(data, info.width, info.height, info.channels, region),
      );

      let partial = 0;
      let opaque = 0;
      let alphaSum = 0;
      for (let offset = 3; offset < data.length; offset += info.channels) {
        const alpha = data[offset] ?? 0;
        alphaSum += alpha;
        if (alpha === 255) opaque += 1;
        else if (alpha > 0) partial += 1;
      }
      const pixels = info.width * info.height;
      const indexAlpha =
        indexZones.reduce((sum, region) => sum + region.alphaSum, 0) /
        indexZones.reduce((sum, region) => sum + region.total * 255, 0);
      const controlAlpha =
        controlZones.reduce((sum, region) => sum + region.alphaSum, 0) /
        controlZones.reduce((sum, region) => sum + region.total * 255, 0);
      expect(center.nonTransparent, `${house} center aperture`).toBe(0);
      expect(
        exterior.reduce((sum, region) => sum + region.nonTransparent, 0),
        `${house} exterior`,
      ).toBe(0);
      expect(
        corners.reduce((sum, region) => sum + region.nonTransparent, 0),
        `${house} corners`,
      ).toBe(0);
      expect(opaque, `${house} frame is not intentionally quiet`).toBe(0);
      expect(partial / pixels, `${house} visible ornament`).toBeGreaterThan(0.1);
      expect(partial / pixels, `${house} visible ornament`).toBeLessThan(0.25);
      expect(alphaSum / (pixels * 255), `${house} weighted coverage`).toBeGreaterThan(
        0.06,
      );
      expect(alphaSum / (pixels * 255), `${house} weighted coverage`).toBeLessThan(
        0.16,
      );
      expect(indexAlpha / controlAlpha, `${house} index-zone attenuation`).toBeLessThan(
        0.15,
      );
    }

    for (const density of [
      { suffix: "", width: 256, height: 384 },
      { suffix: "@2x", width: 512, height: 768 },
    ]) {
      const parchmentOutput = sharp(
        path.join(artRoot, "primitives", `parchment${density.suffix}.webp`),
      );
      expect(await parchmentOutput.metadata()).toMatchObject({
        width: density.width,
        height: density.height,
      });
      expect((await parchmentOutput.stats()).isOpaque).toBe(true);

      for (const [house, bounds] of Object.entries(frameQualityBounds)) {
        const { data, info } = await sharp(
          path.join(artRoot, "primitives", `frame-${house}${density.suffix}.webp`),
        )
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const center = countAlpha(data, info.width, info.height, info.channels, {
          left: bounds.aperture.left + 0.02,
          top: bounds.aperture.top + 0.02,
          right: bounds.aperture.right - 0.02,
          bottom: bounds.aperture.bottom - 0.02,
        });
        const corners = [
          { left: 0, top: 0, right: 0.01, bottom: 0.01 },
          { left: 0.99, top: 0, right: 1, bottom: 0.01 },
          { left: 0, top: 0.99, right: 0.01, bottom: 1 },
          { left: 0.99, top: 0.99, right: 1, bottom: 1 },
        ].map((region) =>
          countAlpha(data, info.width, info.height, info.channels, region),
        );
        const whole = countAlpha(data, info.width, info.height, info.channels, {
          left: 0,
          top: 0,
          right: 1,
          bottom: 1,
        });
        const indexZones = [
          { left: 0.035, top: 0.025, right: 0.275, bottom: 0.295 },
          { left: 0.725, top: 0.705, right: 0.965, bottom: 0.975 },
        ].map((region) =>
          countAlpha(data, info.width, info.height, info.channels, region),
        );
        const controlZones = [
          { left: 0.725, top: 0.025, right: 0.965, bottom: 0.295 },
          { left: 0.035, top: 0.705, right: 0.275, bottom: 0.975 },
        ].map((region) =>
          countAlpha(data, info.width, info.height, info.channels, region),
        );
        const indexAlpha =
          indexZones.reduce((sum, region) => sum + region.alphaSum, 0) /
          indexZones.reduce((sum, region) => sum + region.total * 255, 0);
        const controlAlpha =
          controlZones.reduce((sum, region) => sum + region.alphaSum, 0) /
          controlZones.reduce((sum, region) => sum + region.total * 255, 0);
        expect(center.nonTransparent, `${house}${density.suffix} center`).toBe(0);
        expect(
          corners.reduce((sum, region) => sum + region.nonTransparent, 0),
          `${house}${density.suffix} corners`,
        ).toBe(0);
        expect(whole.partial, `${house}${density.suffix} ordinary-alpha frame`).toBe(
          whole.nonTransparent,
        );
        expect(
          whole.alphaSum / (whole.total * 255),
          `${house}${density.suffix} weighted frame coverage`,
        ).toBeGreaterThan(0.06);
        expect(
          whole.alphaSum / (whole.total * 255),
          `${house}${density.suffix} weighted frame coverage`,
        ).toBeLessThan(0.16);
        expect(
          indexAlpha / controlAlpha,
          `${house}${density.suffix} index-zone attenuation`,
        ).toBeLessThan(0.15);
      }
    }
  });
});
