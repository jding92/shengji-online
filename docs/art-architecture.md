# Composable art architecture

`apps/web/lib/art-registry.ts` is the source of truth for generated runtime art. It records the
source recipe, 1x/2x outputs, alpha contract, optional safe zones, optional 9-slice metadata, and
lifecycle of every registered asset. `pnpm art:build` consumes that registry directly.

## Composition boundary

Runtime visuals are assembled from named slots rather than treated as indivisible images:

- A card face is surface, optional illustration, House frame, rank, suit, and an external VFX layer.
- A player tag is center, ornament, portrait frame, portrait, and content.
- Panels and buttons keep chrome separate from typography, icons, state, and VFX.

The first reusable UI primitives are now source-controlled SVG layers under
`assets/12-ui-primitives`: a transparent House portrait surround and a nine-slice primary-button
surface. Both are built at 1x/2x through the registry and are explicit replaceable slots in
`ChromePortrait` and `ChromeButton`; portraits, labels, icons, focus states, and VFX remain live
independent content.

The card surface must remain opaque. Index primitives use binary alpha: empty pixels are fully
transparent and every visible glyph pixel is fully opaque. Ordinary alpha is reserved for artwork
that intentionally needs soft edges, such as atmospheric VFX and the narrow antialias contour of
an extracted ornament frame; it must not make a card surface translucent.

## Migration lifecycle

- `primitive`: reusable now.
- `temporary-composite`: usable during migration but still contains layers that must be split.
- `legacy-deferred`: existing full render retained for compatibility and intentionally scheduled
  for decomposition later.
- `planned`: a typed slot exists, but no runtime output is claimed yet.

The existing aces, court cards, and jokers are `legacy-deferred`. They remain unchanged until the
base registry and CardFace compositor are stable; a later art pass will separate their surface,
illustration, House frame, and indices. Number cards now compose the shared parchment surface, an
optional approved treasure illustration, one of four transparent House frames, and generated
indices. The former blank-card and full-card treasure compatibility composites are no longer
runtime assets.

## Adding art

1. Add the source master under `/assets` and its reproducible prompt under `docs/prompt-batches`.
2. Register one semantic asset id and its build recipe. Do not add a parallel manifest row.
3. Choose the strictest honest alpha contract and add safe-zone or 9-slice metadata when relevant.
4. Run `pnpm art:build`, the focused registry/art tests, and the web typecheck.
