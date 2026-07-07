"use client";

import type { PrivateGameView } from "@shengji/protocol";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MOMENT_MAX_AGE_MS } from "../lib/constants";
import { deriveMoments, type GameMoment } from "../lib/moments";

const MAX_MOMENTS = 8;

type MomentRecord = {
  moment: GameMoment;
  createdAt: number;
};

export function useGameMoments(view: PrivateGameView | null): {
  moments: GameMoment[];
  dismiss: (id: string) => void;
} {
  const previousView = useRef<PrivateGameView | null>(null);
  const [records, setRecords] = useState<MomentRecord[]>([]);

  useEffect(() => {
    if (view === null) {
      previousView.current = null;
      return;
    }

    const nextMoments = deriveMoments(previousView.current, view);
    previousView.current = view;
    if (nextMoments.length === 0) return;

    const createdAt = Date.now();
    setRecords((current) => {
      const seen = new Set(current.map(({ moment }) => moment.id));
      const appended = nextMoments
        .filter((moment) => !seen.has(moment.id))
        .map((moment) => ({ moment, createdAt }));
      if (appended.length === 0) return current;
      return [...current, ...appended].slice(-MAX_MOMENTS);
    });
  }, [view]);

  useEffect(() => {
    if (records.length === 0) return;
    const now = Date.now();
    const nextExpiry = Math.min(
      ...records.map(({ createdAt }) => createdAt + MOMENT_MAX_AGE_MS),
    );
    const timer = setTimeout(
      () =>
        setRecords((current) =>
          current.filter(({ createdAt }) => Date.now() - createdAt < MOMENT_MAX_AGE_MS),
        ),
      Math.max(0, nextExpiry - now),
    );
    return () => clearTimeout(timer);
  }, [records]);

  const dismiss = useCallback((id: string) => {
    setRecords((current) => current.filter(({ moment }) => moment.id !== id));
  }, []);
  const moments = useMemo(() => records.map(({ moment }) => moment), [records]);

  return { moments, dismiss };
}
