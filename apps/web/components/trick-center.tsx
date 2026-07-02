"use client";

import type { PrivateGameView } from "@shengji/protocol";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cardFaceLabel, relativeSeatPosition, type TablePosition } from "../lib/cards";
import { TRICK_SWEEP_MS } from "../lib/constants";
import { Countdown } from "./countdown";
import { PlayingCard } from "./card";

type PublicTrick = NonNullable<
  NonNullable<PrivateGameView["publicRound"]>["currentTrick"]
>;

/** Pixel offset from table center toward each seat, for the sweep exit. */
const SWEEP_VECTORS: Record<TablePosition, { x: number; y: number }> = {
  south: { x: 0, y: 300 },
  north: { x: 0, y: -300 },
  east: { x: 340, y: 0 },
  west: { x: -340, y: 0 },
};

type Sweep = { plays: PublicTrick["plays"]; winnerSeat: number };

/**
 * Keeps a just-completed trick on the table for a beat and returns it so it
 * can be animated toward the winner's seat before disappearing.
 */
function useTrickSweep(view: PrivateGameView): Sweep | null {
  const round = view.publicRound;
  const [sweep, setSweep] = useState<Sweep | null>(null);
  const previousTrick = useRef<PublicTrick | undefined>(round?.currentTrick);

  useEffect(() => {
    const previous = previousTrick.current;
    const current = round?.currentTrick;
    previousTrick.current = current;
    if (previous === undefined || current !== undefined || round === undefined) {
      return;
    }
    const winnerSeat =
      round.completedTricksSummary.at(-1)?.winnerSeat ?? round.currentTurnSeat;
    if (winnerSeat === undefined) return;
    setSweep({ plays: previous.plays, winnerSeat });
  }, [round]);

  // The dismiss timer lives with the sweep itself: keying it off `round`
  // would cancel it on the next snapshot and leave the sweep stuck.
  useEffect(() => {
    if (sweep === null) return;
    const timer = setTimeout(() => setSweep(null), TRICK_SWEEP_MS);
    return () => clearTimeout(timer);
  }, [sweep]);

  return sweep;
}

/** The single centered status message for the current phase, keyed for exits. */
function phaseMessage(
  view: PrivateGameView,
  turnDeadline: string | null,
  serverNow: () => number,
): { key: string; node: ReactNode } | null {
  const round = view.publicRound;
  if (view.phase === "dealing") {
    const bid = round?.currentBid;
    return {
      key: "dealing",
      node: (
        <div className="phase-message">
          <span className="deal-spinner">升</span>
          <strong>Dealing the cards</strong>
          <small>
            {bid
              ? `Seat ${bid.seat + 1} declared ${cardFaceLabel(bid.face)}${bid.count > 1 ? ` ×${bid.count}` : ""}`
              : "Bids are open during the deal."}
          </small>
        </div>
      ),
    };
  }
  if (
    view.phase === "post-deal-bidding" &&
    round !== undefined &&
    round.currentTrick === undefined
  ) {
    return {
      key: "bidding",
      node: (
        <div className="phase-message bid-message">
          <Countdown deadline={round.biddingDeadline} now={serverNow} />
          <strong>{round.currentBid ? "Raise or pass" : "Declare trump"}</strong>
          <small>
            {round.currentBid
              ? `Seat ${round.currentBid.seat + 1} declared ${cardFaceLabel(round.currentBid.face)}${round.currentBid.count > 1 ? ` ×${round.currentBid.count}` : ""}`
              : "Select level cards or a joker pair."}
          </small>
        </div>
      ),
    };
  }
  if (view.phase === "bottom-exchange") {
    return {
      key: "bottom",
      node: (
        <div className="phase-message">
          <span className="bottom-icon">底</span>
          <strong>
            {view.you.seat === round?.leaderSeat ? "Bury 8 cards" : "Leader is burying"}
          </strong>
          <small>Bottom points count only if attackers take the last trick.</small>
        </div>
      ),
    };
  }
  if (
    view.phase === "playing" &&
    round !== undefined &&
    round.currentTrick === undefined
  ) {
    const yourLead = round.currentTurnSeat === view.you.seat;
    return {
      key: `lead-${yourLead ? "you" : "waiting"}`,
      node: (
        <div className="table-watermark">
          <span>升</span>
          <small>{yourLead ? "Your lead" : "Waiting for lead"}</small>
          {yourLead && (
            <Countdown deadline={turnDeadline ?? undefined} now={serverNow} />
          )}
        </div>
      ),
    };
  }
  return null;
}

export function TrickCenter({
  view,
  turnDeadline,
  serverNow,
}: {
  view: PrivateGameView;
  turnDeadline: string | null;
  serverNow: () => number;
}) {
  const round = view.publicRound;
  const message = phaseMessage(view, turnDeadline, serverNow);
  const sweep = useTrickSweep(view);
  const reducedMotion = useReducedMotion() ?? false;
  const sweepVector =
    sweep === null || reducedMotion
      ? { x: 0, y: 0 }
      : SWEEP_VECTORS[relativeSeatPosition(sweep.winnerSeat, view.you.seat)];
  return (
    <div className="trick-center">
      {/*
        Concurrent mode (not mode="wait"): entering and exiting messages
        overlap in an absolutely-positioned slot, so a missed exit callback
        can never wedge the next phase's message out of the tree.
      */}
      <AnimatePresence>
        {sweep === null && message && (
          <motion.div
            className="phase-slot"
            key={message.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {message.node}
          </motion.div>
        )}
      </AnimatePresence>
      {sweep !== null && (
        <motion.div
          className="trick-sweep"
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{ ...sweepVector, scale: 0.45, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeIn", delay: 0.12 }}
        >
          {sweep.plays.map((play, playIndex) => (
            <div className={`center-play play-${playIndex}`} key={play.seat}>
              {play.cards.map((card) => (
                <PlayingCard key={card.id} card={card} compact />
              ))}
            </div>
          ))}
        </motion.div>
      )}
      {round?.currentTrick?.plays.map((play, playIndex) => (
        <motion.div
          className={`center-play play-${playIndex}`}
          key={`${play.seat}-${play.cards.map(({ id }) => id).join("-")}`}
          initial={{ opacity: 0, scale: 0.82 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {play.cards.map((card) => (
            <PlayingCard key={card.id} card={card} compact />
          ))}
          <span>Seat {play.seat + 1}</span>
        </motion.div>
      ))}
    </div>
  );
}
