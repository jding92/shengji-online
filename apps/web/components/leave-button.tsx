"use client";

import { useEffect, useState } from "react";
import { LEAVE_CONFIRM_MS } from "../lib/constants";
import { ChromeButton } from "./ui-chrome";

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
    <ChromeButton
      className={`leave-button ${confirming ? "is-confirming" : ""}`}
      variant={confirming ? "danger" : "neutral"}
      onClick={() => {
        if (confirming) onLeave();
        else setConfirming(true);
      }}
    >
      {confirming ? "Tap again to leave" : "Leave"}
    </ChromeButton>
  );
}
