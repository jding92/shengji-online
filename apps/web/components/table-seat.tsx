"use client";

import type { BotDifficulty, PrivateGameView } from "@shengji/protocol";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { replaceWithBot } from "../lib/bot-api";
import { cardFaceLabel, type TablePosition } from "../lib/cards";
import { teamClassForSeat } from "../lib/strings";
import { CardBack } from "./card";
import { PlayerTag } from "./player-tag";
import { ChromeButton, ChromePanel } from "./ui-chrome";

type CurrentBid = NonNullable<
  NonNullable<PrivateGameView["publicRound"]>["currentBid"]
>;

/* Compact card-back box, fixed in the layout skeleton. */
const CARD_W = 75;
const CARD_H = 108;

/**
 * An opponent's whole hand as a fan of card backs, so hand size reads at a
 * glance as the round progresses. Side seats rotate their cards 90° — every
 * player appears to face the middle of the table, like your own hand does.
 */
function MiniHand({ count, vertical }: { count: number; vertical: boolean }) {
  // Distribute the fan across a fixed span; big hands pack tighter.
  const step = count > 1 ? Math.min(18, (vertical ? 250 : 320) / (count - 1)) : 0;
  const extent = count > 0 ? (count - 1) * step + CARD_W : CARD_W;
  // A rotated card keeps its 75×108 layout box, so offset it to make the
  // 108×75 visual footprint start at the fan position.
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
  role = null,
  handTotal,
  bid,
  roomId,
  timer,
  trickWinner = false,
}: {
  seat: PrivateGameView["seats"][number];
  position: TablePosition;
  currentTurn: boolean;
  isYou: boolean;
  /** The round's declarer, marked with the 庄 (banker) crest. */
  isLeader: boolean;
  /** This seat's side this round; shown as a 攻/守 tag on the nameplate. */
  role?: "attacking" | "defending" | null;
  /** Steady-state hand size, shown only on the local player's nameplate. */
  handTotal?: number;
  /** This seat's standing trump bid, shown as a badge until finalization. */
  bid?: CurrentBid | undefined;
  roomId: string;
  /** Local player's active decision clock, overlaid on their nameplate. */
  timer?: { deadline: string; now: () => number };
  /** A just-won trick pulse, driven by snapshot-diffed moments. */
  trickWinner?: boolean;
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
      className={`table-seat seat-${position} ${teamClassForSeat(seat.seat)} ${currentTurn ? "is-turn" : ""} ${trickWinner ? "is-trick-winner" : ""}`}
    >
      {/* Your own hand is face-up in the dock below — no backs needed. */}
      {!isYou && (
        <MiniHand
          count={seat.cardCount}
          vertical={position === "east" || position === "west"}
        />
      )}
      <PlayerTag
        seat={seat}
        isYou={isYou}
        isLeader={isLeader}
        role={role}
        {...(handTotal !== undefined ? { handTotal } : {})}
        {...(timer !== undefined ? { timer } : {})}
      />
      {canReplace && (
        <ChromePanel className="takeover-control">
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
              <ChromeButton
                variant="gold"
                disabled={replacing}
                onClick={() => void takeOver()}
              >
                {replacing ? "Replacing…" : "Confirm bot"}
              </ChromeButton>
              <ChromeButton disabled={replacing} onClick={() => setShowTakeover(false)}>
                Cancel
              </ChromeButton>
            </>
          ) : (
            <ChromeButton onClick={() => setShowTakeover(true)}>
              Replace with bot
            </ChromeButton>
          )}
          {replaceError && <small>{replaceError}</small>}
        </ChromePanel>
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
