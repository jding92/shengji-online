"use client";

import type { BotDifficulty, PrivateGameView } from "@shengji/protocol";
import { AnimatePresence, motion } from "motion/react";
import { useState, type CSSProperties } from "react";
import { replaceWithBot } from "../lib/bot-api";
import { cardFaceLabel, type TablePosition } from "../lib/cards";
import { teamClassForTeamId } from "../lib/strings";
import type { SeatSlot } from "../lib/table-layout";
import { CardBack } from "./card";
import { PlayerTag } from "./player-tag";
import { ChromeButton, ChromePanel } from "./ui-chrome";

type CurrentBid = NonNullable<
  NonNullable<PrivateGameView["publicRound"]>["currentBid"]
>;

/**
 * An opponent's whole hand as a fan of card backs, so hand size reads at a
 * glance as the round progresses. Side seats rotate their cards 90° — every
 * player appears to face the middle of the table, like your own hand does.
 */
function MiniHand({ count, vertical }: { count: number; vertical: boolean }) {
  return (
    <div
      className={`mini-hand ${vertical ? "is-vertical" : ""}`}
      data-seat-fan={vertical ? "vertical" : "horizontal"}
      data-hand-count={count}
      aria-hidden="true"
      style={{ "--fan-count": Math.max(1, count) } as CSSProperties}
    >
      {Array.from({ length: count }, (_, index) => (
        <span
          className={`mini-card ${index === count - 1 ? "is-top" : ""}`}
          key={index}
          style={{ "--fan-index": index } as CSSProperties}
        >
          <CardBack />
        </span>
      ))}
    </div>
  );
}

export function TableSeat({
  seat,
  position,
  slot = null,
  currentTurn,
  isYou,
  isLeader,
  role = null,
  isFriend = false,
  bid,
  roomId,
  timer,
  trickWinner = false,
}: {
  seat: PrivateGameView["seats"][number];
  position: TablePosition | null;
  /** Radial geometry for non-four-player tables; legacy positions omit it. */
  slot?: SeatSlot | null;
  currentTurn: boolean;
  isYou: boolean;
  /** The round's declarer, marked with the 庄 (banker) crest. */
  isLeader: boolean;
  /** This seat's side this round; shown with the reusable role art on the nameplate. */
  role?: "attacking" | "defending" | null;
  /** A finding-friends reveal marker; never inferred for unknown seats. */
  isFriend?: boolean;
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
  const positionClass = position === null ? "seat-radial" : `seat-${position}`;
  const vertical =
    position === "east" ||
    position === "west" ||
    (position === null && (slot?.edge === "right" || slot?.edge === "left"));
  const seatStyle =
    slot === null
      ? undefined
      : ({
          "--seat-x": `${slot.xPct}%`,
          "--seat-y": `${slot.yPct}%`,
        } as CSSProperties);

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
      className={`table-seat ${positionClass} ${teamClassForTeamId(seat.teamId)} ${currentTurn ? "is-turn" : ""} ${trickWinner ? "is-trick-winner" : ""} ${timer === undefined ? "" : "has-timer"}`}
      data-seat-position={position === null ? undefined : position}
      data-seat-edge={slot?.edge}
      style={seatStyle}
    >
      {/* Your own hand is face-up in the dock below — no backs needed. */}
      {!isYou && <MiniHand count={seat.cardCount} vertical={vertical} />}
      <PlayerTag
        seat={seat}
        isYou={isYou}
        isLeader={isLeader}
        role={role}
        isFriend={isFriend}
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
