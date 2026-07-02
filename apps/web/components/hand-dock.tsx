"use client";

import type {
  CardInstance,
  PrivateGameView,
  WireClientCommand,
} from "@shengji/protocol";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { PlayingCard } from "./card";

export function HandDock({
  cards,
  selected,
  selectedCards,
  hinted,
  selectionKind,
  onToggle,
  onClear,
  actions,
  bottomSize,
  submit,
}: {
  cards: readonly CardInstance[];
  selected: ReadonlySet<string>;
  selectedCards: readonly CardInstance[];
  hinted: ReadonlySet<string>;
  selectionKind: "normal" | "throw" | "unleadable";
  onToggle: (card: CardInstance, index: number, shift: boolean) => void;
  onClear: () => void;
  actions: ReadonlySet<PrivateGameView["legalActions"][number]>;
  bottomSize: number;
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
    <section className="hand-dock">
      <div className="hand-meta">
        <span>
          YOUR HAND <b>{cards.length}</b>
        </span>
        <span>
          {selected.size} selected
          {selected.size > 0 && (
            <button type="button" className="clear-selection" onClick={onClear}>
              Clear
            </button>
          )}
        </span>
      </div>
      <div className="hand-scroll" role="group" aria-label="Your hand">
        {cards.map((card, index) => (
          <PlayingCard
            key={card.id}
            card={card}
            entrance="deal"
            selected={selected.has(card.id)}
            hinted={hinted.has(card.id)}
            onSelect={(event) => onToggle(card, index, event.shiftKey)}
          />
        ))}
      </div>

      <AnimatePresence>
        {confirmingThrow && (
          <motion.p
            className="throw-warning"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            This is a throw (甩牌): every part must be unbeatable. If an opponent can
            beat any part, you are forced to lead its smallest piece instead.
          </motion.p>
        )}
      </AnimatePresence>

      <div className="action-dock">
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
          <button
            className="button button-primary"
            type="button"
            disabled={selectedIds.length !== bottomSize}
            onClick={() => submit({ type: "BURY_BOTTOM", cards: selectedIds })}
          >
            Bury {selectedIds.length} / {bottomSize}
          </button>
        )}
        {actions.has("play-cards") && (
          <button
            className={`button ${isThrow ? "button-gold" : "button-primary"}`}
            type="button"
            disabled={
              selectedIds.length === 0 || (isLeading && selectionKind === "unleadable")
            }
            onClick={play}
          >
            {isThrow
              ? confirmingThrow
                ? "Confirm throw 甩牌"
                : "Play throw 甩牌"
              : "Play selected"}
          </button>
        )}
      </div>
    </section>
  );
}
