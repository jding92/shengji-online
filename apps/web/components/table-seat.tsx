"use client";

import type { PrivateGameView } from "@shengji/protocol";
import { motion } from "motion/react";
import type { TablePosition } from "../lib/cards";
import { teamLabelForSeat } from "../lib/strings";
import { CardBack } from "./card";

export function TableSeat({
  seat,
  position,
  currentTurn,
  isYou,
}: {
  seat: PrivateGameView["seats"][number];
  position: TablePosition;
  currentTurn: boolean;
  isYou: boolean;
}) {
  return (
    <div className={`table-seat seat-${position} ${currentTurn ? "is-turn" : ""}`}>
      <div className="mini-hand" aria-label={`${seat.cardCount} cards`}>
        {Array.from({ length: Math.min(3, seat.cardCount) }, (_, index) => (
          <CardBack key={index} compact />
        ))}
        {seat.cardCount > 0 && (
          <motion.span
            className="card-count"
            key={seat.cardCount}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
          >
            {seat.cardCount}
          </motion.span>
        )}
      </div>
      <div className="player-chip">
        <span className="player-avatar">
          {seat.name?.slice(0, 1).toUpperCase() ?? "·"}
        </span>
        <span>
          <strong>{isYou ? "You" : (seat.name ?? `Seat ${seat.seat + 1}`)}</strong>
          <small>
            {seat.rank === null
              ? "Waiting"
              : `Level ${seat.rank} · ${teamLabelForSeat(seat.seat)}`}
          </small>
        </span>
        {!seat.connected && seat.playerId !== null && <i className="offline-dot" />}
      </div>
    </div>
  );
}
