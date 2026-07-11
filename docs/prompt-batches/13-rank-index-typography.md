# Batch 13 — rank index typography primitives

This batch replaces the temporary Georgia / Times SVG with committed raster
masters for ranks `2` through `10`. The generated shape is produced once in
black and recolored locally for red, so both tones share pixel-identical
geometry. Every master is a `512 × 640` binary-alpha PNG: empty pixels are fully
transparent and glyph pixels are fully opaque, flat, and precolored.

## Style references

The image model receives these four existing court cards as style references
only. The large top-left rank letters are the typography target:

- `assets/04-hearts-greek/04-hearts-greek-queen.png` — red `Q`
- `assets/02-diamonds-chinese/02-diamonds-chinese-jack.png` — red `J`
- `assets/03-spades-norse/03-spades-norse-king.png` — black `K`
- `assets/05-clubs-egyptian/05-clubs-egyptian-queen.png` — black `Q`

## Per-rank generation prompt

Run the built-in image generation tool once per `[RANK]` in
`2, 3, 4, 5, 6, 7, 8, 9, 10`, with all four references attached.

```text
Use case: stylized-concept
Asset type: game playing-card corner-index numeral master
Input images: all four images are style references only; study only the large top-left court-card rank letters Q, J, K.
Primary request: render exactly one numeral: "[RANK]". It must be a tall, compact, high-contrast traditional playing-card serif glyph derived from the reference rank-letter vocabulary: narrow body, strong vertical stress, sharp wedge/bracketed serifs, authoritative inked silhouette. Flat solid near-black #17130F fill only.
Scene/backdrop: perfectly flat solid #FF00FF chroma-key background for local removal.
Composition/framing: one upright centered numeral filling about 70% of a 1024x1024 square, with generous even padding and no clipping.
Constraints: render the character [RANK] exactly once; fully opaque flat glyph; perfectly uniform background; no texture, gradient, lighting, shadow, glow, outline, bevel, gold, ornament, distress, card frame, suit icon, letters, punctuation, badge, watermark, or extra marks. Do not use magenta inside the glyph. This is a clean isolated typographic glyph, not a card image. For 10, keep the two digits tightly kerned as one compact rank mark while preserving two distinct readable digits.
```

Save the selected chroma outputs as
`assets/13-rank-index-typography/chroma/rank-[RANK]-chroma.png`.

## Local normalization and alpha contract

Run `pnpm art:ranks`. The deterministic processor:

1. separates the near-black glyph from the magenta field by color distance;
2. trims and normalizes every rank to a shared `512 × 640` canvas;
3. hardens the silhouette to binary alpha;
4. replaces every visible RGB pixel with either black `#17130F` or red
   `#9C1724` instead of retaining chroma-contaminated antialias pixels; and
5. emits `rank-black-[RANK].png` and `rank-red-[RANK].png` with identical alpha
   masks.

This intentionally rejects translucent antialiasing and chroma fringe. The
production art registry reads the 18 normalized PNG masters and `pnpm
art:build` emits the 36 lossless `1×` / `2×` WebPs under
`apps/web/public/art/cards/indices/`.

The visual QA sheet is
`docs/art-qa/13-rank-index-typography-contact-sheet.png`.
