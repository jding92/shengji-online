import type { SeatView } from "@shengji/protocol";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { PlayerTag } from "./player-tag";

const seat: SeatView = {
  seat: 0,
  playerId: "player-0",
  name: "Ming",
  connected: true,
  isBot: true,
  botDifficulty: "intermediate",
  ready: true,
  rank: "2",
  cardCount: 14,
  teamId: "team-0",
};

describe("PlayerTag", () => {
  test("keeps its transparent shell and reusable visual layers separate", () => {
    const markup = renderToStaticMarkup(
      <PlayerTag
        seat={seat}
        isYou
        isLeader
        role="defending"
        handTotal={25}
        timer={{ deadline: "2099-01-01T00:00:00.000Z", now: () => 0 }}
      />,
    );

    expect(markup).toContain('data-player-tag-shell="transparent"');
    expect(markup).toContain('data-player-tag-layer="surface"');
    expect(markup).toContain('data-player-tag-layer="ornament"');
    expect(markup).toContain('data-player-tag-layer="portrait"');
    expect(markup).toContain('data-player-tag-layer="content"');
    expect(markup).toContain('data-player-tag-layer="status"');
    expect(markup).toContain('data-player-tag-layer="timer"');
    expect(markup).toContain('data-art-asset="ui.chrome.player-nameplate"');
    expect(markup).toContain('src="/art/ui/nameplate.webp"');
    expect(markup).toContain(
      'srcSet="/art/ui/nameplate.webp 1x, /art/ui/nameplate@2x.webp 2x"',
    );
    expect(markup.indexOf('data-player-tag-layer="surface"')).toBeLessThan(
      markup.indexOf('data-player-tag-layer="ornament"'),
    );
    expect(markup).toContain('class="seat-portrait"');
    expect(markup).toContain(">You</strong>");
    expect(markup).toContain("14/25");
  });
});
