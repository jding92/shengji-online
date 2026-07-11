import { fourPlayerTwoDeckFixedTeamRuleset } from "./four-player-two-deck.js";
import type { ShengJiRuleset } from "./schema.js";
import { sixPlayerThreeDeckFutureRuleset } from "./six-player-three-deck.js";

export type RulesetPresetEntry = {
  id: string;
  ruleset: ShengJiRuleset;
  visibility: "production" | "experimental";
  description: string;
};

export const DEFAULT_PRESET_ID = "shengji-4p-2d-fixed-v1";

export const RULESET_PRESETS: readonly RulesetPresetEntry[] = [
  {
    id: fourPlayerTwoDeckFixedTeamRuleset.id,
    ruleset: fourPlayerTwoDeckFixedTeamRuleset,
    visibility: "production",
    description: "Four players, two decks, fixed alternating teams.",
  },
  {
    id: sixPlayerThreeDeckFutureRuleset.id,
    ruleset: sixPlayerThreeDeckFutureRuleset,
    visibility: "experimental",
    description: "Six players, three decks, fixed alternating teams (experimental).",
  },
];

export function getPreset(id: string): RulesetPresetEntry | undefined {
  return RULESET_PRESETS.find((entry) => entry.id === id);
}

export function listPresets(includeExperimental = false): RulesetPresetEntry[] {
  return RULESET_PRESETS.filter(
    (entry) => includeExperimental || entry.visibility === "production",
  );
}
