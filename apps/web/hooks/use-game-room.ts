"use client";

import {
  PROTOCOL_VERSION,
  type PrivateGameView,
  type ServerEnvelope,
  type WireClientCommand,
} from "@shengji/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  TOAST_DISMISS_MS,
} from "../lib/constants";
import { safeStorage } from "../lib/safe-storage";
import { sessionKey } from "../lib/session";

export type ConnectionStatus =
  | "join-required"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline";

function socketUrl(roomId: string, token: string): string {
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  const base =
    configured ??
    `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:3001/ws`;
  const url = new URL(base);
  url.searchParams.set("roomId", roomId);
  url.searchParams.set("token", token);
  return url.toString();
}

export function useGameRoom(roomId: string) {
  const [view, setView] = useState<PrivateGameView | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const viewRef = useRef<PrivateGameView | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const claimedRequestIdsRef = useRef(new Set<string>());
  /** serverTime - clientTime, updated from TIMER_TICK; keeps countdowns honest. */
  const serverOffsetRef = useRef(0);
  const [turnDeadline, setTurnDeadline] = useState<string | null>(null);
  const [trackedRejections, setTrackedRejections] = useState<
    Map<string, { code: string; message: string }>
  >(new Map());

  const updateView = useCallback((next: PrivateGameView) => {
    viewRef.current = next;
    setView(next);
  }, []);

  const connect = useCallback(
    (token: string, reconnecting = false) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) return;
      setStatus(reconnecting ? "reconnecting" : "connecting");
      intentionalCloseRef.current = false;
      const socket = new WebSocket(socketUrl(roomId, token));
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        attemptsRef.current = 0;
        setStatus("connected");
        setError(null);
      });
      socket.addEventListener("message", (message) => {
        let envelope: ServerEnvelope;
        try {
          envelope = JSON.parse(String(message.data)) as ServerEnvelope;
        } catch {
          setError("The server sent an unreadable update.");
          return;
        }
        if (envelope.type === "SNAPSHOT" || envelope.type === "EVENTS") {
          updateView(envelope.view);
          return;
        }
        if (envelope.type === "TIMER_TICK") {
          serverOffsetRef.current = Date.parse(envelope.serverTime) - Date.now();
          setTurnDeadline(envelope.deadline);
          return;
        }
        if (claimedRequestIdsRef.current.has(envelope.requestId)) {
          setTrackedRejections((previous) => {
            const next = new Map(previous);
            next.set(envelope.requestId, {
              code: envelope.code,
              message: envelope.message,
            });
            return next;
          });
          if (envelope.code === "STALE_REVISION") {
            socket.close(4000, "Refresh stale state");
          }
          return;
        }
        setError(envelope.message);
        if (envelope.code === "STALE_REVISION") {
          socket.close(4000, "Refresh stale state");
        }
      });
      socket.addEventListener("close", () => {
        if (socketRef.current === socket) socketRef.current = null;
        if (intentionalCloseRef.current) return;
        attemptsRef.current += 1;
        const delay = Math.min(
          RECONNECT_MAX_MS,
          RECONNECT_BASE_MS * 2 ** attemptsRef.current,
        );
        setStatus(navigator.onLine ? "reconnecting" : "offline");
        retryRef.current = setTimeout(() => connect(token, true), delay);
      });
      socket.addEventListener("error", () => {
        setError("Could not reach the game server. Retrying…");
      });
    },
    [roomId, updateView],
  );

  useEffect(() => {
    const stored = safeStorage.get(sessionKey(roomId));
    if (stored === null) setStatus("join-required");
    else connect(stored);
    return () => {
      intentionalCloseRef.current = true;
      if (retryRef.current !== null) clearTimeout(retryRef.current);
      socketRef.current?.close(1000, "Leaving page");
    };
  }, [connect, roomId]);

  const join = useCallback(
    async (name: string) => {
      setError(null);
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = (await response.json()) as { playerToken?: string; error?: string };
      if (!response.ok || body.playerToken === undefined) {
        throw new Error(body.error ?? "Could not join room");
      }
      safeStorage.set(sessionKey(roomId), body.playerToken);
      connect(body.playerToken);
    },
    [connect, roomId],
  );

  const sendCommandWithTracking = useCallback(
    (command: WireClientCommand, tracked: boolean): string | null => {
      const requestId = crypto.randomUUID();
      if (tracked) claimedRequestIdsRef.current.add(requestId);
      const socket = socketRef.current;
      const current = viewRef.current;
      const token = safeStorage.get(sessionKey(roomId));
      if (socket?.readyState !== WebSocket.OPEN || current === null || token === null) {
        if (tracked) claimedRequestIdsRef.current.delete(requestId);
        setError("You are not connected yet.");
        return null;
      }
      socket.send(
        JSON.stringify({
          protocolVersion: PROTOCOL_VERSION,
          roomId,
          playerToken: token,
          requestId,
          expectedRevision: current.revision,
          command,
        }),
      );
      return requestId;
    },
    [roomId],
  );

  const sendCommand = useCallback(
    (command: WireClientCommand) => sendCommandWithTracking(command, false),
    [sendCommandWithTracking],
  );

  // There is no success ACK: callers track the id for a rejection and observe
  // the next private snapshot for successful application.
  const sendTrackedCommand = useCallback(
    (command: WireClientCommand) => sendCommandWithTracking(command, true),
    [sendCommandWithTracking],
  );

  const consumeRejection = useCallback(
    (requestId: string): { code: string; message: string } | undefined => {
      claimedRequestIdsRef.current.delete(requestId);
      const rejection = trackedRejections.get(requestId);
      setTrackedRejections((previous) => {
        if (!previous.has(requestId)) return previous;
        const next = new Map(previous);
        next.delete(requestId);
        return next;
      });
      return rejection;
    },
    [trackedRejections],
  );

  const leaveSession = useCallback(() => {
    intentionalCloseRef.current = true;
    socketRef.current?.close(1000, "Forget this session");
    safeStorage.remove(sessionKey(roomId));
    viewRef.current = null;
    setView(null);
    window.location.href = "/";
  }, [roomId]);

  const serverNow = useCallback(() => Date.now() + serverOffsetRef.current, []);

  // Error toasts auto-dismiss for every consumer; they stay click-dismissable.
  useEffect(() => {
    if (error === null) return;
    const timer = setTimeout(() => setError(null), TOAST_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [error]);

  return {
    view,
    status,
    error,
    clearError: () => setError(null),
    join,
    sendCommand,
    sendTrackedCommand,
    trackedRejections,
    consumeRejection,
    leaveSession,
    turnDeadline,
    serverNow,
  };
}
