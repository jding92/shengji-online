"use client";

import type {
  BotDifficulty,
  PrivateGameView,
  WireClientCommand,
} from "@shengji/protocol";
import { useState } from "react";
import { addBot, removeBot } from "../lib/bot-api";
import { teamLabelForSeat } from "../lib/strings";
import { LeaveButton } from "./leave-button";
import { SeatAvatar } from "./seat-avatar";
import { ChromeButton } from "./ui-chrome";

type LobbyProps = {
  view: PrivateGameView;
  sendCommand: (command: WireClientCommand) => boolean;
  onLeave: () => void;
};

function difficultyLabel(difficulty: BotDifficulty | undefined): string {
  return difficulty === undefined
    ? "Bot"
    : `Bot · ${difficulty.charAt(0).toUpperCase()}${difficulty.slice(1)}`;
}

export function Lobby({ view, sendCommand, onLeave }: LobbyProps) {
  const [copied, setCopied] = useState(false);
  const [difficultyBySeat, setDifficultyBySeat] = useState<
    Record<number, BotDifficulty>
  >({});
  const [pendingBot, setPendingBot] = useState<string | null>(null);
  const [botError, setBotError] = useState<string | null>(null);
  const occupied = view.seats.filter(({ playerId }) => playerId !== null).length;
  const you = view.seats.find(({ playerId }) => playerId === view.you.playerId);

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
          <ChromeButton variant="neutral" onClick={() => void copyInvite()}>
            {copied ? "Copied!" : "Copy invite"}
          </ChromeButton>
        </div>

        <div className="rules-ribbon" aria-label="Room rules">
          <span>4 players</span>
          <i />
          <span>2 decks</span>
          <i />
          <span>Fixed teams</span>
          <i />
          <span>Throws on</span>
        </div>

        <div className="seat-picker">
          {view.seats.map((seat) => {
            const isYou = seat.playerId === view.you.playerId;
            const difficulty = difficultyBySeat[seat.seat] ?? "intermediate";
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
                          : `Team ${teamLabelForSeat(seat.seat).toLowerCase()}`}
                  </small>
                  {seat.isBot && <span className="bot-badge">BOT</span>}
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
            <strong>{occupied} / 4 seated</strong>
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
    </main>
  );
}
