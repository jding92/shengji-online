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
    expect(getPreset("shengji-6p-3d-fixed-experimental")?.visibility).toBe(
      "experimental",
    );
    expect(getPreset("does-not-exist")).toBeUndefined();
  });

  it("hides experimental presets unless requested", () => {
    const production = listPresets();
    expect(production.every((entry) => entry.visibility === "production")).toBe(true);
    expect(production.map((entry) => entry.id)).toContain(DEFAULT_PRESET_ID);
    expect(production.map((entry) => entry.id)).not.toContain(
      "shengji-6p-3d-fixed-experimental",
    );

    const all = listPresets(true);
    expect(all.map((entry) => entry.id)).toContain("shengji-6p-3d-fixed-experimental");
    expect(all).toHaveLength(RULESET_PRESETS.length);
  });
});
