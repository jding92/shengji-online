import { ART_ASSET_IDS, artAssetPath, type ArtAssetId } from "./art-registry";

/**
 * V1 table portraits are deliberately assigned to physical seats, not player
 * accounts. This keeps private rooms and practice bots visually consistent
 * without introducing a profile or character-selection system.
 */
export const SEAT_PORTRAIT_IDS = [
  "hadesKingYan",
  "persephonePlumBlossom",
  "poseidonDragonKing",
  "athenaGrandStrategist",
] as const;

export type SeatPortraitId = (typeof SEAT_PORTRAIT_IDS)[number];

const SEAT_PORTRAIT_ASSETS = {
  hadesKingYan: ART_ASSET_IDS.portrait("hades-king-yan"),
  persephonePlumBlossom: ART_ASSET_IDS.portrait("persephone-plum-blossom"),
  poseidonDragonKing: ART_ASSET_IDS.portrait("poseidon-dragon-king"),
  athenaGrandStrategist: ART_ASSET_IDS.portrait("athena-grand-strategist"),
} as const satisfies Record<SeatPortraitId, ArtAssetId>;

export function portraitForSeat(seat: number): {
  id: SeatPortraitId;
  assetId: (typeof SEAT_PORTRAIT_ASSETS)[SeatPortraitId];
  src: string;
  src2x: string;
} {
  const id = SEAT_PORTRAIT_IDS[seat % SEAT_PORTRAIT_IDS.length]!;
  const assetId = SEAT_PORTRAIT_ASSETS[id];
  return {
    id,
    assetId,
    src: artAssetPath(assetId, 1),
    src2x: artAssetPath(assetId, 2),
  };
}
