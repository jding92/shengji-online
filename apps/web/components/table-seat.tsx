"use client";

import type { PrivateGameView } from "@shengji/protocol";
import { AnimatePresence, motion } from "motion/react";
import { cardFaceLabel, type TablePosition } from "../lib/cards";
import { teamClassForSeat, teamLabelForSeat } from "../lib/strings";
import { CardBack } from "./card";

type CurrentBid = NonNullable<
  NonNullable<PrivateGameView["publicRound"]>["currentBid"]
>;

/* Compact card-back box, fixed in the layout skeleton. */
const CARD_W = 50;
const CARD_H = 72;

/**
 * An opponent's whole hand as a fan of card backs, so hand size reads at a
 * glance as the round progresses. Side seats rotate their cards 90° — every
 * player appears to face the middle of the table, like your own hand does.
 */
function MiniHand({ count, vertical }: { count: number; vertical: boolean }) {
  // Distribute the fan across a fixed span; big hands pack tighter.
  const step = count > 1 ? Math.min(18, (vertical ? 250 : 320) / (count - 1)) : 0;
  const extent = count > 0 ? (count - 1) * step + CARD_W : CARD_W;
  // A rotated card keeps its 50×72 layout box, so offset it to make the
  // 72×50 visual footprint start at the fan position.
  const skew = (CARD_H - CARD_W) / 2;
  return (
    <div
      className={`mini-hand ${vertical ? "is-vertical" : ""}`}
      aria-hidden="true"
      style={
        vertical ? { width: CARD_H, height: extent } : { width: extent, height: CARD_H }
      }
    >
      {Array.from({ length: count }, (_, index) => (
        <span
          className={`mini-card ${index === count - 1 ? "is-top" : ""}`}
          key={index}
          style={
            vertical
              ? { top: index * step - skew, left: skew }
              : { left: index * step, top: 0 }
          }
        >
          <CardBack compact />
        </span>
      ))}
    </div>
  );
}

export function TableSeat({
  seat,
  position,
  currentTurn,
  isYou,
  isLeader,
  handTotal,
  bid,
}: {
  seat: PrivateGameView["seats"][number];
  position: TablePosition;
  currentTurn: boolean;
  isYou: boolean;
  /** The round's declarer, marked with the 庄 (banker) crest. */
  isLeader: boolean;
  /** Steady-state hand size, for the "current / total" card count. */
  handTotal: number;
  /** This seat's standing trump bid, shown as a badge until finalization. */
  bid?: CurrentBid | undefined;
}) {
  return (
    <div
      className={`table-seat seat-${position} ${teamClassForSeat(seat.seat)} ${currentTurn ? "is-turn" : ""}`}
    >
      {/* Your own hand is face-up in the dock below — no backs needed. */}
      {!isYou && (
        <MiniHand
          count={seat.cardCount}
          vertical={position === "east" || position === "west"}
        />
      )}
      <div className="player-chip">
        <span className="player-avatar">
          {seat.name?.slice(0, 1).toUpperCase() ?? "·"}
        </span>
        <span className="player-ident">
          <strong>
            {isYou ? "You" : (seat.name ?? `Seat ${seat.seat + 1}`)}
            {isLeader && (
              <span className="leader-badge" title="Round leader · 庄家">
                庄
              </span>
            )}
          </strong>
          <small>
            {seat.rank === null
              ? "Waiting"
              : `Lv ${seat.rank} · ${teamLabelForSeat(seat.seat)}`}
          </small>
        </span>
        {handTotal > 0 && (
          <motion.span
            className="seat-count"
            key={seat.cardCount}
            initial={{ scale: 1.25 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
          >
            {seat.cardCount} / {handTotal}
          </motion.span>
        )}
        {!seat.connected && seat.playerId !== null && <i className="offline-dot" />}
      </div>
      <AnimatePresence>
        {bid && (
          <motion.span
            className="bid-badge"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 420, damping: 24 }}
          >
            主 {cardFaceLabel(bid.face)}
            {bid.count > 1 ? ` ×${bid.count}` : ""}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
