import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { ChromeButton, ChromeLink, ChromePortrait } from "./ui-chrome";

describe("composable UI chrome", () => {
  test("renders an interchangeable registry-backed portrait frame around content", () => {
    const markup = renderToStaticMarkup(
      <ChromePortrait>
        <span>portrait</span>
      </ChromePortrait>,
    );

    expect(markup).toContain('data-chrome-layer="portrait-frame"');
    expect(markup).toContain('data-art-asset="ui.portrait-frame.house"');
    expect(markup).toContain('src="/art/ui/primitives/portrait-frame-house.webp"');
    expect(markup).toContain(
      'srcSet="/art/ui/primitives/portrait-frame-house.webp 1x, /art/ui/primitives/portrait-frame-house@2x.webp 2x"',
    );
    expect(markup).toContain('data-chrome-layer="portrait"');
  });

  test("keeps primary button surface art separate from its live label", () => {
    const markup = renderToStaticMarkup(
      <ChromeButton variant="primary">Play</ChromeButton>,
    );

    expect(markup).toContain('data-chrome-button-surface="ui.button.primary"');
    expect(markup).toContain('data-chrome-layer="surface"');
    expect(markup).toContain('data-art-asset="ui.button.primary"');
    expect(markup).toContain('src="/art/ui/primitives/button-primary.webp"');
    expect(markup).toContain(
      'srcSet="/art/ui/primitives/button-primary.webp 1x, /art/ui/primitives/button-primary@2x.webp 2x"',
    );
    expect(markup).toContain('data-chrome-layer="content">Play</span>');
  });

  test.each(["primary", "gold", "neutral", "danger"] as const)(
    "maps the %s UX variant to matching reusable surface art",
    (variant) => {
      const markup = renderToStaticMarkup(
        <ChromeButton variant={variant}>{variant}</ChromeButton>,
      );
      expect(markup).toContain(`data-chrome-button-surface="ui.button.${variant}"`);
      expect(markup).toContain(`data-art-asset="ui.button.${variant}"`);
      expect(markup).toContain(`/art/ui/primitives/button-${variant}.webp`);
    },
  );

  test("gives navigational actions the same surface contract", () => {
    const markup = renderToStaticMarkup(
      <ChromeLink href="/guide" variant="primary">
        Guide
      </ChromeLink>,
    );
    expect(markup).toContain('class="chrome-button chrome-link chrome-button-primary"');
    expect(markup).toContain('data-art-asset="ui.button.primary"');
    expect(markup).toContain('href="/guide"');
  });
});
