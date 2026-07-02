"use client";

import type { PrivateGameView } from "@shengji/protocol";
import type { TablePosition } from "../lib/cards";
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
        {seat.cardCount > 0 && <span className="card-count">{seat.cardCount}</span>}
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
              : `Level ${seat.rank} · ${seat.seat % 2 === 0 ? "Gold" : "Ember"}`}
          </small>
        </span>
        {!seat.connected && seat.playerId !== null && <i className="offline-dot" />}
      </div>
    </div>
  );
}
