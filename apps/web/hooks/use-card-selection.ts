"use client";

import type { CardInstance } from "@shengji/protocol";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Card selection over a sorted hand: click toggles, shift-click extends a
 * range from the last click, and the selection prunes itself when cards
 * leave the hand.
 */
export function useCardSelection(cards: readonly CardInstance[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const lastIndex = useRef<number | null>(null);

  useEffect(() => {
    const owned = new Set(cards.map(({ id }) => id));
    setSelected((current) => new Set([...current].filter((id) => owned.has(id))));
  }, [cards]);

  const toggle = useCallback(
    (card: CardInstance, index: number, shift: boolean) => {
      setSelected((current) => {
        const next = new Set(current);
        if (shift && lastIndex.current !== null) {
          const start = Math.min(lastIndex.current, index);
          const end = Math.max(lastIndex.current, index);
          for (const rangeCard of cards.slice(start, end + 1)) next.add(rangeCard.id);
        } else if (next.has(card.id)) next.delete(card.id);
        else next.add(card.id);
        return next;
      });
      lastIndex.current = index;
    },
    [cards],
  );

  const clear = useCallback(() => {
    setSelected(new Set());
    lastIndex.current = null;
  }, []);

  const selectedCards = cards.filter(({ id }) => selected.has(id));

  return { selected, selectedCards, toggle, clear };
}
