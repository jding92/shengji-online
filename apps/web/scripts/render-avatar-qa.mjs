import { Buffer } from "node:buffer";
import { log } from "node:console";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const scriptDir = import.meta.dirname;
const webDir = path.resolve(scriptDir, "..");
const repoDir = path.resolve(webDir, "../..");
const assetsDir = path.join(repoDir, "assets");
const qaDir = path.join(repoDir, "docs/art-qa");
const outputPath = path.join(qaDir, "08-avatars-contact-sheet.png");

const portraits = [
  [
    "hades-king-yan",
    "07-avatars-greek-court/07-avatars-greek-court-hades-king-yan.png",
  ],
  [
    "persephone-plum-blossom-empress",
    "07-avatars-greek-court/07-avatars-greek-court-persephone-plum-blossom-empress.png",
  ],
  [
    "poseidon-dragon-king",
    "07-avatars-greek-court/07-avatars-greek-court-poseidon-dragon-king.png",
  ],
  [
    "athena-grand-strategist",
    "07-avatars-greek-court/07-avatars-greek-court-athena-grand-strategist.png",
  ],
  [
    "thor-thunder-brawler",
    "08-avatars-cross-pantheon/08-avatars-cross-pantheon-thor-thunder-brawler.png",
  ],
  [
    "freyja-valkyrie-queen",
    "08-avatars-cross-pantheon/08-avatars-cross-pantheon-freyja-valkyrie-queen.png",
  ],
  [
    "anubis-jackal-judge",
    "08-avatars-cross-pantheon/08-avatars-cross-pantheon-anubis-jackal-judge.png",
  ],
  [
    "change-moon-huntress",
    "08-avatars-cross-pantheon/08-avatars-cross-pantheon-change-moon-huntress.png",
  ],
];

function labelSvg(width, height, text) {
  const escaped = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:Arial,sans-serif;font-weight:700;fill:#ead7a1;letter-spacing:.3px}</style><text x="${width / 2}" y="${height - 9}" text-anchor="middle" font-size="13">${escaped}</text></svg>`,
  );
}

async function renderSmallCircle(sourcePath) {
  const portrait = await sharp(sourcePath)
    .resize(34, 34, { fit: "fill" })
    .png()
    .toBuffer();
  const circle = Buffer.from(
    '<svg width="34" height="34" xmlns="http://www.w3.org/2000/svg"><circle cx="17" cy="17" r="17" fill="white"/></svg>',
  );
  return sharp(portrait)
    .composite([{ input: circle, blend: "dest-in" }])
    .resize(136, 136, { kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();
}

async function writeSheet() {
  const cellWidth = 280;
  const cellHeight = 190;
  const gap = 18;
  const headerHeight = 34;
  const columns = 4;
  const rows = 2;
  const width = columns * cellWidth + (columns + 1) * gap;
  const height = headerHeight + rows * cellHeight + (rows + 1) * gap;
  const composites = [];

  for (const [index, [slug, relativePath]] of portraits.entries()) {
    const sourcePath = path.join(assetsDir, relativePath);
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = gap + column * (cellWidth + gap);
    const top = headerHeight + gap + row * (cellHeight + gap);
    composites.push({
      input: labelSvg(cellWidth, headerHeight, slug),
      left,
      top: top - headerHeight,
    });
    composites.push({
      input: await sharp(sourcePath).resize(128, 128, { fit: "fill" }).png().toBuffer(),
      left: left + 20,
      top: top + 10,
    });
    composites.push({
      input: await renderSmallCircle(sourcePath),
      left: left + 144,
      top: top + 6,
    });
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
log(`Rendered avatar contact sheet to ${path.relative(repoDir, outputPath)}`);
