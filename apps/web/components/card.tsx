"use client";

import { getEffectiveSuit, type Rank, type TrumpSpec } from "@shengji/engine";
import type { CardInstance } from "@shengji/protocol";
import { motion, useReducedMotion } from "motion/react";
import type { MouseEvent } from "react";

const suitGlyph = {
  spades: "♠",
  hearts: "♥",
  clubs: "♣",
  diamonds: "♦",
} as const;

type PipPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "upper-left"
  | "upper-right"
  | "mid-left"
  | "center"
  | "mid-right"
  | "lower-left"
  | "lower-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

const PIP_LAYOUTS: Partial<Record<Rank, readonly PipPosition[]>> = {
  "2": ["top-center", "bottom-center"],
  "3": ["top-center", "center", "bottom-center"],
  "4": ["top-left", "top-right", "bottom-left", "bottom-right"],
  "5": ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
  "6": [
    "top-left",
    "top-right",
    "mid-left",
    "mid-right",
    "bottom-left",
    "bottom-right",
  ],
  "7": [
    "top-left",
    "top-right",
    "mid-left",
    "center",
    "mid-right",
    "bottom-left",
    "bottom-right",
  ],
  "8": [
    "top-left",
    "top-center",
    "top-right",
    "mid-left",
    "mid-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
  ],
  "9": [
    "top-left",
    "top-center",
    "top-right",
    "mid-left",
    "center",
    "mid-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
  ],
  "10": [
    "top-left",
    "top-right",
    "upper-left",
    "upper-right",
    "mid-left",
    "mid-right",
    "lower-left",
    "lower-right",
    "bottom-left",
    "bottom-right",
  ],
};

export function numberPipLayout(rank: Rank): readonly PipPosition[] | undefined {
  return PIP_LAYOUTS[rank];
}

type CardProps = {
  card: CardInstance;
  selected?: boolean;
  compact?: boolean;
  disabled?: boolean;
  /** Soft gold glow marking cards relevant to the current decision. */
  hinted?: boolean;
  /** "deal" drops in from above (hand cards); "pop" scales in (table plays). */
  entrance?: "deal" | "pop";
  /** Seconds to stagger the initial entrance animation. */
  entranceDelay?: number;
  /**
   * The round's finalized trump. When set, cards that count as trump get an
   * is-trump class so skins can mark their power (gilded frame, 主 seal).
   */
  trump?: TrumpSpec;
  onSelect?: (event: MouseEvent<HTMLButtonElement>) => void;
};

export function PlayingCard({
  card,
  selected = false,
  compact = false,
  disabled = false,
  hinted = false,
  entrance = "pop",
  entranceDelay = 0,
  trump,
  onSelect,
}: CardProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const face = card.face;
  const isTrump = trump !== undefined && getEffectiveSuit(card, trump) === "trump";
  const rankClass = face.kind === "standard" ? `rank-${face.rank}` : "";
  const pipLayout = face.kind === "standard" ? numberPipLayout(face.rank) : undefined;
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
  const transition = reducedMotion
    ? { duration: 0.01 }
    : entrance === "deal"
      ? { type: "spring" as const, stiffness: 420, damping: 30 }
      : { duration: 0.16 };
  const entranceTransition =
    entranceDelay > 0 && !reducedMotion
      ? { ...transition, delay: entranceDelay }
      : transition;

  return (
    <motion.button
      type="button"
      layout={!reducedMotion}
      layoutId={card.id}
      aria-label={display.label}
      aria-pressed={selected}
      disabled={disabled || onSelect === undefined}
      className={`playing-card card-${display.color} ${rankClass} ${isTrump ? "is-trump" : ""} ${selected ? "is-selected" : ""} ${compact ? "is-compact" : ""} ${hinted ? "is-hinted" : ""}`}
      onClick={onSelect}
      initial={initial}
      animate={{ opacity: 1, y: selected ? -18 : 0, scale: 1, rotate: 0 }}
      {...(onSelect === undefined || reducedMotion ? {} : { whileHover: { y: -18 } })}
      transition={entranceTransition}
    >
      <span className="card-corner">
        <strong>{display.rank}</strong>
        <span>{display.suit}</span>
      </span>
      {pipLayout !== undefined && (
        <>
          <span className="card-corner card-corner-opposite" aria-hidden="true">
            <strong>{display.rank}</strong>
            <span>{display.suit}</span>
          </span>
          <span className="number-pips" aria-hidden="true">
            {pipLayout.map((position, index) => (
              <i
                className={`number-pip pip-${position} ${position.startsWith("lower") || position.startsWith("bottom") ? "is-inverted" : ""}`}
                key={`${position}-${index}`}
              >
                {display.suit}
              </i>
            ))}
          </span>
        </>
      )}
      {pipLayout === undefined && (
        <span className={`card-center ${display.isJoker ? "is-joker-center" : ""}`}>
          {display.isJoker ? "JOKER" : display.suit}
        </span>
      )}
      {display.isJoker && <span className="joker-script">{display.rank}王</span>}
    </motion.button>
  );
}

export function CardBack({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`card-back ${compact ? "is-compact" : ""}`} aria-hidden="true">
      <span className="card-back-seal">升</span>
    </span>
  );
}
