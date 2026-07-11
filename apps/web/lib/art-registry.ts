/**
 * Declarative registry for generated art and composable visual primitives.
 *
 * The registry deliberately distinguishes primitive assets from transitional
 * composites and legacy full renders. Consumers should resolve paths through
 * this module so a composite can be replaced by separate layers without
 * changing component-level naming conventions.
 */

export type ArtAlphaContract = "opaque" | "binary-alpha" | "ordinary-alpha";

export type ArtHouse = "hearts" | "spades" | "diamonds" | "clubs";
export type ArtLegacyRankName = "king" | "queen" | "jack" | "ace";
export type ArtNumberRank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10";
export type ArtRankTone = "red" | "black";
export type ArtTreasureRankName = "five" | "ten";
export type ArtPortraitId =
  | "hades-king-yan"
  | "persephone-plum-blossom"
  | "poseidon-dragon-king"
  | "athena-grand-strategist";
export type ArtGameplayUiId =
  | "attack-badge"
  | "defend-badge"
  | "trump-declaration"
  | "buried-cards"
  | "card-deck"
  | "attackers-banner"
  | "defenders-banner"
  | "level-up-score";

export type ArtAssetId =
  | `card.legacy.${ArtHouse}.${ArtLegacyRankName}`
  | `card.legacy.joker.${"big" | "small"}`
  | `card.frame.${ArtHouse}.ornament`
  | `card.illustration.${ArtHouse}.${ArtTreasureRankName}-treasure`
  | `card.index.suit.${ArtHouse}`
  | `card.index.rank.${ArtRankTone}.${ArtNumberRank}`
  | `ui.${ArtGameplayUiId}`
  | `portrait.${ArtPortraitId}`
  | "ui.chrome.panel-frame"
  | "ui.chrome.player-nameplate"
  | "ui.chrome.table-ring"
  | "ui.wordmark"
  | "vfx.trump-burst"
  | "splash.victory"
  | "splash.defeat"
  | "home.hero-landscape"
  | "home.hero-portrait"
  | "card.back.premium"
  | "texture.table-felt"
  | "card.surface.parchment"
  | "ui.portrait-frame.house"
  | "ui.button.primary";

export const ART_ASSET_IDS = {
  cardBack: "card.back.premium",
  cardSurface: "card.surface.parchment",
  panelFrame: "ui.chrome.panel-frame",
  playerNameplate: "ui.chrome.player-nameplate",
  tableRing: "ui.chrome.table-ring",
  wordmark: "ui.wordmark",
  trumpBurst: "vfx.trump-burst",
  splashVictory: "splash.victory",
  splashDefeat: "splash.defeat",
  heroLandscape: "home.hero-landscape",
  heroPortrait: "home.hero-portrait",
  portraitFrame: "ui.portrait-frame.house",
  primaryButton: "ui.button.primary",
  legacyCardFace: <House extends ArtHouse, Rank extends ArtLegacyRankName>(
    house: House,
    rank: Rank,
  ): `card.legacy.${House}.${Rank}` => `card.legacy.${house}.${rank}`,
  legacyJoker: <Size extends "big" | "small">(
    size: Size,
  ): `card.legacy.joker.${Size}` => `card.legacy.joker.${size}`,
  houseCardFrame: <House extends ArtHouse>(
    house: House,
  ): `card.frame.${House}.ornament` => `card.frame.${house}.ornament`,
  treasureIllustration: <House extends ArtHouse, Rank extends ArtTreasureRankName>(
    house: House,
    rank: Rank,
  ): `card.illustration.${House}.${Rank}-treasure` =>
    `card.illustration.${house}.${rank}-treasure`,
  suitIndex: <House extends ArtHouse>(house: House): `card.index.suit.${House}` =>
    `card.index.suit.${house}`,
  rankIndex: <Tone extends ArtRankTone, Rank extends ArtNumberRank>(
    tone: Tone,
    rank: Rank,
  ): `card.index.rank.${Tone}.${Rank}` => `card.index.rank.${tone}.${rank}`,
  gameplayUi: <Id extends ArtGameplayUiId>(id: Id): `ui.${Id}` => `ui.${id}`,
  portrait: <Id extends ArtPortraitId>(id: Id): `portrait.${Id}` => `portrait.${id}`,
} as const;

export type ArtAssetKind =
  | "card-surface"
  | "card-frame"
  | "card-illustration"
  | "rank-index"
  | "suit-index"
  | "legacy-card-face"
  | "card-back"
  | "portrait"
  | "portrait-frame"
  | "panel-chrome"
  | "button-chrome"
  | "vfx"
  | "icon"
  | "banner"
  | "backdrop"
  | "texture";

export type ArtLifecycle =
  | "primitive"
  | "temporary-composite"
  | "legacy-deferred"
  | "planned";

export interface ArtSafeZone {
  id: string;
  purpose: string;
  /** Normalized coordinates in the range 0..1. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArtNineSlice {
  /** Insets are pixels in the 1x output coordinate space. */
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ArtOutput {
  density: 1 | 2;
  path: string;
  width: number;
  /** `auto` preserves the source aspect ratio. */
  height: number | "auto";
  format: "webp" | "png";
}

export interface ArtCrop {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ArtBuildRecipe {
  source: string;
  crop?: ArtCrop;
  fit?: "contain" | "cover" | "fill" | "inside" | "outside";
  background?: { r: number; g: number; b: number; alpha: number };
  removeMagenta?: boolean;
  transparentExterior?: boolean;
  hardAlpha?: boolean;
  tightAlpha?: boolean;
  flatColor?: { r: number; g: number; b: number };
  lossless?: boolean;
}

export interface ArtAssetDefinition<Id extends string = ArtAssetId> {
  id: Id;
  kind: ArtAssetKind;
  alpha: ArtAlphaContract;
  lifecycle: ArtLifecycle;
  outputs: readonly ArtOutput[];
  build?: ArtBuildRecipe;
  safeZones?: readonly ArtSafeZone[];
  nineSlice?: ArtNineSlice;
  house?: ArtHouse;
  note?: string;
}

export type ArtCompositionSlot =
  | "surface"
  | "frame"
  | "illustration"
  | "rank"
  | "suit"
  | "portrait"
  | "portrait-frame"
  | "center"
  | "ornament"
  | "content"
  | "vfx";

export interface ArtCompositionSchema {
  id: string;
  slots: readonly {
    slot: ArtCompositionSlot;
    accepts: readonly ArtAssetKind[];
    required: boolean;
    repeatable?: boolean;
  }[];
  note?: string;
}

const CARD_SAFE_ZONES = [
  {
    id: "index-top",
    purpose: "Top-left rank and suit",
    x: 0.035,
    y: 0.025,
    width: 0.24,
    height: 0.27,
  },
  {
    id: "index-bottom",
    purpose: "Mirrored bottom-right rank and suit",
    x: 0.725,
    y: 0.705,
    width: 0.24,
    height: 0.27,
  },
] as const satisfies readonly ArtSafeZone[];

function densityOutputs(
  outputPath: string,
  width: number,
  width2x: number,
  height: number | "auto" = "auto",
  height2x: number | "auto" = "auto",
): readonly ArtOutput[] {
  const extensionIndex = outputPath.lastIndexOf(".");
  const path2x = `${outputPath.slice(0, extensionIndex)}@2x${outputPath.slice(extensionIndex)}`;
  const format = outputPath.endsWith(".png") ? "png" : "webp";
  return [
    { density: 1, path: outputPath, width, height, format },
    { density: 2, path: path2x, width: width2x, height: height2x, format },
  ];
}

function sourceAsset(
  definition: Omit<ArtAssetDefinition, "outputs"> & {
    outputPath: string;
    width: number;
    width2x: number;
    height?: number | "auto";
    height2x?: number | "auto";
  },
): ArtAssetDefinition {
  const {
    outputPath,
    width,
    width2x,
    height = "auto",
    height2x = "auto",
    ...asset
  } = definition;
  return {
    ...asset,
    outputs: densityOutputs(outputPath, width, width2x, height, height2x),
  };
}

const houses = [
  ["diamonds", "02-diamonds-chinese"],
  ["spades", "03-spades-norse"],
  ["hearts", "04-hearts-greek"],
  ["clubs", "05-clubs-egyptian"],
] as const;

const legacyRanks = ["king", "queen", "jack", "ace"] as const;

const legacyCourtAssets = houses.flatMap(([house, folder]) =>
  legacyRanks.map((rank) =>
    sourceAsset({
      id: ART_ASSET_IDS.legacyCardFace(house, rank),
      kind: "legacy-card-face",
      alpha: "opaque",
      lifecycle: "legacy-deferred",
      house,
      note: "Deferred: decompose this fully generated ace/court card after the base registry and CardFace compositor are established.",
      build: { source: `${folder}/${folder}-${rank}.png` },
      outputPath: `cards/${house}-${rank}.webp`,
      width: 256,
      width2x: 512,
    }),
  ),
);

const legacyJokerAssets = (
  [
    ["big", "wukong"],
    ["small", "loki"],
  ] as const
).map(([size, source]) =>
  sourceAsset({
    id: ART_ASSET_IDS.legacyJoker(size),
    kind: "legacy-card-face",
    alpha: "opaque",
    lifecycle: "legacy-deferred",
    note: "Deferred: decompose this fully generated joker after the base registry and CardFace compositor are established.",
    build: { source: `01-jokers/01-jokers-${source}.png` },
    outputPath: `cards/joker-${size}.webp`,
    width: 256,
    width2x: 512,
  }),
);

const primitiveFrameAssets = houses.map(([house]) =>
  sourceAsset({
    id: ART_ASSET_IDS.houseCardFrame(house),
    kind: "card-frame",
    alpha: "ordinary-alpha",
    lifecycle: "primitive",
    house,
    safeZones: CARD_SAFE_ZONES,
    note: "Reusable House ornament with a transparent center aperture and exterior. Compose over card.surface.parchment; partial alpha is limited to the ornament antialias contour.",
    build: {
      source: `12-card-primitives/frame-${house}.png`,
      fit: "fill",
      tightAlpha: true,
      lossless: true,
    },
    outputPath: `cards/primitives/frame-${house}.webp`,
    width: 256,
    height: 384,
    width2x: 512,
    height2x: 768,
  }),
);

const treasureVersions = {
  hearts: { five: "v2", ten: "v2" },
  spades: { five: "v1", ten: "v1" },
  diamonds: { five: "v1", ten: "v1" },
  clubs: { five: "v1", ten: "v1" },
} as const;

const treasureAssets = houses.flatMap(([house]) =>
  (["five", "ten"] as const).map((rank) =>
    sourceAsset({
      id: ART_ASSET_IDS.treasureIllustration(house, rank),
      kind: "card-illustration",
      alpha: "opaque",
      lifecycle: "primitive",
      house,
      safeZones: CARD_SAFE_ZONES,
      note: "Approved borderless treasure illustration layer. Compose between the shared parchment surface and transparent House frame; generated indices remain separate.",
      build: {
        source: `12-point-treasure-illustration-layers/${house}-${rank}-${treasureVersions[house][rank]}.png`,
        fit: "fill",
      },
      outputPath: `cards/illustrations/${house}-${rank}-treasure.webp`,
      width: 256,
      height: 384,
      width2x: 512,
      height2x: 768,
    }),
  ),
);

const suitIndexAssets = houses.map(([house]) =>
  sourceAsset({
    id: ART_ASSET_IDS.suitIndex(house),
    kind: "suit-index",
    alpha: "binary-alpha",
    lifecycle: "primitive",
    house,
    build: {
      source: `11-point-treasures-and-indices/suit-${house}-chroma.png`,
      removeMagenta: true,
      hardAlpha: true,
      lossless: true,
    },
    outputPath: `cards/indices/suit-${house}.webp`,
    width: 64,
    width2x: 128,
  }),
);

const numberRanks = ["2", "3", "4", "5", "6", "7", "8", "9", "10"] as const;
const rankIndexAssets = (["red", "black"] as const).flatMap((tone) =>
  numberRanks.map((rank) =>
    sourceAsset({
      id: ART_ASSET_IDS.rankIndex(tone, rank),
      kind: "rank-index",
      alpha: "binary-alpha",
      lifecycle: "primitive",
      build: {
        source: `13-rank-index-typography/rank-${tone}-${rank}.png`,
        hardAlpha: true,
        flatColor:
          tone === "red"
            ? { r: 0x9c, g: 0x17, b: 0x24 }
            : { r: 0x17, g: 0x13, b: 0x0f },
        lossless: true,
      },
      outputPath: `cards/indices/rank-${tone}-${rank}.webp`,
      width: 64,
      width2x: 128,
    }),
  ),
);

const gameplayUiAssets = [
  ["attack-badge", "icon", 256, 512],
  ["defend-badge", "icon", 256, 512],
  ["trump-declaration", "banner", 256, 512],
  ["buried-cards", "icon", 256, 512],
  ["card-deck", "icon", 256, 512],
  ["attackers-banner", "banner", 640, 1280],
  ["defenders-banner", "banner", 640, 1280],
  ["level-up-score", "icon", 320, 640],
] as const;

const gameplayUiRows = gameplayUiAssets.map(([name, kind, width, width2x]) =>
  sourceAsset({
    id: ART_ASSET_IDS.gameplayUi(name),
    kind,
    alpha: "ordinary-alpha",
    lifecycle: "primitive",
    build: { source: `06-ui-gameplay/06-ui-gameplay-${name}.png` },
    outputPath: `ui/${name}.webp`,
    width,
    width2x,
  }),
);

const portraitAssets = [
  ["hades-king-yan", "hades-king-yan"],
  ["persephone-plum-blossom", "persephone-plum-blossom-empress"],
  ["poseidon-dragon-king", "poseidon-dragon-king"],
  ["athena-grand-strategist", "athena-grand-strategist"],
] as const;

const portraits = portraitAssets.map(([output, source]) =>
  sourceAsset({
    id: ART_ASSET_IDS.portrait(output),
    kind: "portrait",
    alpha: "ordinary-alpha",
    lifecycle: "primitive",
    build: { source: `07-avatars-greek-court/07-avatars-greek-court-${source}.png` },
    outputPath: `avatars/${output}.webp`,
    width: 128,
    width2x: 256,
  }),
);

const chromeAssets = [
  sourceAsset({
    id: "ui.chrome.panel-frame",
    kind: "panel-chrome",
    alpha: "ordinary-alpha",
    lifecycle: "primitive",
    nineSlice: { top: 48, right: 48, bottom: 48, left: 48 },
    build: { source: "10-ui-chrome-and-deck/10-ui-chrome-and-deck-panel-frame.png" },
    outputPath: "ui/panel-frame.webp",
    width: 512,
    width2x: 1024,
  }),
  sourceAsset({
    id: "ui.chrome.player-nameplate",
    kind: "panel-chrome",
    alpha: "binary-alpha",
    lifecycle: "temporary-composite",
    nineSlice: { top: 20, right: 86, bottom: 20, left: 86 },
    note: "The exterior is removed in the pipeline; the enclosed black center remains. Future player tags should compose center, ornament, and portrait frame separately.",
    build: {
      source: "10-ui-chrome-and-deck/10-ui-chrome-and-deck-nameplate.png",
      transparentExterior: true,
      hardAlpha: true,
      lossless: true,
    },
    outputPath: "ui/nameplate.webp",
    width: 460,
    width2x: 920,
  }),
  sourceAsset({
    id: "ui.chrome.table-ring",
    kind: "panel-chrome",
    alpha: "ordinary-alpha",
    lifecycle: "primitive",
    build: { source: "10-ui-chrome-and-deck/10-ui-chrome-and-deck-table-ring.png" },
    outputPath: "ui/table-ring.webp",
    width: 800,
    width2x: 1600,
  }),
  sourceAsset({
    id: "ui.wordmark",
    kind: "banner",
    alpha: "ordinary-alpha",
    lifecycle: "primitive",
    build: {
      source: "10-ui-chrome-and-deck/10-ui-chrome-and-deck-sheng-ji-wordmark.png",
    },
    outputPath: "ui/sheng-ji-wordmark.webp",
    width: 600,
    width2x: 1200,
  }),
  sourceAsset({
    id: "vfx.trump-burst",
    kind: "vfx",
    alpha: "ordinary-alpha",
    lifecycle: "primitive",
    build: { source: "10-ui-chrome-and-deck/10-ui-chrome-and-deck-trump-burst.png" },
    outputPath: "ui/trump-burst.webp",
    width: 512,
    width2x: 1024,
  }),
];

const backdropAssets = [
  [
    "splash.victory",
    "06-ui-gameplay/06-ui-gameplay-victory-screen.png",
    "splash/victory.webp",
    960,
    1600,
  ],
  [
    "splash.defeat",
    "06-ui-gameplay/06-ui-gameplay-defeat-screen.png",
    "splash/defeat.webp",
    960,
    1600,
  ],
  [
    "home.hero-landscape",
    "09-ui-followups/09-ui-followups-home-hero-landscape.png",
    "home/hero-landscape.webp",
    960,
    1920,
  ],
  [
    "home.hero-portrait",
    "09-ui-followups/09-ui-followups-home-hero-portrait.png",
    "home/hero-portrait.webp",
    540,
    1080,
  ],
] as const;

const backdrops = backdropAssets.map(([id, source, outputPath, width, width2x]) =>
  sourceAsset({
    id,
    kind: "backdrop",
    alpha: "opaque",
    lifecycle: "primitive",
    build: { source },
    outputPath,
    width,
    width2x,
  }),
);

const otherAssets = [
  sourceAsset({
    id: "card.back.premium",
    kind: "card-back",
    alpha: "opaque",
    lifecycle: "primitive",
    build: { source: "09-ui-followups/09-ui-followups-premium-card-back.png" },
    outputPath: "cards/card-back.webp",
    width: 256,
    width2x: 512,
  }),
  sourceAsset({
    id: "texture.table-felt",
    kind: "texture",
    alpha: "opaque",
    lifecycle: "primitive",
    build: { source: "09-ui-followups/09-ui-followups-table-felt.png" },
    outputPath: "textures/table-felt.webp",
    width: 512,
    width2x: 1024,
  }),
  {
    id: "card.surface.parchment",
    kind: "card-surface",
    alpha: "opaque",
    lifecycle: "primitive",
    outputs: densityOutputs("cards/primitives/parchment.webp", 256, 512, 384, 768),
    build: {
      source: "12-card-primitives/parchment-surface.png",
      fit: "fill",
      lossless: true,
    },
    note: "Shared fully opaque, House-neutral parchment surface for every composited card face.",
  },
  sourceAsset({
    id: "ui.portrait-frame.house",
    kind: "portrait-frame",
    alpha: "ordinary-alpha",
    lifecycle: "primitive",
    note: "Reusable transparent portrait surround derived from the approved black, crimson, and distressed-gold player chrome. Portrait imagery remains a separate slot.",
    build: { source: "12-ui-primitives/portrait-frame-house.svg", lossless: true },
    outputPath: "ui/primitives/portrait-frame-house.webp",
    width: 72,
    height: 72,
    width2x: 144,
    height2x: 144,
  }),
  sourceAsset({
    id: "ui.button.primary",
    kind: "button-chrome",
    alpha: "ordinary-alpha",
    lifecycle: "primitive",
    nineSlice: { top: 10, right: 24, bottom: 10, left: 24 },
    note: "Reusable primary-action surface derived from the approved black, crimson, and distressed-gold chrome. Labels, icons, focus state, and VFX remain separate slots.",
    build: { source: "12-ui-primitives/button-primary.svg", lossless: true },
    outputPath: "ui/primitives/button-primary.webp",
    width: 240,
    height: 72,
    width2x: 480,
    height2x: 144,
  }),
] satisfies readonly ArtAssetDefinition[];

export const ART_ASSETS: readonly ArtAssetDefinition[] = [
  ...legacyCourtAssets,
  ...legacyJokerAssets,
  ...primitiveFrameAssets,
  ...treasureAssets,
  ...suitIndexAssets,
  ...rankIndexAssets,
  ...gameplayUiRows,
  ...portraits,
  ...chromeAssets,
  ...backdrops,
  ...otherAssets,
];

export const ART_COMPOSITIONS = [
  {
    id: "card-face",
    slots: [
      { slot: "surface", accepts: ["card-surface"], required: true },
      {
        slot: "illustration",
        accepts: ["card-illustration", "legacy-card-face"],
        required: false,
      },
      { slot: "frame", accepts: ["card-frame"], required: true },
      { slot: "rank", accepts: ["rank-index"], required: false },
      { slot: "suit", accepts: ["suit-index"], required: false },
      { slot: "vfx", accepts: ["vfx"], required: false, repeatable: true },
    ],
    note: "VFX is composed outside the opaque card surface. Legacy full faces are allowed only during migration.",
  },
  {
    id: "player-tag",
    slots: [
      { slot: "center", accepts: ["panel-chrome"], required: true },
      {
        slot: "ornament",
        accepts: ["panel-chrome"],
        required: false,
        repeatable: true,
      },
      { slot: "portrait-frame", accepts: ["portrait-frame"], required: true },
      { slot: "portrait", accepts: ["portrait"], required: true },
      {
        slot: "content",
        accepts: ["icon", "button-chrome"],
        required: false,
        repeatable: true,
      },
    ],
  },
  {
    id: "dashboard-panel",
    slots: [
      { slot: "frame", accepts: ["panel-chrome"], required: true },
      {
        slot: "content",
        accepts: ["icon", "banner", "button-chrome"],
        required: false,
        repeatable: true,
      },
    ],
  },
  {
    id: "button",
    slots: [
      { slot: "surface", accepts: ["button-chrome"], required: true },
      { slot: "content", accepts: ["icon"], required: false },
      { slot: "vfx", accepts: ["vfx"], required: false, repeatable: true },
    ],
  },
] as const satisfies readonly ArtCompositionSchema[];

export function validateArtRegistry(
  assets: readonly ArtAssetDefinition<string>[] = ART_ASSETS,
  compositions: readonly ArtCompositionSchema[] = ART_COMPOSITIONS,
): readonly string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();

  for (const asset of assets) {
    if (ids.has(asset.id)) errors.push(`Duplicate asset id: ${asset.id}`);
    ids.add(asset.id);

    if (asset.lifecycle === "planned") {
      if (asset.build !== undefined)
        errors.push(`Planned asset must not have a build recipe: ${asset.id}`);
    } else if (asset.build === undefined) {
      errors.push(`Built asset is missing a build recipe: ${asset.id}`);
    }

    if (asset.outputs.length > 0) {
      const densities = new Set(asset.outputs.map((output) => output.density));
      if (!densities.has(1) || !densities.has(2) || densities.size !== 2) {
        errors.push(`Asset must define exactly one 1x and one 2x output: ${asset.id}`);
      }
    } else if (asset.lifecycle !== "planned") {
      errors.push(`Non-planned asset has no outputs: ${asset.id}`);
    }

    for (const output of asset.outputs) {
      if (paths.has(output.path)) errors.push(`Duplicate output path: ${output.path}`);
      paths.add(output.path);
      if (output.width <= 0 || (output.height !== "auto" && output.height <= 0)) {
        errors.push(`Invalid output dimensions: ${asset.id} ${output.path}`);
      }
      if (output.density === 2 && !output.path.includes("@2x")) {
        errors.push(`2x output path must include @2x: ${asset.id} ${output.path}`);
      }
    }

    if (asset.alpha === "binary-alpha" && asset.build !== undefined) {
      if (asset.build.hardAlpha !== true) {
        errors.push(`Binary-alpha build must harden alpha: ${asset.id}`);
      }
      if (asset.build.lossless !== true) {
        errors.push(`Binary-alpha build must use lossless encoding: ${asset.id}`);
      }
    }
    for (const zone of asset.safeZones ?? []) {
      if (
        zone.x < 0 ||
        zone.y < 0 ||
        zone.width <= 0 ||
        zone.height <= 0 ||
        zone.x + zone.width > 1 ||
        zone.y + zone.height > 1
      ) {
        errors.push(`Safe zone is outside normalized bounds: ${asset.id} ${zone.id}`);
      }
    }
    if (asset.nineSlice !== undefined) {
      const { top, right, bottom, left } = asset.nineSlice;
      if ([top, right, bottom, left].some((inset) => inset < 0)) {
        errors.push(`9-slice insets must be non-negative: ${asset.id}`);
      }
      const output1x = asset.outputs.find((output) => output.density === 1);
      if (
        output1x !== undefined &&
        (left + right >= output1x.width ||
          (output1x.height !== "auto" && top + bottom >= output1x.height))
      ) {
        errors.push(`9-slice insets consume the output: ${asset.id}`);
      }
    }
  }

  const modeledKinds = new Set(assets.map((asset) => asset.kind));
  const compositionIds = new Set<string>();
  for (const composition of compositions) {
    if (compositionIds.has(composition.id)) {
      errors.push(`Duplicate composition id: ${composition.id}`);
    }
    compositionIds.add(composition.id);
    for (const slot of composition.slots) {
      if (
        slot.accepts.length === 0 ||
        !slot.accepts.some((kind) => modeledKinds.has(kind))
      ) {
        errors.push(
          `Composition slot accepts no modeled asset kind: ${composition.id} ${slot.slot}`,
        );
      }
    }
  }

  return errors;
}

const assetById = new Map(ART_ASSETS.map((asset) => [asset.id, asset]));

export function getArtAsset(id: ArtAssetId): ArtAssetDefinition {
  const asset = assetById.get(id);
  if (asset === undefined) throw new Error(`Unknown art asset: ${id}`);
  return asset;
}

export function artAssetPath(id: ArtAssetId, density: 1 | 2 = 1): string {
  const asset = getArtAsset(id);
  const output = asset.outputs.find((candidate) => candidate.density === density);
  if (output === undefined)
    throw new Error(`Art asset is not built at ${density}x: ${id}`);
  return `/art/${output.path}`;
}

export function artAssetSrcSet(id: ArtAssetId): string {
  return `${artAssetPath(id, 1)} 1x, ${artAssetPath(id, 2)} 2x`;
}
