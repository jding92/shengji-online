# Polish roadmap

These recommendations focus on the next layer of acclaimed-indie polish: clearer play,
stronger table presence, better defaults, and production details that make repeat games
feel intentional rather than merely functional.

## Next up

- **Settings panel** — Consolidate sound, music, reduced motion, language, and future
  accessibility controls in one predictable place; the side panel already has a mute
  toggle, so this is mostly information architecture. Effort: M.
- **Colorblind-safe suit accents** — Keep the mythic palette, but add shape / pattern
  redundancy for suit hints and team states so red-gold ornament never carries meaning
  alone. Effort: S.
- **Last-trick viewer** — Let players reopen the completed trick, winner, points, and led
  structure; this reduces confusion in the most common "why did that win?" moment.
  Effort: M.
- **First-run tutorial overlay** — Drive teachable moments from `apps/web/lib/moments.ts`
  so the tutorial appears exactly when a bid, bury, follow obligation, or point capture
  matters. Effort: M.
- **Level-progress ladder in the side panel** — Use the existing level-up ladder art to
  show both teams' current rank, next defender, and what a hold / breakthrough means.
  Effort: S.
- **Room-share polish** — Add a clear invite panel with copy link, QR code, room code, and
  reconnect guidance; private friend rooms live or die by the join flow. Effort: M.
- **Music-bed integration order** — Wire the prompts in `docs/audio-prompts.md` after SFX:
  lobby loop first, then in-round tension, then victory / defeat fanfares. The
  `use-sound-effects.ts` hook already gives the right preference boundary. Effort: M.

## Worth doing

- **Bot personas from the pantheon roster (shipped: seat-keyed persona names).**
- **zh / en full-UI language toggle** — Make the bilingual identity real by localizing all
  labels, errors, tutorial copy, and room flows; keep card symbols and rule terms
  consistent across languages. Effort: L.
- **PWA manifest and install path** — Finish installable app polish once the Batch 09 icon
  set lands: manifest, theme color, iOS metadata, offline shell, and install copy. Effort:
  M.
- **Mobile haptics** — Trigger subtle vibration from the moments layer for your turn,
  trump declaration, trick won, points captured, and game result; honor reduced-motion /
  haptics settings. Effort: S.
- **Emotes and pings** — Add restrained table pings, thanks, nice-play, and hurry cues with
  rate limits; useful in friend rooms without requiring chat moderation. Effort: M.
- **Compact hand readability pass** — Tune mobile card fan spacing, selected-card lift,
  trump treatment, and point glows after the number-card and trump kits land. Effort: M.
- **Round recap upgrade** — Turn the current summary into a short score narrative:
  bottom multiplier, point cards captured, rank movement, and next defenders. Effort: M.

## Horizon

- **Spectator mode** — Add a server-authorized private view for observers with no hidden
  hands, clear seat labels, and delayed / redacted sensitive information as needed.
  Effort: L.
- **Streaming-friendly layout** — Provide a wider table composition with larger trick
  center, persistent scoreboard, room-code hiding, and reduced private-hand exposure for
  broadcasts. Effort: M.
- **Replay and review mode** — Persist enough public state to step through completed
  tricks after a round; this pairs naturally with last-trick viewer and spectator work.
  Effort: L.
- **Rules explanation drawer** — Contextual, phase-aware rule snippets for bidding,
  following, tractors, throws, and bottom scoring; avoid a static manual wall. Effort: M.
- **Account-light identity** — Optional saved display name, avatar choice, sound settings,
  and recent rooms without adding matchmaking or social complexity. Effort: M.
- **Advanced bot style sliders** — Once personas exist, let practice choose conservative,
  aggressive, teaching, or chaotic play profiles while keeping authoritative validation
  unchanged. Effort: L.

## Code hygiene

Keep polish work aligned with existing boundaries: server authority stays in the engine
and room layer, moments drive visual / audio / haptic reactions, and generated art enters
through `assets` plus `apps/web/scripts/build-art.mjs`. Dead `.victory-mark` CSS was
removed in the companion code change; keep future cleanup similarly narrow and documented.
