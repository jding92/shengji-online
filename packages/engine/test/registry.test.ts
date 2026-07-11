import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRESET_ID,
  RULESET_PRESETS,
  getPreset,
  listPresets,
} from "../src/index.js";

describe("ruleset registry", () => {
  it("exposes the 4p/2d preset as the default id", () => {
    expect(DEFAULT_PRESET_ID).toBe("shengji-4p-2d-fixed-v1");
    expect(getPreset(DEFAULT_PRESET_ID)?.visibility).toBe("production");
  });

  it("looks presets up by id", () => {
    expect(getPreset("shengji-6p-3d-fixed-v1")?.visibility).toBe("production");
    expect(getPreset("shengji-4p-3d-fixed-v1")?.visibility).toBe("production");
    expect(getPreset("shengji-8p-4d-fixed-v1")?.visibility).toBe("production");
    expect(getPreset("does-not-exist")).toBeUndefined();
  });

  it("registers all four multi-deck/large-table presets as production", () => {
    const productionIds = RULESET_PRESETS.filter(
      (entry) => entry.visibility === "production",
    ).map((entry) => entry.id);
    expect(productionIds).toEqual([
      "shengji-4p-2d-fixed-v1",
      "shengji-4p-3d-fixed-v1",
      "shengji-6p-3d-fixed-v1",
      "shengji-8p-4d-fixed-v1",
    ]);
  });

  it("registers the finding-friends presets as experimental until Phase 3c", () => {
    const experimentalIds = RULESET_PRESETS.filter(
      (entry) => entry.visibility === "experimental",
    ).map((entry) => entry.id);
    expect(experimentalIds).toEqual([
      "shengji-ff-5p-2d-v1",
      "shengji-ff-6p-3d-v1",
      "shengji-ff-7p-3d-v1",
      "shengji-ff-8p-4d-v1",
    ]);
  });

  it("hides experimental presets unless explicitly included", () => {
    const production = listPresets();
    const all = listPresets(true);
    expect(production.every((entry) => entry.visibility === "production")).toBe(true);
    expect(production.map((entry) => entry.id)).toContain(DEFAULT_PRESET_ID);
    expect(all).toHaveLength(RULESET_PRESETS.length);
    expect(all.map((entry) => entry.id)).toContain("shengji-ff-5p-2d-v1");
  });
});
