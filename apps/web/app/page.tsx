"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function HomePage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom(practice = false) {
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body = (await response.json()) as {
        room?: { roomId: string };
        error?: string;
      };
      if (!response.ok || body.room === undefined) {
        throw new Error(body.error ?? "Could not create a table");
      }
      router.push(`/room/${body.room.roomId}${practice ? "?practice=1" : ""}`);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Could not create table",
      );
    } finally {
      setCreating(false);
    }
  }

  function joinRoom(event: FormEvent) {
    event.preventDefault();
    const normalized = roomCode.trim().toUpperCase();
    if (normalized.length > 0) router.push(`/room/${normalized}`);
  }

  return (
    <main className="menu-shell">
      <div className="ambient-orb orb-one" />
      <div className="ambient-orb orb-two" />
      <motion.section
        className="menu-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <span className="menu-mark" aria-hidden="true">
          升
        </span>
        <h1 className="menu-title">升级</h1>
        <p className="menu-subtitle">SHENG JI</p>

        <div className="menu-actions">
          <button
            className="button button-primary button-large menu-button"
            type="button"
            disabled={creating}
            onClick={() => void createRoom()}
          >
            {creating ? "Preparing table…" : "Create table"}
          </button>

          <form className="menu-join" onSubmit={joinRoom}>
            <input
              aria-label="Table code"
              maxLength={8}
              placeholder="TABLE CODE"
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value)}
            />
            <button
              className="button button-gold"
              type="submit"
              disabled={roomCode.trim().length === 0}
            >
              Join
            </button>
          </form>

          <a
            className="button button-ghost menu-button"
            href="https://robertying.com/shengji/rules.html"
            target="_blank"
            rel="noreferrer"
          >
            How to play
          </a>

          <button
            className="button button-ghost menu-button"
            type="button"
            disabled={creating}
            onClick={() => void createRoom(true)}
          >
            Practice table · solo
          </button>
        </div>

        {error && <p className="inline-error">{error}</p>}
      </motion.section>
    </main>
  );
}
