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
    const ids = RULESET_PRESETS.map((entry) => entry.id);
    expect(ids).toEqual([
      "shengji-4p-2d-fixed-v1",
      "shengji-4p-3d-fixed-v1",
      "shengji-6p-3d-fixed-v1",
      "shengji-8p-4d-fixed-v1",
    ]);
    expect(RULESET_PRESETS.every((entry) => entry.visibility === "production")).toBe(
      true,
    );
  });

  it("lists every registered preset when nothing is experimental", () => {
    // No preset is currently experimental (finding-friends presets land
    // experimental in Phase 3), so the visibility filter is a no-op today —
    // both calls must agree and cover the full registry.
    const production = listPresets();
    const all = listPresets(true);
    expect(production.map((entry) => entry.id)).toEqual(all.map((entry) => entry.id));
    expect(production).toHaveLength(RULESET_PRESETS.length);
    expect(production.map((entry) => entry.id)).toContain(DEFAULT_PRESET_ID);
  });
});
