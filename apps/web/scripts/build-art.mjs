import { error, log } from "node:console";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";

const scriptDir = import.meta.dirname;
const webDir = path.resolve(scriptDir, "..");
const repoDir = path.resolve(webDir, "../..");
const assetsDir = path.join(repoDir, "assets");
const publicArtDir = path.join(webDir, "public/art");
const quality = 80;

const ranks = ["king", "queen", "jack", "ace"];
const suits = [
  ["diamonds", "02-diamonds-chinese"],
  ["spades", "03-spades-norse"],
  ["hearts", "04-hearts-greek"],
  ["clubs", "05-clubs-egyptian"],
];

const cardRows = suits.flatMap(([suit, folder]) =>
  ranks.map((rank) => ({
    source: `${folder}/${folder}-${rank}.png`,
    outputs: densities(`cards/${suit}-${rank}.webp`, 256, 512),
  })),
);

const uiRows = [
  ...[
    "attack-badge",
    "defend-badge",
    "trump-declaration",
    "buried-cards",
    "card-deck",
    "points-glow",
  ].map((name) => uiRow(name, 256, 512)),
  ...["attackers-banner", "defenders-banner"].map((name) => uiRow(name, 640, 1280)),
  uiRow("level-up-score", 320, 640),
];

const manifest = [
  ...cardRows,
  {
    source: "01-jokers/01-jokers-wukong.png",
    outputs: densities("cards/joker-big.webp", 256, 512),
  },
  {
    source: "01-jokers/01-jokers-loki.png",
    outputs: densities("cards/joker-small.webp", 256, 512),
  },
  ...uiRows,
  {
    source: "06-ui-gameplay/06-ui-gameplay-victory-screen.png",
    outputs: densities("splash/victory.webp", 960, 1600),
  },
  {
    source: "06-ui-gameplay/06-ui-gameplay-defeat-screen.png",
    outputs: densities("splash/defeat.webp", 960, 1600),
  },
  {
    source: "07-avatars-greek-court/07-avatars-greek-court-hades-king-yan.png",
    outputs: densities("avatars/hades-king-yan.webp", 128, 256),
  },
  /*
   * TODO(art): add when generated — prompts in
   * docs/prompt-batches/07-avatars-greek-court.md and
   * docs/prompt-batches/08-avatars-cross-pantheon.md
   *
   * 07: persephone-plum-blossom-empress, poseidon-dragon-king,
   * athena-grand-strategist, dionysus-wild-guest,
   * hephaestus-master-artificer, ares-crimson-war-saint
   * 08: thor, freyja, anubis, bastet, artemis-change, amaterasu, anansi,
   * heracles, moirai, charon
   */
];

function densities(outputPath, width, width2x) {
  const parsed = path.parse(outputPath);
  return [
    { path: outputPath, width },
    { path: path.join(parsed.dir, `${parsed.name}@2x${parsed.ext}`), width: width2x },
  ];
}

function uiRow(name, width, width2x) {
  return {
    source: `06-ui-gameplay/06-ui-gameplay-${name}.png`,
    outputs: densities(`ui/${name}.webp`, width, width2x),
  };
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
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

async function build() {
  await assertSourcesExist();

  let count = 0;
  let totalBytes = 0;

  for (const entry of manifest) {
    const sourcePath = path.join(assetsDir, entry.source);

    for (const output of entry.outputs) {
      const outputPath = path.join(publicArtDir, output.path);
      await mkdir(path.dirname(outputPath), { recursive: true });

      const info = await sharp(sourcePath)
        .resize({ width: output.width })
        .webp({ quality })
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
