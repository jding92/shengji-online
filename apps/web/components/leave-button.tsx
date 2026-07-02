"use client";

import { useEffect, useState } from "react";
import { LEAVE_CONFIRM_MS } from "../lib/constants";

/**
 * Two-tap leave control: the first tap arms a short confirmation window
 * instead of using a blocking native dialog.
 */
export function LeaveButton({ onLeave }: { onLeave: () => void }) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), LEAVE_CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  return (
    <button
      type="button"
      className={`button button-ghost leave-button ${confirming ? "is-confirming" : ""}`}
      onClick={() => {
        if (confirming) onLeave();
        else setConfirming(true);
      }}
    >
      {confirming ? "Tap again to leave" : "Leave"}
    </button>
  );
}
