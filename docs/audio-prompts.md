# Audio Direction & SFX Prompt Library

Use these prompts as the sound-design companion to the mythic UI art batches. The target
sound is **lacquer & parchment**: dry, woody, percussive card foley; short silk/guzheng
plucks and low taiko accents; crisp Persona-5-flavored UI snap. Avoid synthy casino
bleeps, slot-machine sparkle, EDM risers, cartoon boings, and glossy mobile-game chimes.

## Technical spec

```text
Primary format: OGG Vorbis
Fallback format: M4A/AAC
Sample rate: 44.1 kHz
Channels: mono for UI/foley, stereo for fanfares and music beds
Length: SFX under 1 second except fanfares at 2-4 seconds
Loudness: about -16 LUFS integrated, true peak at or below -1 dBTFS
Asset path: apps/web/public/audio/
Naming: kebab-case filenames matching these section names
```

Export every short cue as both `.ogg` and `.m4a` when assets are produced. The code
registry currently points at OGG names first; fallbacks can be wired when the first real
audio drop lands.

## card-deal-riffle.ogg

```text
Create a short mono card-deal riffle for a mythic Chinese trick-taking web game. Dry
lacquered playing cards flick quickly across parchment: 3-5 tight paper snaps, light
wooden table resonance, subtle silk sleeve movement. Percussive and tactile, not magical.
Persona-5-style UI sharpness without electronic bleeps. Under 0.8 seconds, 44.1 kHz,
about -16 LUFS integrated, true peak below -1 dBTFS. Clean start and tail, no reverb wash.
```

## card-played.ogg

```text
Create a short mono card-play thwack for a mythic Chinese trick-taking web game. One
lacquered card slapped decisively onto a wooden table over parchment, with a crisp paper
edge snap and low dry knock. Add a tiny guzheng-string tick layered very quietly for
premium UI snap. No casino chip sound, no synth beep. Under 0.45 seconds, 44.1 kHz,
about -16 LUFS integrated, true peak below -1 dBTFS.
```

## trick-won.ogg

```text
Create a short mono trick-won cue for a mythic Chinese trick-taking web game. A quick
silk-and-card sweep whoosh gathers the trick, followed by a restrained gold coin chime
and soft wooden stop. Dry, stylish, lacquer-and-parchment texture; Persona-5-flavored
snap without sounding electronic. Under 0.9 seconds, 44.1 kHz, about -16 LUFS integrated,
true peak below -1 dBTFS. Leave a clean tail.
```

## points-captured.ogg

```text
Create a short mono points-captured cue for a mythic Chinese trick-taking web game. Two or
three small antique coin chimes, warm brass/gold, with a faint paper tally tick underneath.
Elegant and restrained, not slot-machine sparkle. Dry room, no long shimmer. Under 0.7
seconds, 44.1 kHz, about -16 LUFS integrated, true peak below -1 dBTFS.
```

## trump-declared.ogg

```text
Create a short mono trump declaration stinger for a mythic Chinese trick-taking web game.
A low taiko hit lands first, immediately followed by a small gong ring and a tight card
snap accent, like a red seal being stamped onto lacquer. Dramatic but compact, with no
orchestral swell and no synth riser. Under 1 second, 44.1 kHz, about -16 LUFS integrated,
true peak below -1 dBTFS.
```

## kitty-revealed.ogg

```text
Create a short mono kitty-revealed cue for a mythic Chinese trick-taking web game. A small
stack of face-down cards flips over: paper flutter, silk cord slip, subtle wooden tray
tap, and a quiet bronze glint at the end. Mysterious but dry and tactile, not magical
sparkle. Under 0.85 seconds, 44.1 kHz, about -16 LUFS integrated, true peak below -1 dBTFS.
```

## round-ended-victory.ogg

```text
Create a 2-3 second stereo round-victory fanfare for a mythic Chinese trick-taking web
game. Short taiko pickup, bright guzheng flourish, warm gong bloom, and a few restrained
gold coin accents. Triumphant Sun Wukong energy, lacquer black and imperial gold, but
still game-UI sized. No synth lead, no casino jingle. 44.1 kHz, about -16 LUFS integrated,
true peak below -1 dBTFS, clean ending.
```

## round-ended-defeat.ogg

```text
Create a 2-3 second stereo round-defeat sting for a mythic Chinese trick-taking web game.
Muted taiko thud, descending guzheng scrape, dark bronze gong tail, and a dry paper-card
fall at the end. Loki-flavored mischief and loss, restrained rather than melodramatic.
No synth drone, no cartoon failure sound. 44.1 kHz, about -16 LUFS integrated, true peak
below -1 dBTFS, clean ending.
```

## game-over-victory.ogg

```text
Create a 3-4 second stereo game-victory fanfare for a mythic Chinese trick-taking web
game. Bold taiko hits, celebratory guzheng run, gong ring, hand cymbal flash, and a final
lacquer-card snap. Epic but compact: Sun Wukong victory splash, red seal stamp, gold coins,
parchment, and theatrical Persona-5 UI confidence. No EDM, no casino fanfare. 44.1 kHz,
about -16 LUFS integrated, true peak below -1 dBTFS.
```

## game-over-defeat.ogg

```text
Create a 3-4 second stereo game-defeat sting for a mythic Chinese trick-taking web game.
Low taiko heartbeat, cold muted gong, descending plucked strings, dry cards sliding away
on parchment. Dark Loki defeat splash energy with tarnished gold and emerald shadow, but
not horror. No synth pad, no cartoon sad trombone. 44.1 kHz, about -16 LUFS integrated,
true peak below -1 dBTFS.
```

## your-turn.ogg

```text
Create a short mono your-turn chime for a mythic Chinese trick-taking web game. A crisp
woodblock tick, tiny guzheng harmonic, and light gold coin overtone, like the table
quietly pointing at the player. Urgent but polite. Persona-5-style UI snap, no phone
notification beep, no casino sound. Under 0.55 seconds, 44.1 kHz, about -16 LUFS
integrated, true peak below -1 dBTFS.
```

## card-select.ogg

```text
Create a very short mono card-select tick for a mythic Chinese trick-taking web game.
Dry lacquer-card edge click plus tiny bamboo/wood tick, immediate and tactile. It should
feel like selecting a premium playing card, not pressing a digital keypad. Under 0.18
seconds, 44.1 kHz, about -16 LUFS integrated, true peak below -1 dBTFS.
```

## button-press.ogg

```text
Create a short mono button-press cue for a mythic Chinese trick-taking web game. A snappy
lacquer UI click: woodblock tap, paper seal press, and tiny silk swish. Stylish,
Persona-5-flavored, but acoustic and dry. No synth click, no bleep. Under 0.25 seconds,
44.1 kHz, about -16 LUFS integrated, true peak below -1 dBTFS.
```

## lobby-theme.ogg

```text
Create a seamless 60-90 second stereo lobby music loop for a mythic Chinese trick-taking
web game. Lacquer-and-parchment lounge tension: low taiko heartbeat every few bars, sparse
guzheng phrases, dry wood percussion, faint silk movement, warm gong punctuation, and a
confident Persona-5-style rhythmic snap without synth bass or casino gloss. Mood: players
gathering around a mythic card table, stylish but not busy. Loop must connect perfectly
with no audible click, no fade-out, 44.1 kHz, about -16 LUFS integrated, true peak below
-1 dBTFS.
```

## in-round-tension-layer.ogg

```text
Create a seamless 60-90 second stereo in-round tension music loop for a mythic Chinese
trick-taking web game. Minimal dry percussion, muted taiko pulse, plucked guzheng ostinato,
soft wooden ticks, occasional low gong shadow, and subtle silk-ribbon motion. The loop
should support focused card play without stealing attention. Acoustic lacquer-and-parchment
palette, no synth arpeggios, no casino bleeps. Loop must connect perfectly with no audible
click, no fade-out, 44.1 kHz, about -16 LUFS integrated, true peak below -1 dBTFS.
```
