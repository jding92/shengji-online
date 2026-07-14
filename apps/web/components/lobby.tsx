"use client";

import type {
  BotDifficulty,
  PrivateGameView,
  WireClientCommand,
} from "@shengji/protocol";
import { useEffect, useRef, useState } from "react";
import { addBot, removeBot } from "../lib/bot-api";
import { fetchPresets, type PresetSummary } from "../lib/presets";
import { describeRules, resolveViewRuleset, rulesetSignature } from "../lib/rules";
import { teamLabelForTeamId } from "../lib/strings";
import type { OptionServerIssues, OptionsEditorValue } from "./options-editor";
import { OptionsEditor } from "./options-editor";
import { ChromeModal } from "./chrome-modal";
import { LeaveButton } from "./leave-button";
import { SeatAvatar } from "./seat-avatar";
import { ChromeButton } from "./ui-chrome";

type LobbyProps = {
  view: PrivateGameView;
  sendCommand: (command: WireClientCommand) => string | null;
  sendTrackedCommand: (command: WireClientCommand) => string | null;
  trackedRejections: ReadonlyMap<string, { code: string; message: string }>;
  consumeRejection: (
    requestId: string,
  ) => { code: string; message: string } | undefined;
  onLeave: () => void;
};

export function shouldShowRulesChangedNotice(
  previousSignature: string | null,
  currentSignature: string,
  phase: PrivateGameView["phase"],
): boolean {
  return (
    previousSignature !== null &&
    phase === "lobby" &&
    previousSignature !== currentSignature
  );
}

export function LobbyRulesChangedNotice({
  show,
  onDismiss,
}: {
  show: boolean;
  onDismiss: () => void;
}) {
  if (!show) return null;
  return (
    <div className="lobby-notice" role="status">
      <span>Rules changed — ready up again · 规则已更改</span>
      <button
        type="button"
        aria-label="Dismiss rules changed notice"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}

export type LobbyRulesEditorProps = {
  open: boolean;
  draft: OptionsEditorValue | null;
  presets: readonly PresetSummary[];
  presetLoadError: string | null;
  canEdit: boolean;
  occupiedSeats: number[];
  joinedPlayerCount: number;
  pendingRequest: boolean;
  serverIssues?: OptionServerIssues;
  onClose: () => void;
  onChange: (next: OptionsEditorValue) => void;
  onSubmit?: () => void;
};

export function LobbyRulesEditor({
  open,
  draft,
  presets,
  presetLoadError,
  canEdit,
  occupiedSeats,
  joinedPlayerCount,
  pendingRequest,
  serverIssues,
  onClose,
  onChange,
  onSubmit,
}: LobbyRulesEditorProps) {
  return (
    <ChromeModal
      open={open && draft !== null}
      titleId="lobby-table-rules-title"
      onClose={onClose}
    >
      <div className="chrome-modal-heading">
        <div>
          <p className="eyebrow">TABLE RULES · 桌规</p>
          <h2 id="lobby-table-rules-title">
            {canEdit ? "Set the table" : "Table rules"}
          </h2>
        </div>
        <ChromeButton variant="neutral" onClick={onClose}>
          Close
        </ChromeButton>
      </div>
      {presetLoadError && <p className="inline-error">{presetLoadError}</p>}
      {draft !== null && (
        <OptionsEditor
          presets={presets}
          phase="lobby"
          value={draft}
          onChange={onChange}
          occupiedSeats={occupiedSeats}
          joinedPlayerCount={joinedPlayerCount}
          {...(serverIssues === undefined ? {} : { serverIssues })}
          disabled={!canEdit || pendingRequest}
          {...(onSubmit === undefined ? {} : { onSubmit })}
        />
      )}
    </ChromeModal>
  );
}

function difficultyLabel(difficulty: BotDifficulty | undefined): string {
  return difficulty === undefined
    ? "Bot"
    : `Bot · ${difficulty.charAt(0).toUpperCase()}${difficulty.slice(1)}`;
}

export function Lobby({
  view,
  sendCommand,
  sendTrackedCommand,
  trackedRejections,
  consumeRejection,
  onLeave,
}: LobbyProps) {
  const [copied, setCopied] = useState(false);
  const [difficultyBySeat, setDifficultyBySeat] = useState<
    Record<number, BotDifficulty>
  >({});
  const [pendingBot, setPendingBot] = useState<string | null>(null);
  const [botError, setBotError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesDraft, setRulesDraft] = useState<OptionsEditorValue | null>(null);
  const [presets, setPresets] = useState<PresetSummary[]>([]);
  const [presetLoadError, setPresetLoadError] = useState<string | null>(null);
  const presetsRequested = useRef(false);
  const [rulesServerIssues, setRulesServerIssues] = useState<
    OptionServerIssues | undefined
  >();
  const [submittedRulesSignature, setSubmittedRulesSignature] = useState<string | null>(
    null,
  );
  const [submittedRulesRevision, setSubmittedRulesRevision] = useState<number | null>(
    null,
  );
  const [pendingRulesRequestId, setPendingRulesRequestId] = useState<string | null>(
    null,
  );
  const previousRulesetSignature = useRef<string | null>(null);
  const [rulesChangedNotice, setRulesChangedNotice] = useState(false);
  const occupied = view.seats.filter(({ playerId }) => playerId !== null).length;
  const you = view.seats.find(({ playerId }) => playerId === view.you.playerId);
  const resolvedRuleset = resolveViewRuleset(view.ruleset);
  const ruleStrings = describeRules(resolvedRuleset, view.ruleset);
  const isHost = view.hostPlayerId === view.you.playerId;
  const canEditRules = view.legalActions.includes("update-options") && isHost;

  useEffect(() => {
    if (!rulesOpen || presetsRequested.current) return;
    presetsRequested.current = true;
    void fetchPresets()
      .then((response) => setPresets(response.presets))
      .catch((cause: unknown) => {
        setPresetLoadError(
          cause instanceof Error ? cause.message : "Could not load game presets",
        );
      });
  }, [rulesOpen]);

  useEffect(() => {
    const nextSignature = rulesetSignature(view.ruleset);
    if (
      shouldShowRulesChangedNotice(
        previousRulesetSignature.current,
        nextSignature,
        view.phase,
      )
    ) {
      setRulesChangedNotice(true);
    }
    previousRulesetSignature.current = nextSignature;
  }, [view.phase, view.ruleset]);

  useEffect(() => {
    if (
      submittedRulesSignature !== null &&
      submittedRulesRevision !== null &&
      view.revision > submittedRulesRevision &&
      rulesetSignature(view.ruleset) === submittedRulesSignature
    ) {
      setRulesOpen(false);
      setRulesDraft(null);
      setRulesServerIssues(undefined);
      setSubmittedRulesSignature(null);
      setSubmittedRulesRevision(null);
      setPendingRulesRequestId(null);
    }
  }, [submittedRulesRevision, submittedRulesSignature, view.revision, view.ruleset]);

  useEffect(() => {
    if (
      pendingRulesRequestId === null ||
      !trackedRejections.has(pendingRulesRequestId)
    ) {
      return;
    }
    const rejection = consumeRejection(pendingRulesRequestId);
    if (rejection !== undefined) {
      setRulesServerIssues({ error: rejection.message });
      setPendingRulesRequestId(null);
      setSubmittedRulesSignature(null);
      setSubmittedRulesRevision(null);
    }
  }, [consumeRejection, pendingRulesRequestId, trackedRejections]);

  async function copyInvite() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1_600);
  }

  async function changeBot(key: string, action: () => Promise<void>): Promise<void> {
    setPendingBot(key);
    setBotError(null);
    try {
      await action();
    } catch (cause) {
      setBotError(cause instanceof Error ? cause.message : "Could not update the bot");
    } finally {
      setPendingBot(null);
    }
  }

  function openRules() {
    setRulesDraft({ presetId: view.ruleset.presetId, options: view.ruleset.options });
    setRulesServerIssues(undefined);
    setSubmittedRulesSignature(null);
    setSubmittedRulesRevision(null);
    setPendingRulesRequestId(null);
    setRulesOpen(true);
  }

  function submitRules() {
    if (!canEditRules || rulesDraft === null) return;
    const requestId = sendTrackedCommand({
      type: "UPDATE_OPTIONS",
      presetId: rulesDraft.presetId,
      options: rulesDraft.options,
    });
    if (requestId === null) return;
    setPendingRulesRequestId(requestId);
    setSubmittedRulesSignature(
      rulesetSignature({
        ...view.ruleset,
        presetId: rulesDraft.presetId,
        options: rulesDraft.options,
      }),
    );
    setSubmittedRulesRevision(view.revision);
  }

  return (
    <main className="lobby-shell">
      <div className="ambient-orb orb-one" />
      <div className="ambient-orb orb-two" />
      <section className="lobby-card glass-panel">
        <p className="eyebrow">PRIVATE TABLE · 私人牌桌</p>
        <div className="lobby-heading">
          <div>
            <h1>Room {view.roomId}</h1>
            <p>Choose a seat, settle in, and ready up.</p>
          </div>
          <div className="lobby-heading-actions">
            <ChromeButton variant="gold" onClick={openRules}>
              TABLE RULES · 桌规
            </ChromeButton>
            <ChromeButton variant="neutral" onClick={() => void copyInvite()}>
              {copied ? "Copied!" : "Copy invite"}
            </ChromeButton>
          </div>
        </div>

        <div className="rules-ribbon" aria-label="Room rules">
          {ruleStrings.map((rule, index) => (
            <span
              className={rule === "CUSTOM · 自定义" ? "rules-ribbon-custom" : undefined}
              key={rule}
            >
              {index > 0 && <i />}
              {rule}
            </span>
          ))}
        </div>

        <LobbyRulesChangedNotice
          show={rulesChangedNotice}
          onDismiss={() => setRulesChangedNotice(false)}
        />

        <div className="seat-picker">
          {view.seats.map((seat) => {
            const isYou = seat.playerId === view.you.playerId;
            const difficulty = difficultyBySeat[seat.seat] ?? "intermediate";
            const teamLabel = teamLabelForTeamId(seat.teamId);
            return (
              <div key={seat.seat} className={`lobby-seat ${isYou ? "is-you" : ""}`}>
                <button
                  type="button"
                  className="lobby-seat-main"
                  disabled={seat.playerId !== null && !isYou}
                  onClick={() => sendCommand({ type: "SIT", seat: seat.seat })}
                >
                  <span className="seat-number">0{seat.seat + 1}</span>
                  {seat.playerId === null ? (
                    <span className="seat-avatar">+</span>
                  ) : (
                    <SeatAvatar seat={seat.seat} />
                  )}
                  <strong>{seat.name ?? "Open seat"}</strong>
                  <small>
                    {isYou
                      ? "You"
                      : seat.isBot
                        ? difficultyLabel(seat.botDifficulty)
                        : seat.playerId === null
                          ? "Tap to sit"
                          : teamLabel === null
                            ? "Side unrevealed"
                            : `Team ${teamLabel.toLowerCase()}`}
                  </small>
                  {seat.isBot && <span className="bot-badge">BOT</span>}
                  {seat.playerId === view.hostPlayerId && (
                    <span className="host-badge">HOST</span>
                  )}
                  {seat.ready && <span className="ready-stamp">READY</span>}
                </button>
                {seat.isBot && seat.playerId !== null && (
                  <button
                    type="button"
                    className="remove-bot"
                    aria-label={`Remove ${seat.name ?? "bot"}`}
                    disabled={pendingBot === `remove:${seat.playerId}`}
                    onClick={() =>
                      void changeBot(`remove:${seat.playerId}`, () =>
                        removeBot(view.roomId, seat.playerId!),
                      )
                    }
                  >
                    ×
                  </button>
                )}
                {seat.playerId === null && (
                  <div className="add-bot-control">
                    <select
                      aria-label={`Bot difficulty for seat ${seat.seat + 1}`}
                      value={difficulty}
                      disabled={pendingBot === `add:${seat.seat}`}
                      onChange={(event) =>
                        setDifficultyBySeat((current) => ({
                          ...current,
                          [seat.seat]: event.target.value as BotDifficulty,
                        }))
                      }
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert</option>
                    </select>
                    <button
                      type="button"
                      disabled={pendingBot === `add:${seat.seat}`}
                      onClick={() =>
                        void changeBot(`add:${seat.seat}`, () =>
                          addBot(view.roomId, seat.seat, difficulty),
                        )
                      }
                    >
                      {pendingBot === `add:${seat.seat}` ? "Adding…" : "Add bot"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {botError && <p className="inline-error">{botError}</p>}

        <footer className="lobby-footer">
          <div>
            <strong>
              {occupied} / {view.ruleset.players} seated
            </strong>
            <span>All players must be ready to deal.</span>
          </div>
          <div className="lobby-footer-actions">
            <LeaveButton onLeave={onLeave} />
            <ChromeButton
              variant="primary"
              disabled={view.you.seat === null}
              onClick={() => sendCommand({ type: "READY", ready: !you?.ready })}
            >
              {you?.ready ? "Not ready" : "Ready up"}
            </ChromeButton>
          </div>
        </footer>
      </section>
      <LobbyRulesEditor
        open={rulesOpen}
        draft={rulesDraft}
        presets={presets}
        presetLoadError={presetLoadError}
        canEdit={canEditRules}
        occupiedSeats={view.seats
          .filter(({ playerId }) => playerId !== null)
          .map(({ seat }) => seat)}
        joinedPlayerCount={view.joinedPlayerCount}
        pendingRequest={pendingRulesRequestId !== null}
        {...(rulesServerIssues === undefined
          ? {}
          : { serverIssues: rulesServerIssues })}
        onClose={() => setRulesOpen(false)}
        onChange={(next) => {
          setRulesDraft(next);
          setRulesServerIssues(undefined);
        }}
        {...(canEditRules ? { onSubmit: submitRules } : {})}
      />
    </main>
  );
}
