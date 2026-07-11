import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CardFace, resolveCardFaceLayers } from "./card-face";

describe("CardFace", () => {
  test("keeps the reusable layer contract stable for an ordinary number card", () => {
    const markup = renderToStaticMarkup(
      <CardFace face={{ kind: "standard", suit: "hearts", rank: "3" }} />,
    );

    expect(markup).toContain('data-card-layer="surface"');
    expect(markup).toContain('data-card-layer="parchment"');
    expect(markup).toContain('data-card-asset="card.surface.parchment"');
    expect(markup).toContain(
      'srcSet="/art/cards/primitives/parchment.webp 1x, /art/cards/primitives/parchment@2x.webp 2x"',
    );
    expect(markup).toContain('data-card-layer="frame"');
    expect(markup).toContain('data-card-asset="card.frame.hearts.ornament"');
    expect(markup).toContain('data-card-layer="index-top-left"');
    expect(markup).toContain('data-card-layer="index-bottom-right"');
    expect(markup).toContain('data-card-index="generated"');
    expect(markup).toContain('data-card-layer="vfx"');
    expect(markup.indexOf('data-card-layer="vfx"')).toBeGreaterThan(
      markup.indexOf("</span>"),
    );
    expect(markup).not.toContain("card-corner");
    expect(markup).not.toContain("number-pips");
  });

  test("composes an approved treasure illustration between surface and frame", () => {
    const markup = renderToStaticMarkup(
      <CardFace face={{ kind: "standard", suit: "clubs", rank: "10" }} />,
    );

    expect(markup).toContain('data-card-asset-lifecycle="composed"');
    expect(markup).toContain('data-card-asset="card.illustration.clubs.ten-treasure"');
    expect(markup).toContain("/art/cards/illustrations/clubs-ten-treasure.webp");
    expect(markup).toContain('data-card-asset="card.frame.clubs.ornament"');
    expect(markup).toContain('data-card-layer="index-top-left"');
    expect(markup).toContain('data-card-vfx="disabled"');
  });

  test("resolves every numbered House card through the shared composition contract", () => {
    const suits = ["hearts", "spades", "diamonds", "clubs"] as const;
    const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10"] as const;

    for (const suit of suits) {
      for (const rank of ranks) {
        const layers = resolveCardFaceLayers({ kind: "standard", suit, rank });
        const markup = renderToStaticMarkup(
          <CardFace face={{ kind: "standard", suit, rank }} />,
        );
        const isTreasure = rank === "5" || rank === "10";

        const tone = suit === "hearts" || suit === "diamonds" ? "red" : "black";
        expect(layers.lifecycle, `${suit} ${rank}`).toBe("composed");
        expect(layers.surface?.id, `${suit} ${rank} surface`).toBe(
          "card.surface.parchment",
        );
        expect(layers.index, `${suit} ${rank}`).toBeDefined();
        expect(layers.index?.rank.id, `${suit} ${rank} rank`).toBe(
          `card.index.rank.${tone}.${rank}`,
        );
        expect(layers.index?.suit.id, `${suit} ${rank} suit`).toBe(
          `card.index.suit.${suit}`,
        );
        expect(layers.frame?.id, `${suit} ${rank} frame`).toBe(
          `card.frame.${suit}.ornament`,
        );
        expect(layers.illustration !== undefined, `${suit} ${rank} illustration`).toBe(
          isTreasure,
        );
        if (isTreasure) {
          expect(layers.illustration?.id, `${suit} ${rank} illustration id`).toBe(
            `card.illustration.${suit}.${rank === "5" ? "five" : "ten"}-treasure`,
          );
        }
        expect(markup, `${suit} ${rank} surface srcset`).toContain(
          "/art/cards/primitives/parchment@2x.webp 2x",
        );
        expect(markup, `${suit} ${rank} frame srcset`).toContain(
          `/art/cards/primitives/frame-${suit}@2x.webp 2x`,
        );
        expect(markup, `${suit} ${rank} rank srcset`).toContain(
          `/art/cards/indices/rank-${tone}-${rank}@2x.webp 2x`,
        );
        expect(markup, `${suit} ${rank} suit srcset`).toContain(
          `/art/cards/indices/suit-${suit}@2x.webp 2x`,
        );
        expect(markup, `${suit} ${rank} VFX`).toContain('data-card-vfx="disabled"');
        expect(markup, `${suit} ${rank} generated index`).toContain(
          'data-card-index="generated"',
        );
      }
    }
  });

  test("leaves all deferred aces, courts, and jokers as legacy full faces", () => {
    const legacyFaces = [
      ...(["hearts", "spades", "diamonds", "clubs"] as const).flatMap((suit) =>
        (["A", "K", "Q", "J"] as const).map((rank) => ({
          kind: "standard" as const,
          suit,
          rank,
        })),
      ),
      { kind: "joker" as const, joker: "big" as const },
      { kind: "joker" as const, joker: "small" as const },
    ];

    for (const face of legacyFaces) {
      const layers = resolveCardFaceLayers(face);
      const markup = renderToStaticMarkup(<CardFace face={face} />);

      expect(layers.lifecycle).toBe("legacy-deferred");
      expect(layers.surface).toBeUndefined();
      expect(layers.frame).toBeUndefined();
      expect(layers.index).toBeUndefined();
      expect(layers.illustration?.id).toMatch(/^card\.legacy\./);
      expect(markup).toContain('data-card-index="embedded"');
      expect(markup).not.toContain('data-card-index="generated"');
      expect(markup).not.toContain("card.surface.parchment");
      expect(markup).not.toContain(".ornament");
      expect(markup).not.toContain("rank-red-");
      expect(markup).not.toContain("rank-black-");
    }
  });
});
