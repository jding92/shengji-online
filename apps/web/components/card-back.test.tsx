import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CardBack } from "./card";

describe("CardBack", () => {
  test("renders the premium back as an explicit registry layer", () => {
    const markup = renderToStaticMarkup(<CardBack compact />);

    expect(markup).toContain("card-back is-compact");
    expect(markup).toContain('data-art-asset="card.back.premium"');
    expect(markup).toContain('src="/art/cards/card-back.webp"');
    expect(markup).toContain(
      'srcSet="/art/cards/card-back.webp 1x, /art/cards/card-back@2x.webp 2x"',
    );
  });
});
