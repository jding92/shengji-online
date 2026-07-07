# Batch 10 — UI chrome and deck completion

Paste each block one at a time, in the same conversation as your reference sheets.

These prompts fill the remaining deck and UI chrome gaps after Batch 09. Generated PNGs
are opaque, so plan every asset for one of three usable modes: opaque full-bleed art on
parchment, luminance/screen-blend art drawn on pure black for CSS `mix-blend-mode:
screen`, or seamless tileable textures. Source PNGs land under repo-root `assets/`;
filenames should map directly to new manifest rows in `apps/web/scripts/build-art.mjs`
before WebP output is generated under `apps/web/public/art/`.

## Number-card kit — Hearts / House of Olympus

```
Match the established art style of the previous designs in this conversation, especially the Greek Hearts court cards and the premium card back.

Number-card construction kit, portrait 2:3 plus a separate large pip glyph. Create an ornate blank playing-card face for 2 through 10 of hearts: off-white aged-parchment card body, empty quiet center field for programmatic CSS pips, mirrored corner index zones left blank, thin imperial-gold border, Greek meander corners, laurel wreath curls, olive-branch filigree, tiny marble-white lightning accents, and subtle vermilion heart enamel in the frame. Beside it, create one large single heart suit-pip glyph rendered as a bold ink emblem on the exact same parchment tone, suitable for clean CSS compositing over the blank card. Do not place multiple pips, ranks, numbers, letters, or characters.

STYLE: Persona 5 × Hades hybrid illustration — heavy black ink outlines, high-contrast cel shading, lacquer black, vermilion red, imperial gold, marble white, and off-white aged-parchment background. Greek meander and laurel ornamentation, graphic ink-splatter restraint around the border only. Flat graphic background, no photorealism. Clean edges suitable for cutting out as game assets; pip sits on matching parchment tone, no transparency, no drop shadow outside the parchment field.
```

Aspect / size target: 2:3 portrait card blank at 1024 × 1536, plus 1:1 pip glyph at 512 × 512.

## Number-card kit — Spades / House of the Ravens

```
Match the established art style of the previous designs in this conversation, especially the Norse Spades court cards and the premium card back.

Number-card construction kit, portrait 2:3 plus a separate large pip glyph. Create an ornate blank playing-card face for 2 through 10 of spades: off-white aged-parchment card body, empty quiet center field for programmatic CSS pips, mirrored corner index zones left blank, thin imperial-gold border, black lacquer edge accents, Norse rune bands, knotwork corners, raven-feather motifs, and small ice-blue aurora glints worked into the frame. Beside it, create one large single spade suit-pip glyph rendered as a bold ink emblem on the exact same parchment tone, suitable for clean CSS compositing over the blank card. Do not place multiple pips, ranks, numbers, letters, or characters.

STYLE: Persona 5 × Hades hybrid illustration — heavy black ink outlines, high-contrast cel shading, lacquer black, imperial gold, ice-blue aurora accents, and off-white aged-parchment background. Norse runes, knotwork, and raven ornamentation, graphic ink-splatter restraint around the border only. Flat graphic background, no photorealism. Clean edges suitable for cutting out as game assets; pip sits on matching parchment tone, no transparency, no drop shadow outside the parchment field.
```

Aspect / size target: 2:3 portrait card blank at 1024 × 1536, plus 1:1 pip glyph at 512 × 512.

## Number-card kit — Diamonds / House of the Celestial Court

```
Match the established art style of the previous designs in this conversation, especially the Chinese Diamonds court cards and the premium card back.

Number-card construction kit, portrait 2:3 plus a separate large pip glyph. Create an ornate blank playing-card face for 2 through 10 of diamonds: off-white aged-parchment card body, empty quiet center field for programmatic CSS pips, mirrored corner index zones left blank, thin imperial-gold border, saturated crimson lacquer edge accents, auspicious cloud scrolls (祥云), cash-coin chains, tiny jade inlays, and restrained phoenix-flame points in the corners. Beside it, create one large single diamond suit-pip glyph rendered as a bold ink emblem on the exact same parchment tone, suitable for clean CSS compositing over the blank card. Do not place multiple pips, ranks, numbers, letters, or characters.

STYLE: Persona 5 × Hades hybrid illustration — heavy black ink outlines, high-contrast cel shading, lacquer black, crimson, imperial gold, jade accents, and off-white aged-parchment background. Auspicious clouds, cash coins, and Chinese court ornamentation, graphic ink-splatter restraint around the border only. Flat graphic background, no photorealism. Clean edges suitable for cutting out as game assets; pip sits on matching parchment tone, no transparency, no drop shadow outside the parchment field.
```

Aspect / size target: 2:3 portrait card blank at 1024 × 1536, plus 1:1 pip glyph at 512 × 512.

## Number-card kit — Clubs / House of the Two Lands

```
Match the established art style of the previous designs in this conversation, especially the Egyptian Clubs court cards and the premium card back.

Number-card construction kit, portrait 2:3 plus a separate large pip glyph. Create an ornate blank playing-card face for 2 through 10 of clubs: off-white aged-parchment card body, empty quiet center field for programmatic CSS pips, mirrored corner index zones left blank, thin imperial-gold border, green-black lacquer edge accents, Egyptian hieroglyph cartouches, lotus and papyrus corners, tiny turquoise scarab inlays, and restrained sun-disk rays in the frame. Beside it, create one large single club suit-pip glyph rendered as a bold ink emblem on the exact same parchment tone, suitable for clean CSS compositing over the blank card. Do not place multiple pips, ranks, numbers, letters, or characters.

STYLE: Persona 5 × Hades hybrid illustration — heavy black ink outlines, high-contrast cel shading, lacquer black, green-black, imperial gold, turquoise and lapis accents, and off-white aged-parchment background. Egyptian hieroglyph, lotus, papyrus, scarab, and sun-disk ornamentation, graphic ink-splatter restraint around the border only. Flat graphic background, no photorealism. Clean edges suitable for cutting out as game assets; pip sits on matching parchment tone, no transparency, no drop shadow outside the parchment field.
```

Aspect / size target: 2:3 portrait card blank at 1024 × 1536, plus 1:1 pip glyph at 512 × 512.

## Trump treatment kit

```
Match the established art style of the previous designs in this conversation, especially the trump declaration burst, point-card glows, and premium card back.

Trump overlay design sheet, landscape 4:3, with four cleanly separated assets. Asset 1: ornate 2:3 gold-foil trump frame drawn on a pure black background for CSS screen-blend compositing over any card face; filigree must sit only on the border and corners, with the center transparent-looking black. Asset 2: compact-size legibility variant of the same trump frame with thicker gold shapes and fewer thin curls for small cards. Asset 3: small red-and-gold 主 seal medallion on aged parchment, readable at tiny size, like a stamped lacquer coin. Asset 4: optional radial bloom / glow burst drawn on pure black, gold lightning and vermilion ink rays only, no parchment.

STYLE: Persona 5 × Hades hybrid illustration — heavy black ink outlines where parchment is present, high-contrast cel shading, lacquer black, vermilion red, imperial gold, off-white aged-parchment medallion. Gold foil, seal ink, auspicious cloud filigree, graphic speedline energy. Flat graphic background, no photorealism. Clean edges suitable for cutting out as game assets; screen-blend overlay assets must use pure black background with no parchment texture.
```

Aspect / size target: 4:3 design sheet; frame assets crop to 1024 × 1536, seal crops to 512 × 512, burst crops to 1024 × 1024.

## UI chrome kit

```
Match the established art style of the previous designs in this conversation, especially the team banners, nameplate banners, and premium card back.

UI chrome design sheet, landscape 16:9, with clean separation between components. Include a 9-slice-able lacquer panel frame for side panels, menu cards, and modals: ornament concentrated in corners and edges, plain parchment-black center, suitable for 9-slice scaling. Include an inset well texture for score pills, stats, point totals, and buried-bottom tabs: dark lacquer recess with worn gold inner rim and quiet parchment fibers. Include a button set with six states: primary vermilion slab normal and pressed, imperial-gold slab normal and pressed, ghost / outline button normal and pressed. Buttons should be empty of text, with clear bevel change between normal and pressed.

STYLE: Persona 5 × Hades hybrid illustration — heavy black ink outlines, high-contrast cel shading, lacquer black, vermilion red, imperial gold, off-white aged parchment, muted deep-green shadow. Gold filigree ornamentation, auspicious cloud accents, dry ink edge wear. Flat graphic background, no photorealism. Clean edges suitable for cutting out as game assets; opaque full-bleed parchment mode, no transparency assumptions.
```

Aspect / size target: 16:9 design sheet at 1920 × 1080; panel frame crops to scalable 1024 × 768, wells and buttons crop to 512-wide UI strips.

## Nameplate and badge set

```
Match the established art style of the previous designs in this conversation, especially the ATTACK / DEFEND badges and player nameplate banners.

Small UI badge design sheet, landscape 16:9, with generous clean separation so each chip can be cropped by CSS. Include: a landscape nameplate chrome plate about 230 × 82 with empty center for player name; leader 庄 crest seal; bid badge tag; BOT badge chip; small round role tags 攻 and 守; crooked READY ink stamp; disconnected marker with cracked lacquer edge; countdown ring frame with empty center; and 底 count chip. Keep every small asset readable at compact table size, with bold silhouettes and no tiny text except the listed Chinese characters and BOT / READY.

STYLE: Persona 5 × Hades hybrid illustration — heavy black ink outlines, high-contrast cel shading, lacquer black, vermilion red, imperial gold, off-white aged-parchment background, deep green defender accent where useful. Gold filigree ornamentation, seal ink, chipped lacquer, graphic ink-splatter accents. Flat graphic background, no photorealism. Clean edges suitable for cutting out as game assets; opaque parchment mode, designed to be circle-cropped or chip-cropped by CSS.
```

Aspect / size target: 16:9 design sheet at 1920 × 1080; nameplate crops near 460 × 164 @2x, badges and chips crop from 128 × 128 to 384 × 384.

## Phase emblems

```
Match the established art style of the previous designs in this conversation, especially the trump declaration burst and Kitty / bottom cards icon.

Phase emblem design sheet, landscape 4:3, with four cleanly separated assets. Asset 1: bidding 主 tile, compact square tile about 48 px final size, red seal character 主 on gold-lacquer parchment. Asset 2: bottom-exchange 底 tile, compact square tile about 48 px final size, tied-card and tray motif with the character 底. Asset 3: large idle 升 felt watermark drawn on pure black for CSS screen-blend onto the table felt, subtle gold and vermilion ink only, no parchment. Asset 4: trick-impact ring burst drawn on pure black, circular gold brush ring with red speedline cuts and black negative center, made for a screen-blend impact overlay.

STYLE: Persona 5 × Hades hybrid illustration — heavy black ink outlines where parchment is present, high-contrast cel shading, lacquer black, vermilion red, imperial gold, off-white aged-parchment tile surfaces. Gold filigree ornamentation, seal stamps, graphic ink-splatter and speedline energy. Flat graphic background, no photorealism. Clean edges suitable for cutting out as game assets; screen-blend assets must use pure black background.
```

Aspect / size target: 4:3 design sheet; tiles crop to 256 × 256, watermark crops to 1024 × 1024, ring burst crops to 1024 × 1024.

## Toasts and status

```
Match the established art style of the previous designs in this conversation, especially the team banners and UI chrome.

Status UI design sheet, landscape 16:9, with clean separation between horizontal assets. Include a throw-banner frame strip: jagged red-and-gold parchment strip with empty center for throw text and small black shard accents. Include two toast frames: error frame with vermilion danger edge and cracked lacquer corners, notice frame with gold edge and calmer parchment center. Include a connection pill frame with three separate status gems: live gem glowing gold-green, reconnecting gem pulsing vermilion-gold, offline gem dark cracked lacquer with muted gray shine. No full sentences or placeholder text inside the frames.

STYLE: Persona 5 × Hades hybrid illustration — heavy black ink outlines, high-contrast cel shading, lacquer black, vermilion red, imperial gold, off-white aged-parchment background, restrained deep-green live accent, muted gray offline accent. Gold filigree ornamentation, seal ink, graphic splatter and speedline energy. Flat graphic background, no photorealism. Clean edges suitable for cutting out as game assets; opaque full-bleed parchment mode.
```

Aspect / size target: 16:9 design sheet at 1920 × 1080; banner and toast strips crop to 1024 × 256, status gems crop to 256 × 256.

## Decorative table and rules ornaments

```
Match the established art style of the previous designs in this conversation, especially the table felt texture and premium card back.

Decorative ornament design sheet, landscape 16:9, with three cleanly separated assets. Asset 1: table-edge ring ornament drawn on pure black for CSS screen-blend or as a tileable border strip: imperial-gold circular brushwork, vermilion lacquer cuts, subtle House motifs repeating around the ring, center pure black. Asset 2: rules-ribbon divider ornaments, several narrow horizontal parchment-and-gold strips with red seal knots and tiny suit-House details, designed to divide rules text without stealing focus. Asset 3: seamless tileable border strip variant with repeating gold corner ticks and black lacquer scuffs, no obvious seam.

STYLE: Persona 5 × Hades hybrid illustration — heavy black ink outlines where parchment is present, high-contrast cel shading, lacquer black, vermilion red, imperial gold, off-white aged parchment, quiet House accent colors. Gold filigree ornamentation, auspicious cloud curls, meander, runes, hieroglyphs, and knotwork in restrained doses. Flat graphic background, no photorealism. Clean edges suitable for cutting out as game assets; pure-black screen-blend areas must be true black, tileable strip must repeat cleanly.
```

Aspect / size target: 16:9 design sheet at 1920 × 1080; ring crops to 1600 × 1600, dividers crop to 1024 × 160, tile strip crops to 1024 × 128.

## Sheng Ji wordmark logotype

```
Match the established art style of the previous designs in this conversation, especially the app icon mark, trump declaration burst, and premium card back.

Proper Sheng Ji wordmark logotype, landscape 4:3. Create a brush-calligraphy lockup for 升级 as the dominant mark, bold black ink strokes with vermilion seal cuts, imperial-gold edge highlights, and a small crooked red seal stamp of 升 tucked into the composition. Add a compact Latin subline reading "SHENG JI" in distressed gold capitals beneath the Chinese mark. The wordmark should feel like a mythic card-table title, readable at home-screen size and still recognizable in smaller headers. Keep the background plain aged parchment.

STYLE: Persona 5 × Hades hybrid illustration — heavy black ink calligraphy, high-contrast cel-shade highlights, lacquer black, vermilion red, imperial gold, off-white aged-parchment background. Gold filigree restraint, graphic ink-splatter energy, theatrical but legible. Flat graphic background, no photorealism. Clean edges suitable for cutting out as a game asset.
```

Aspect / size target: 4:3 landscape, generate large enough to crop to 1200 × 900 and a wide header-safe 1200 × 360 variant.

## Already queued elsewhere

Do not duplicate these prompts in this batch:

- Batch 09: premium card back, home hero key art, table felt texture, app / PWA icon set,
  and portrait 9:16 victory / defeat splash variants.
- Batches 07 and 08: the remaining 16 avatar portraits.
