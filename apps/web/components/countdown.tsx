"use client";

import { useEffect, useState } from "react";
import { COUNTDOWN_TICK_MS } from "../lib/constants";

export function Countdown({
  deadline,
  now,
}: {
  deadline: string | undefined;
  now: () => number;
}) {
  // State holds whole seconds so React skips renders between ticks.
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (deadline === undefined) {
      setRemaining(null);
      return;
    }
    const target = Date.parse(deadline);
    const update = () => setRemaining(Math.max(0, Math.ceil((target - now()) / 1_000)));
    update();
    const timer = setInterval(update, COUNTDOWN_TICK_MS);
    return () => clearInterval(timer);
  }, [deadline, now]);
  if (remaining === null) return null;
  return (
    <span className={remaining <= 5 ? "countdown is-urgent" : "countdown"}>
      {remaining}s
    </span>
  );
}
