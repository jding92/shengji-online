"use client";

import type { CardInstance } from "@shengji/protocol";
import { motion, useReducedMotion } from "motion/react";
import type { MouseEvent } from "react";

const suitGlyph = {
  spades: "♠",
  hearts: "♥",
  clubs: "♣",
  diamonds: "♦",
} as const;

type CardProps = {
  card: CardInstance;
  selected?: boolean;
  compact?: boolean;
  disabled?: boolean;
  /** Soft gold glow marking cards relevant to the current decision. */
  hinted?: boolean;
  /** "deal" drops in from above (hand cards); "pop" scales in (table plays). */
  entrance?: "deal" | "pop";
  onSelect?: (event: MouseEvent<HTMLButtonElement>) => void;
};

export function PlayingCard({
  card,
  selected = false,
  compact = false,
  disabled = false,
  hinted = false,
  entrance = "pop",
  onSelect,
}: CardProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const face = card.face;
  const display =
    face.kind === "joker"
      ? {
          isJoker: true,
          rank: face.joker === "big" ? "大" : "小",
          suit: "★",
          color: face.joker,
          label: `${face.joker === "big" ? "Big" : "Small"} joker`,
        }
      : {
          isJoker: false,
          rank: face.rank,
          suit: suitGlyph[face.suit],
          color: face.suit,
          label: `${face.rank} of ${face.suit}`,
        };

  const initial = reducedMotion
    ? { opacity: 0 }
    : entrance === "deal"
      ? { opacity: 0, y: -90, rotate: -5 }
      : { opacity: 0, scale: 0.82 };
  const transition =
    entrance === "deal" && !reducedMotion
      ? { type: "spring" as const, stiffness: 420, damping: 30 }
      : { duration: 0.16 };

  return (
    <motion.button
      type="button"
      layout
      layoutId={card.id}
      aria-label={display.label}
      aria-pressed={selected}
      disabled={disabled || onSelect === undefined}
      className={`playing-card card-${display.color} ${selected ? "is-selected" : ""} ${compact ? "is-compact" : ""} ${hinted ? "is-hinted" : ""}`}
      onClick={onSelect}
      initial={initial}
      animate={{ opacity: 1, y: selected ? -18 : 0, scale: 1, rotate: 0 }}
      transition={transition}
    >
      <span className="card-corner">
        <strong>{display.rank}</strong>
        <span>{display.suit}</span>
      </span>
      <span className="card-center">{display.isJoker ? "JOKER" : display.suit}</span>
      {display.isJoker && <span className="joker-script">{display.rank}王</span>}
    </motion.button>
  );
}

export function CardBack({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`card-back ${compact ? "is-compact" : ""}`} aria-hidden="true">
      <span>升</span>
    </span>
  );
}
