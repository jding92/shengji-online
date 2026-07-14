import type { GameMoment } from "./moments";

/**
 * Sound assets drop in by placing files under `public/audio/` and filling the
 * matching registry entry. The sound hook reads this registry directly, so no
 * other code changes are needed when the first audio files land.
 */
export type SoundEvent =
  | GameMoment["type"]
  | "FRIEND_REVEALED"
  | "YOUR_TURN"
  | "CARD_SELECT"
  | "BUTTON_PRESS";

export const SOUND_REGISTRY: Record<
  SoundEvent,
  { src: string; volume: number } | null
> = {
  // TODO(audio): trump declaration stinger -- prompt in docs/audio-prompts.md §trump-declared.ogg
  TRUMP_DECLARED: null,
  // TODO(audio): card play thwack -- prompt in docs/audio-prompts.md §card-played.ogg
  CARD_PLAYED: null,
  // TODO(audio): friend reveal stamp -- prompt to be written when audio lands.
  FRIEND_REVEALED: null,
  // TODO(audio): trick sweep whoosh + coin chime -- prompt in docs/audio-prompts.md §trick-won.ogg
  TRICK_WON: null,
  // TODO(audio): points coin-chime -- prompt in docs/audio-prompts.md §points-captured.ogg
  POINTS_CAPTURED: null,
  // TODO(audio): kitty flip -- prompt in docs/audio-prompts.md §kitty-revealed.ogg
  KITTY_REVEALED: null,
  // TODO(audio): round victory/defeat fanfare -- prompt in docs/audio-prompts.md §round-ended-victory.ogg / §round-ended-defeat.ogg
  ROUND_ENDED: null,
  // TODO(audio): game victory/defeat fanfare -- prompt in docs/audio-prompts.md §game-over-victory.ogg / §game-over-defeat.ogg
  GAME_OVER: null,
  // TODO(audio): your-turn chime -- prompt in docs/audio-prompts.md §your-turn.ogg
  YOUR_TURN: null,
  // TODO(audio): card select tick -- prompt in docs/audio-prompts.md §card-select.ogg
  CARD_SELECT: null,
  // TODO(audio): button press -- prompt in docs/audio-prompts.md §button-press.ogg
  BUTTON_PRESS: null,
};
