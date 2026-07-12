import { Buffer } from "node:buffer";
import { log } from "node:console";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const scriptDir = import.meta.dirname;
const repoDir = path.resolve(scriptDir, "../../..");
const assetsDir = path.join(repoDir, "assets");
const outputDir = path.join(assetsDir, "12-ui-primitives");
const qaDir = path.join(repoDir, "docs/art-qa");
const sourcePath = path.join(
  assetsDir,
  "10-ui-chrome-and-deck/10-ui-chrome-and-deck-table-ring.png",
);
const outputPath = path.join(outputDir, "table-ring-ornament.png");

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(value) {
  const normalized = clamp(value);
  return normalized * normalized * (3 - 2 * normalized);
}

/**
 * The generated ring master was painted on true black. Convert brightness into
 * coverage and reconstruct edge color so the old black premultiplication cannot
 * leave a dark halo on the felt. Black negative-space linework intentionally
 * becomes transparent: the table texture supplies that negative space at run
 * time, making the ring a reusable ornament instead of a square panel.
 */
async function extractRing() {
  const { data, info } = await sharp(sourcePath).raw().toBuffer({
    resolveWithObject: true,
  });
  const output = Buffer.alloc(info.width * info.height * 4);

  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const sourceOffset = pixel * info.channels;
    const outputOffset = pixel * 4;
    const red = data[sourceOffset] ?? 0;
    const green = data[sourceOffset + 1] ?? 0;
    const blue = data[sourceOffset + 2] ?? 0;
    const maximum = Math.max(red, green, blue);
    const alpha = Math.round(255 * smoothstep((maximum - 5) / 59));

    if (alpha === 0) continue;

    // Edge pixels in the RGB source were already composited over black. Lift
    // their value before applying alpha so they retain the hue of the lacquer
    // and gold rather than drawing a charcoal fringe around the ornament.
    const lift = maximum < 104 ? 104 / Math.max(1, maximum) : 1;
    output[outputOffset] = Math.min(255, Math.round(red * lift));
    output[outputOffset + 1] = Math.min(255, Math.round(green * lift));
    output[outputOffset + 2] = Math.min(255, Math.round(blue * lift));
    output[outputOffset + 3] = alpha;
  }

  await sharp(output, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

function countAlphaRegion(data, info, region) {
  const left = Math.floor(region.left * info.width);
  const top = Math.floor(region.top * info.height);
  const right = Math.ceil(region.right * info.width);
  const bottom = Math.ceil(region.bottom * info.height);
  let nonTransparent = 0;
  let partial = 0;
  let darkVisible = 0;
  let total = 0;

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const red = data[offset] ?? 0;
      const green = data[offset + 1] ?? 0;
      const blue = data[offset + 2] ?? 0;
      const alpha = data[offset + 3] ?? 0;
      if (alpha > 0) nonTransparent += 1;
      if (alpha > 0 && alpha < 255) partial += 1;
      if (alpha > 0 && Math.max(red, green, blue) < 96) darkVisible += 1;
      total += 1;
    }
  }
  return { nonTransparent, partial, darkVisible, total };
}

async function assertRingQuality() {
  const { data, info } = await sharp(outputPath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const center = countAlphaRegion(data, info, {
    left: 0.36,
    top: 0.36,
    right: 0.64,
    bottom: 0.64,
  });
  const corners = [
    { left: 0, top: 0, right: 0.08, bottom: 0.08 },
    { left: 0.92, top: 0, right: 1, bottom: 0.08 },
    { left: 0, top: 0.92, right: 0.08, bottom: 1 },
    { left: 0.92, top: 0.92, right: 1, bottom: 1 },
  ].map((region) => countAlphaRegion(data, info, region));
  const whole = countAlphaRegion(data, info, {
    left: 0,
    top: 0,
    right: 1,
    bottom: 1,
  });
  const cornerVisible = corners.reduce((sum, region) => sum + region.nonTransparent, 0);

  if (center.nonTransparent !== 0) {
    throw new Error(
      `Ring QA failed: center contains ${center.nonTransparent} visible pixels`,
    );
  }
  if (cornerVisible !== 0) {
    throw new Error(`Ring QA failed: corners contain ${cornerVisible} visible pixels`);
  }
  if (whole.nonTransparent < whole.total * 0.12) {
    throw new Error("Ring QA failed: ornament coverage is unexpectedly sparse");
  }
  if (whole.nonTransparent > whole.total * 0.35) {
    throw new Error("Ring QA failed: visible coverage suggests a retained matte");
  }
  if (whole.darkVisible !== 0) {
    throw new Error(
      `Ring QA failed: ${whole.darkVisible} visible pixels retain a dark matte fringe`,
    );
  }

  log(
    `QA table ring: visible=${((whole.nonTransparent / whole.total) * 100).toFixed(2)}% partial=${((whole.partial / whole.total) * 100).toFixed(2)}% center=0 corners=0 dark-fringe=0`,
  );
}

async function writeContactSheet() {
  const size = 512;
  const ring = await sharp(outputPath).resize(size, size).png().toBuffer();
  const backgrounds = [
    { r: 6, g: 13, b: 10, alpha: 1 },
    { r: 34, g: 72, b: 56, alpha: 1 },
    { r: 255, g: 0, b: 255, alpha: 1 },
  ];
  const previews = await Promise.all(
    backgrounds.map((background) =>
      sharp({
        create: { width: size, height: size, channels: 4, background },
      })
        .composite([{ input: ring }])
        .png()
        .toBuffer(),
    ),
  );

  await mkdir(qaDir, { recursive: true });
  await sharp({
    create: {
      width: size * previews.length,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(previews.map((input, index) => ({ input, left: index * size, top: 0 })))
    .png({ compressionLevel: 9 })
    .toFile(path.join(qaDir, "12-table-ring-ornament-contact-sheet.png"));
}

await mkdir(outputDir, { recursive: true });
await extractRing();
await assertRingQuality();
await writeContactSheet();
log(`Extracted table ring primitive to ${path.relative(repoDir, outputPath)}`);
