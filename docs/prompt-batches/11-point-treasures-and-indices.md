# Batch 11 — point treasures and clean indices

These are the production prompts used for the eight point-card faces and four
House suit glyphs. Generate each point card with its existing blank number-card
frame as **Image 1 / edit target** and the matching ace as **Image 2 / style
reference**. The generated face must remain opaque. Suit glyphs use a removable
`#FF00FF` field; only the empty field becomes transparent during `art:build`.

## Shared point-card edit prompt

```text
Use case: precise-object-edit
Asset type: opaque full-face game card art for the [RANK] of [SUIT]
Input images: Image 1 is the exact [HOUSE] number-card frame to edit; Image 2 is the style reference.
Primary request: Change only Image 1's empty center into [SUBJECT].
Style/medium: match Image 2's Persona 5 × Hades hybrid, heavy black ink outlines, high-contrast cel shading, imperial gold, aged parchment, and the House accent palette.
Composition/framing: centered treasure silhouette readable at tiny card size; fives are valuable restrained caches, tens are legendary overflowing hoards.
Constraints: preserve Image 1's complete outer frame, dimensions, parchment border, top-left quiet index zone, and bottom-right quiet index zone exactly; opaque full-bleed card; no numeral, no rank, no suit icon, no pips, no letters, no text, no watermark; do not cover or redesign the border.
```

| Card | Subject                                                                                                                                                     |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5♥   | A laurel-wrapped Greek amphora holding golden drachmae and ceremonial jewelry, with marble-white lightning and vermilion enamel accents.                    |
| 10♥  | The Golden Fleece draped over an overflowing Olympian coffer of gold vessels, drachmae, laurel crowns, and gemstones beneath storm-white lightning.         |
| 5♠   | Draupnir displayed on a rune-carved coffer with arm rings, restrained hack-gold, raven feathers, and frost-lit coins.                                       |
| 10♠  | Fafnir and Andvari's legendary cursed hoard beneath the ominous shadow of a coiled dragon, aurora ribbons, and frost-blue rune glow.                        |
| 5♦   | A jade-and-gold wealth bowl holding yuanbao, square-holed cash coins, a jade ruyi, red silk, pearls, and restrained phoenix-fire sparks.                    |
| 10♦  | The Dragon King's underwater treasury: a luminous dragon pearl above gold yuanbao, cash coins, jade seals, coral, jeweled vessels, and water-cloud scrolls. |
| 5♣   | A gold scarab pectoral above a small tomb offering chest with lapis and turquoise amulets, rings, lotus jewelry, and funerary beads.                        |
| 10♣  | A pharaonic treasury centered on a golden funerary mask with crook and flail, canopic treasure, scarab pectorals, lapis vessels, and sun-disk light.        |

## Shared suit-glyph prompt

```text
Use case: stylized-concept
Asset type: fully opaque [SUIT] icon on a removable background for a playing-card corner index
Input images: Image 1 is the current pip reference; Image 2 is the matching House ace style reference.
Primary request: Create one centered, unmistakable [SUIT] symbol, fully filled and fully opaque, with [HOUSE TREATMENT] contained inside its silhouette.
Scene/backdrop: perfectly flat solid #FF00FF chroma-key background for local background removal.
Style/medium: crisp painted game UI glyph matching the Persona 5 × Hades card art.
Composition/framing: single centered icon, generous even padding, strong silhouette readable at 12–20 pixels.
Constraints: background exactly uniform #FF00FF with no texture, shadow, gradient, glow, floor, or reflection; do not use #FF00FF in the icon; icon itself solid and opaque; no badge, backing plate, card frame, letters, numbers, text, watermark, or extra objects.
```

- Hearts: vermilion enamel, black ink silhouette, imperial-gold rim, Greek
  laurel and meander details.
- Spades: black lacquer, imperial-gold knotwork, ice-blue rune and aurora
  details.
- Diamonds: saturated crimson lacquer, imperial-gold auspicious clouds, jade
  details.
- Clubs: green-black lacquer, imperial-gold lotus and hieroglyph details,
  turquoise and lapis scarabs.

Numerals moved to the reusable raster typography primitives documented in
[`13-rank-index-typography.md`](./13-rank-index-typography.md). The old live-font
SVG is intentionally retired so card indices do not depend on Georgia, Times,
or any platform font renderer.
