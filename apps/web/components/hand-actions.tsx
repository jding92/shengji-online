"use client";

import type {
  CardInstance,
  PrivateGameView,
  WireClientCommand,
} from "@shengji/protocol";
import type { TrumpSpec } from "@shengji/engine";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { describePlaySelection } from "../lib/cards";
import { ChromeButton } from "./ui-chrome";

/**
 * The primary action button(s) for your turn — Pass / Bid / Bury / Play —
 * with the two-tap throw confirmation and a dynamic, human Play label. Lives
 * on the "You" seat row (to the right of your nameplate), so the hand below
 * keeps clear headroom for selected cards to lift.
 */
export function HandActions({
  selectedCards,
  selectionKind,
  actions,
  bottomSize,
  hasPassedBid,
  requiredCardCount,
  trump,
  submit,
}: {
  selectedCards: readonly CardInstance[];
  selectionKind: "normal" | "throw" | "unleadable";
  actions: ReadonlySet<PrivateGameView["legalActions"][number]>;
  bottomSize: number;
  hasPassedBid: boolean;
  requiredCardCount: number | undefined;
  trump: TrumpSpec | undefined;
  submit: (command: WireClientCommand) => void;
}) {
  const selectedIds = selectedCards.map(({ id }) => id);
  const isLeading = actions.has("attempt-throw");
  const isThrow = isLeading && selectionKind === "throw";
  const [confirmingThrow, setConfirmingThrow] = useState(false);
  const selectionSignature = selectedIds.join(",");

  // Changing the selection disarms a pending throw confirmation.
  useEffect(() => setConfirmingThrow(false), [selectionSignature]);

  function play() {
    if (!isThrow) {
      submit({ type: "PLAY_CARDS", cards: selectedIds, intent: "normal" });
      return;
    }
    if (!confirmingThrow) {
      setConfirmingThrow(true);
      return;
    }
    submit({ type: "PLAY_CARDS", cards: selectedIds, intent: "throw" });
  }

  return (
    <div className="hand-actions">
      <AnimatePresence>
        {confirmingThrow && (
          <motion.p
            className="throw-warning"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            A throw (甩牌) must be unbeatable in every part — if an opponent can beat
            any piece, you're forced to lead its smallest instead.
          </motion.p>
        )}
      </AnimatePresence>

      {hasPassedBid && (
        <span className="bid-passed-status" role="status">
          Passed
        </span>
      )}
      {actions.has("pass-bid") && (
        <button
          className="button button-ghost"
          type="button"
          onClick={() => submit({ type: "PASS_BID" })}
        >
          Pass
        </button>
      )}
      {actions.has("bid") && (
        <button
          className="button button-gold"
          type="button"
          disabled={selectedIds.length === 0}
          onClick={() => submit({ type: "BID", cards: selectedIds })}
        >
          Bid selected
        </button>
      )}
      {actions.has("bury-bottom") && (
        <ChromeButton
          className="button"
          variant="primary"
          disabled={selectedIds.length !== bottomSize}
          onClick={() => submit({ type: "BURY_BOTTOM", cards: selectedIds })}
        >
          Bury {selectedIds.length} / {bottomSize}
        </ChromeButton>
      )}
      {actions.has("play-cards") && (
        <>
          <span
            className="play-selection-progress"
            aria-label={
              requiredCardCount === undefined
                ? `${selectedIds.length} cards selected for the lead`
                : `${selectedIds.length} of ${requiredCardCount} cards selected`
            }
          >
            {requiredCardCount === undefined ? (
              <>
                <b>{selectedIds.length}</b> selected
              </>
            ) : (
              <>
                <b>{selectedIds.length}</b> / {requiredCardCount} cards
              </>
            )}
          </span>
          <ChromeButton
            className="button"
            variant={isThrow ? "gold" : "primary"}
            disabled={
              selectedIds.length === 0 ||
              (requiredCardCount !== undefined &&
                selectedIds.length !== requiredCardCount) ||
              (isLeading && selectionKind === "unleadable")
            }
            onClick={play}
          >
            {isThrow
              ? confirmingThrow
                ? "Confirm throw 甩牌"
                : "Play throw 甩牌"
              : describePlaySelection(selectedCards, trump)}
          </ChromeButton>
        </>
      )}
    </div>
  );
}
