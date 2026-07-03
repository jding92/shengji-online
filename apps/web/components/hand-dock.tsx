"use client";

import type { CardInstance } from "@shengji/protocol";
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
  onToggle,
}: {
  cards: readonly CardInstance[];
  selected: ReadonlySet<string>;
  hinted: ReadonlySet<string>;
  onToggle: (card: CardInstance, index: number, shift: boolean) => void;
}) {
  return (
    <section className="hand-dock">
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
    </section>
  );
}
