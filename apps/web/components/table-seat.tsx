"use client";

import type { BotDifficulty, PrivateGameView } from "@shengji/protocol";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { replaceWithBot } from "../lib/bot-api";
import { cardFaceLabel, type TablePosition } from "../lib/cards";
import { teamClassForSeat, teamLabelForSeat } from "../lib/strings";
import { CardBack } from "./card";
import { Countdown } from "./countdown";

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
  bid,
  roomId,
  timer,
}: {
  seat: PrivateGameView["seats"][number];
  position: TablePosition;
  currentTurn: boolean;
  isYou: boolean;
  /** The round's declarer, marked with the 庄 (banker) crest. */
  isLeader: boolean;
  /** This seat's standing trump bid, shown as a badge until finalization. */
  bid?: CurrentBid | undefined;
  roomId: string;
  /** Local player's active decision clock, overlaid on their nameplate. */
  timer?: { deadline: string; now: () => number };
}) {
  const [showTakeover, setShowTakeover] = useState(false);
  const [difficulty, setDifficulty] = useState<BotDifficulty>("intermediate");
  const [replacing, setReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const canReplace = !isYou && seat.playerId !== null && !seat.connected && !seat.isBot;

  async function takeOver(): Promise<void> {
    if (seat.playerId === null) return;
    setReplacing(true);
    setReplaceError(null);
    try {
      await replaceWithBot(roomId, seat.playerId, difficulty);
      setShowTakeover(false);
    } catch (cause) {
      setReplaceError(
        cause instanceof Error ? cause.message : "Could not replace player",
      );
    } finally {
      setReplacing(false);
    }
  }

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
        {isYou && timer !== undefined && (
          <span className="seat-timer-badge" aria-label="Turn timer">
            <Countdown deadline={timer.deadline} now={timer.now} />
          </span>
        )}
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
            {seat.isBot && (
              <span
                className="bot-badge"
                title={`Bot · ${seat.botDifficulty ?? "intermediate"}`}
              >
                BOT
              </span>
            )}
          </strong>
          <small>
            {seat.rank === null
              ? "Waiting"
              : `Lv ${seat.rank} · ${teamLabelForSeat(seat.seat)}`}
          </small>
        </span>
        {!seat.connected && seat.playerId !== null && !seat.isBot && (
          <i className="offline-dot" />
        )}
      </div>
      {canReplace && (
        <div className="takeover-control">
          {showTakeover ? (
            <>
              <select
                aria-label={`Replacement bot difficulty for ${seat.name ?? "player"}`}
                value={difficulty}
                disabled={replacing}
                onChange={(event) => setDifficulty(event.target.value as BotDifficulty)}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
              <button
                type="button"
                disabled={replacing}
                onClick={() => void takeOver()}
              >
                {replacing ? "Replacing…" : "Confirm bot"}
              </button>
              <button
                type="button"
                disabled={replacing}
                onClick={() => setShowTakeover(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setShowTakeover(true)}>
              Replace with bot
            </button>
          )}
          {replaceError && <small>{replaceError}</small>}
        </div>
      )}
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
