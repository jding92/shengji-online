import { Buffer } from "node:buffer";
import { log } from "node:console";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const scriptDir = import.meta.dirname;
const repoDir = path.resolve(scriptDir, "../../..");
const assetsDir = path.join(repoDir, "assets");
const outputDir = path.join(assetsDir, "12-card-primitives");
const qaDir = path.join(repoDir, "docs/art-qa");

const width = 1024;
const height = 1536;

const houses = {
  hearts: {
    source: "10-ui-chrome-and-deck/10-ui-chrome-and-deck-hearts-number-kit.png",
    crop: { left: 48, top: 28, width: 660, height: 980 },
    outer: { left: 0.022, top: 0.024, right: 0.978, bottom: 0.976 },
    aperture: { left: 0.18, top: 0.175, right: 0.84, bottom: 0.83 },
  },
  spades: {
    source: "10-ui-chrome-and-deck/10-ui-chrome-and-deck-spades-number-kit.png",
    crop: { left: 54, top: 12, width: 710, height: 1000 },
    outer: { left: 0.018, top: 0.012, right: 0.982, bottom: 0.988 },
    aperture: { left: 0.17, top: 0.175, right: 0.88, bottom: 0.858 },
  },
  diamonds: {
    source: "10-ui-chrome-and-deck/10-ui-chrome-and-deck-diamonds-number-kit.png",
    crop: { left: 72, top: 20, width: 690, height: 980 },
    outer: { left: 0.02, top: 0.026, right: 0.98, bottom: 0.974 },
    aperture: { left: 0.205, top: 0.18, right: 0.86, bottom: 0.83 },
  },
  clubs: {
    source: "10-ui-chrome-and-deck/10-ui-chrome-and-deck-clubs-number-kit.png",
    crop: { left: 48, top: 22, width: 700, height: 980 },
    outer: { left: 0.04, top: 0.035, right: 0.96, bottom: 0.965 },
    aperture: { left: 0.19, top: 0.145, right: 0.81, bottom: 0.855 },
  },
};

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(value) {
  const normalized = clamp(value);
  return normalized * normalized * (3 - 2 * normalized);
}

function rectangleCoverage(x, y, rectangle, antialiasWidth) {
  const normalizedX = (x + 0.5) / width;
  const normalizedY = (y + 0.5) / height;
  const left = smoothstep((normalizedX - rectangle.left) / antialiasWidth);
  const right = smoothstep((rectangle.right - normalizedX) / antialiasWidth);
  const top = smoothstep((normalizedY - rectangle.top) / antialiasWidth);
  const bottom = smoothstep((rectangle.bottom - normalizedY) / antialiasWidth);
  return Math.min(left, right, top, bottom);
}

function frameGeometry(x, y, definition) {
  // The source kits contain parchment both inside and outside the ornament.
  // Explicit outer and aperture bounds guarantee that neither field can leak
  // into the reusable frame. A 1.5px transition at master size retains only a
  // narrow antialias contour around the extracted ornament.
  const antialiasWidth = 1.5 / Math.min(width, height);
  const outer = rectangleCoverage(x, y, definition.outer, antialiasWidth);
  const aperture = rectangleCoverage(x, y, definition.aperture, antialiasWidth);
  return outer * (1 - aperture);
}

function extractOrnamentAlpha(red, green, blue, geometry) {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const saturation = maximum === 0 ? 0 : (maximum - minimum) / maximum;
  const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

  // Parchment is light and weakly saturated. House ink, metal, jewels, and
  // outlines are darker or more saturated; combining both signals removes the
  // paper without inventing or repainting ornament pixels.
  const darkSignal = smoothstep((205 - luma) / 55);
  const colorSignal =
    smoothstep((saturation - 0.24) / 0.18) * smoothstep((230 - luma) / 45);
  const ornamentSignal = Math.max(darkSignal, colorSignal);
  const isolatedSignal = smoothstep((ornamentSignal - 0.34) / 0.12) * geometry;
  if (isolatedSignal < 0.025) return 0;
  if (isolatedSignal > 0.975) return 255;
  return Math.round(255 * isolatedSignal);
}

async function writeParchmentSurface() {
  const hearts = houses.hearts;
  const sourcePath = path.join(assetsDir, hearts.source);
  const card = await sharp(sourcePath).extract(hearts.crop).png().toBuffer();

  // The center of the Greek blank is an ornament-free approved parchment field.
  // A 2:3 crop avoids every House ornament before scaling to the shared master.
  await sharp(card)
    .extract({ left: 180, top: 220, width: 300, height: 450 })
    .resize({ width, height, fit: "fill", kernel: sharp.kernel.lanczos3 })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputDir, "parchment-surface.png"));
}

async function writeFrame(house, definition) {
  const { data, info } = await sharp(path.join(assetsDir, definition.source))
    .extract(definition.crop)
    .resize({ width, height, fit: "fill", kernel: sharp.kernel.lanczos3 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const output = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = (y * width + x) * info.channels;
      const outputOffset = (y * width + x) * 4;
      const red = data[sourceOffset] ?? 0;
      const green = data[sourceOffset + 1] ?? 0;
      const blue = data[sourceOffset + 2] ?? 0;
      output[outputOffset] = red;
      output[outputOffset + 1] = green;
      output[outputOffset + 2] = blue;
      output[outputOffset + 3] = extractOrnamentAlpha(
        red,
        green,
        blue,
        frameGeometry(x, y, definition),
      );
    }
  }

  await sharp(output, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputDir, `frame-${house}.png`));
}

function countAlphaRegion(data, region) {
  const left = Math.floor(region.left * width);
  const top = Math.floor(region.top * height);
  const right = Math.ceil(region.right * width);
  const bottom = Math.ceil(region.bottom * height);
  let nonTransparent = 0;
  let partial = 0;
  let total = 0;

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3] ?? 0;
      if (alpha > 0) nonTransparent += 1;
      if (alpha > 0 && alpha < 255) partial += 1;
      total += 1;
    }
  }
  return { nonTransparent, partial, total };
}

async function assertFrameQuality(house, definition) {
  const { data } = await sharp(path.join(outputDir, `frame-${house}.png`))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const center = countAlphaRegion(data, {
    left: definition.aperture.left + 0.01,
    top: definition.aperture.top + 0.01,
    right: definition.aperture.right - 0.01,
    bottom: definition.aperture.bottom - 0.01,
  });
  const exteriorRegions = [
    { left: 0, top: 0, right: 1, bottom: Math.max(0, definition.outer.top - 0.004) },
    {
      left: 0,
      top: Math.min(1, definition.outer.bottom + 0.004),
      right: 1,
      bottom: 1,
    },
    { left: 0, top: 0, right: Math.max(0, definition.outer.left - 0.004), bottom: 1 },
    {
      left: Math.min(1, definition.outer.right + 0.004),
      top: 0,
      right: 1,
      bottom: 1,
    },
  ];
  const exterior = exteriorRegions.map((region) => countAlphaRegion(data, region));
  const corners = [
    { left: 0, top: 0, right: 0.012, bottom: 0.012 },
    { left: 0.988, top: 0, right: 1, bottom: 0.012 },
    { left: 0, top: 0.988, right: 0.012, bottom: 1 },
    { left: 0.988, top: 0.988, right: 1, bottom: 1 },
  ].map((region) => countAlphaRegion(data, region));

  let opaque = 0;
  let partial = 0;
  let transparent = 0;
  for (let offset = 3; offset < data.length; offset += 4) {
    const alpha = data[offset] ?? 0;
    if (alpha === 0) transparent += 1;
    else if (alpha === 255) opaque += 1;
    else partial += 1;
  }
  const pixels = width * height;
  const failures = [];
  if (center.nonTransparent !== 0) {
    failures.push(
      `center aperture has ${center.nonTransparent} non-transparent pixels`,
    );
  }
  if (exterior.some((region) => region.nonTransparent !== 0)) {
    failures.push(
      `exterior has ${exterior.reduce((sum, region) => sum + region.nonTransparent, 0)} non-transparent pixels`,
    );
  }
  if (corners.some((region) => region.nonTransparent !== 0)) {
    failures.push(
      `corners have ${corners.reduce((sum, region) => sum + region.nonTransparent, 0)} non-transparent pixels`,
    );
  }
  if (opaque < pixels * 0.08) failures.push("retained ornament is unexpectedly sparse");
  if (transparent < pixels * 0.45)
    failures.push("transparent field is unexpectedly small");
  if (partial === 0 || partial > pixels * 0.025) {
    failures.push(`partial-alpha contour is outside the 0–2.5% budget (${partial})`);
  }
  if (failures.length > 0) {
    throw new Error(`Frame QA failed for ${house}: ${failures.join("; ")}`);
  }
  log(
    `QA ${house}: center=0 exterior=0 corners=0 partial=${((partial / pixels) * 100).toFixed(2)}%`,
  );
}

async function assertParchmentQuality() {
  const { data, info } = await sharp(path.join(outputDir, "parchment-surface.png"))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let nonOpaque = 0;
  let accentPixels = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset] ?? 0;
    const green = data[offset + 1] ?? 0;
    const blue = data[offset + 2] ?? 0;
    const alpha = data[offset + 3] ?? 0;
    if (alpha !== 255) nonOpaque += 1;
    if (Math.max(red, green, blue) - Math.min(red, green, blue) > 80) {
      accentPixels += 1;
    }
  }
  const pixels = info.width * info.height;
  if (nonOpaque > 0) {
    throw new Error(`Parchment QA failed: ${nonOpaque} pixels are not fully opaque`);
  }
  if (accentPixels > pixels * 0.0001) {
    throw new Error(
      `Parchment QA failed: ${accentPixels} high-chroma pixels suggest House ornament contamination`,
    );
  }
  log(`QA parchment: opaque=${pixels} accent=${accentPixels}`);
}

async function writeContactSheet() {
  const cardWidth = 256;
  const cardHeight = 384;
  const gap = 16;
  const names = Object.keys(houses);
  const parchment = await sharp(path.join(outputDir, "parchment-surface.png"))
    .resize(cardWidth, cardHeight)
    .png()
    .toBuffer();
  const composites = [];

  for (const [column, house] of names.entries()) {
    const frame = await sharp(path.join(outputDir, `frame-${house}.png`))
      .resize(cardWidth, cardHeight)
      .png()
      .toBuffer();
    for (const [row, background] of [
      { r: 5, g: 6, b: 8, alpha: 1 },
      { r: 255, g: 0, b: 255, alpha: 1 },
    ].entries()) {
      const preview = await sharp({
        create: { width: cardWidth, height: cardHeight, channels: 4, background },
      })
        .composite([{ input: frame }])
        .png()
        .toBuffer();
      composites.push({
        input: preview,
        left: gap + column * (cardWidth + gap),
        top: gap + row * (cardHeight + gap),
      });
    }
    const assembled = await sharp(parchment)
      .composite([{ input: frame }])
      .png()
      .toBuffer();
    composites.push({
      input: assembled,
      left: gap + column * (cardWidth + gap),
      top: gap + 2 * (cardHeight + gap),
    });
  }

  await mkdir(qaDir, { recursive: true });
  await sharp({
    create: {
      width: gap + names.length * (cardWidth + gap),
      height: gap + 3 * (cardHeight + gap),
      channels: 4,
      background: { r: 42, g: 38, b: 32, alpha: 1 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(path.join(qaDir, "12-card-primitives-contact-sheet.png"));
}

await mkdir(outputDir, { recursive: true });
await writeParchmentSurface();
for (const [house, definition] of Object.entries(houses)) {
  await writeFrame(house, definition);
}
await assertParchmentQuality();
for (const [house, definition] of Object.entries(houses)) {
  await assertFrameQuality(house, definition);
}
await writeContactSheet();
log(`Extracted shared card primitives to ${path.relative(repoDir, outputDir)}`);
