import { DEFAULT_PRESET_ID, resolveRuleset, type GameOptions } from "@shengji/engine";
import type { PrivateGameView } from "@shengji/protocol";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  Lobby,
  LobbyRulesChangedNotice,
  LobbyRulesEditor,
  shouldShowRulesChangedNotice,
} from "./lobby";

function makeView(
  options: GameOptions = {},
  overrides: Partial<PrivateGameView> = {},
): PrivateGameView {
  const resolved = resolveRuleset(DEFAULT_PRESET_ID, options);
  if (!resolved.ok) throw new Error(resolved.issues[0]?.message ?? "Invalid fixture");
  const seats = Array.from({ length: resolved.ruleset.players.count }, (_, seat) => ({
    seat,
    playerId: seat === 0 ? "p0" : null,
    name: seat === 0 ? "Host" : null,
    connected: seat === 0,
    isBot: false,
    ready: false,
    rank: null,
    cardCount: 0,
  }));
  return {
    roomId: "ABC123",
    revision: 3,
    hostPlayerId: "p0",
    joinedPlayerCount: 1,
    ruleset: {
      id: resolved.ruleset.id,
      name: resolved.ruleset.name,
      players: resolved.ruleset.players.count,
      decks: resolved.ruleset.decks.count,
      bottomSize: resolved.ruleset.bottom.size,
      presetId: DEFAULT_PRESET_ID,
      teamsMode: resolved.ruleset.teams.mode,
      options,
    },
    phase: "lobby",
    you: { playerId: "p0", seat: 0, hand: [] },
    seats,
    legalActions: ["update-options"],
    ...overrides,
  };
}

const commandProps = {
  sendCommand: () => null,
  sendTrackedCommand: () => "request-1",
  trackedRejections: new Map<string, { code: string; message: string }>(),
  consumeRejection: () => undefined,
  onLeave: () => undefined,
};

describe("Lobby", () => {
  test("shows the host badge and live rules ribbon for expanded tables", () => {
    const view = makeView({ playerCount: 6, deckCount: 3 });
    const markup = renderToStaticMarkup(<Lobby view={view} {...commandProps} />);

    expect(markup).toContain("HOST");
    expect(markup).toContain("6 PLAYERS · 6人");
    expect(markup).toContain("3 DECKS · 3副牌");
    expect(markup).not.toContain("Throws on");
    expect(markup).toContain("TABLE RULES · 桌规");
  });

  test("only an editable host rules modal gets a submit affordance", () => {
    const draft = { presetId: DEFAULT_PRESET_ID, options: {} };
    const hostMarkup = renderToStaticMarkup(
      <LobbyRulesEditor
        open
        draft={draft}
        canEdit
        occupiedSeats={[0]}
        joinedPlayerCount={1}
        pendingRequest={false}
        onClose={() => undefined}
        onChange={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    const guestMarkup = renderToStaticMarkup(
      <LobbyRulesEditor
        open
        draft={draft}
        canEdit={false}
        occupiedSeats={[0]}
        joinedPlayerCount={1}
        pendingRequest={false}
        onClose={() => undefined}
        onChange={() => undefined}
      />,
    );

    expect(hostMarkup).toContain("APPLY OPTIONS · 应用设置");
    expect(guestMarkup).not.toContain("APPLY OPTIONS · 应用设置");
  });

  test("renders the re-ready notice when the rules signature changes", () => {
    expect(shouldShowRulesChangedNotice("old", "new", "lobby")).toBe(true);
    expect(shouldShowRulesChangedNotice(null, "new", "lobby")).toBe(false);
    expect(shouldShowRulesChangedNotice("old", "new", "playing")).toBe(false);

    const markup = renderToStaticMarkup(
      <LobbyRulesChangedNotice show onDismiss={() => undefined} />,
    );
    expect(markup).toContain("Rules changed — ready up again · 规则已更改");
  });
});
