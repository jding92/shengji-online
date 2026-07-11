import { error, log } from "node:console";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";

import { ART_ASSETS, validateArtRegistry } from "../lib/art-registry.ts";

const scriptDir = import.meta.dirname;
const webDir = path.resolve(scriptDir, "..");
const repoDir = path.resolve(webDir, "../..");
const assetsDir = path.join(repoDir, "assets");
const publicArtDir = path.join(webDir, "public/art");
const quality = 80;

const registeredRows = ART_ASSETS.filter((asset) => asset.build !== undefined).map(
  (asset) => ({
    ...asset.build,
    id: asset.id,
    alpha: asset.alpha,
    outputs: asset.outputs.map((output) => ({
      path: output.path,
      width: output.width,
      ...(output.height === "auto" ? {} : { height: output.height }),
    })),
  }),
);

// Platform icons do not have a 1x/2x pair, so they intentionally live outside
// the reusable asset registry. Their shared SVG source remains declarative.
const platformRows = [
  {
    id: "platform.icons",
    alpha: "ordinary-alpha",
    source: "../apps/web/public/art/ui/mythic-logo.svg",
    outputs: [
      { path: "icons/favicon-16.png", width: 16 },
      { path: "icons/favicon-32.png", width: 32 },
      { path: "icons/apple-touch-180.png", width: 180 },
      { path: "icons/pwa-192.png", width: 192 },
      { path: "icons/pwa-512.png", width: 512 },
    ],
  },
];

const manifest = [...registeredRows, ...platformRows];

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function assertRegistryValid() {
  const validationErrors = validateArtRegistry();
  if (validationErrors.length > 0) {
    throw new Error(`Invalid art registry:\n${validationErrors.join("\n")}`);
  }
}

async function assertSourcesExist() {
  const missing = [];
  await Promise.all(
    manifest.map(async ({ source }) => {
      try {
        await stat(path.join(assetsDir, source));
      } catch {
        missing.push(source);
      }
    }),
  );

  if (missing.length > 0) {
    throw new Error(`Missing art source file(s):\n${missing.join("\n")}`);
  }
}

async function removeMagenta(image) {
  const { data, info } = await image.ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    if (
      red > 55 &&
      blue > 55 &&
      Math.min(red, blue) > green + 20 &&
      Math.abs(red - blue) < 85
    ) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    } else {
      data[offset + 3] = data[offset + 3] === 0 ? 0 : 255;
    }
  }
  return sharp(data, { raw: info });
}

async function removeBorderConnectedDark(image) {
  const { data, info } = await image.ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const isDark = (pixel) => {
    const offset = pixel * channels;
    return data[offset] < 36 && data[offset + 1] < 36 && data[offset + 2] < 36;
  };
  const add = (pixel) => {
    if (visited[pixel] === 1 || !isDark(pixel)) return;
    visited[pixel] = 1;
    queue[tail] = pixel;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    add(x);
    add((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    add(y * width);
    add(y * width + width - 1);
  }
  while (head < tail) {
    const pixel = queue[head];
    head += 1;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) add(pixel - 1);
    if (x + 1 < width) add(pixel + 1);
    if (y > 0) add(pixel - width);
    if (y + 1 < height) add(pixel + width);
  }
  for (let pixel = 0; pixel < visited.length; pixel += 1) {
    data[pixel * channels + 3] = visited[pixel] === 1 ? 0 : 255;
  }
  return sharp(data, { raw: info });
}

async function hardenAlpha(image) {
  const { data, info } = await image.ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  for (let offset = 3; offset < data.length; offset += info.channels) {
    data[offset] = data[offset] === 0 ? 0 : 255;
  }
  return sharp(data, { raw: info });
}

async function flattenOpaqueColor(image, color) {
  const { data, info } = await image.ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const alpha = data[offset + 3];
    if (alpha === 0) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
    } else {
      data[offset] = color.r;
      data[offset + 1] = color.g;
      data[offset + 2] = color.b;
    }
  }
  return sharp(data, { raw: info });
}

async function tightenAlpha(image) {
  const { data, info } = await image.ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  for (let offset = 3; offset < data.length; offset += info.channels) {
    const alpha = data[offset];
    if (alpha <= 96) data[offset] = 0;
    else if (alpha >= 160) data[offset] = 255;
    else data[offset] = Math.round(((alpha - 96) / 64) * 255);
  }
  return sharp(data, { raw: info });
}

async function build() {
  await assertRegistryValid();
  await assertSourcesExist();

  let count = 0;
  let totalBytes = 0;

  for (const entry of manifest) {
    const sourcePath = path.join(assetsDir, entry.source);

    for (const output of entry.outputs) {
      const outputPath = path.join(publicArtDir, output.path);
      await mkdir(path.dirname(outputPath), { recursive: true });

      let image = sharp(sourcePath);
      if (entry.crop !== undefined) image = image.extract(entry.crop);
      if (entry.removeMagenta === true) image = await removeMagenta(image);
      if (entry.transparentExterior === true) {
        image = await removeBorderConnectedDark(image);
      }
      image = image.resize({
        width: output.width,
        ...(output.height === undefined ? {} : { height: output.height }),
        ...(entry.fit === undefined ? {} : { fit: entry.fit }),
        ...(entry.background === undefined ? {} : { background: entry.background }),
      });
      if (entry.removeMagenta === true) image = await removeMagenta(image);
      if (entry.hardAlpha === true) image = await hardenAlpha(image);
      if (entry.tightAlpha === true) image = await tightenAlpha(image);
      if (entry.flatColor !== undefined) {
        image = await flattenOpaqueColor(image, entry.flatColor);
      }
      const info =
        path.extname(output.path) === ".png"
          ? await image.png({ compressionLevel: 9 }).toFile(outputPath)
          : await image
              .webp({ quality, ...(entry.lossless === true ? { lossless: true } : {}) })
              .toFile(outputPath);

      count += 1;
      totalBytes += info.size;
      log(
        `${path.relative(webDir, outputPath)} ${info.width}x${info.height} ${formatKb(info.size)}`,
      );
    }
  }

  log(`Built ${count} art files, ${formatKb(totalBytes)} total.`);
}

try {
  await build();
} catch (err) {
  error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
