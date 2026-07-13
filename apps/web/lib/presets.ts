import type { OptionEditability } from "@shengji/engine";

export type PresetSummary = {
  id: string;
  name: string;
  players: number;
  decks: number;
  teamsMode: "fixed" | "finding-friends";
  description: string;
};

export type PresetsResponse = {
  presets: PresetSummary[];
  optionMetadata: OptionEditability[];
};

/** A typed HTTP failure so the caller can offer a retry without parsing text. */
export class PresetsFetchError extends Error {
  readonly status: number;

  constructor(status: number, message = "Could not load game presets") {
    super(message);
    this.name = "PresetsFetchError";
    this.status = status;
  }
}

export async function fetchPresets(): Promise<PresetsResponse> {
  const response = await fetch("/api/presets");
  if (!response.ok) {
    throw new PresetsFetchError(response.status);
  }

  return (await response.json()) as PresetsResponse;
}
