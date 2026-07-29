import { DEFAULT_PRESET_ID, type GameOptions } from "@shengji/engine";
import type { BotDifficulty } from "@shengji/protocol";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { setOption, type OptionsEditorValue } from "../lib/rules";
import { StartGamePanel, type StartGameOpponents } from "./start-game-panel";

function panelMarkup(
  opponents: StartGameOpponents = "friends",
  rules: OptionsEditorValue = { presetId: DEFAULT_PRESET_ID, options: {} },
  creating = false,
) {
  const botDifficulty: BotDifficulty = "intermediate";
  return renderToStaticMarkup(
    <StartGamePanel
      rules={rules}
      onRulesChange={() => undefined}
      opponents={opponents}
      onOpponentsChange={() => undefined}
      botDifficulty={botDifficulty}
      onBotDifficultyChange={() => undefined}
      creating={creating}
      onStart={() => undefined}
    />,
  );
}

describe("StartGamePanel", () => {
  test("shows the friends start flow without bot difficulty", () => {
    const markup = panelMarkup();

    expect(markup).toContain("OPPONENTS · 对手");
    expect(markup).toContain("Create table");
    expect(markup).not.toContain("BOT DIFFICULTY · 机器人难度");
  });

  test("shows bot difficulty and the practice start action", () => {
    const markup = panelMarkup("bots");

    expect(markup).toContain("BOT DIFFICULTY · 机器人难度");
    expect(markup).toContain("Start practice");
  });

  test("summarizes the default rules without a custom chip", () => {
    const markup = panelMarkup();

    expect(markup).toContain("4 PLAYERS · 4人");
    expect(markup).toContain("2 DECKS · 2副牌");
    expect(markup).toContain("FIXED TEAMS · 固定队");
    expect(markup).toContain("HAND 25 · 手牌 25");
    expect(markup).not.toContain("CUSTOM · 自定义");
  });

  test("marks overridden rules as custom", () => {
    const options: GameOptions = setOption({}, "scoring.bandSize", 55);
    const markup = panelMarkup("friends", {
      presetId: DEFAULT_PRESET_ID,
      options,
    });

    expect(markup).toContain("CUSTOM · 自定义");
  });

  test("shows the preparing label while creating", () => {
    const markup = panelMarkup("friends", undefined, true);

    expect(markup).toContain("Preparing table…");
    expect(markup).toContain("disabled");
  });
});
