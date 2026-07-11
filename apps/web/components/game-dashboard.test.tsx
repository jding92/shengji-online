import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { GameDashboard } from "./game-dashboard";

describe("GameDashboard", () => {
  test("composes registry chrome around live dashboard content and controls", () => {
    const markup = renderToStaticMarkup(
      <GameDashboard
        roomId="M83KJ3"
        yourTeam={{
          label: "我方 · YOUR TEAM",
          rank: "2",
          role: "defending",
          teamClass: "team-blue",
        }}
        rivalTeam={{
          label: "对方 · RIVALS",
          rank: "5",
          role: "attacking",
          teamClass: "team-red",
        }}
        roundNumber={3}
        trumpRank="7"
        standingTrump={undefined}
        trumpCard={undefined}
        attackerPoints={-25}
        pointsTone="stat-mid"
        pointProgress={-12.5}
        pointThresholds={[40, 80, 120, 160, 200]}
        pointMeterMax={200}
        projectedOutcome={{ winner: "attackers", levelDelta: 1 }}
        previousResult={{
          winnerLabel: "Your team",
          attackerPoints: 65,
          winner: "defenders",
        }}
        buriedPoints={25}
        bottomOpen
        onToggleBottom={() => undefined}
        muted={false}
        onToggleMuted={() => undefined}
        onLeave={() => undefined}
      />,
    );

    expect(markup).toContain('data-dashboard-layout="responsive-rail"');
    expect(markup).toContain('data-chrome-layer="frame"');
    expect(markup).toContain('data-art-asset="ui.chrome.panel-frame"');
    expect(markup).toContain('src="/art/ui/panel-frame.webp"');
    expect(markup).toContain(
      'srcSet="/art/ui/panel-frame.webp 1x, /art/ui/panel-frame@2x.webp 2x"',
    );
    expect(markup).toContain('data-chrome-layer="content"');
    expect(markup.indexOf('data-chrome-layer="frame"')).toBeLessThan(
      markup.indexOf('data-chrome-layer="content"'),
    );
    expect(markup).toContain("Room M83KJ3");
    expect(markup).toContain('data-art-asset="ui.defend-badge"');
    expect(markup).toContain('data-art-asset="ui.attack-badge"');
    expect(markup).toContain(
      'srcSet="/art/ui/defend-badge.webp 1x, /art/ui/defend-badge@2x.webp 2x"',
    );
    expect(markup).toContain(
      'srcSet="/art/ui/attack-badge.webp 1x, /art/ui/attack-badge@2x.webp 2x"',
    );
    expect(markup).toContain('data-art-asset="ui.buried-cards"');
    expect(markup).toContain(
      'srcSet="/art/ui/buried-cards.webp 1x, /art/ui/buried-cards@2x.webp 2x"',
    );
    expect(markup).toContain("YOUR TEAM");
    expect(markup).toContain("RIVALS");
    expect(markup).toContain("ROUND TRUMP");
    expect(markup).toContain("ATTACKER POINTS");
    expect(markup).toContain(">-25</strong>");
    expect(markup).toContain('class="points-meter-fill" style="width:0%"');
    expect(markup).toContain("Your team");
    expect(markup).toContain("65 pts · defenders");
    expect(markup).toContain("25 pts");
    expect(markup).toContain('aria-label="Mute sounds"');
    expect(markup).toContain(">Leave</button>");
  });
});
