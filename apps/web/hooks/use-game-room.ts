"use client";

import {
  PROTOCOL_VERSION,
  type PrivateGameView,
  type ServerEnvelope,
  type WireClientCommand,
} from "@shengji/protocol";
import { useCallback, useEffect, useRef, useState } from "react";

export type ConnectionStatus =
  | "join-required"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline";

function sessionKey(roomId: string): string {
  return `shengji:session:${roomId}`;
}

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
        if (envelope.type === "COMMAND_REJECTED") {
          setError(envelope.message);
          if (envelope.code === "STALE_REVISION") {
            socket.close(4000, "Refresh stale state");
          }
        }
      });
      socket.addEventListener("close", () => {
        if (socketRef.current === socket) socketRef.current = null;
        if (intentionalCloseRef.current) return;
        attemptsRef.current += 1;
        const delay = Math.min(8_000, 500 * 2 ** attemptsRef.current);
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
    const stored = window.localStorage.getItem(sessionKey(roomId));
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
      window.localStorage.setItem(sessionKey(roomId), body.playerToken);
      connect(body.playerToken);
    },
    [connect, roomId],
  );

  const sendCommand = useCallback(
    (command: WireClientCommand) => {
      const socket = socketRef.current;
      const current = viewRef.current;
      const token = window.localStorage.getItem(sessionKey(roomId));
      if (socket?.readyState !== WebSocket.OPEN || current === null || token === null) {
        setError("You are not connected yet.");
        return false;
      }
      socket.send(
        JSON.stringify({
          protocolVersion: PROTOCOL_VERSION,
          roomId,
          playerToken: token,
          requestId: crypto.randomUUID(),
          expectedRevision: current.revision,
          command,
        }),
      );
      return true;
    },
    [roomId],
  );

  const leaveSession = useCallback(() => {
    intentionalCloseRef.current = true;
    socketRef.current?.close(1000, "Forget this session");
    window.localStorage.removeItem(sessionKey(roomId));
    viewRef.current = null;
    setView(null);
    window.location.reload();
  }, [roomId]);

  return {
    view,
    status,
    error,
    clearError: () => setError(null),
    join,
    sendCommand,
    leaveSession,
  };
}
