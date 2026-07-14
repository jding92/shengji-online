import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { GameDashboard, TeamRoleBadge } from "./game-dashboard";

describe("GameDashboard", () => {
  test("uses a single accessible emblem instead of duplicate role labels", () => {
    const attacking = renderToStaticMarkup(<TeamRoleBadge role="attacking" />);
    const pending = renderToStaticMarkup(<TeamRoleBadge role="pending" />);

    expect(attacking).toContain('data-art-asset="ui.attack-badge"');
    expect(attacking).toContain('alt="Attacking team"');
    expect(attacking).not.toContain("role-char");
    expect(attacking).not.toContain("role-en");
    expect(pending).toContain('role="img" aria-label="Role pending"');
  });

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
    expect(markup).toContain('alt="Defending team"');
    expect(markup).toContain('alt="Attacking team"');
    expect(markup).toContain('data-art-asset="ui.buried-cards"');
    expect(markup).toContain(
      'srcSet="/art/ui/buried-cards.webp 1x, /art/ui/buried-cards@2x.webp 2x"',
    );
    expect(markup).toContain("YOUR TEAM");
    expect(markup).toContain("RIVALS");
    expect(markup).toContain('aria-label="YOUR TEAM, rank 2, defending"');
    expect(markup).toContain('aria-label="RIVALS, rank 5, attacking"');
    expect(markup).not.toContain('class="role-char"');
    expect(markup).not.toContain('class="role-en"');
    expect(markup).toContain(">TRUMP</small>");
    expect(markup).toContain("ROUND POINTS");
    expect(markup).toContain(">-25</strong>");
    expect(markup).toContain('class="points-meter-fill" style="width:0%"');
    expect(markup).toContain(
      'role="progressbar" aria-label="Attacker scoring progress" aria-valuemin="0" aria-valuemax="200" aria-valuenow="0"',
    );
    expect(markup).toContain("+1 level");
    expect(markup).toContain("Your team");
    expect(markup).toContain("65 pts · defenders");
    expect(markup).toContain("25 pts");
    expect(markup).toContain('aria-label="Mute sounds"');
    expect(markup).toContain('data-chrome-layer="content">Leave</span>');
    expect(markup).toContain('data-chrome-button-surface="ui.button.neutral"');
  });

  test("renders finding-friends calls by index with provisional points", () => {
    const callFace = {
      kind: "standard" as const,
      suit: "spades" as const,
      rank: "K" as const,
    };
    const markup = renderToStaticMarkup(
      <GameDashboard
        roomId="FF1234"
        yourTeam={{
          label: "我方 · YOUR TEAM",
          rank: null,
          role: "pending",
          teamClass: "team-neutral",
        }}
        rivalTeam={{
          label: "对方 · RIVALS",
          rank: null,
          role: "pending",
          teamClass: "team-neutral",
        }}
        findingFriends={{
          declarerSeat: 0,
          calls: [
            { face: callFace, copyIndex: 1 },
            { face: callFace, copyIndex: 2, revealed: { seat: 2, trickNumber: 3 } },
          ],
          seats: [
            {
              seat: 0,
              playerId: "p0",
              name: "Declarer",
              connected: true,
              isBot: false,
              ready: true,
              rank: "2",
              cardCount: 25,
              role: "declarer",
              teamId: "defenders",
            },
            {
              seat: 2,
              playerId: "p2",
              name: "Friend",
              connected: true,
              isBot: false,
              ready: true,
              rank: "2",
              cardCount: 24,
              role: "friend",
              teamId: "defenders",
            },
          ],
          roundsWonBySeat: { 0: 1, 2: 2 },
          outcome: undefined,
        }}
        roundNumber={1}
        trumpRank="7"
        standingTrump={undefined}
        trumpCard={undefined}
        attackerPoints={35}
        pointsTone="stat-mid"
        pointProgress={17.5}
        pointThresholds={[40, 80, 120, 160, 200]}
        pointMeterMax={200}
        projectedOutcome={null}
        previousResult={null}
        buriedPoints={null}
        bottomOpen={false}
        onToggleBottom={() => undefined}
        muted={false}
        onToggleMuted={() => undefined}
        onLeave={() => undefined}
      />,
    );

    expect(markup).toContain('data-finding-friends="true"');
    expect(markup).toContain("PROVISIONAL");
    expect(markup).toContain("暂计");
    expect(markup).toContain("Declarer");
    expect(markup).toContain("Friend");
    expect(markup).toContain(">?</strong>");
    expect(markup).toContain('data-call-index="0"');
    expect(markup).toContain('data-call-index="1"');
    expect(markup).toContain("TRICK 3");
    expect(markup).toContain("ROUNDS WON · 胜局");
  });
});
