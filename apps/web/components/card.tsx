"use client";

import type { CardInstance } from "@shengji/protocol";
import { motion } from "motion/react";
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
  onSelect?: (event: MouseEvent<HTMLButtonElement>) => void;
};

export function PlayingCard({
  card,
  selected = false,
  compact = false,
  disabled = false,
  onSelect,
}: CardProps) {
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

  return (
    <motion.button
      type="button"
      layout
      aria-label={display.label}
      aria-pressed={selected}
      disabled={disabled || onSelect === undefined}
      className={`playing-card card-${display.color} ${selected ? "is-selected" : ""} ${compact ? "is-compact" : ""}`}
      onClick={onSelect}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: selected ? -18 : 0 }}
      transition={{ duration: 0.16 }}
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
