import { DEFAULT_PRESET_ID, resolveRuleset, type GameOptions } from "@shengji/engine";
import type { PrivateGameView } from "@shengji/protocol";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { TableSettingsModal } from "./table-settings-modal";

function makeView(
  phase: PrivateGameView["phase"] = "playing",
  options: GameOptions = {},
  overrides: Partial<PrivateGameView> = {},
): PrivateGameView {
  const resolved = resolveRuleset(DEFAULT_PRESET_ID, options);
  if (!resolved.ok) throw new Error(resolved.issues[0]?.message ?? "Invalid fixture");
  return {
    roomId: "ABC123",
    revision: 3,
    hostPlayerId: "p0",
    joinedPlayerCount: 2,
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
    phase,
    you: { playerId: "p1", seat: 1, hand: [] },
    seats: [
      {
        seat: 0,
        playerId: "p0",
        name: "Host",
        connected: true,
        isBot: false,
        ready: true,
        rank: null,
        cardCount: 0,
      },
      {
        seat: 1,
        playerId: "p1",
        name: "Guest",
        connected: true,
        isBot: false,
        ready: true,
        rank: null,
        cardCount: 0,
      },
      {
        seat: 2,
        playerId: "bot-1",
        name: "The Scholar",
        connected: true,
        isBot: true,
        botDifficulty: "advanced",
        ready: true,
        rank: null,
        cardCount: 0,
      },
      {
        seat: 3,
        playerId: null,
        name: null,
        connected: false,
        isBot: false,
        ready: false,
        rank: null,
        cardCount: 0,
      },
    ],
    legalActions: [],
    ...overrides,
  };
}

const commandProps = {
  sendTrackedCommand: () => "request-1",
  trackedRejections: new Map<string, { code: string; message: string }>(),
  consumeRejection: () => undefined,
  onClose: () => undefined,
};

describe("TableSettingsModal", () => {
  test("shows timers only when the viewer can update options", () => {
    const hostMarkup = renderToStaticMarkup(
      <TableSettingsModal
        open
        view={makeView("playing", {}, { legalActions: ["update-options"] })}
        {...commandProps}
      />,
    );
    const guestMarkup = renderToStaticMarkup(
      <TableSettingsModal open view={makeView()} {...commandProps} />,
    );

    expect(hostMarkup).toContain("TIMERS · 时限");
    expect(guestMarkup).not.toContain("TIMERS · 时限");
  });

  test("lists bot seats and presses the current difficulty", () => {
    const markup = renderToStaticMarkup(
      <TableSettingsModal open view={makeView()} {...commandProps} />,
    );

    expect(markup).toContain("BOTS · 机器人");
    expect(markup).toContain("The Scholar");
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain("Advanced");
  });

  test("shows neither section for a non-host table without bots", () => {
    const view = makeView(
      "playing",
      {},
      {
        legalActions: [],
        seats: makeView().seats.map((seat) => ({ ...seat, isBot: false })),
      },
    );
    const markup = renderToStaticMarkup(
      <TableSettingsModal open view={view} {...commandProps} />,
    );

    expect(markup).not.toContain("TIMERS · 时限");
    expect(markup).not.toContain("BOTS · 机器人");
  });
});
