import { renderToStaticMarkup } from "react-dom/server";
import type { GameOptions } from "@shengji/engine";
import { describe, expect, test } from "vitest";
import type { PresetSummary } from "../lib/presets";
import { OptionsEditor, PresetPicker } from "./options-editor";

const presets: PresetSummary[] = [
  {
    id: "shengji-4p-2d-fixed-v1",
    name: "Sheng Ji 4P Fixed Teams",
    players: 4,
    decks: 2,
    teamsMode: "fixed",
    description: "Four players, two decks, fixed alternating teams.",
  },
  {
    id: "shengji-ff-5p-2d-v1",
    name: "Finding Friends 5P",
    players: 5,
    decks: 2,
    teamsMode: "finding-friends",
    description: "Five players, two decks, finding friends.",
  },
];

function editorMarkup(
  phase: "lobby" | "playing",
  options: GameOptions = {},
  occupiedSeats: number[] = [],
  joinedPlayerCount = 0,
) {
  return renderToStaticMarkup(
    <OptionsEditor
      presets={presets}
      phase={phase}
      value={{ presetId: presets[0]!.id, options }}
      onChange={() => undefined}
      occupiedSeats={occupiedSeats}
      joinedPlayerCount={joinedPlayerCount}
      onSubmit={() => undefined}
    />,
  );
}

describe("OptionsEditor", () => {
  test("shows all groups in the lobby and timers only in-game", () => {
    const lobby = editorMarkup("lobby");
    expect(lobby).toContain("TABLE · 牌桌");
    expect(lobby).toContain("CLIMB · 升级");
    expect(lobby).toContain("SCORING · 计分");
    expect(lobby).toContain("BIDDING · 叫牌");
    expect(lobby).toContain("TIMERS · 时限");

    const playing = editorMarkup("playing");
    expect(playing).toContain("TIMERS · 时限");
    expect(playing).not.toContain("TABLE · 牌桌");
    expect(playing).not.toContain("CLIMB · 升级");
    expect(playing).not.toContain("MAX REDEALS · 最多重发");
  });

  test("disables player counts below occupied seats or joined players", () => {
    const markup = editorMarkup("lobby", {}, [0, 2, 4], 5);
    expect(markup).toContain('title="Seats in use / players joined"');
    expect(markup).toContain("Seats in use / players joined");
    expect(markup).toContain('aria-pressed="true" disabled');
  });

  test("renders override reset chrome and inline resolver issues", () => {
    const markup = editorMarkup("lobby", { bottomSize: -1 });
    expect(markup).toContain("OVERRIDE · 覆盖");
    expect(markup).toContain('data-chrome-layer="content">默认</span>');
    expect(markup).toContain("Too small");
    expect(markup).toContain('class="option-issue"');
  });

  test("renders preset card selection through ChromeButton pressed state", () => {
    const markup = renderToStaticMarkup(
      <PresetPicker
        presets={presets}
        value={presets[1]!.id}
        onChange={() => undefined}
      />,
    );
    expect(markup).toContain('class="chrome-button chrome-button-gold preset-card"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain("FINDING FRIENDS · 找朋友");
    expect(markup).toContain("Five players, two decks, finding friends.");
  });
});
