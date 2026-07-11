import { Buffer } from "node:buffer";
import { log } from "node:console";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const scriptDir = import.meta.dirname;
const repoDir = path.resolve(scriptDir, "../../..");
const sourceDir = path.join(repoDir, "assets/13-rank-index-typography");
const chromaDir = path.join(sourceDir, "chroma");
const qaDir = path.join(repoDir, "docs/art-qa");

const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10"];
const tones = {
  black: [0x17, 0x13, 0x0f],
  red: [0x9c, 0x17, 0x24],
};
const canvas = { width: 512, height: 640 };
const content = { maxWidth: 416, height: 560 };

function isGlyphPixel(red, green, blue) {
  const darkDistance = Math.hypot(red, green, blue);
  const magentaDistance = Math.hypot(red - 255, green, blue - 255);
  return darkDistance < magentaDistance;
}

async function normalizedMask(rank) {
  const { data, info } = await sharp(path.join(chromaDir, `rank-${rank}-chroma.png`))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mask = Buffer.alloc(info.width * info.height);
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const sourceOffset = (y * info.width + x) * info.channels;
      const red = data[sourceOffset] ?? 0;
      const green = data[sourceOffset + 1] ?? 0;
      const blue = data[sourceOffset + 2] ?? 0;
      if (!isGlyphPixel(red, green, blue)) continue;

      mask[y * info.width + x] = 255;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) {
    throw new Error(`No glyph pixels found for rank ${rank}`);
  }

  const sourceWidth = right - left + 1;
  const sourceHeight = bottom - top + 1;
  const naturalWidth = Math.round((sourceWidth / sourceHeight) * content.height);
  const outputWidth = Math.min(content.maxWidth, naturalWidth);
  const { data: resized, info: resizedInfo } = await sharp(mask, {
    raw: { width: info.width, height: info.height, channels: 1 },
  })
    .extract({ left, top, width: sourceWidth, height: sourceHeight })
    .resize({
      width: outputWidth,
      height: content.height,
      fit: "fill",
      kernel: sharp.kernel.nearest,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const normalized = Buffer.alloc(canvas.width * canvas.height);
  const offsetX = Math.floor((canvas.width - outputWidth) / 2);
  const offsetY = Math.floor((canvas.height - content.height) / 2);
  for (let y = 0; y < content.height; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      normalized[(offsetY + y) * canvas.width + offsetX + x] =
        resized[(y * outputWidth + x) * resizedInfo.channels] ?? 0;
    }
  }

  return normalized;
}

function rgbaGlyph(mask, color) {
  const output = Buffer.alloc(canvas.width * canvas.height * 4);
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (mask[pixel] !== 255) continue;
    const offset = pixel * 4;
    output[offset] = color[0];
    output[offset + 1] = color[1];
    output[offset + 2] = color[2];
    output[offset + 3] = 255;
  }
  return output;
}

async function buildContactSheet(outputs) {
  const tileWidth = 192;
  const tileHeight = 240;
  const gap = 12;
  const width = ranks.length * tileWidth + (ranks.length + 1) * gap;
  const height = tileHeight * 2 + gap * 3;
  const composites = [];

  for (const [row, tone] of ["black", "red"].entries()) {
    for (const [column, rank] of ranks.entries()) {
      const glyph = await sharp(outputs.get(`${tone}-${rank}`))
        .resize({ width: tileWidth, height: tileHeight, fit: "contain" })
        .png()
        .toBuffer();
      composites.push({
        input: glyph,
        left: gap + column * (tileWidth + gap),
        top: gap + row * (tileHeight + gap),
      });
    }
  }

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 238, g: 221, b: 183, alpha: 1 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(path.join(qaDir, "13-rank-index-typography-contact-sheet.png"));
}

async function main() {
  await mkdir(sourceDir, { recursive: true });
  await mkdir(qaDir, { recursive: true });
  const outputs = new Map();

  for (const rank of ranks) {
    const mask = await normalizedMask(rank);
    for (const [tone, color] of Object.entries(tones)) {
      const outputPath = path.join(sourceDir, `rank-${tone}-${rank}.png`);
      await sharp(rgbaGlyph(mask, color), {
        raw: { ...canvas, channels: 4 },
      })
        .png({ compressionLevel: 9 })
        .toFile(outputPath);
      outputs.set(`${tone}-${rank}`, outputPath);
      log(path.relative(repoDir, outputPath));
    }
  }

  await buildContactSheet(outputs);
  log("docs/art-qa/13-rank-index-typography-contact-sheet.png");
}

await main();
