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

/** The set of `OPTION_METADATA` keys editable while in `phase`, dotted timers included. */
export function editableOptionKeySet(phase: GamePhase): Set<string> {
  const bucket = phase === "lobby" ? "lobby" : "in-game";
  const keys = new Set<string>();
  for (const meta of OPTION_METADATA) {
    if (meta.editableIn.includes(bucket)) keys.add(meta.key);
  }
  return keys;
}

/** Structural equality for the small JSON-safe shapes `GameOptions` leaves hold. */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, index) => valuesEqual(value, b[index]))
    );
  }
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(aRecord), ...Object.keys(bRecord)]);
    return [...keys].every((key) => valuesEqual(aRecord[key], bRecord[key]));
  }
  return false;
}

/**
 * The `OPTION_METADATA` keys that differ between two option bags. `timers` is
 * compared leaf-by-leaf (`"timers.playTimeoutSeconds"`, ...) so the result
 * lines up 1:1 with `OPTION_METADATA` entries; every other key is compared as
 * a whole (a change anywhere inside `scoring` or `throwPenalty` reports that
 * top-level key, since neither is in-game editable regardless of which leaf
 * moved).
 */
export function diffOptionKeys(a: GameOptions, b: GameOptions): string[] {
  const topKeys = new Set<keyof GameOptions>([
    ...(Object.keys(a) as (keyof GameOptions)[]),
    ...(Object.keys(b) as (keyof GameOptions)[]),
  ]);
  const diffs: string[] = [];
  for (const key of topKeys) {
    if (key === "timers") {
      const timerKeys = new Set([
        ...Object.keys(a.timers ?? {}),
        ...Object.keys(b.timers ?? {}),
      ]);
      for (const timerKey of timerKeys) {
        const av = (a.timers as Record<string, unknown> | undefined)?.[timerKey];
        const bv = (b.timers as Record<string, unknown> | undefined)?.[timerKey];
        if (!valuesEqual(av, bv)) diffs.push(`timers.${timerKey}`);
      }
      continue;
    }
    if (!valuesEqual(a[key], b[key])) diffs.push(key);
  }
  return diffs;
}
