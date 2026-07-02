"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useGameRoom } from "../hooks/use-game-room";
import { NOTICE_DISMISS_MS } from "../lib/constants";
import { GameTable } from "./game-table";
import { Lobby } from "./lobby";

/** Announces seat connection changes ("Ada disconnected") as passing notices. */
function useConnectionNotices(
  seats:
    | { playerId: string | null; name: string | null; connected: boolean }[]
    | undefined,
) {
  const [notice, setNotice] = useState<string | null>(null);
  const previous = useRef(new Map<string, boolean>());

  useEffect(() => {
    if (seats === undefined) return;
    for (const seat of seats) {
      if (seat.playerId === null) continue;
      const wasConnected = previous.current.get(seat.playerId);
      if (wasConnected !== undefined && wasConnected !== seat.connected) {
        setNotice(
          `${seat.name ?? "A player"} ${seat.connected ? "reconnected" : "disconnected"}`,
        );
      }
      previous.current.set(seat.playerId, seat.connected);
    }
  }, [seats]);

  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  return { notice, clearNotice: () => setNotice(null) };
}

export function RoomClient({ roomId }: { roomId: string }) {
  const {
    view,
    status,
    error,
    clearError,
    join,
    sendCommand,
    leaveSession,
    turnDeadline,
    serverNow,
  } = useGameRoom(roomId);
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const { notice, clearNotice } = useConnectionNotices(view?.seats);

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    setJoining(true);
    setJoinError(null);
    try {
      await join(name);
    } catch (cause) {
      setJoinError(cause instanceof Error ? cause.message : "Could not join");
    } finally {
      setJoining(false);
    }
  }

  if (status === "join-required") {
    return (
      <main className="join-shell">
        <div className="ambient-orb orb-one" />
        <div className="ambient-orb orb-two" />
        <section className="join-card glass-panel">
          <span className="brand-mark large">升</span>
          <p className="eyebrow">YOU’RE INVITED · 邀请</p>
          <h1>Join room {roomId}</h1>
          <p>One name, no account. Your browser keeps a private reconnect key.</p>
          <form onSubmit={(event) => void handleJoin(event)}>
            <label htmlFor="display-name">Display name</label>
            <input
              id="display-name"
              autoFocus
              autoComplete="nickname"
              maxLength={32}
              placeholder="How should friends see you?"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <button
              className="button button-primary"
              disabled={joining || name.trim().length === 0}
            >
              {joining ? "Joining…" : "Take a seat"}
            </button>
          </form>
        </section>
        {joinError && (
          <button
            type="button"
            className="error-toast"
            onClick={() => setJoinError(null)}
          >
            <strong>Could not join</strong>
            <span>{joinError}</span>
            <i>×</i>
          </button>
        )}
      </main>
    );
  }

  if (view === null) {
    return (
      <main className="join-shell">
        <div className="loading-mark">升</div>
        <strong>
          {status === "reconnecting" ? "Rejoining your table…" : "Opening the table…"}
        </strong>
        <small>Your seat and hand are restored from the server.</small>
      </main>
    );
  }

  return (
    <>
      {view.phase === "lobby" ? (
        <Lobby view={view} sendCommand={sendCommand} onLeave={leaveSession} />
      ) : (
        <GameTable
          view={view}
          sendCommand={sendCommand}
          onLeave={leaveSession}
          turnDeadline={turnDeadline}
          serverNow={serverNow}
        />
      )}
      <div className={`connection-pill connection-${status}`}>
        <i /> {status === "connected" ? "Live" : status}
      </div>
      {notice && (
        <button type="button" className="notice-toast" onClick={clearNotice}>
          <span>{notice}</span>
          <i>×</i>
        </button>
      )}
      {error && (
        <button type="button" className="error-toast" onClick={clearError}>
          <strong>That move didn’t work</strong>
          <span>{error}</span>
          <i>×</i>
        </button>
      )}
    </>
  );
}
