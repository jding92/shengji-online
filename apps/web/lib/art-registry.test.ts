import { describe, expect, test } from "vitest";

import {
  ART_ASSETS,
  ART_ASSET_IDS,
  ART_COMPOSITIONS,
  artAssetPath,
  artAssetSrcSet,
  getArtAsset,
  validateArtRegistry,
  type ArtAssetDefinition,
  type ArtAssetKind,
} from "./art-registry";
import {
  artCardSurface,
  artHouseFrame,
  artJokerFace,
  artTreasureIllustration,
} from "./art";

describe("art registry", () => {
  test("has unique ids, output paths, and valid composition metadata", () => {
    expect(validateArtRegistry()).toEqual([]);
  });

  test("models every reusable primitive family in the migration plan", () => {
    const modeledKinds = new Set(ART_ASSETS.map((asset) => asset.kind));
    const requiredKinds: readonly ArtAssetKind[] = [
      "card-surface",
      "card-frame",
      "card-illustration",
      "rank-index",
      "suit-index",
      "portrait",
      "portrait-frame",
      "panel-chrome",
      "button-chrome",
      "vfx",
    ];

    for (const kind of requiredKinds) expect(modeledKinds.has(kind), kind).toBe(true);
  });

  test("gives every built asset explicit 1x and 2x outputs", () => {
    for (const asset of ART_ASSETS.filter(
      (candidate) => candidate.lifecycle !== "planned",
    )) {
      expect(asset.outputs.map((output) => output.density).sort(), asset.id).toEqual([
        1, 2,
      ]);
      expect(
        asset.outputs.every((output) => output.width > 0),
        asset.id,
      ).toBe(true);
    }
  });

  test("keeps the public-path resolver independent of component hardcoding", () => {
    expect(artAssetPath("card.index.rank.red.10")).toBe(
      "/art/cards/indices/rank-red-10.webp",
    );
    expect(artAssetPath("card.index.suit.spades", 2)).toBe(
      "/art/cards/indices/suit-spades@2x.webp",
    );
    expect(artAssetSrcSet(ART_ASSET_IDS.suitIndex("spades"))).toBe(
      "/art/cards/indices/suit-spades.webp 1x, /art/cards/indices/suit-spades@2x.webp 2x",
    );
    expect(artAssetPath("card.surface.parchment")).toBe(
      "/art/cards/primitives/parchment.webp",
    );
    expect(artAssetPath(ART_ASSET_IDS.houseCardFrame("hearts"), 2)).toBe(
      "/art/cards/primitives/frame-hearts@2x.webp",
    );
    expect(artCardSurface()).toBe("/art/cards/primitives/parchment.webp");
    expect(artHouseFrame("diamonds")).toBe("/art/cards/primitives/frame-diamonds.webp");
    expect(artJokerFace("big")).toBe("/art/cards/joker-big.webp");
    expect(artTreasureIllustration("diamonds", "10")).toBe(
      "/art/cards/illustrations/diamonds-ten-treasure.webp",
    );
  });

  test("marks fully generated aces, courts, and jokers for later decomposition", () => {
    const deferred = ART_ASSETS.filter(
      (asset) => asset.lifecycle === "legacy-deferred",
    );
    expect(deferred).toHaveLength(18);
    expect(deferred.every((asset) => asset.kind === "legacy-card-face")).toBe(true);
    expect(deferred.every((asset) => asset.note?.includes("base registry"))).toBe(true);
  });

  test("ships a shared opaque surface and transparent semantic House frames", () => {
    const surface = getArtAsset(ART_ASSET_IDS.cardSurface);
    expect(surface).toMatchObject({
      kind: "card-surface",
      alpha: "opaque",
      lifecycle: "primitive",
    });
    expect(surface.outputs.map((output) => [output.width, output.height])).toEqual([
      [256, 384],
      [512, 768],
    ]);

    for (const house of ["hearts", "spades", "diamonds", "clubs"] as const) {
      const frame = getArtAsset(ART_ASSET_IDS.houseCardFrame(house));
      expect(frame).toMatchObject({
        kind: "card-frame",
        alpha: "ordinary-alpha",
        lifecycle: "primitive",
        house,
      });
      expect(frame.build?.lossless).toBe(true);
      expect(frame.build?.tightAlpha).toBe(true);
      expect(frame.safeZones?.map((zone) => zone.id)).toEqual([
        "index-top",
        "index-bottom",
      ]);
    }
  });

  test("registers only the approved treasure illustration masters as primitives", () => {
    const selected = {
      hearts: { five: "v2", ten: "v2" },
      spades: { five: "v1", ten: "v1" },
      diamonds: { five: "v1", ten: "v1" },
      clubs: { five: "v1", ten: "v1" },
    } as const;

    for (const house of ["hearts", "spades", "diamonds", "clubs"] as const) {
      for (const rank of ["five", "ten"] as const) {
        const treasure = getArtAsset(ART_ASSET_IDS.treasureIllustration(house, rank));
        expect(treasure).toMatchObject({
          kind: "card-illustration",
          alpha: "opaque",
          lifecycle: "primitive",
          house,
        });
        expect(treasure.build?.source).toBe(
          `12-point-treasure-illustration-layers/${house}-${rank}-${selected[house][rank]}.png`,
        );
        expect(treasure.outputs.map((output) => output.path)).toEqual([
          `cards/illustrations/${house}-${rank}-treasure.webp`,
          `cards/illustrations/${house}-${rank}-treasure@2x.webp`,
        ]);
      }
    }

    const manifestSources = ART_ASSETS.flatMap((asset) =>
      asset.build === undefined ? [] : [asset.build.source],
    );
    expect(manifestSources).not.toContain(
      "12-point-treasure-illustration-layers/hearts-five-v1.png",
    );
    expect(manifestSources).not.toContain(
      "12-point-treasure-illustration-layers/hearts-ten-v1.png",
    );
  });

  test("captures normalized card index safe zones and panel 9-slices", () => {
    const treasure = getArtAsset("card.illustration.hearts.ten-treasure");
    expect(treasure.safeZones?.map((zone) => zone.id)).toEqual([
      "index-top",
      "index-bottom",
    ]);
    expect(getArtAsset("ui.chrome.panel-frame").nineSlice).toEqual({
      top: 48,
      right: 48,
      bottom: 48,
      left: 48,
    });
  });

  test("ships buildable portrait-frame and primary-button primitives", () => {
    expect(getArtAsset(ART_ASSET_IDS.portraitFrame)).toMatchObject({
      kind: "portrait-frame",
      alpha: "ordinary-alpha",
      lifecycle: "primitive",
      build: { source: "12-ui-primitives/portrait-frame-house.svg" },
    });
    expect(getArtAsset(ART_ASSET_IDS.primaryButton)).toMatchObject({
      kind: "button-chrome",
      alpha: "ordinary-alpha",
      lifecycle: "primitive",
      build: { source: "12-ui-primitives/button-primary.svg" },
      nineSlice: { top: 10, right: 24, bottom: 10, left: 24 },
    });
    expect(artAssetSrcSet(ART_ASSET_IDS.portraitFrame)).toContain(
      "portrait-frame-house@2x.webp 2x",
    );
    expect(artAssetSrcSet(ART_ASSET_IDS.primaryButton)).toContain(
      "button-primary@2x.webp 2x",
    );
  });

  test("declares CardFace as ordered reusable slots", () => {
    const cardFace = ART_COMPOSITIONS.find(
      (composition) => composition.id === "card-face",
    );
    expect(cardFace?.slots.map((slot) => slot.slot)).toEqual([
      "surface",
      "illustration",
      "frame",
      "rank",
      "suit",
      "vfx",
    ]);
  });

  test("every composition slot accepts at least one modeled asset kind", () => {
    const modeledKinds = new Set(ART_ASSETS.map((asset) => asset.kind));
    for (const composition of ART_COMPOSITIONS) {
      for (const slot of composition.slots) {
        expect(
          slot.accepts.some((kind) => modeledKinds.has(kind)),
          `${composition.id}.${slot.slot}`,
        ).toBe(true);
      }
    }

    expect(
      validateArtRegistry(
        [
          {
            id: "only-icon",
            kind: "icon",
            alpha: "opaque",
            lifecycle: "planned",
            outputs: [],
          },
        ],
        [
          {
            id: "invalid-composition",
            slots: [{ slot: "vfx", accepts: ["vfx"], required: true }],
          },
        ],
      ),
    ).toContain(
      "Composition slot accepts no modeled asset kind: invalid-composition vfx",
    );
  });

  test("built binary-alpha primitives use hardened lossless output", () => {
    const binaryAssets = ART_ASSETS.filter(
      (asset) => asset.alpha === "binary-alpha" && asset.build !== undefined,
    );
    expect(binaryAssets.length).toBeGreaterThan(0);
    for (const asset of binaryAssets) {
      expect(asset.build?.hardAlpha, asset.id).toBe(true);
      expect(asset.build?.lossless, asset.id).toBe(true);
    }
  });

  test("reports invalid duplicate paths and alpha contracts", () => {
    const invalid: readonly ArtAssetDefinition<string>[] = [
      {
        id: "duplicate",
        kind: "suit-index",
        alpha: "binary-alpha",
        lifecycle: "primitive",
        build: { source: "one.png" },
        outputs: [
          { density: 1, path: "same.webp", width: 10, height: 10, format: "webp" },
          { density: 2, path: "same@2x.webp", width: 20, height: 20, format: "webp" },
        ],
      },
      {
        id: "duplicate",
        kind: "icon",
        alpha: "opaque",
        lifecycle: "primitive",
        build: { source: "two.png" },
        outputs: [
          { density: 1, path: "same.webp", width: 10, height: 10, format: "webp" },
          { density: 2, path: "other@2x.webp", width: 20, height: 20, format: "webp" },
        ],
      },
    ];

    expect(validateArtRegistry(invalid)).toEqual(
      expect.arrayContaining([
        "Binary-alpha build must harden alpha: duplicate",
        "Binary-alpha build must use lossless encoding: duplicate",
        "Duplicate asset id: duplicate",
        "Duplicate output path: same.webp",
      ]),
    );
  });
});
