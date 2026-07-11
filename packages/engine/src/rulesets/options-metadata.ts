import type { GamePhase } from "../state/model.js";
import type { GameOptions } from "./options.js";

export type OptionEditability = {
  key: keyof GameOptions | `timers.${string}`;
  editableIn: ("lobby" | "in-game")[];
  /** Enum on purpose; "consensus" is reserved for a future authority model. */
  authority: "host";
  /** Whether applying the change resets every player's ready state. */
  requiresReReady: boolean;
};

/**
 * v1 classification: everything is lobby-editable, host-only, re-ready-required.
 * The only in-game-safe keys are the individual timers, which are read on every
 * reschedule and so never invalidate a live round. Bot difficulty and pacing are
 * server-level knobs (Phase 4), not part of this options bag.
 */
export const OPTION_METADATA: readonly OptionEditability[] = [
  {
    key: "playerCount",
    editableIn: ["lobby"],
    authority: "host",
    requiresReReady: true,
  },
  { key: "deckCount", editableIn: ["lobby"], authority: "host", requiresReReady: true },
  { key: "teamsMode", editableIn: ["lobby"], authority: "host", requiresReReady: true },
  {
    key: "friendCallCount",
    editableIn: ["lobby"],
    authority: "host",
    requiresReReady: true,
  },
  {
    key: "bottomSize",
    editableIn: ["lobby"],
    authority: "host",
    requiresReReady: true,
  },
  {
    key: "startingRank",
    editableIn: ["lobby"],
    authority: "host",
    requiresReReady: true,
  },
  {
    key: "gameEndsOnSuccessfulDefenseAt",
    editableIn: ["lobby"],
    authority: "host",
    requiresReReady: true,
  },
  {
    key: "mustDefendRanks",
    editableIn: ["lobby"],
    authority: "host",
    requiresReReady: true,
  },
  { key: "scoring", editableIn: ["lobby"], authority: "host", requiresReReady: true },
  {
    key: "throwPenalty",
    editableIn: ["lobby"],
    authority: "host",
    requiresReReady: true,
  },
  {
    key: "allowNoTrumpJokerBid",
    editableIn: ["lobby"],
    authority: "host",
    requiresReReady: true,
  },
  {
    key: "minimumJokerBidCount",
    editableIn: ["lobby"],
    authority: "host",
    requiresReReady: true,
  },
  {
    key: "maxRedeals",
    editableIn: ["lobby"],
    authority: "host",
    requiresReReady: true,
  },
  {
    key: "timers.playTimeoutSeconds",
    editableIn: ["lobby", "in-game"],
    authority: "host",
    requiresReReady: false,
  },
  {
    key: "timers.disconnectedTimeoutSeconds",
    editableIn: ["lobby", "in-game"],
    authority: "host",
    requiresReReady: false,
  },
  {
    key: "timers.postDealWindowSeconds",
    editableIn: ["lobby", "in-game"],
    authority: "host",
    requiresReReady: false,
  },
  {
    key: "timers.responseWindowSeconds",
    editableIn: ["lobby", "in-game"],
    authority: "host",
    requiresReReady: false,
  },
];

/** The top-level `GameOptions` keys a host may change while in `phase`. */
export function optionsEditableInPhase(phase: GamePhase): (keyof GameOptions)[] {
  const bucket = phase === "lobby" ? "lobby" : "in-game";
  const keys = new Set<keyof GameOptions>();
  for (const meta of OPTION_METADATA) {
    if (!meta.editableIn.includes(bucket)) continue;
    const topKey = meta.key.includes(".")
      ? (meta.key.split(".")[0] as keyof GameOptions)
      : (meta.key as keyof GameOptions);
    keys.add(topKey);
  }
  return [...keys];
}
