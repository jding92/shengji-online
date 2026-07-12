import { readFile } from "node:fs/promises";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test } from "vitest";
import { CardFace } from "./card-face";

let globalCss = "";
let mythicCss = "";
let trickCenterSource = "";
let gameTableSource = "";
let roundSummarySource = "";
let roomClientSource = "";

beforeAll(async () => {
  [
    globalCss,
    mythicCss,
    trickCenterSource,
    gameTableSource,
    roundSummarySource,
    roomClientSource,
  ] = await Promise.all([
    readFile(path.resolve(process.cwd(), "app/globals.css"), "utf8"),
    readFile(path.resolve(process.cwd(), "app/themes/mythic.css"), "utf8"),
    readFile(path.resolve(process.cwd(), "components/trick-center.tsx"), "utf8"),
    readFile(path.resolve(process.cwd(), "components/game-table.tsx"), "utf8"),
    readFile(path.resolve(process.cwd(), "components/round-summary-modal.tsx"), "utf8"),
    readFile(path.resolve(process.cwd(), "components/room-client.tsx"), "utf8"),
  ]);
});

function declarationBlock(pattern: RegExp): string {
  const match = globalCss.match(pattern);
  expect(match, `Missing CSS rule: ${pattern.source}`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("card primitive layout", () => {
  test("fills the runtime card box without cropping primitive layers", () => {
    const layerRule = declarationBlock(
      /\.card-face-parchment > img,\s*\.card-face-illustration > img,\s*\.card-face-frame > img\s*\{([^}]*)\}/,
    );

    expect(layerRule).toContain("width: 100%");
    expect(layerRule).toContain("height: 100%");
    expect(layerRule).toContain("object-fit: fill");
    expect(layerRule).not.toContain("object-fit: cover");
  });

  test("keeps complete compositions at both required rendered sizes", () => {
    const regularRule = declarationBlock(/\.playing-card,\s*\.card-back\s*\{([^}]*)\}/);
    const compactRule = declarationBlock(
      /\.playing-card\.is-compact,\s*\.card-back\.is-compact\s*\{([^}]*)\}/,
    );
    expect(regularRule).toContain("width: 108px");
    expect(regularRule).toContain("height: 156px");
    expect(compactRule).toContain("width: 75px");
    expect(compactRule).toContain("height: 108px");

    for (const fixture of [
      {
        className: "playing-card",
        face: {
          kind: "standard" as const,
          suit: "hearts" as const,
          rank: "10" as const,
        },
      },
      {
        className: "playing-card is-compact",
        face: {
          kind: "standard" as const,
          suit: "spades" as const,
          rank: "3" as const,
        },
      },
    ]) {
      const markup = renderToStaticMarkup(
        <span className={fixture.className}>
          <CardFace face={fixture.face} />
        </span>,
      );
      expect(markup).toContain('data-card-asset="card.surface.parchment"');
      expect(markup).toContain(
        `data-card-asset="card.frame.${fixture.face.suit}.ornament"`,
      );
      expect(markup).toContain('data-card-index="generated"');
    }
  });

  test("keeps overlapping card surfaces opaque without opacity dimming", () => {
    const surfaceRule = declarationBlock(/\.card-surface\s*\{([^}]*)\}/);
    expect(surfaceRule).toContain("overflow: hidden");
    expect(surfaceRule).toContain("background: #f5e8cc");
    expect(surfaceRule).not.toMatch(/\bopacity\s*:/);

    const backRule = declarationBlock(/\.card-back-art\s*\{([^}]*)\}/);
    expect(backRule).toContain("object-fit: fill");
    expect(backRule).not.toContain("object-fit: cover");
    expect(backRule).not.toMatch(/\bopacity\s*:/);
  });

  test("keeps lifted hand cards behind the cards to their right", () => {
    const selectedRule = declarationBlock(/\.playing-card\.is-selected\s*\{([^}]*)\}/);
    const handHoverRule = declarationBlock(
      /\.hand-scroll \.playing-card:is\(:hover, :focus-visible\)\s*\{([^}]*)\}/,
    );
    expect(selectedRule).toContain("z-index: auto");
    expect(handHoverRule).toContain("z-index: auto");
  });

  test("uses gilded selection corners and stronger playable-card contrast", () => {
    const selectedSurface = mythicCss.match(
      /\.playing-card\.is-selected \.card-surface\s*\{([^}]*)\}/,
    )?.[1];
    const selectedCorners = mythicCss.match(
      /\.playing-card\.is-selected::after\s*\{([^}]*)\}/,
    )?.[1];
    expect(selectedSurface).toContain("border-color: #ffe8a3");
    expect(selectedSurface).toContain("0 0 0 4px #d5a43b");
    expect(selectedSurface).not.toContain("0 0 0 3px var(--red)");
    expect(selectedCorners).toContain("linear-gradient");
    expect(mythicCss).toContain("mythic-playable-card-pulse");
    expect(mythicCss).toContain("filter: brightness(0.62) saturate(0.42)");
  });

  test("only overlaps center-play cards inside the compact container fallback", () => {
    const regularPlayRule = declarationBlock(
      /\.center-play \.playing-card\s*\{([^}]*)\}/,
    );
    expect(regularPlayRule).toContain("margin-left: 0");
    expect(globalCss).toMatch(
      /@container \(max-width: 760px\) or \(max-height: 560px\)[\s\S]*?\.center-play \.playing-card\s*\{[\s\S]*?margin-left: -51px/,
    );
  });

  test("does not fade card-bearing wrappers or ancestors", () => {
    const trickPlays = trickCenterSource.slice(
      trickCenterSource.indexOf("className={`trick-plays"),
    );
    const buriedPanel = gameTableSource.slice(
      gameTableSource.indexOf('className="buried-panel"'),
    );
    const modalScrim = roundSummarySource.slice(
      roundSummarySource.indexOf("className={`modal-scrim"),
      roundSummarySource.indexOf("<motion.section"),
    );
    const roundSummary = roundSummarySource.slice(
      roundSummarySource.indexOf("className={`round-summary"),
      roundSummarySource.indexOf("{!gameOver && yourTeamWon"),
    );
    const bottomRevealCard = roundSummarySource.slice(
      roundSummarySource.indexOf('className="bottom-reveal-card"'),
      roundSummarySource.indexOf("<PlayingCard card={card} compact />"),
    );
    const tableScreenMotion = roomClientSource.slice(
      roomClientSource.indexOf("const tableScreenMotion"),
      roomClientSource.indexOf("const transitionalScreenMotion"),
    );
    const tableMotionSelection = roomClientSource.slice(
      roomClientSource.indexOf("const screenMotion ="),
      roomClientSource.indexOf("const screen ="),
    );

    expect(trickPlays).not.toContain("opacity:");
    expect(buriedPanel).not.toContain("opacity:");
    expect(modalScrim).not.toContain("opacity:");
    expect(roundSummary).not.toContain("opacity:");
    expect(bottomRevealCard).not.toContain("opacity:");
    expect(tableScreenMotion).not.toContain("opacity:");
    expect(tableScreenMotion).toContain("initial: false");
    expect(tableMotionSelection).toContain(
      'screenKey === "table" ? tableScreenMotion : transitionalScreenMotion',
    );
  });
});
