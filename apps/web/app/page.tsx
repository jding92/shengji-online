"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function HomePage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/rooms", { method: "POST", body: "{}" });
      const body = (await response.json()) as {
        room?: { roomId: string };
        error?: string;
      };
      if (!response.ok || body.room === undefined) {
        throw new Error(body.error ?? "Could not create a room");
      }
      router.push(`/room/${body.room.roomId}`);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Could not create room",
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
    <main className="home-shell">
      <nav className="home-nav">
        <div className="brand-lockup">
          <span className="brand-mark">升</span>
          <span>
            <strong>Sheng Ji</strong>
            <small>升级 · Level Up</small>
          </span>
        </div>
        <a href="#rules">How it plays</a>
      </nav>

      <div className="ambient-orb orb-one" />
      <div className="ambient-orb orb-two" />
      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">THE CLASSIC PARTNERSHIP CARD GAME</p>
          <h1>
            Your table,
            <br />
            <em>wherever friends are.</em>
          </h1>
          <p className="hero-lede">
            A calm, faithful online table for four-player Sheng Ji—two decks, real
            tractors, throws, and no account required.
          </p>
          <div className="hero-actions">
            <button
              className="button button-primary button-large"
              type="button"
              disabled={creating}
              onClick={() => void createRoom()}
            >
              {creating ? "Preparing table…" : "Create private room"}
            </button>
            <form className="join-code-form" onSubmit={joinRoom}>
              <input
                aria-label="Room code"
                maxLength={8}
                placeholder="ROOM CODE"
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value)}
              />
              <button type="submit" aria-label="Join room">
                →
              </button>
            </form>
          </div>
          {error && <p className="inline-error">{error}</p>}
          <div className="trust-row">
            <span>✓ Private invite links</span>
            <span>✓ Reconnect-safe</span>
            <span>✓ Open source</span>
          </div>
        </div>

        <div className="hero-table" aria-hidden="true">
          <div className="hero-table-inner">
            <span className="demo-seat demo-north">Ming · 25</span>
            <span className="demo-seat demo-east">Lena · 25</span>
            <span className="demo-seat demo-west">Kai · 25</span>
            <div className="demo-trick">
              <span className="demo-card red">K♥</span>
              <span className="demo-card red">K♥</span>
              <span className="demo-card">A♠</span>
              <span className="demo-card">A♠</span>
            </div>
            <span className="demo-title">拖拉机</span>
            <span className="demo-subtitle">TRACTOR</span>
          </div>
          <div className="floating-note note-one">Trump / 主 · ♥</div>
          <div className="floating-note note-two">Attackers · 65 分</div>
        </div>
      </section>

      <section className="feature-strip" id="rules">
        <article>
          <span>01</span>
          <div>
            <strong>Faithful rules</strong>
            <p>Joker tiers, effective-rank tractors, throws, and bottom multipliers.</p>
          </div>
        </article>
        <article>
          <span>02</span>
          <div>
            <strong>Server-authoritative</strong>
            <p>Legal moves are enforced without revealing anyone else’s hand.</p>
          </div>
        </article>
        <article>
          <span>03</span>
          <div>
            <strong>Made for friends</strong>
            <p>Share one link, refresh safely, and return to the same seat.</p>
          </div>
        </article>
      </section>
    </main>
  );
}
