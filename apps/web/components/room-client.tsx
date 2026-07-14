"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useGameRoom } from "../hooks/use-game-room";
import { NOTICE_DISMISS_MS, TOAST_DISMISS_MS } from "../lib/constants";
import { GameTable } from "./game-table";
import { Lobby } from "./lobby";
import { ChromeButton } from "./ui-chrome";

/** Announces seat connection changes ("Ada disconnected") as passing notices. */
function useConnectionNotices(
  seats:
    | {
        playerId: string | null;
        name: string | null;
        connected: boolean;
        isBot: boolean;
      }[]
    | undefined,
) {
  const [notice, setNotice] = useState<string | null>(null);
  const previous = useRef(new Map<string, { connected: boolean; isBot: boolean }>());

  useEffect(() => {
    if (seats === undefined) return;
    for (const seat of seats) {
      if (seat.playerId === null) continue;
      const before = previous.current.get(seat.playerId);
      if (before !== undefined && before.isBot !== seat.isBot) {
        setNotice(
          `${seat.name ?? "A player"} ${
            seat.isBot ? "is now controlled by a bot" : "reclaimed their seat"
          }`,
        );
      } else if (before !== undefined && before.connected !== seat.connected) {
        setNotice(
          `${seat.name ?? "A player"} ${
            seat.connected ? "reconnected" : "disconnected"
          }`,
        );
      }
      previous.current.set(seat.playerId, {
        connected: seat.connected,
        isBot: seat.isBot,
      });
    }
  }, [seats]);

  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  return { notice, clearNotice: () => setNotice(null) };
}

export function RoomClient({
  roomId,
  autoStart = false,
}: {
  roomId: string;
  /** Practice tables sit and ready the human automatically, skipping the lobby. */
  autoStart?: boolean;
}) {
  const {
    view,
    status,
    error,
    clearError,
    join,
    sendCommand,
    sendTrackedCommand,
    trackedRejections,
    consumeRejection,
    leaveSession,
    turnDeadline,
    serverNow,
  } = useGameRoom(roomId);
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const autoSitAttempted = useRef(false);
  const autoReadyAttempted = useRef(false);
  // Reveal the lobby if an auto-start table has not begun dealing in time, so a
  // stalled sit/ready never leaves the player on a dead loading screen.
  const [autoStartStalled, setAutoStartStalled] = useState(false);
  const { notice, clearNotice } = useConnectionNotices(view?.seats);
  const reducedMotion = useReducedMotion() ?? false;

  useEffect(() => {
    if (view?.phase !== "lobby" || view.you.seat !== null || autoSitAttempted.current) {
      return;
    }
    const occupied = view.seats.filter(({ playerId }) => playerId !== null);
    if (occupied.length === 0 || occupied.some(({ isBot }) => !isBot)) return;
    const open = view.seats.find(({ playerId }) => playerId === null);
    if (open !== undefined && sendCommand({ type: "SIT", seat: open.seat })) {
      autoSitAttempted.current = true;
    }
  }, [sendCommand, view]);

  // Practice tables ready the human as soon as they are seated with an all-bot
  // table, so the round starts without a manual lobby step.
  useEffect(() => {
    if (!autoStart || view?.phase !== "lobby" || autoReadyAttempted.current) return;
    const mine = view.seats.find(({ playerId }) => playerId === view.you.playerId);
    if (mine === undefined || mine.ready) return;
    const others = view.seats.filter(
      ({ playerId }) => playerId !== null && playerId !== view.you.playerId,
    );
    if (others.length === 0 || others.some(({ isBot }) => !isBot)) return;
    if (sendCommand({ type: "READY" })) {
      autoReadyAttempted.current = true;
    }
  }, [autoStart, sendCommand, view]);

  // Safety net: if the auto-start table is still in the lobby after a few
  // seconds, fall back to the manual lobby instead of a stuck loading screen.
  useEffect(() => {
    if (!autoStart || view?.phase !== "lobby") {
      setAutoStartStalled(false);
      return;
    }
    const timer = setTimeout(() => setAutoStartStalled(true), 6_000);
    return () => clearTimeout(timer);
  }, [autoStart, view?.phase]);

  // Every toast auto-dismisses; all remain click-dismissable.
  useEffect(() => {
    if (joinError === null) return;
    const timer = setTimeout(() => setJoinError(null), TOAST_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [joinError]);

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

  const autoStarting = autoStart && view?.phase === "lobby" && !autoStartStalled;
  const screenKey =
    status === "join-required"
      ? "join"
      : view === null || autoStarting
        ? "loading"
        : view.phase === "lobby"
          ? "lobby"
          : "table";
  // A resumed game can mount with a full, overlapped hand already present.
  // Keep that entire card-bearing tree opaque; only non-table screens use the
  // shared cross-fade.
  const tableScreenMotion = { initial: false as const };
  const transitionalScreenMotion = {
    initial: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
    exit: reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 },
    transition: { duration: reducedMotion ? 0.18 : 0.22, ease: "easeOut" },
  } as const;
  const screenMotion =
    screenKey === "table" ? tableScreenMotion : transitionalScreenMotion;

  const screen =
    status === "join-required" ? (
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
            <ChromeButton
              type="submit"
              variant="primary"
              disabled={joining || name.trim().length === 0}
            >
              {joining ? "Joining…" : "Take a seat"}
            </ChromeButton>
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
    ) : view === null ? (
      <main className="join-shell">
        <div className="loading-mark">升</div>
        <strong>
          {status === "reconnecting" ? "Rejoining your table…" : "Opening the table…"}
        </strong>
        <small>Your seat and hand are restored from the server.</small>
      </main>
    ) : autoStarting ? (
      <main className="join-shell">
        <div className="loading-mark">升</div>
        <strong>Dealing you in…</strong>
        <small>Shuffling the deck and seating your bots.</small>
      </main>
    ) : view.phase === "lobby" ? (
      <Lobby
        view={view}
        sendCommand={sendCommand}
        sendTrackedCommand={sendTrackedCommand}
        trackedRejections={trackedRejections}
        consumeRejection={consumeRejection}
        onLeave={leaveSession}
      />
    ) : (
      <GameTable
        view={view}
        sendCommand={sendCommand}
        sendTrackedCommand={sendTrackedCommand}
        trackedRejections={trackedRejections}
        consumeRejection={consumeRejection}
        onLeave={leaveSession}
        turnDeadline={turnDeadline}
        serverNow={serverNow}
      />
    );

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div key={screenKey} className="room-screen" {...screenMotion}>
          {screen}
        </motion.div>
      </AnimatePresence>
      {view !== null && status !== "join-required" && (
        <>
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
      )}
    </>
  );
}
