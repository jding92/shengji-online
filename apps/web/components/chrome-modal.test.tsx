import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ChromeModal } from "./chrome-modal";

describe("ChromeModal", () => {
  test("renders an accessible, themed modal shell", () => {
    const markup = renderToStaticMarkup(
      <ChromeModal titleId="modal-title" onClose={() => undefined}>
        <h2 id="modal-title">Options · 设置</h2>
        <button type="button">Close</button>
      </ChromeModal>,
    );

    expect(markup).toContain('class="modal-scrim chrome-modal-scrim"');
    expect(markup).toContain('class="chrome-modal-card glass-panel"');
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-labelledby="modal-title"');
  });
});
