"use client";

import { useEffect, useRef, useState } from "react";
import { useGameRoom } from "../hooks/use-game-room";
import { GameTable } from "./game-table";
import { Lobby } from "./lobby";

const PLAYER_NAMES = ["Player 1", "Player 2", "Player 3", "Player 4"] as const;

/**
 * Practice mode: one browser controls all four players. Each player has its
 * own session slot and WebSocket; the switcher picks whose view and actions
 * are shown, so every flow can be explored end-to-end without other clients.
 */
export function PracticeRoomClient({ roomId }: { roomId: string }) {
  const p1 = useGameRoom(roomId, "practice-1");
  const p2 = useGameRoom(roomId, "practice-2");
  const p3 = useGameRoom(roomId, "practice-3");
  const p4 = useGameRoom(roomId, "practice-4");
  const players = [p1, p2, p3, p4];
  const [active, setActive] = useState(0);
  const joinAttempted = useRef(new Set<number>());

  // Auto-join all four seats' sessions once.
  useEffect(() => {
    players.forEach((player, index) => {
      if (player.status === "join-required" && !joinAttempted.current.has(index)) {
        joinAttempted.current.add(index);
        void player.join(PLAYER_NAMES[index]!).catch(() => {
          joinAttempted.current.delete(index);
        });
      }
    });
    // players is recreated per render; the statuses are the real dependency.
  }, [p1.status, p2.status, p3.status, p4.status]);

  const current = players[active]!;
  const view = current.view;

  return (
    <>
      <div className="practice-bar" role="tablist" aria-label="Practice players">
        <span className="practice-label">PRACTICE</span>
        {players.map((player, index) => {
          const seat = player.view?.you.seat;
          const isTurn =
            seat !== null &&
            seat !== undefined &&
            player.view?.publicRound?.currentTurnSeat === seat;
          return (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={active === index}
              className={`practice-tab ${active === index ? "is-active" : ""} ${isTurn ? "is-turn" : ""}`}
              onClick={() => setActive(index)}
            >
              {PLAYER_NAMES[index]}
              {seat !== null && seat !== undefined ? ` · S${seat + 1}` : ""}
              {isTurn ? " ●" : ""}
            </button>
          );
        })}
      </div>
      {view === null ? (
        <main className="join-shell">
          <div className="loading-mark">升</div>
          <strong>Opening the practice table…</strong>
        </main>
      ) : view.phase === "lobby" ? (
        <Lobby
          view={view}
          sendCommand={current.sendCommand}
          onLeave={current.leaveSession}
        />
      ) : (
        <GameTable
          view={view}
          sendCommand={current.sendCommand}
          onLeave={current.leaveSession}
          turnDeadline={current.turnDeadline}
          serverNow={current.serverNow}
        />
      )}
      {current.error && (
        <button type="button" className="error-toast" onClick={current.clearError}>
          <strong>That move didn’t work</strong>
          <span>{current.error}</span>
          <i>×</i>
        </button>
      )}
    </>
  );
}
