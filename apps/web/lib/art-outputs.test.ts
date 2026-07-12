import { access } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, test } from "vitest";

import { ART_ASSETS } from "./art-registry";

const assetsRoot = path.resolve(process.cwd(), "../../assets");
const publicArtRoot = path.resolve(process.cwd(), "public/art");

describe("built art outputs", () => {
  test("registered sources and outputs exist with their declared file metadata", async () => {
    const buildableAssets = ART_ASSETS.filter((asset) => asset.build !== undefined);

    expect(buildableAssets.length).toBeGreaterThan(0);

    for (const asset of buildableAssets) {
      await expect(
        access(path.join(assetsRoot, asset.build!.source)),
        `${asset.id} source`,
      ).resolves.toBeUndefined();

      for (const output of asset.outputs) {
        const metadata = await sharp(path.join(publicArtRoot, output.path)).metadata();

        expect(metadata.format, output.path).toBe(output.format);
        expect(metadata.width, output.path).toBe(output.width);
        if (output.height !== "auto") {
          expect(metadata.height, output.path).toBe(output.height);
        }
      }
    }
  });
});
