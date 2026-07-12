import { describe, expect, it } from "vitest";
import {
  diffOptionKeys,
  editableOptionKeySet,
  optionsEditableInPhase,
} from "../src/index.js";

describe("diffOptionKeys", () => {
  it("reports nothing for identical (including empty) option bags", () => {
    expect(diffOptionKeys({}, {})).toEqual([]);
    expect(diffOptionKeys({ maxRedeals: 3 }, { maxRedeals: 3 })).toEqual([]);
  });

  it("reports a changed scalar top-level key", () => {
    expect(diffOptionKeys({ maxRedeals: 3 }, { maxRedeals: 4 })).toEqual([
      "maxRedeals",
    ]);
  });

  it("reports a key present in only one side", () => {
    expect(diffOptionKeys({}, { bottomSize: 8 })).toEqual(["bottomSize"]);
    expect(diffOptionKeys({ bottomSize: 8 }, {})).toEqual(["bottomSize"]);
  });

  it("compares timers leaf-by-leaf as dotted keys", () => {
    const diffs = diffOptionKeys(
      { timers: { playTimeoutSeconds: 30, responseWindowSeconds: 10 } },
      { timers: { playTimeoutSeconds: 45, responseWindowSeconds: 10 } },
    );
    expect(diffs).toEqual(["timers.playTimeoutSeconds"]);
  });

  it("reports every changed timer leaf independently", () => {
    const diffs = diffOptionKeys(
      { timers: { playTimeoutSeconds: 30 } },
      { timers: { playTimeoutSeconds: 45, responseWindowSeconds: 20 } },
    );
    expect(diffs.sort()).toEqual(
      ["timers.playTimeoutSeconds", "timers.responseWindowSeconds"].sort(),
    );
  });

  it("reports a whole-object key when any leaf inside it changes", () => {
    expect(
      diffOptionKeys(
        { throwPenalty: { defenderFailedThrow: -2, attackerFailedThrow: -2 } },
        { throwPenalty: { defenderFailedThrow: -4, attackerFailedThrow: -2 } },
      ),
    ).toEqual(["throwPenalty"]);
    expect(
      diffOptionKeys({ scoring: { bandSize: 40 } }, { scoring: { bandSize: 50 } }),
    ).toEqual(["scoring"]);
  });

  it("treats reordered array elements as a difference", () => {
    expect(
      diffOptionKeys(
        { mustDefendRanks: ["5", "10"] },
        { mustDefendRanks: ["10", "5"] },
      ),
    ).toEqual(["mustDefendRanks"]);
    expect(
      diffOptionKeys(
        { mustDefendRanks: ["5", "10"] },
        { mustDefendRanks: ["5", "10"] },
      ),
    ).toEqual([]);
  });
});

describe("editableOptionKeySet", () => {
  it("includes structural keys only in the lobby bucket", () => {
    const lobbyKeys = editableOptionKeySet("lobby");
    expect(lobbyKeys.has("bottomSize")).toBe(true);
    expect(lobbyKeys.has("maxRedeals")).toBe(true);
    expect(lobbyKeys.has("timers.playTimeoutSeconds")).toBe(true);
  });

  it("restricts non-lobby phases to timers", () => {
    const inGameKeys = editableOptionKeySet("playing");
    expect(inGameKeys.has("bottomSize")).toBe(false);
    expect(inGameKeys.has("maxRedeals")).toBe(false);
    expect(inGameKeys.has("timers.playTimeoutSeconds")).toBe(true);
    expect(inGameKeys.has("timers.disconnectedTimeoutSeconds")).toBe(true);
    // Every non-lobby phase collapses to the same "in-game" bucket.
    expect(editableOptionKeySet("bottom-exchange")).toEqual(inGameKeys);
    expect(editableOptionKeySet("round-scoring")).toEqual(inGameKeys);
  });

  it("agrees with optionsEditableInPhase on the top-level keys it exposes", () => {
    const topLevelInGameKeys = new Set(optionsEditableInPhase("playing"));
    expect(topLevelInGameKeys).toEqual(new Set(["timers"]));
  });
});
