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

const v1PortraitRows = [
  ["persephone-plum-blossom", "persephone-plum-blossom-empress"],
  ["poseidon-dragon-king", "poseidon-dragon-king"],
  ["athena-grand-strategist", "athena-grand-strategist"],
].map(([output, source]) => ({
  source: `07-avatars-greek-court/07-avatars-greek-court-${source}.png`,
  outputs: densities(`avatars/${output}.webp`, 128, 256),
}));

const numberKitCrops = {
  hearts: {
    card: { left: 48, top: 28, width: 660, height: 980 },
    pip: { left: 800, top: 180, width: 700, height: 700 },
  },
  spades: {
    card: { left: 54, top: 12, width: 710, height: 1000 },
    pip: { left: 810, top: 160, width: 700, height: 700 },
  },
  diamonds: {
    card: { left: 72, top: 20, width: 690, height: 980 },
    pip: { left: 820, top: 150, width: 700, height: 700 },
  },
  clubs: {
    card: { left: 48, top: 22, width: 700, height: 980 },
    pip: { left: 800, top: 150, width: 700, height: 700 },
  },
};

const cardKitRows = Object.entries(numberKitCrops).flatMap(([suit, crops]) => [
  {
    source: `10-ui-chrome-and-deck/10-ui-chrome-and-deck-${suit}-number-kit.png`,
    crop: crops.card,
    outputs: densities(`cards/${suit}-number-blank.webp`, 256, 512),
  },
  {
    source: `10-ui-chrome-and-deck/10-ui-chrome-and-deck-${suit}-number-kit.png`,
    crop: crops.pip,
    outputs: densities(`cards/${suit}-pip.webp`, 128, 256),
  },
]);

const pointGlowRows = [
  ["five", { left: 0, top: 88, width: 480, height: 910 }],
  ["ten", { left: 480, top: 88, width: 480, height: 910 }],
  ["king", { left: 960, top: 88, width: 488, height: 910 }],
].map(([name, crop]) => ({
  source: "06-ui-gameplay/06-ui-gameplay-points-glow.png",
  crop,
  outputs: densities(`ui/point-glow-${name}.webp`, 128, 256),
}));

const trumpRows = [
  ["trump-frame", 256, 512],
  ["trump-frame-compact", 128, 256],
  ["trump-seal", 128, 256],
  ["trump-burst", 512, 1024],
].map(([name, width, width2x]) => ({
  source: `10-ui-chrome-and-deck/10-ui-chrome-and-deck-${name}.png`,
  outputs: densities(`ui/${name}.webp`, width, width2x),
}));

const chromeRows = [
  ["panel-frame", "ui/panel-frame.webp", 512, 1024],
  ["nameplate", "ui/nameplate.webp", 460, 920],
  ["table-ring", "ui/table-ring.webp", 800, 1600],
  ["sheng-ji-wordmark", "ui/sheng-ji-wordmark.webp", 600, 1200],
].map(([name, output, width, width2x]) => ({
  source: `10-ui-chrome-and-deck/10-ui-chrome-and-deck-${name}.png`,
  outputs: densities(output, width, width2x),
}));

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
  ...v1PortraitRows,
  ...cardKitRows,
  ...pointGlowRows,
  ...trumpRows,
  ...chromeRows,
  {
    source: "09-ui-followups/09-ui-followups-premium-card-back.png",
    outputs: densities("cards/card-back.webp", 256, 512),
  },
  {
    source: "09-ui-followups/09-ui-followups-home-hero-landscape.png",
    outputs: densities("home/hero-landscape.webp", 960, 1920),
  },
  {
    source: "09-ui-followups/09-ui-followups-home-hero-portrait.png",
    outputs: densities("home/hero-portrait.webp", 540, 1080),
  },
  {
    source: "09-ui-followups/09-ui-followups-table-felt.png",
    outputs: densities("textures/table-felt.webp", 512, 1024),
  },
  {
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

      let image = sharp(sourcePath);
      if (entry.crop !== undefined) image = image.extract(entry.crop);
      image = image.resize({ width: output.width });
      const info =
        path.extname(output.path) === ".png"
          ? await image.png({ compressionLevel: 9 }).toFile(outputPath)
          : await image.webp({ quality }).toFile(outputPath);

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
