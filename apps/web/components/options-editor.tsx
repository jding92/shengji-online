"use client";

import {
  RANKS,
  resolveRuleset,
  type GameOptions,
  type GamePhase,
  type ShengJiRuleset,
} from "@shengji/engine";
import type { PrivateGameView } from "@shengji/protocol";
import { useMemo, type FormEvent } from "react";
import {
  OPTION_FIELDS,
  editableOptionKeySet,
  effectiveValue,
  hasOptionOverride,
  mapIssuesToFields,
  resolveViewRuleset,
  setOption,
  clearOption,
  type IssueFieldKey,
  type OptionField,
  type OptionFieldKey,
} from "../lib/rules";
import type { PresetSummary } from "../lib/presets";
import { ChromeButton } from "./ui-chrome";

export type PresetPickerProps = {
  presets: readonly PresetSummary[];
  value?: string;
  selectedPresetId?: string;
  onChange: (presetId: string) => void;
  disabled?: boolean;
};

export function PresetPicker({
  presets,
  value,
  selectedPresetId,
  onChange,
  disabled = false,
}: PresetPickerProps) {
  const selected = selectedPresetId ?? value;
  return (
    <div className="preset-picker">
      <p className="eyebrow">PRESETS · 规则预设</p>
      <div className="preset-grid" aria-label="Ruleset presets">
        {presets.map((preset) => {
          const isSelected = preset.id === selected;
          return (
            <ChromeButton
              key={preset.id}
              className="preset-card"
              variant={isSelected ? "gold" : "neutral"}
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onChange(preset.id)}
            >
              <span className="preset-card-heading">
                <strong>{preset.name}</strong>
                <span className="preset-chips">
                  <span className="preset-chip">
                    {preset.players}P · {preset.players}人
                  </span>
                  <span className="preset-chip">
                    {preset.decks}D · {preset.decks}副
                  </span>
                  <span className="preset-chip">
                    {preset.teamsMode === "fixed"
                      ? "FIXED · 固定"
                      : "FINDING FRIENDS · 找朋友"}
                  </span>
                </span>
              </span>
              <small>{preset.description}</small>
            </ChromeButton>
          );
        })}
      </div>
    </div>
  );
}

export type OptionServerIssues =
  | readonly { path: string; message: string }[]
  | { error: string };

function isIssueList(
  issues: OptionServerIssues | undefined,
): issues is readonly { path: string; message: string }[] {
  return issues !== undefined && !("error" in issues);
}

export type OptionsEditorValue = {
  presetId: string;
  options: GameOptions;
};

export type OptionsEditorProps = {
  presets: readonly PresetSummary[];
  phase: GamePhase;
  value: OptionsEditorValue;
  onChange: (next: OptionsEditorValue) => void;
  resolved?: ShengJiRuleset;
  occupiedSeats: number[];
  joinedPlayerCount: number;
  serverIssues?: OptionServerIssues;
  disabled?: boolean;
  onSubmit?: () => void;
  submitLabel?: string;
};

const GROUPS: readonly { id: OptionField["group"]; label: string }[] = [
  { id: "TABLE", label: "TABLE · 牌桌" },
  { id: "CLIMB", label: "CLIMB · 升级" },
  { id: "SCORING", label: "SCORING · 计分" },
  { id: "BIDDING", label: "BIDDING · 叫牌" },
  { id: "TIMERS", label: "TIMERS · 时限" },
];

const PLAYER_COUNTS = [4, 5, 6, 7, 8];
const DECK_COUNTS = [1, 2, 3, 4];
const TEAM_MODES = ["fixed", "finding-friends"] as const;

function fieldId(key: OptionFieldKey): string {
  return `option-${key.replaceAll(".", "-")}`;
}

function numberDisplay(value: unknown): string | number {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

function issueText(
  fieldIssues: Partial<Record<IssueFieldKey, { path: string; message: string }[]>>,
  key: IssueFieldKey,
): { path: string; message: string }[] {
  return fieldIssues[key] ?? [];
}

function optionNumberMin(key: OptionFieldKey): number {
  return key === "bottomSize" || key === "maxRedeals" ? 0 : 1;
}

function fieldValue(resolved: ShengJiRuleset, key: OptionFieldKey): unknown {
  return effectiveValue(resolved, key);
}

function TeamModeLabel({ value }: { value: (typeof TEAM_MODES)[number] }) {
  return value === "fixed" ? "FIXED · 固定队" : "FINDING FRIENDS · 找朋友";
}

export function OptionsEditor({
  presets,
  phase,
  value,
  onChange,
  resolved,
  occupiedSeats,
  joinedPlayerCount,
  serverIssues,
  disabled = false,
  onSubmit,
  submitLabel = "APPLY OPTIONS · 应用设置",
}: OptionsEditorProps) {
  const resolution = useMemo(
    () => resolveRuleset(value.presetId, value.options),
    [value.options, value.presetId],
  );
  const effectiveRuleset = useMemo(() => {
    if (resolved !== undefined) return resolved;
    if (resolution.ok) return resolution.ruleset;
    const fallback: PrivateGameView["ruleset"] = {
      id: "fallback",
      name: "Fallback",
      players: 4,
      decks: 2,
      bottomSize: 8,
      presetId: value.presetId,
      teamsMode: "fixed",
      options: {},
    };
    return resolveViewRuleset(fallback);
  }, [resolution, resolved, value.presetId]);
  const clientIssues = resolution.ok ? [] : resolution.issues;
  const externalIssues = isIssueList(serverIssues) ? serverIssues : [];
  const serverError =
    serverIssues !== undefined && !isIssueList(serverIssues)
      ? serverIssues.error
      : undefined;
  const mapped = mapIssuesToFields([...clientIssues, ...externalIssues]);
  const formIssues = [
    ...mapped.unmapped,
    ...(serverError === undefined ? [] : [{ path: "server", message: serverError }]),
  ];
  const editableKeys = editableOptionKeySet(phase);
  const fields = OPTION_FIELDS.filter((field) => editableKeys.has(field.metadataKey));
  const minimumPlayers = Math.max(
    joinedPlayerCount,
    Math.max(-1, ...occupiedSeats) + 1,
  );
  const invalid = !resolution.ok;

  function updateOption(key: OptionFieldKey, nextValue: unknown) {
    onChange({ ...value, options: setOption(value.options, key, nextValue) });
  }

  function resetOption(key: OptionFieldKey) {
    onChange({ ...value, options: clearOption(value.options, key) });
  }

  function selectPreset(presetId: string) {
    onChange({ presetId, options: {} });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invalid) onSubmit?.();
  }

  function renderSegmented(field: OptionField, current: unknown) {
    const choices: readonly unknown[] =
      field.key === "playerCount"
        ? PLAYER_COUNTS
        : field.key === "deckCount"
          ? DECK_COUNTS
          : TEAM_MODES;
    return (
      <div className="option-segmented" role="group" aria-label={field.label}>
        {choices.map((choice) => {
          const selected = current === choice;
          const isPlayerCount = field.key === "playerCount";
          const belowOccupancy = isPlayerCount && (choice as number) < minimumPlayers;
          return (
            <ChromeButton
              key={String(choice)}
              className="option-segment"
              variant={selected ? "gold" : "neutral"}
              aria-pressed={selected}
              disabled={disabled || belowOccupancy}
              title={belowOccupancy ? "Seats in use / players joined" : undefined}
              onClick={() => updateOption(field.key, choice)}
            >
              {field.key === "teamsMode" ? (
                <TeamModeLabel value={choice as (typeof TEAM_MODES)[number]} />
              ) : (
                String(choice)
              )}
            </ChromeButton>
          );
        })}
        {field.key === "playerCount" && minimumPlayers > 4 && (
          <small className="option-hint">Seats in use / players joined</small>
        )}
      </div>
    );
  }

  function renderRank(field: OptionField, current: unknown) {
    return (
      <div
        className="option-segmented option-rank-options"
        role="group"
        aria-label={field.label}
      >
        {RANKS.map((rank) => (
          <ChromeButton
            key={rank}
            className="option-segment option-rank"
            variant={current === rank ? "gold" : "neutral"}
            aria-pressed={current === rank}
            disabled={disabled}
            onClick={() => updateOption(field.key, rank)}
          >
            {rank}
          </ChromeButton>
        ))}
      </div>
    );
  }

  function renderRankMulti(field: OptionField, current: unknown) {
    const selected: unknown[] = Array.isArray(current) ? (current as unknown[]) : [];
    return (
      <div
        className="option-segmented option-rank-options"
        role="group"
        aria-label={field.label}
      >
        {RANKS.map((rank) => {
          const pressed = selected.includes(rank);
          const next = pressed
            ? selected.filter((selectedRank) => selectedRank !== rank)
            : [...selected, rank];
          return (
            <ChromeButton
              key={rank}
              className="option-segment option-rank"
              variant={pressed ? "gold" : "neutral"}
              aria-pressed={pressed}
              disabled={disabled}
              onClick={() => updateOption(field.key, next)}
            >
              {rank}
            </ChromeButton>
          );
        })}
      </div>
    );
  }

  function renderToggle(field: OptionField, current: unknown) {
    return (
      <div className="option-segmented" role="group" aria-label={field.label}>
        {[
          [true, "ON · 开"],
          [false, "OFF · 关"],
        ].map(([choice, label]) => (
          <ChromeButton
            key={String(choice)}
            className="option-segment"
            variant={current === choice ? "gold" : "neutral"}
            aria-pressed={current === choice}
            disabled={disabled}
            onClick={() => updateOption(field.key, choice)}
          >
            {label}
          </ChromeButton>
        ))}
      </div>
    );
  }

  function renderNumber(field: OptionField, current: unknown) {
    const id = fieldId(field.key);
    return (
      <input
        id={id}
        className="arcade-field option-number"
        type="number"
        inputMode="numeric"
        min={optionNumberMin(field.key)}
        value={numberDisplay(current)}
        disabled={
          disabled ||
          (field.key === "friendCallCount" &&
            effectiveRuleset.teams.mode !== "finding-friends")
        }
        onChange={(event) => updateOption(field.key, event.currentTarget.valueAsNumber)}
        aria-label={field.label}
      />
    );
  }

  function renderPair(field: OptionField, current: unknown) {
    const pair =
      typeof current === "object" && current !== null
        ? (current as Record<string, unknown>)
        : {};
    const pairFields = [
      ["defenderFailedThrow", "DEFENDERS · 守方"],
      ["attackerFailedThrow", "ATTACKERS · 攻方"],
    ] as const;
    return (
      <div className="option-pair">
        {pairFields.map(([pairKey, label]) => (
          <label
            key={pairKey}
            className="arcade-field-label"
            htmlFor={`${fieldId(field.key)}-${pairKey}`}
          >
            {label}
            <input
              id={`${fieldId(field.key)}-${pairKey}`}
              className="arcade-field"
              type="number"
              inputMode="numeric"
              value={numberDisplay(pair[pairKey])}
              disabled={disabled}
              onChange={(event) =>
                updateOption(field.key, {
                  defenderFailedThrow: pair.defenderFailedThrow ?? 0,
                  attackerFailedThrow: pair.attackerFailedThrow ?? 0,
                  [pairKey]: event.currentTarget.valueAsNumber,
                })
              }
            />
          </label>
        ))}
      </div>
    );
  }

  function renderControl(field: OptionField, current: unknown) {
    switch (field.control) {
      case "segmented-number":
        return renderSegmented(field, current);
      case "rank":
        return renderRank(field, current);
      case "rank-multi":
        return renderRankMulti(field, current);
      case "toggle":
        return renderToggle(field, current);
      case "pair":
        return renderPair(field, current);
      case "number":
        return renderNumber(field, current);
    }
  }

  return (
    <form className="options-editor" onSubmit={submit} noValidate>
      <PresetPicker
        presets={presets}
        value={value.presetId}
        disabled={disabled}
        onChange={selectPreset}
      />
      {issueText(mapped.byField, "presetId").map((issue) => (
        <p
          className="option-issue inline-error"
          role="alert"
          key={`${issue.path}:${issue.message}`}
        >
          {issue.message}
        </p>
      ))}

      {GROUPS.map((group) => {
        const groupFields = fields.filter((field) => field.group === group.id);
        if (groupFields.length === 0) return null;
        return (
          <section className="options-group" key={group.id}>
            <p className="eyebrow">{group.label}</p>
            {groupFields.map((field) => {
              const current = fieldValue(effectiveRuleset, field.key);
              const overridden = hasOptionOverride(value.options, field.key);
              const issues = issueText(mapped.byField, field.key);
              return (
                <div className="option-row" key={field.key}>
                  <div className="option-row-heading">
                    <label
                      className="arcade-field-label"
                      htmlFor={
                        field.control === "number" ? fieldId(field.key) : undefined
                      }
                    >
                      {field.label}
                    </label>
                    {overridden && (
                      <span className="option-override">
                        OVERRIDE · 覆盖
                        <ChromeButton
                          className="option-reset"
                          variant="neutral"
                          disabled={disabled}
                          onClick={() => resetOption(field.key)}
                        >
                          默认
                        </ChromeButton>
                      </span>
                    )}
                  </div>
                  {renderControl(field, current)}
                  {field.key === "friendCallCount" &&
                    effectiveRuleset.teams.mode !== "finding-friends" && (
                      <small className="option-hint">
                        Finding friends only · 仅找朋友模式
                      </small>
                    )}
                  {issues.map((issue) => (
                    <p
                      className="option-issue"
                      role="alert"
                      key={`${issue.path}:${issue.message}`}
                    >
                      {issue.message}
                    </p>
                  ))}
                </div>
              );
            })}
          </section>
        );
      })}

      {formIssues.map((issue) => (
        <p
          className="inline-error options-form-error"
          role="alert"
          key={`${issue.path}:${issue.message}`}
        >
          {issue.message}
        </p>
      ))}
      {onSubmit !== undefined && (
        <ChromeButton
          type="submit"
          className="options-submit"
          variant="primary"
          disabled={disabled || invalid}
        >
          {submitLabel}
        </ChromeButton>
      )}
    </form>
  );
}
