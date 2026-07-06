"use client";

import type { TrumpSpec } from "@shengji/engine";
import type { CardInstance } from "@shengji/protocol";
import type { CSSProperties } from "react";
import { PlayingCard } from "./card";

/**
 * The face-up fan of your own hand. Action buttons live up on the seat row
 * (see HandActions), so nothing sits directly above the cards and selected
 * cards have room to lift clear of the top edge.
 */
export function HandDock({
  cards,
  selected,
  hinted,
  trump,
  onToggle,
}: {
  cards: readonly CardInstance[];
  selected: ReadonlySet<string>;
  hinted: ReadonlySet<string>;
  /** Finalized trump, so trump cards in the fan can wear their gilding. */
  trump?: TrumpSpec | undefined;
  onToggle: (card: CardInstance, index: number, shift: boolean) => void;
}) {
  return (
    <section className="hand-dock">
      <div
        className="hand-scroll"
        role="group"
        aria-label="Your hand"
        style={{ "--hand-count": Math.max(cards.length, 1) } as CSSProperties}
      >
        {cards.map((card, index) => (
          <PlayingCard
            key={card.id}
            card={card}
            entrance="deal"
            selected={selected.has(card.id)}
            hinted={hinted.has(card.id)}
            {...(trump === undefined ? {} : { trump })}
            onSelect={(event) => onToggle(card, index, event.shiftKey)}
          />
        ))}
      </div>
    </section>
  );
}
