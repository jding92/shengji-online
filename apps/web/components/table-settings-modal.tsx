"use client";

import type {
  BotDifficulty,
  PrivateGameView,
  WireClientCommand,
} from "@shengji/protocol";
import { useEffect, useState } from "react";
import { changeBotDifficulty } from "../lib/bot-api";
import { rulesetSignature } from "../lib/rules";
import type { OptionServerIssues, OptionsEditorValue } from "./options-editor";
import { OptionsEditor } from "./options-editor";
import { ChromeModal } from "./chrome-modal";
import { ChromeButton } from "./ui-chrome";

type TableSettingsModalProps = {
  open: boolean;
  view: PrivateGameView;
  sendTrackedCommand: (command: WireClientCommand) => string | null;
  trackedRejections: ReadonlyMap<string, { code: string; message: string }>;
  consumeRejection: (
    requestId: string,
  ) => { code: string; message: string } | undefined;
  onClose: () => void;
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

export function TableSettingsModal({
  open,
  view,
  sendTrackedCommand,
  trackedRejections,
  consumeRejection,
  onClose,
}: TableSettingsModalProps) {
  const canEditTimers = view.legalActions.includes("update-options");
  const bots = view.seats.filter((seat) => seat.isBot && seat.playerId !== null);
  const [draft, setDraft] = useState<OptionsEditorValue | null>(() =>
    open ? { presetId: view.ruleset.presetId, options: view.ruleset.options } : null,
  );
  const [serverIssues, setServerIssues] = useState<OptionServerIssues | undefined>();
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [submittedSignature, setSubmittedSignature] = useState<string | null>(null);
  const [submittedRevision, setSubmittedRevision] = useState<number | null>(null);
  const [pendingBotId, setPendingBotId] = useState<string | null>(null);
  const [botErrors, setBotErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setDraft({ presetId: view.ruleset.presetId, options: view.ruleset.options });
    setServerIssues(undefined);
    setPendingRequestId(null);
    setSubmittedSignature(null);
    setSubmittedRevision(null);
  }, [open, view.ruleset]);

  useEffect(() => {
    if (
      submittedSignature !== null &&
      submittedRevision !== null &&
      view.revision > submittedRevision &&
      rulesetSignature(view.ruleset) === submittedSignature
    ) {
      onClose();
      setDraft(null);
      setServerIssues(undefined);
      setPendingRequestId(null);
      setSubmittedSignature(null);
      setSubmittedRevision(null);
    }
  }, [onClose, submittedRevision, submittedSignature, view.revision, view.ruleset]);

  useEffect(() => {
    if (pendingRequestId === null || !trackedRejections.has(pendingRequestId)) return;
    const rejection = consumeRejection(pendingRequestId);
    if (rejection === undefined) return;
    setServerIssues({ error: rejection.message });
    setPendingRequestId(null);
    setSubmittedSignature(null);
    setSubmittedRevision(null);
  }, [consumeRejection, pendingRequestId, trackedRejections]);

  function submitTimers() {
    if (!canEditTimers || draft === null) return;
    const requestId = sendTrackedCommand({
      type: "UPDATE_OPTIONS",
      presetId: view.ruleset.presetId,
      options: draft.options,
    });
    if (requestId === null) return;
    setPendingRequestId(requestId);
    setSubmittedSignature(
      rulesetSignature({ ...view.ruleset, options: draft.options }),
    );
    setSubmittedRevision(view.revision);
  }

  async function applyBotDifficulty(botId: string, difficulty: BotDifficulty) {
    setPendingBotId(botId);
    setBotErrors((current) => {
      const next = { ...current };
      delete next[botId];
      return next;
    });
    try {
      await changeBotDifficulty(view.roomId, botId, difficulty);
    } catch (cause) {
      setBotErrors((current) => ({
        ...current,
        [botId]: cause instanceof Error ? cause.message : "Could not update the bot",
      }));
    } finally {
      setPendingBotId(null);
    }
  }

  return (
    <ChromeModal open={open} titleId="table-settings-title" onClose={onClose}>
      <div className="chrome-modal-heading">
        <div>
          <p className="eyebrow">TABLE SETTINGS · 桌面设置</p>
          <h2 id="table-settings-title">Table settings</h2>
        </div>
        <ChromeButton variant="neutral" onClick={onClose}>
          Close
        </ChromeButton>
      </div>

      {canEditTimers && draft !== null && (
        <section className="table-settings-section">
          <p className="eyebrow">TIMERS · 时限</p>
          <OptionsEditor
            phase={view.phase}
            value={draft}
            onChange={(next) => {
              setDraft(next);
              setServerIssues(undefined);
            }}
            occupiedSeats={view.seats
              .filter(({ playerId }) => playerId !== null)
              .map(({ seat }) => seat)}
            joinedPlayerCount={view.joinedPlayerCount}
            {...(serverIssues === undefined ? {} : { serverIssues })}
            disabled={pendingRequestId !== null}
            onSubmit={submitTimers}
          />
        </section>
      )}

      {bots.length > 0 && (
        <section className="table-settings-section">
          <p className="eyebrow">BOTS · 机器人</p>
          <div className="table-bot-list">
            {bots.map((bot) => {
              const botId = bot.playerId!;
              const currentDifficulty = bot.botDifficulty ?? "intermediate";
              const pending = pendingBotId === botId;
              return (
                <div className="table-bot-row" key={botId}>
                  <div className="table-bot-heading">
                    <strong>{bot.name ?? `Seat ${bot.seat + 1}`}</strong>
                    <small>{difficultyLabel(currentDifficulty)}</small>
                  </div>
                  <div className="difficulty-picker">
                    <span className="difficulty-picker-label">DIFFICULTY · 难度</span>
                    <div
                      className="difficulty-options"
                      role="group"
                      aria-label={`Difficulty for ${bot.name ?? `seat ${bot.seat + 1}`}`}
                    >
                      {DIFFICULTIES.map((difficulty) => (
                        <ChromeButton
                          key={difficulty}
                          className="difficulty-option"
                          variant={
                            currentDifficulty === difficulty ? "gold" : "neutral"
                          }
                          aria-pressed={currentDifficulty === difficulty}
                          disabled={pending}
                          onClick={() => void applyBotDifficulty(botId, difficulty)}
                        >
                          {difficultyLabel(difficulty)}
                        </ChromeButton>
                      ))}
                    </div>
                  </div>
                  {botErrors[botId] !== undefined && (
                    <p className="inline-error" role="alert">
                      {botErrors[botId]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </ChromeModal>
  );
}
