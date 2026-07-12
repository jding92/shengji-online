import { eightPlayerFourDeckFixedTeamRuleset } from "./eight-player-four-deck.js";
import {
  eightPlayerFourDeckFindingFriendsRuleset,
  fivePlayerTwoDeckFindingFriendsRuleset,
  sevenPlayerThreeDeckFindingFriendsRuleset,
  sixPlayerThreeDeckFindingFriendsRuleset,
} from "./finding-friends-presets.js";
import { fourPlayerThreeDeckFixedTeamRuleset } from "./four-player-three-deck.js";
import { fourPlayerTwoDeckFixedTeamRuleset } from "./four-player-two-deck.js";
import type { ShengJiRuleset } from "./schema.js";
import { sixPlayerThreeDeckFixedTeamRuleset } from "./six-player-three-deck.js";

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
    id: fourPlayerThreeDeckFixedTeamRuleset.id,
    ruleset: fourPlayerThreeDeckFixedTeamRuleset,
    visibility: "production",
    description: "Four players, three decks, fixed alternating teams.",
  },
  {
    id: sixPlayerThreeDeckFixedTeamRuleset.id,
    ruleset: sixPlayerThreeDeckFixedTeamRuleset,
    visibility: "production",
    description: "Six players, three decks, fixed alternating teams.",
  },
  {
    id: eightPlayerFourDeckFixedTeamRuleset.id,
    ruleset: eightPlayerFourDeckFixedTeamRuleset,
    visibility: "production",
    description: "Eight players, four decks, fixed alternating teams.",
  },
  // Finding-friends presets: protocol + server wire-up shipped in Phase 3c
  // (CALL_FRIENDS, friend-calling timers, integration coverage), so these are
  // production quality.
  {
    id: fivePlayerTwoDeckFindingFriendsRuleset.id,
    ruleset: fivePlayerTwoDeckFindingFriendsRuleset,
    visibility: "production",
    description: "Five players, two decks, finding friends (one call).",
  },
  {
    id: sixPlayerThreeDeckFindingFriendsRuleset.id,
    ruleset: sixPlayerThreeDeckFindingFriendsRuleset,
    visibility: "production",
    description: "Six players, three decks, finding friends (two calls).",
  },
  {
    id: sevenPlayerThreeDeckFindingFriendsRuleset.id,
    ruleset: sevenPlayerThreeDeckFindingFriendsRuleset,
    visibility: "production",
    description: "Seven players, three decks, finding friends (two calls).",
  },
  {
    id: eightPlayerFourDeckFindingFriendsRuleset.id,
    ruleset: eightPlayerFourDeckFindingFriendsRuleset,
    visibility: "production",
    description: "Eight players, four decks, finding friends (three calls).",
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
