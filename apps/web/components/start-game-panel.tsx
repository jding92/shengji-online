"use client";

import { resolveRuleset, totalCards } from "@shengji/engine";
import type { BotDifficulty } from "@shengji/protocol";
import { useMemo } from "react";
import { describeRules, type OptionsEditorValue } from "../lib/rules";
import { OptionsEditor, type OptionServerIssues } from "./options-editor";
import { ChromeButton } from "./ui-chrome";

export type StartGameOpponents = "friends" | "bots";

type StartGamePanelProps = {
  rules: OptionsEditorValue;
  onRulesChange: (next: OptionsEditorValue) => void;
  opponents: StartGameOpponents;
  onOpponentsChange: (next: StartGameOpponents) => void;
  botDifficulty: BotDifficulty;
  onBotDifficultyChange: (next: BotDifficulty) => void;
  creating: boolean;
  serverIssues?: OptionServerIssues;
  onStart: () => void;
};

const DIFFICULTIES: readonly BotDifficulty[] = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
];

function difficultyLabel(difficulty: BotDifficulty): string {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

export function StartGamePanel({
  rules,
  onRulesChange,
  opponents,
  onOpponentsChange,
  botDifficulty,
  onBotDifficultyChange,
  creating,
  serverIssues,
  onStart,
}: StartGamePanelProps) {
  const resolution = useMemo(
    () => resolveRuleset(rules.presetId, rules.options),
    [rules],
  );
  const summaryRules = resolution.ok
    ? (() => {
        const handSize =
          (totalCards(resolution.ruleset.decks) - resolution.ruleset.bottom.size) /
          resolution.ruleset.players.count;
        return [
          ...describeRules(resolution.ruleset),
          `HAND ${handSize} · 手牌 ${handSize}`,
        ];
      })()
    : [];

  return (
    <div className="start-game-panel">
      <div className="start-opponents-row">
        <fieldset className="start-opponents" disabled={creating}>
          <legend>OPPONENTS · 对手</legend>
          {/* The fieldset legend already names this group; a second one breaks
              role-based lookups that expect exactly one match. */}
          <div className="option-segmented">
            {(["friends", "bots"] as const).map((choice) => {
              const selected = opponents === choice;
              return (
                <ChromeButton
                  key={choice}
                  className="option-segment"
                  variant={selected ? "gold" : "neutral"}
                  aria-pressed={selected}
                  onClick={() => onOpponentsChange(choice)}
                >
                  {choice === "friends" ? "FRIENDS · 好友" : "BOTS · 机器人"}
                </ChromeButton>
              );
            })}
          </div>
        </fieldset>

        {opponents === "bots" && (
          <fieldset className="difficulty-picker" disabled={creating}>
            <legend>BOT DIFFICULTY · 机器人难度</legend>
            <div className="difficulty-options">
              {DIFFICULTIES.map((difficulty) => {
                const selected = botDifficulty === difficulty;
                return (
                  <ChromeButton
                    key={difficulty}
                    className="difficulty-option"
                    variant={selected ? "gold" : "neutral"}
                    aria-pressed={selected}
                    onClick={() => onBotDifficultyChange(difficulty)}
                  >
                    {difficultyLabel(difficulty)}
                  </ChromeButton>
                );
              })}
            </div>
          </fieldset>
        )}
      </div>

      <small className="option-hint start-opponents-hint">
        {opponents === "friends"
          ? "Others join with your table code."
          : "Bots fill every other seat and the deal starts at once."}
      </small>

      <OptionsEditor
        phase="lobby"
        value={rules}
        onChange={onRulesChange}
        occupiedSeats={[]}
        joinedPlayerCount={0}
        disabled={creating}
        {...(serverIssues === undefined ? {} : { serverIssues })}
      />

      {summaryRules.length > 0 && (
        <div className="rules-ribbon start-summary" aria-label="Table summary">
          {summaryRules.map((rule, index) => (
            <span
              className={rule === "CUSTOM · 自定义" ? "rules-ribbon-custom" : undefined}
              key={rule}
            >
              {index > 0 && <i />}
              {rule}
            </span>
          ))}
        </div>
      )}

      <ChromeButton
        className="arcade-action"
        variant="primary"
        disabled={creating || !resolution.ok}
        onClick={onStart}
      >
        <span>
          {opponents === "friends"
            ? creating
              ? "Preparing table…"
              : "Create table"
            : creating
              ? "Preparing match…"
              : "Start practice"}
        </span>
        <b aria-hidden="true">→</b>
      </ChromeButton>
    </div>
  );
}
