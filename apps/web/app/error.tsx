"use client";

import { ChromeButton } from "../components/ui-chrome";

export default function RoomError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="join-shell">
      <section className="join-card glass-panel">
        <span className="brand-mark large">升</span>
        <h1>Something broke at the table</h1>
        <p>
          The page hit an unexpected error. Your seat and hand are safe on the server —
          reload to pick up where you left off.
        </p>
        <ChromeButton variant="primary" onClick={() => reset()}>
          Reload the table
        </ChromeButton>
      </section>
    </main>
  );
}
