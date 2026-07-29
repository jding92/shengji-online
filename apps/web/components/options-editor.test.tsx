import { renderToStaticMarkup } from "react-dom/server";
import type { GameOptions } from "@shengji/engine";
import { describe, expect, test } from "vitest";
import { OptionsEditor } from "./options-editor";

const FIXED_PRESET_ID = "shengji-4p-2d-fixed-v1";
const FINDING_FRIENDS_PRESET_ID = "shengji-ff-5p-2d-v1";

function editorMarkup(
  phase: "lobby" | "playing",
  options: GameOptions = {},
  occupiedSeats: number[] = [],
  joinedPlayerCount = 0,
  presetId = FIXED_PRESET_ID,
  serverIssues?: { path: string; message: string }[],
) {
  return renderToStaticMarkup(
    <OptionsEditor
      phase={phase}
      value={{ presetId, options }}
      onChange={() => undefined}
      occupiedSeats={occupiedSeats}
      joinedPlayerCount={joinedPlayerCount}
      {...(serverIssues === undefined ? {} : { serverIssues })}
      onSubmit={() => undefined}
    />,
  );
}

describe("OptionsEditor", () => {
  test("shows primary groups and collapsed advanced options in the lobby", () => {
    const lobby = editorMarkup("lobby");
    expect(lobby).toContain("TABLE · 牌桌");
    expect(lobby).toContain("TIMERS · 时限");
    expect(lobby).toContain("ADVANCED · 高级");
    expect(lobby).not.toContain("CLIMB · 升级");
    expect(lobby.indexOf("TEAMS · 队伍模式")).toBeLessThan(
      lobby.indexOf("PLAYERS · 玩家数"),
    );

    const playing = editorMarkup("playing");
    expect(playing).toContain("TIMERS · 时限");
    expect(playing).not.toContain("TABLE · 牌桌");
    expect(playing).not.toContain("ADVANCED · 高级");
  });

  test("opens advanced options when a server issue targets an advanced field", () => {
    const markup = editorMarkup("lobby", {}, [], 0, FIXED_PRESET_ID, [
      { path: "bottom.size", message: "Bottom size is invalid" },
    ]);
    expect(markup).toContain("BOTTOM · 底牌数");
    expect(markup).toContain('aria-expanded="true"');
  });

  test("shows friend calls only for finding-friends tables", () => {
    const fixed = editorMarkup("lobby");
    const findingFriends = editorMarkup("lobby", {}, [], 0, FINDING_FRIENDS_PRESET_ID);
    expect(fixed).not.toContain("FRIEND CALLS · 叫朋友数");
    expect(findingFriends).toContain("FRIEND CALLS · 叫朋友数");
  });

  test("disables player counts that conflict with the teams mode", () => {
    const fixed = editorMarkup("lobby");
    expect(
      fixed.match(/title="Fixed teams need an even count · 固定队需偶数"/g) ?? [],
    ).toHaveLength(2);
    expect(fixed).toContain('aria-label="PLAYERS · 玩家数"');
    const findingFriends = editorMarkup("lobby", {}, [], 0, FINDING_FRIENDS_PRESET_ID);
    expect(findingFriends).toContain(
      'title="Finding friends needs 5+ · 找朋友需至少5人"',
    );
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
});
