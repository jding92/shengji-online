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
    expect(markup).toContain('data-player-role="defending"');
    expect(markup).toContain('data-round-leader="true"');
    expect(markup).toContain('data-art-asset="ui.player-badge.round-leader"');
    expect(markup).toContain('src="/art/ui/player-badge/round-leader.webp"');
    expect(markup).toContain(
      'srcSet="/art/ui/player-badge/round-leader.webp 1x, /art/ui/player-badge/round-leader@2x.webp 2x"',
    );
    expect(markup).toContain('data-art-asset="ui.player-badge.role-defend"');
    expect(markup).toContain('src="/art/ui/player-badge/role-defend.webp"');
    expect(markup).toContain(
      'srcSet="/art/ui/player-badge/role-defend.webp 1x, /art/ui/player-badge/role-defend@2x.webp 2x"',
    );
    expect(markup).toContain('data-player-type="bot"');
    expect(markup).toContain('data-art-asset="ui.player-badge.type-bot"');
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
    expect(markup).not.toContain('class="seat-count"');
    expect(markup).not.toContain("14/25");
    expect(markup).not.toContain(">14</");
    expect(markup).not.toContain(">BOT</");
    expect(markup).not.toContain("Lv 2");
    expect(markup).not.toContain("Blue");
    expect(markup.indexOf('data-round-leader="true"')).toBeLessThan(
      markup.indexOf('data-player-role="defending"'),
    );
    expect(markup.indexOf('data-player-role="defending"')).toBeLessThan(
      markup.indexOf('data-player-type="bot"'),
    );
    expect(markup.indexOf('data-player-type="bot"')).toBeLessThan(
      markup.indexOf('class="seat-timer-badge"'),
    );
  });

  test("marks a reused portrait with its physical-seat accent", () => {
    const markup = renderToStaticMarkup(
      <PlayerTag
        seat={{ ...seat, seat: 4 }}
        isYou={false}
        isLeader={false}
        role={null}
      />,
    );

    expect(markup).toContain('data-seat-accent="4"');
  });
});
