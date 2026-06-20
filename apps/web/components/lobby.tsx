"use client";

import type { PrivateGameView, WireClientCommand } from "@shengji/protocol";
import { useState } from "react";

type LobbyProps = {
  view: PrivateGameView;
  sendCommand: (command: WireClientCommand) => boolean;
};

export function Lobby({ view, sendCommand }: LobbyProps) {
  const [copied, setCopied] = useState(false);
  const occupied = view.seats.filter(({ playerId }) => playerId !== null).length;
  const you = view.seats.find(({ playerId }) => playerId === view.you.playerId);

  async function copyInvite() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1_600);
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
          <button
            className="button button-ghost"
            type="button"
            onClick={() => void copyInvite()}
          >
            {copied ? "Copied!" : "Copy invite"}
          </button>
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
            const teammate = seat.seat % 2 === (view.you.seat ?? seat.seat) % 2;
            return (
              <button
                key={seat.seat}
                type="button"
                className={`lobby-seat ${isYou ? "is-you" : ""}`}
                disabled={seat.playerId !== null && !isYou}
                onClick={() => sendCommand({ type: "SIT", seat: seat.seat })}
              >
                <span className="seat-number">0{seat.seat + 1}</span>
                <span className="seat-avatar">
                  {seat.name?.slice(0, 1).toUpperCase() ?? "+"}
                </span>
                <strong>{seat.name ?? "Open seat"}</strong>
                <small>
                  {isYou
                    ? "You"
                    : seat.playerId === null
                      ? "Tap to sit"
                      : teammate
                        ? "Team jade"
                        : "Team ember"}
                </small>
                {seat.ready && <span className="ready-stamp">READY</span>}
              </button>
            );
          })}
        </div>

        <footer className="lobby-footer">
          <div>
            <strong>{occupied} / 4 seated</strong>
            <span>All players must be ready to deal.</span>
          </div>
          <button
            type="button"
            className="button button-primary"
            disabled={view.you.seat === null}
            onClick={() => sendCommand({ type: "READY", ready: !you?.ready })}
          >
            {you?.ready ? "Not ready" : "Ready up"}
          </button>
        </footer>
      </section>
    </main>
  );
}
