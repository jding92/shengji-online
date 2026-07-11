# Point Treasure Illustration Layers

This batch replaces monolithic point-card renders with borderless, opaque
illustration masters. The card compositor supplies parchment, House frame,
corner indices, interaction states, and any future VFX as separate reusable
assets.

## Shared generation contract

```text
Use case: stylized-concept
Asset type: modular full-card illustration layer for a mythology treasure playing card
Primary request: Create the requested House treasure illustration. A five-point card is a valuable curated cache; a ten-point card is a legendary hoard, expressed through scale, depth, and richness rather than literal item counts.
Style/medium: premium painterly mythological game-card illustration; refined ink-and-gouache detail; warm aged-material integration; clear focal hierarchy at playing-card scale.
Composition/framing: portrait 2:3, full bleed illustration layer. Keep the important subject primarily in the central middle 56% of the canvas. Reserve approximately the top-left 22% and bottom-right 22% as quiet, LIGHT neutral/gold/frost-mist space for overlaid indices. Both index zones must be low-detail, high-readability, and free of important subjects.
Constraints: opaque 1024x1536 portrait master; no playing-card frame; no border; no parchment frame; no corner ornaments; no rank; no numeral; no suit icon; no pips; no typography; no labels; no text; no watermark; no UI; no VFX ring, particles, glow border, or animation effect. The image is an illustration layer intended to sit beneath separate reusable surface, frame, and index assets.
Avoid: card mockup, ornate edge frame, dark or busy index zones, important subjects touching the canvas edge, literal counted groups, pseudo-text, signature.
```

## House subject prompts and selections

| House              | Value | Subject prompt                                                                                                                                                                                                                                                         | Selected master                                                     |
| ------------------ | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Hearts / Greek     |     5 | Laurel-wrapped black-figure amphora filled with golden drachmae, accompanied by a restrained cache of ceremonial jewelry on red cloth. Warm cream limestone and gold light.                                                                                            | `assets/12-point-treasure-illustration-layers/hearts-five-v2.png`   |
| Hearts / Greek     |    10 | The Golden Fleece draped over an overflowing Olympian treasure coffer, with drachmae, laurel jewelry, ceremonial vessels, and red cloth. Monumental Greek treasury, warm cream and gold.                                                                               | `assets/12-point-treasure-illustration-layers/hearts-ten-v2.png`    |
| Spades / Norse     |     5 | Draupnir displayed on a rune-carved coffer with arm rings and restrained frost-lit hack-gold. Pale frost mist and slate-blue stone.                                                                                                                                    | `assets/12-point-treasure-illustration-layers/spades-five-v1.png`   |
| Spades / Norse     |    10 | Fafnir and Andvari's legendary hoard beneath a dragon shadow and cold aurora, overflowing with Norse arm rings, vessels, coins, and rune-carved chests. Pale frost mist in the index zones.                                                                            | `assets/12-point-treasure-illustration-layers/spades-ten-v1.png`    |
| Diamonds / Chinese |     5 | Auspicious carved-jade wealth bowl with yuanbao, ancient cash coins, jade ruyi, pearls, and red silk. Curated cache, pale warm wash in the index zones.                                                                                                                | `assets/12-point-treasure-illustration-layers/diamonds-five-v1.png` |
| Diamonds / Chinese |    10 | The Dragon King's magnificent underwater treasury, centered on a luminous dragon pearl surrounded by jade imperial seals, carved ruyi, coral, gold yuanbao, ancient cash coins, and rich red silk. Underwater palace radiance with pale pearl mist in the index zones. | `assets/12-point-treasure-illustration-layers/diamonds-ten-v1.png`  |
| Clubs / Egyptian   |     5 | Royal winged scarab pectoral in turquoise and lapis with a modest open funerary-gold casket, lapis and carnelian amulets, a broad collar, protective eye charms, and a few ceremonial gold pieces. Sunlit limestone in the index zones.                                | `assets/12-point-treasure-illustration-layers/clubs-five-v1.png`    |
| Clubs / Egyptian   |    10 | Magnificent pharaonic treasury centered on a radiant golden funerary mask, surrounded by crossed royal crook and flail, jeweled canopic vessels, scarab pectorals, lapis collars, turquoise amulets, and overflowing ceremonial gold under a high sun-disk beam.       | `assets/12-point-treasure-illustration-layers/clubs-ten-v1.png`     |

For ten-point prompts, explicitly preserve the matching five-point master's
rendering style and corner geometry while increasing only the hoard's depth,
scale, and richness. Existing full-card renders may be supplied as subject and
palette references only; their frames, indices, and embedded card layout must
not be copied.

## Selection history

| Variant                | Status             | Review note                                                                                                                       |
| ---------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `hearts-five-v1.png`   | Rejected, retained | Subject direction was usable, but the entire image was dark and the top-left/bottom-right index zones were busy and low contrast. |
| `hearts-five-v2.png`   | Selected           | Warm, light limestone field; compact valuable cache; both diagonal index zones remain quiet.                                      |
| `hearts-ten-v1.png`    | Rejected, retained | Legendary-hoard subject was strong, but the black treasury scene left both index zones dark and visually congested.               |
| `hearts-ten-v2.png`    | Selected           | Retains the Golden Fleece hoard while restoring light, quiet diagonal index zones.                                                |
| `spades-five-v1.png`   | Selected           | Clear Draupnir cache with pale frost-mist index zones.                                                                            |
| `spades-ten-v1.png`    | Selected           | Strong legendary escalation and readable frost-mist corners.                                                                      |
| `diamonds-five-v1.png` | Selected           | Clear wealth-bowl cache, borderless composition, and light diagonal index zones.                                                  |
| `diamonds-ten-v1.png`  | Selected           | Luminous pearl focal point and legendary underwater scale with quiet pearl-mist corners.                                          |
| `clubs-five-v1.png`    | Selected           | Restrained scarab cache with a light limestone field and clear index zones.                                                       |
| `clubs-ten-v1.png`     | Selected           | Legendary funerary treasury with a strong mask focal point and light sunlit corners.                                              |

The approved overview is saved at
`assets/12-point-treasure-illustration-layers/approved-treasure-layers-contact-sheet.png`.
