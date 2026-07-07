# Art Direction & Image-Gen Prompt Library

> **Ready-to-paste batches:** every prompt below is also expanded into self-contained,
> copy-paste blocks under [`docs/prompt-batches/`](prompt-batches/) — one file per
> generation batch, numbered in the recommended order. This document remains the design
> bible; the batch files are the working copies.

Persona 5 × Hades rendering, East Asian character-design lens, **four mythologies — one per
suit** (Fate-series style). Every character from every pantheon is drawn through the same
Chinese-opera/wuxia remix so the deck reads as one game; each House carries its own ornament
vocabulary (runes vs meander vs clouds vs hieroglyphs) so suits read at a glance mid-trick.

Court archetypes are consistent across Houses:
- **King** = the pantheon's sovereign
- **Queen** = its iconic great goddess
- **Jack** = its young champion / prodigy
- **Ace** = a legendary relic of that mythology (no character)
- **Jokers** = wildcard tricksters from ANY mythology — they belong to no House

---

## 1. Shared style block

Paste this at the end of every prompt (referred to below as `[STYLE]`):

> **STYLE:** Persona 5 × Hades hybrid illustration. Heavy black ink outlines, high-contrast
> cel shading with painted rim light, dramatic chiaroscuro. Base palette: lacquer black,
> vermilion red, imperial gold, off-white aged-parchment background, plus the House accent
> color. East Asian character design — wuxia and Chinese-opera costuming reinterpreting
> world mythology. Gold filigree frames, chains and gear accents. Confident, theatrical
> expressions; dynamic three-quarter poses; graphic splatter and speedline energy in
> negative space. Flat graphic background, no photorealism, no western realistic fantasy
> armor.

Consistency tips for ChatGPT image gen:
- Generate in the **same conversation** as the reference sheets and say "match the style of the card faces above."
- Card faces: portrait **2:3**. Avatar badges: **1:1**. Banners/logos: **4:3** or **16:9**.
- Ask for "clean edges suitable for cutting out as a game asset, plain parchment background."
- Regenerate characters one at a time for finals; use multi-up sheets only for exploration.

### Card face template

> Ornate playing card **[RANK][SUIT]** for a Chinese trump card game (Shengji/Tractor).
> Half-body character portrait inside a circular ink-wash inset, mirrored rank-and-suit
> indices in opposite corners, thin gold filigree inner frame with **[HOUSE ORNAMENT]**
> corner details. House accent color: **[ACCENT]**. Character: **[CHARACTER DESCRIPTION]**.
> [STYLE]

---

## 2. The four Houses (suit → mythology)

| Suit | House | Mythology | Accent palette | Ornament vocabulary | FX signature |
|------|-------|-----------|----------------|---------------------|--------------|
| ♥ Hearts | House of Olympus | Greek | Vermilion + gold + marble white | Greek key/meander, laurel, olive branch, amphorae | Storm-white lightning crackle, petals |
| ♠ Spades | House of the Ravens | Norse | Black + gold + ice-blue aurora | Runes, knotwork, wolf & raven totems | Aurora ribbons, frost, rune-glow |
| ♦ Diamonds | House of the Celestial Court | Chinese | Crimson + imperial gold + jade | Auspicious clouds (祥云), cash coins, dragons, jade | Gold coin sparks, phoenix fire |
| ♣ Clubs | House of the Two Lands | Egyptian | Green-black + gold + turquoise/lapis | Hieroglyph cartouches, lotus & papyrus, scarabs, wedjat eyes | Sandstream, turquoise glow, sun-disk rays |

Diamonds is the **home pantheon** — the game is Chinese, so the Celestial Court gets the
most saturated red/gold treatment and the base style is "native" to it. The other Houses
are guests rendered through the same lens. Clubs' green-black matches the club courts
already generated; Osiris is literally depicted green-skinned in Egyptian art, so the fit
is canonical.

---

## 3. Court card castings & prompts

### ♥ Hearts — House of Olympus (Greek)

**K♥ — Zeus × The Philanderer Emperor**
> Magnificent, dangerously charming sky-emperor who rules the House of Desire because no
> god has loved more recklessly. Crimson-and-gold imperial robes embroidered with storm
> clouds and thunderbolts, laurel wreath fused into a gold imperial crown, a great black
> eagle perched on his throne back. Holds a gold thunderbolt loosely like a wine cup, a red
> silk ribbon (some admirer's favor) tied around it. A single peacock feather pinned at his
> collar — Hera is always watching. The grin of a king who has never once been told no.
> Ornament: meander + laurel. Accent: vermilion + gold + storm white. [STYLE]

**Q♥ — Aphrodite × Tang Dynasty Beauty**
> Breathtaking goddess born of sea-foam, reimagined as a Tang-court beauty. Layered silk
> gown gradient from sea-foam white at the shoulder to deep vermilion and gold at the hem,
> sash floating in a wave-curl behind her. Holds a bronze mirror-fan reflecting a glowing
> heart. Peony motifs, a pair of red-crowned cranes as her doves, seashell-and-pearl
> hairpin. Amused, devastating gaze straight at the viewer. Ornament: meander + olive
> branch. Accent: vermilion + gold + pearl. [STYLE]

**J♥ — Eros, the Cocky Archer**
> Smirking teenage archer in short red hanfu with gold arrow-fletching embroidery, blindfold
> pushed up onto his forehead (he never needed it). Drawing a short recurve bow with a
> heart-tipped arrow, silk ribbons and petals spiraling off the bowstring. One foot on a
> drifting cloud. Ornament: meander. Accent: vermilion + gold + pink petal. [STYLE]

**A♥ — Relic: The Master Bolt**
> Zeus's thunderbolt as a gold-and-crystal relic hovering point-down over a laurel wreath,
> heart-shaped storm cloud behind it, white lightning crackling into meander patterns.
> No character. [STYLE]

### ♠ Spades — House of the Ravens (Norse)

**K♠ — Odin × The Wandering Allfather**
> One-eyed sovereign of the slain disguised as a road-worn wuxia elder: wide conical
> traveling hat (douli) casting his rune-scarred face in shadow, a single ice-blue eye
> burning beneath it, long grey-black beard braided with gold rings. Black layered robes
> with knotwork embroidery, the spear Gungnir held like a walking staff — its blade forms a
> spade silhouette. Two ravens (Huginn and Muninn) on his shoulders whispering, two wolf
> silhouettes at the frame's edge. Aurora ribbons and floating runes behind. He already
> knows how this game ends. Ornament: runes + knotwork. Accent: black + gold + ice-blue
> aurora. [STYLE]

**Q♠ — Hel × The Half-Veiled Queen**
> Queen of the Norse underworld, split down the center: her right half a breathtaking
> pale empress in black silk with silver knotwork, her left half skeletal and frost-blue,
> elegantly veiled behind funeral gauze and bone ornaments. Both halves smile — differently.
> Holds a black lacquer bowl of mist (the mead of the dead). Frost flowers bloom where her
> hem touches. Ornament: runes + bone filigree. Accent: black + gold + frost blue. [STYLE]

**J♠ — Brynhildr, the Valkyrie**
> Young shieldmaiden mid-descent, wings of black-and-gold feathers flared behind her,
> winged helm pushed back off her fierce grinning face. Lamellar armor over a short black
> war-robe, a spear of ice-blue light couched under one arm, a round rune-etched shield on
> the other. Aurora light streaks trail her dive. She's choosing you for her side.
> Ornament: runes + feathers. Accent: black + gold + aurora. [STYLE]

**A♠ — Relic: Mjölnir**
> Thor's hammer embedded in a rune-carved standing stone shaped subtly like a spade, gold
> lightning grounding into knotwork patterns, aurora sky behind. Short haft wrapped in red
> silk cord (the one Chinese touch). No character. [STYLE]

### ♦ Diamonds — House of the Celestial Court (Chinese — home pantheon)

**K♦ — The Jade Emperor (玉皇大帝)**
> Supreme sovereign of Heaven in maximal imperial splendor: layered gold dragon robes over
> deep crimson, flat-topped mianguan crown with twelve strands of jade beads, a gold
> ruyi scepter across his lap. Seated on a dragon throne wreathed in auspicious clouds,
> celestial bureaucracy scrolls floating in ranks behind him. Composed, faintly weary
> majesty — he has signed ten thousand edicts today. Ornament: 祥云 + coiling dragons.
> Accent: crimson + imperial gold + jade. [STYLE]

**Q♦ — Xiwangmu (西王母), Queen Mother of the West**
> Ageless, regal goddess of immortality with a phoenix crown trailing gold filigree and
> kingfisher-blue inlay. Holds a branch of the immortality peach tree, one luminous peach
> glowing like a lantern. A jade tablet at her sash, attendant crane wings sweeping the
> frame edge. Her smile grants and denies eternity in the same moment. Ornament: 祥云 +
> phoenix. Accent: crimson + gold + kingfisher blue. [STYLE]

**J♦ — Nezha, the Rebel Prodigy**
> Explosive boy-god mid-leap off his wind-fire wheels, twin hair-buns, red armillary sash
> (混天绫) whipping in a full circle around him, fire-point spear spinning. Lotus-petal
> armor pieces over bare arms, cosmic ring at his belt. Grinning with absolutely no respect
> for authority. Flame trails form diamond shapes. Ornament: 祥云 + lotus. Accent: crimson +
> gold + flame. [STYLE]

**A♦ — Relic: The Peach of Immortality**
> A single perfect immortality peach on a jade tray, glowing from within, ringed by strings
> of gold cash coins and auspicious clouds. A bite is missing. No character. [STYLE]

### ♣ Clubs — House of the Two Lands (Egyptian)

**K♣ — Osiris × The Green King Reborn**
> Resurrected king of the afterlife: skin of pale jade-green, wrapped in black-and-gold
> mummification silks restyled as layered court robes, tall atef crown with gold plumes.
> Arms crossed holding the crook and flail — the flail's three strands ending in small club
> shapes. Wheat sheaves and turquoise scarabs at the frame base; a faint seam of gold kintsugi
> lines where he was once cut apart and remade. Serene, unkillable authority. Ornament:
> hieroglyph cartouches + wheat. Accent: green-black + gold + turquoise. [STYLE]

**Q♣ — Isis × The Winged Sorceress**
> Great goddess of magic mid-incantation, vast gold-and-lapis wings spread the full width
> of the frame, throne-glyph crown. Black sheath gown reimagined as an embroidered qipao
> with hieroglyph trim, an ankh glowing in one raised hand, stars swirling into spell-rings
> around the other. The one who out-tricked the sun god and reassembled a king. Ornament:
> hieroglyphs + stars. Accent: green-black + gold + lapis blue. [STYLE]

**J♣ — Horus, the Avenger Prince**
> Sharp-eyed young heir with a falcon-feather half-cloak and gold falcon helm pushed back
> on his brow, one eye ringed with the wedjat marking. Khopesh sickle-sword resting across
> his shoulders, wing-shaped speedlines behind him. He's here to win back his father's
> throne one trick at a time. Ornament: wedjat eyes + falcon feathers. Accent: green-black +
> gold + turquoise. [STYLE]

**A♣ — Relic: The Eye of Ra**
> A gold-and-lapis wedjat eye relic radiating sun-disk rays, cradled in lotus and papyrus
> blooms, scarab beetles of turquoise and gold at its corners. Sand streams upward around
> it, defying gravity. No character. [STYLE]

### Jokers — the Wildcards (any mythology)

The jokers belong to no House. They are the tricksters who crash every pantheon.

**Big Joker — Sun Wukong, the Great Sage Equal of Heaven (齐天大圣)**
> The Monkey King in full havoc glory: golden chainmail vest over a jester-red opera robe,
> phoenix-feather cap with two towering feathers in place of a jester's horns, tiger-skin
> kilt. One foot on a somersault cloud, the gold-banded staff (如意金箍棒) resting across
> his shoulders with both wrists draped over it, tail curled into a question mark. His grin
> has beaten death, the dragon kings, and the entire celestial army. Gold flame FX. He
> outranks the Jade Emperor — exactly as he always claimed he did. Accent: full palette +
> blazing gold. [STYLE]

**Small Joker — Loki, the Uninvited God**
> Sharp-featured Norse trickster in black-and-emerald motley cut like a Chinese-opera
> villain's robe, horned jester crown whose tips curl like serpents, gold bells silent
> mid-swing. A slender snake coils down one arm; he holds up a playing card burning with
> cold green fire, and his cast shadow is the wrong shape — a fox, or maybe a horse. A thin
> scarred seam at the corners of his grin. Cold emerald witch-fire FX (deliberately breaks
> the deck's warm palette). Second-highest card in the game, and absolutely seething about
> it. Accent: full palette + emerald witch-fire. [STYLE]

*Alternate wildcards if you want variant joker skins later: **Anansi** (West African spider
storyteller weaving cards on silk threads), **Eris** (Greek discord queen dangling a golden
peach inscribed 予最美者 — "for the fairest"), **Raven** (Pacific Northwest shapeshifter
stealing the sun as a glowing coin).*

---

## 4. Avatar portrait roster (shield-badge frame)

Avatars are wildcards from ANY mythology — this is where the full Fate-style character pool
lives, including every god displaced from the old all-Greek court layout.

### Badge template

> Player avatar badge for a Chinese trump card game: bust portrait inside the established
> jagged shield-crest frame (spiked gold-edged border, auspicious cloud at lower corners,
> chevron at bottom point). Character: **[CHARACTER DESCRIPTION]**. [STYLE]

### Casting the 8 existing portraits

| Existing portrait | Cast as |
|---|---|
| Guy flicking the A♠, round red glasses | **Hermes** — merchant trickster off-duty |
| Empress with card fan | **Tyche** — fortune goddess reading your hand |
| Pale noble with skulls & teal fire | **Thanatos** — death, but make it fashion |
| Lady with wine glass & fur | **Circe** — enchantress hostess |
| Goggles + wrench girl | **Cyclops forge-apprentice** of Hephaestus |
| Peking-opera headdress beauty | **Medusa** — the pom-pom filaments become snakes in later variants |
| Hooded man with 胜 coin & snake | **Dolos** — spirit of trickery |
| Bearded general with dragon pauldron | **Agamemnon** — banner general |

### The displaced Greek court (reuse as badge prompts)

These were fully written as court cards in the all-Greek layout; drop their descriptions
into the badge template as premium avatars:

**Hades × King Yan (阎罗王)**
> Stern middle-aged emperor of the dead, regal and unbothered. Black imperial dragon robe
> threaded with gold chain embroidery, fused crown: Greek laurel wreath merging into a
> Chinese mianguan with hanging jade-bead curtain (旒) that half-veils his eyes. Holds a
> two-pronged obsidian bident. Three-headed guardian dog rendered as a trio of snarling
> gold foo-dog heads at his shoulder. Ghost-teal soul flames. [STYLE]

**Persephone × Plum Blossom Empress**
> Serene, quietly dangerous empress split between seasons: left half of her robe is black
> winter silk with bare branch embroidery, right half blooms with red plum blossoms.
> Cradles a golden pomegranate, seeds glowing like embers. Narcissus hairpins, spirit
> butterflies. A knowing half-smile — she chose this throne. [STYLE]

**Poseidon × Dragon King of the East Sea (东海龙王)**
> Majestic sea sovereign in deep green-black scale armor chased with gold, subtle dragon
> horns and long whiskers. Trident in hand, a luminous pearl orb floating above his free
> palm, ink-wash tidal wave curling behind. [STYLE]

**Athena × Grand Strategist**
> Composed war-scholar goddess in dark armored robes with owl-motif pauldrons, gold-inlaid
> helm under one arm. Round shield etched with a bagua pattern, a subtle gorgon face at its
> center. Holds a single white weiqi (Go) stone poised mid-move. A small gold owl on her
> shoulder. [STYLE]

**Dionysus, the Wild Guest**
> Grinning, half-drunk young god mid-toast, leopard-pelt half-cloak, ivy and grapes in his
> hair, thyrsus staff as a gnarled vine-club, wine gourd sloshing. Slightly off-balance
> pose that's somehow perfect. [STYLE]

**Hephaestus × Master Artificer**
> Burly soot-streaked smith, magnificent braided beard, leather-and-bronze apron over
> gold-trimmed hanfu. Right arm a masterwork prosthetic of interlocking gold gears (the
> game's tractor-gear motif). Tongs holding a molten diamond, hammer over shoulder. [STYLE]

**Ares × Crimson War Saint**
> Towering war god mid-laugh, wolfish grin, red-and-gold lamellar armor, war paint slash
> across one eye, massive guandao on his shoulder, burning silk war-cape shredding into
> embers. [STYLE]

### Cross-pantheon additions

**Thor × Thunder Brawler**
> Barrel-chested redhead grinning through a braided beard, hammer resting head-down like a
> mallet at a night market, knuckles crackling with lightning, a belt of gold rings, two
> goats' silhouettes butting heads on his pauldron. [STYLE]

**Freyja × Valkyrie Queen**
> Golden-haired war goddess in a falcon-feather cloak half-drawn like a card fan, amber
> necklace (Brísingamen) glowing at her throat, two enormous cats flanking her shoulders in
> the badge frame, expression equal parts love and war. [STYLE]

**Anubis × The Jackal Judge**
> Elegant jackal-masked judge in black-and-gold robes, a small brass scale dangling from
> one finger — a feather on one pan, a playing card on the other. Turquoise eyes glowing
> inside the mask's shadow. [STYLE]

**Bastet × Temple Cat**
> Sleek cat-eared goddess lounging with a gold ankh spinning on one claw, lapis eyeliner,
> a saucer of milk beside a stack of won chips, purring smugness. [STYLE]

**Artemis × Chang'e, the Moon Huntress**
> Cool silver-and-black moon goddess archer, crescent-moon recurve bow across her back,
> white-silver hair with a jade crescent pin. A jade rabbit with a tiny quiver on her
> shoulder. Aloof, faintly amused. [STYLE]

**Amaterasu × The Mirror of Dawn**
> Radiant sun goddess emerging from cave shadow, one half of the badge dark, the other
> blazing gold; holds a bronze mirror reflecting her own light forward, sunburst hairpins,
> magatama beads. [STYLE]

**Anansi × The Story Weaver**
> Wiry old trickster with six extra shadow-arms of spider silhouette behind his two real
> ones, each shadow-hand holding a different card, weaving silk threads between them like
> a cat's cradle, gap-toothed grin. [STYLE]

**Heracles × Tiger-Slayer (武松 energy)**
> Mountain of a man with a tiger pelt knotted over one shoulder, hand-wrapped fists, twelve
> small trophy medallions strung across his chest. Cheerful, terrifying grin. [STYLE]

**The Moirai × Three Seamstresses**
> Three fates sharing one badge: a young woman spinning red thread, a serene woman
> measuring it across her fingers, an old woman with gold scissors poised to cut. The
> single red thread connects all three hands. [STYLE]

**Charon × Lantern Ferryman**
> Gaunt hooded boatman with a long lantern-pole oar, teal ghost-light lantern swinging, a
> single gold coin held between his teeth in a grin. Mist and river reeds at the badge's
> lower edge. [STYLE]

---

## 5. Shengji-specific UI assets (next batch)

These fill gameplay gaps the current sheets don't cover:

**ATTACK / DEFEND team badges (standalone remake)**
> The originals exist only on the mixed UI sheet — regenerate as clean standalone assets.
> ATTACK: jagged red-and-gold arrow bursting diagonally upward through black spike shards
> and red ink-splatter, distressed cream-gold "ATTACK" lettering, black diamond seal
> stamped 攻. DEFEND: heavy gold-and-black shield crowned with gold trim, deep green smoke
> clouds and spike shards, "DEFEND" lettering, green diamond seal stamped 守. [STYLE]

**Point-card glow (5 / 10 / K are worth points)**
> UI FX overlay set: three rectangular card-edge auras in the established FX style (gold
> electric crackle) with small denomination medallions — "5" (5 pts), "10" (10 pts),
> "K" (10 pts) — each medallion a gold coin with red enamel numeral. Parchment background,
> presented as a design sheet. [STYLE]

**Trump declaration burst**
> Explosive UI callout badge: a fist slamming a card down, radial ink-splash and gold
> lightning, banner reading "TRUMP!" with small 主 character seal. Same energy as the
> existing ATTACK badge. [STYLE]

**Kitty / bottom cards (底牌) icon**
> Icon badge: a small stack of face-down cards (premium black back design) tied with a red
> silk cord and wax seal stamped 底, resting on a gold tray, wisps of mystery smoke. [STYLE]

**Level ladder (2 → A)**
> Vertical UI progression track: thirteen small gold rung-medallions (2–10, J, Q, K, A)
> on a chain ladder climbing between clouds; current-level medallion enlarged and burning
> with red flame, A at the summit styled as a tiny throne. [STYLE]

**Team banners**
> Two horizontal team nameplate banners matching the existing nameplate style: "DEFENDERS"
> in deep green-gold with the shield motif and 守, "ATTACKERS" in red-gold with the arrow
> motif and 攻, each with 4 small circular avatar sockets. [STYLE]

**Victory / defeat splash**
> Full-screen splash pair, 16:9. VICTORY: Sun Wukong's silhouette on his cloud above a
> burst of cards and coins, 勝 seal, laurel + cloud frame. DEFEAT: Loki's emerald-lit grin
> looming in storm clouds, scattered face-down cards, muted palette, 敗 seal. [STYLE]

---

## 6. Batch order suggestion

1. **Jokers** (Sun Wukong / Loki) — most-seen cards in Shengji, set the ceiling.
2. **One full House end-to-end (♦ Chinese, the home pantheon)** to validate the
   House-per-mythology system with the ornament vocabulary.
3. **♠ Norse next** — it diverges most from the established Greek-flavored sheets, so it's
   the real test that the unified style lens holds across pantheons.
4. Remaining Houses (♥ Greek, ♣ Egyptian).
5. Trump declaration burst + point-card glows (core gameplay feedback).
6. Avatar roster, 4 at a time on multi-up sheets, then singles for winners.
7. Splash screens last (most expensive to iterate).
