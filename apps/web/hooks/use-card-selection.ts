"use client";

import type { CardInstance } from "@shengji/protocol";
import { useCallback, useEffect, useRef, useState } from "react";

export function capCardSelection(
  selected: ReadonlySet<string>,
  cards: readonly CardInstance[],
  limit?: number,
): Set<string> {
  const capped = new Set<string>();
  const maximum = limit === undefined ? Number.POSITIVE_INFINITY : Math.max(0, limit);
  for (const card of cards) {
    if (!selected.has(card.id)) continue;
    if (capped.size >= maximum) break;
    capped.add(card.id);
  }
  return capped;
}

export function toggleCardSelection({
  selected,
  cards,
  card,
  index,
  shift,
  lastIndex,
  limit,
}: {
  selected: ReadonlySet<string>;
  cards: readonly CardInstance[];
  card: CardInstance;
  index: number;
  shift: boolean;
  lastIndex: number | null;
  limit?: number;
}): Set<string> {
  const next = new Set(selected);
  if (!shift || lastIndex === null) {
    if (next.has(card.id)) {
      next.delete(card.id);
    } else if (limit === undefined || next.size < limit) {
      next.add(card.id);
    }
    return next;
  }

  const start = Math.min(lastIndex, index);
  const end = Math.max(lastIndex, index);
  for (const rangeCard of cards.slice(start, end + 1)) {
    if (next.has(rangeCard.id)) continue;
    if (limit !== undefined && next.size >= limit) break;
    next.add(rangeCard.id);
  }
  return next;
}

/**
 * Card selection over a sorted hand: click toggles, shift-click extends a
 * range from the last click, and the selection prunes itself when cards
 * leave the hand.
 */
export function useCardSelection(cards: readonly CardInstance[], limit?: number) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const lastIndex = useRef<number | null>(null);

  useEffect(() => {
    setSelected((current) => capCardSelection(current, cards, limit));
    if (lastIndex.current !== null && lastIndex.current >= cards.length) {
      lastIndex.current = null;
    }
  }, [cards, limit]);

  const toggle = useCallback(
    (card: CardInstance, index: number, shift: boolean) => {
      setSelected((current) =>
        toggleCardSelection({
          selected: current,
          cards,
          card,
          index,
          shift,
          lastIndex: lastIndex.current,
          ...(limit === undefined ? {} : { limit }),
        }),
      );
      lastIndex.current = index;
    },
    [cards, limit],
  );

  const clear = useCallback(() => {
    setSelected(new Set());
    lastIndex.current = null;
  }, []);

  const selectedCards = cards.filter(({ id }) => selected.has(id));

  return { selected, selectedCards, toggle, clear };
}
