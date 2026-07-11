import type { CardInstance } from "@shengji/protocol";
import {
  ART_ASSET_IDS,
  artAssetPath,
  artAssetSrcSet,
  type ArtAssetId,
} from "../lib/art-registry";
import type { ArtNumberRank } from "../lib/art";

const NUMBER_RANKS = new Set<ArtNumberRank>([
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
]);

type CardFace = CardInstance["face"];

const LEGACY_RANK_NAMES = {
  A: "ace",
  K: "king",
  Q: "queen",
  J: "jack",
} as const;

export type CardAssetSource = {
  id: ArtAssetId;
  src: string;
  srcSet: string;
};

export type CardFaceLayers = {
  /**
   * Number cards are composed from typed primitives. Aces, courts, and jokers
   * intentionally remain deferred legacy full-face art with embedded indices.
   */
  lifecycle: "composed" | "legacy-deferred";
  surface?: CardAssetSource;
  illustration?: CardAssetSource;
  frame?: CardAssetSource;
  index?: {
    rank: CardAssetSource;
    suit: CardAssetSource;
  };
};

function source(id: ArtAssetId): CardAssetSource {
  return { id, src: artAssetPath(id), srcSet: artAssetSrcSet(id) };
}

export function resolveCardFaceLayers(face: CardFace): CardFaceLayers {
  if (face.kind === "joker") {
    return {
      lifecycle: "legacy-deferred",
      illustration: source(ART_ASSET_IDS.legacyJoker(face.joker)),
    };
  }

  const numberRank = NUMBER_RANKS.has(face.rank as ArtNumberRank)
    ? (face.rank as ArtNumberRank)
    : null;
  if (numberRank === null) {
    const legacyRank = LEGACY_RANK_NAMES[face.rank as keyof typeof LEGACY_RANK_NAMES];
    return {
      lifecycle: "legacy-deferred",
      illustration: source(ART_ASSET_IDS.legacyCardFace(face.suit, legacyRank)),
    };
  }

  const isRed = face.suit === "hearts" || face.suit === "diamonds";
  const index = {
    rank: source(ART_ASSET_IDS.rankIndex(isRed ? "red" : "black", numberRank)),
    suit: source(ART_ASSET_IDS.suitIndex(face.suit)),
  };
  const composed = {
    lifecycle: "composed" as const,
    surface: source(ART_ASSET_IDS.cardSurface),
    frame: source(ART_ASSET_IDS.houseCardFrame(face.suit)),
    index,
  };

  if (numberRank === "5" || numberRank === "10") {
    return {
      ...composed,
      illustration: source(
        ART_ASSET_IDS.treasureIllustration(
          face.suit,
          numberRank === "5" ? "five" : "ten",
        ),
      ),
    };
  }

  return composed;
}

function CardLayerSlot({
  asset,
  layer,
}: {
  asset: CardAssetSource | undefined;
  layer: "parchment" | "illustration" | "frame";
}) {
  return (
    <span
      className={`card-face-layer card-face-${layer}`}
      data-card-layer={layer}
      data-card-asset={asset === undefined ? "none" : asset.id}
      data-card-src={asset === undefined ? undefined : asset.src}
      aria-hidden="true"
    >
      {asset !== undefined && (
        <img src={asset.src} srcSet={asset.srcSet} alt="" draggable={false} />
      )}
    </span>
  );
}

function CardIndex({
  index,
  opposite = false,
}: {
  index: NonNullable<CardFaceLayers["index"]> | undefined;
  opposite?: boolean;
}) {
  return (
    <span
      className={`card-art-index ${opposite ? "card-art-index-opposite" : ""}`}
      data-card-layer={opposite ? "index-bottom-right" : "index-top-left"}
      data-card-index={index === undefined ? "embedded" : "generated"}
      aria-hidden="true"
    >
      {index !== undefined && (
        <>
          <img
            className="card-rank-art"
            data-card-asset={index.rank.id}
            src={index.rank.src}
            srcSet={index.rank.srcSet}
            alt=""
            draggable={false}
          />
          <img
            className="card-suit-art"
            data-card-asset={index.suit.id}
            src={index.suit.src}
            srcSet={index.suit.srcSet}
            alt=""
            draggable={false}
          />
        </>
      )}
    </span>
  );
}

export function CardFace({ face }: { face: CardFace }) {
  const layers = resolveCardFaceLayers(face);

  return (
    <>
      <span
        className="card-surface"
        data-card-layer="surface"
        data-card-asset-lifecycle={layers.lifecycle}
        aria-hidden="true"
      >
        <CardLayerSlot asset={layers.surface} layer="parchment" />
        <CardLayerSlot asset={layers.illustration} layer="illustration" />
        <CardLayerSlot asset={layers.frame} layer="frame" />
        <CardIndex index={layers.index} />
        <CardIndex index={layers.index} opposite />
      </span>
      <span
        className="card-vfx-host"
        data-card-layer="vfx"
        data-card-vfx="disabled"
        aria-hidden="true"
      />
    </>
  );
}
