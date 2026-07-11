"use client";

import type { CardInstance } from "@shengji/protocol";
import { motion, useReducedMotion } from "motion/react";
import type { MouseEvent } from "react";
import { ART_ASSET_IDS, artAssetPath, artAssetSrcSet } from "../lib/art-registry";
import { CardFace } from "./card-face";

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
  /** Seconds to stagger the initial entrance animation. */
  entranceDelay?: number;
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
  onSelect,
}: CardProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const face = card.face;
  const rankClass = face.kind === "standard" ? `rank-${face.rank}` : "";
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
    ? false
    : entrance === "deal"
      ? { y: -90, rotate: -5 }
      : { scale: 0.82 };
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
      className={`playing-card card-${display.color} ${rankClass} ${selected ? "is-selected" : ""} ${compact ? "is-compact" : ""} ${hinted ? "is-hinted" : ""}`}
      onClick={onSelect}
      initial={initial}
      animate={{ y: selected ? -18 : 0, scale: 1, rotate: 0 }}
      {...(onSelect === undefined || reducedMotion ? {} : { whileHover: { y: -18 } })}
      transition={entranceTransition}
    >
      <CardFace face={face} />
    </motion.button>
  );
}

export function CardBack({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`card-back ${compact ? "is-compact" : ""}`} aria-hidden="true">
      <img
        className="card-back-art"
        data-art-asset={ART_ASSET_IDS.cardBack}
        src={artAssetPath(ART_ASSET_IDS.cardBack)}
        srcSet={artAssetSrcSet(ART_ASSET_IDS.cardBack)}
        alt=""
        draggable={false}
      />
      <span className="card-back-seal">升</span>
    </span>
  );
}
