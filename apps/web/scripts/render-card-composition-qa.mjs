import { Buffer } from "node:buffer";
import { log } from "node:console";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { ART_ASSET_IDS, artAssetPath } from "../lib/art-registry.ts";

const scriptDir = import.meta.dirname;
const webDir = path.resolve(scriptDir, "..");
const repoDir = path.resolve(webDir, "../..");
const publicDir = path.join(webDir, "public");
const qaDir = path.join(repoDir, "docs/art-qa");
const outputPath = path.join(qaDir, "13-card-composition-readability.png");

const houses = ["hearts", "spades", "diamonds", "clubs"];
const variants = [
  { label: "ordinary 8", rank: "8", treasure: null },
  { label: "cache 5", rank: "5", treasure: "five" },
  { label: "hoard 10", rank: "10", treasure: "ten" },
];
const sizes = [
  {
    label: "108×156",
    width: 108,
    height: 156,
    inset: 8,
    rankWidth: 26,
    rankHeight: 23,
    suitWidth: 18,
    suitHeight: 18,
  },
  {
    label: "75×108",
    width: 75,
    height: 108,
    inset: 5,
    rankWidth: 21,
    rankHeight: 18,
    suitWidth: 14,
    suitHeight: 14,
  },
];

function publicAsset(id) {
  return path.join(publicDir, artAssetPath(id, 2).replace(/^\//, ""));
}

async function resizeAsset(id, width, height) {
  return sharp(publicAsset(id))
    .resize({ width, height, fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
}

async function renderIndex(house, rank, size) {
  const red = house === "hearts" || house === "diamonds";
  const groupHeight = size.rankHeight + size.suitHeight - 2;
  const rankArt = await sharp(
    publicAsset(ART_ASSET_IDS.rankIndex(red ? "red" : "black", rank)),
  )
    .resize({
      width: size.rankWidth,
      height: size.rankHeight,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
  const suitArt = await sharp(publicAsset(ART_ASSET_IDS.suitIndex(house)))
    .resize({
      width: size.suitWidth,
      height: size.suitHeight,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size.rankWidth,
      height: groupHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: rankArt, left: 0, top: 0 },
      {
        input: suitArt,
        left: Math.round((size.rankWidth - size.suitWidth) / 2),
        top: size.rankHeight - 2,
      },
    ])
    .png()
    .toBuffer();
}

async function renderCard(house, variant, size) {
  const layers = [
    {
      input: await resizeAsset(ART_ASSET_IDS.cardSurface, size.width, size.height),
    },
  ];
  if (variant.treasure !== null) {
    layers.push({
      input: await resizeAsset(
        ART_ASSET_IDS.treasureIllustration(house, variant.treasure),
        size.width,
        size.height,
      ),
    });
  }
  layers.push({
    input: await resizeAsset(
      ART_ASSET_IDS.houseCardFrame(house),
      size.width,
      size.height,
    ),
  });

  const index = await renderIndex(house, variant.rank, size);
  const indexHeight = size.rankHeight + size.suitHeight - 2;
  const opposite = await sharp(index).rotate(180).png().toBuffer();
  const stroke = Buffer.from(
    `<svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg"><rect x="0.75" y="0.75" width="${size.width - 1.5}" height="${size.height - 1.5}" rx="5" fill="none" stroke="#24180c" stroke-width="1.5"/></svg>`,
  );

  return sharp({
    create: {
      width: size.width,
      height: size.height,
      channels: 4,
      background: { r: 245, g: 232, b: 204, alpha: 1 },
    },
  })
    .composite([
      ...layers,
      { input: index, left: size.inset, top: size.inset },
      {
        input: opposite,
        left: size.width - size.inset - size.rankWidth,
        top: size.height - size.inset - indexHeight,
      },
      { input: stroke, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

function labelSvg(width, height, text, fontSize = 15) {
  const escaped = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:Arial,sans-serif;font-weight:700;fill:#ead7a1;letter-spacing:.5px}</style><text x="${width / 2}" y="${height - 8}" text-anchor="middle" font-size="${fontSize}">${escaped}</text></svg>`,
  );
}

async function writeSheet() {
  const gap = 18;
  const labelWidth = 82;
  const cellWidth = 126;
  const headerHeight = 38;
  const rowHeight = 180;
  const columns = sizes.flatMap((size) =>
    variants.map((variant) => ({ size, variant })),
  );
  const width = labelWidth + gap + columns.length * (cellWidth + gap) + gap;
  const height = headerHeight + houses.length * rowHeight + gap;
  const composites = [];

  for (const [column, { size, variant }] of columns.entries()) {
    composites.push({
      input: labelSvg(cellWidth, headerHeight, `${size.label} · ${variant.label}`, 12),
      left: labelWidth + gap + column * (cellWidth + gap),
      top: 0,
    });
  }

  for (const [row, house] of houses.entries()) {
    const rowTop = headerHeight + row * rowHeight;
    composites.push({
      input: labelSvg(labelWidth, rowHeight / 2, house.toUpperCase(), 13),
      left: 0,
      top: rowTop + 35,
    });
    for (const [column, { size, variant }] of columns.entries()) {
      const card = await renderCard(house, variant, size);
      composites.push({
        input: card,
        left:
          labelWidth +
          gap +
          column * (cellWidth + gap) +
          Math.round((cellWidth - size.width) / 2),
        top: rowTop + Math.round((rowHeight - size.height) / 2),
      });
    }
  }

  await mkdir(qaDir, { recursive: true });
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 20, g: 18, b: 15, alpha: 1 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

await writeSheet();
log(`Rendered card readability QA to ${path.relative(repoDir, outputPath)}`);
