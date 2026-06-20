"use client";

import { useState, type FormEvent } from "react";
import { useGameRoom } from "../hooks/use-game-room";
import { GameTable } from "./game-table";
import { Lobby } from "./lobby";

export function RoomClient({ roomId }: { roomId: string }) {
  const { view, status, error, clearError, join, sendCommand } = useGameRoom(roomId);
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    setJoining(true);
    try {
      await join(name);
    } catch (joinError) {
      clearError();
      window.setTimeout(() => {
        const message =
          joinError instanceof Error ? joinError.message : "Could not join";
        window.alert(message);
      }, 0);
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
        <Lobby view={view} sendCommand={sendCommand} />
      ) : (
        <GameTable view={view} sendCommand={sendCommand} />
      )}
      <div className={`connection-pill connection-${status}`}>
        <i /> {status === "connected" ? "Live" : status}
      </div>
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
