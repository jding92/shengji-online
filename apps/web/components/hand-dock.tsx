"use client";

import type { CardInstance } from "@shengji/protocol";
import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { PlayingCard } from "./card";

const DEAL_STAGGER_SECONDS = 0.035;

/**
 * The face-up fan of your own hand. Action buttons live up on the seat row
 * (see HandActions), so nothing sits directly above the cards and selected
 * cards have room to lift clear of the top edge.
 */
export function HandDock({
  cards,
  selected,
  hinted,
  isDealing,
  isYourTurn,
  onToggle,
}: {
  cards: readonly CardInstance[];
  selected: ReadonlySet<string>;
  hinted: ReadonlySet<string>;
  isDealing: boolean;
  isYourTurn: boolean;
  onToggle: (card: CardInstance, index: number, shift: boolean) => void;
}) {
  const previousHandIds = useRef<Set<string> | null>(null);
  let addedIndex = 0;
  const entranceDelays = new Map<string, number>();
  if (isDealing && previousHandIds.current !== null) {
    for (const card of cards) {
      if (!previousHandIds.current.has(card.id)) {
        entranceDelays.set(card.id, addedIndex * DEAL_STAGGER_SECONDS);
        addedIndex += 1;
      }
    }
  }

  useEffect(() => {
    previousHandIds.current = new Set(cards.map(({ id }) => id));
  }, [cards]);

  return (
    <section className={`hand-dock ${isYourTurn ? "is-your-turn" : ""}`}>
      <div
        className={`hand-scroll ${hinted.size > 0 ? "has-hints" : ""}`}
        role="group"
        aria-label="Your hand"
        style={{ "--hand-count": Math.max(cards.length, 1) } as CSSProperties}
      >
        {cards.map((card, index) => (
          <PlayingCard
            key={card.id}
            card={card}
            entrance="deal"
            entranceDelay={entranceDelays.get(card.id) ?? 0}
            selected={selected.has(card.id)}
            hinted={hinted.has(card.id)}
            onSelect={(event) => onToggle(card, index, event.shiftKey)}
          />
        ))}
      </div>
    </section>
  );
}
