import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { GameMoment } from "../lib/moments";
import { isMomentLayerMoment, MomentLayer } from "./moment-layer";

describe("MomentLayer", () => {
  test("point-bearing won tricks do not create a visual overlay", () => {
    const pointTrick: GameMoment = {
      id: "trick-won:1:1",
      type: "TRICK_WON",
      winnerSeat: 2,
      points: 10,
      cards: [],
    };

    expect(isMomentLayerMoment(pointTrick)).toBe(false);
  });

  test("resolves trump layers through explicit registry assets", () => {
    const trumpMoment: GameMoment = {
      id: "trump-declared:1:0",
      type: "TRUMP_DECLARED",
      seat: 0,
    };
    const markup = renderToStaticMarkup(
      <MomentLayer moments={[trumpMoment]} dismiss={() => undefined} />,
    );

    expect(markup).toContain('data-art-asset="vfx.trump-burst"');
    expect(markup).toContain(
      'srcSet="/art/ui/trump-burst.webp 1x, /art/ui/trump-burst@2x.webp 2x"',
    );
    expect(markup).toContain('data-art-asset="ui.trump-declaration"');
    expect(markup).toContain(
      'srcSet="/art/ui/trump-declaration.webp 1x, /art/ui/trump-declaration@2x.webp 2x"',
    );
  });
});
