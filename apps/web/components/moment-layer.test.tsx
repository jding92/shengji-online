import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { PrivateGameView, SeatView } from "@shengji/protocol";
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

  test("renders a named friend reveal stamp", () => {
    const reveal: GameMoment = {
      id: "friend-revealed:1:0",
      type: "FRIEND_REVEALED",
      seat: 2,
      face: { kind: "standard", suit: "spades", rank: "K" },
      copyIndex: 1,
      trickNumber: 3,
    };
    const markup = renderToStaticMarkup(
      <MomentLayer
        moments={[reveal]}
        dismiss={() => undefined}
        view={
          {
            seats: [{ seat: 2, name: "Poseidon", playerId: "p2" } as SeatView],
          } as PrivateGameView
        }
      />,
    );

    expect(isMomentLayerMoment(reveal)).toBe(true);
    expect(markup).toContain("FRIEND REVEALED · 找到朋友");
    expect(markup).toContain("Poseidon joins the declarer");
  });
});
