"use client";

import type { PrivateGameView } from "@shengji/protocol";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cardFaceLabel, relativeSeatPosition, type TablePosition } from "../lib/cards";
import { TRICK_RESULT_HOLD_MS, TRICK_SWEEP_MS } from "../lib/constants";
import { PlayingCard } from "./card";

type PublicCompletedTrick = NonNullable<
  NonNullable<PrivateGameView["publicRound"]>["lastCompletedTrick"]
>;

/** Pixel offset from table center toward each seat, for the sweep exit. */
const SWEEP_VECTORS: Record<TablePosition, { x: number; y: number }> = {
  south: { x: 0, y: 300 },
  north: { x: 0, y: -300 },
  east: { x: 340, y: 0 },
  west: { x: -340, y: 0 },
};

type Sweep = {
  plays: PublicCompletedTrick["plays"];
  winnerSeat: number;
};

/**
 * Keeps a just-completed trick on the table for a beat and returns it so it
 * can be animated toward the winner's seat before disappearing.
 */
function useTrickSweep(view: PrivateGameView): Sweep | null {
  const round = view.publicRound;
  const [sweep, setSweep] = useState<Sweep | null>(null);
  const completedKey =
    round?.lastCompletedTrick === undefined
      ? null
      : `${round.roundNumber}:${round.completedTricksSummary.length}`;
  const previousCompletedKey = useRef<string | null>(completedKey);
  const pendingSweeps = useRef<Sweep[]>([]);
  const freshSweep =
    completedKey !== null &&
    completedKey !== previousCompletedKey.current &&
    round?.lastCompletedTrick !== undefined
      ? {
          plays: round.lastCompletedTrick.plays,
          winnerSeat: round.lastCompletedTrick.winnerSeat,
        }
      : null;

  useEffect(() => {
    if (
      completedKey === null ||
      completedKey === previousCompletedKey.current ||
      round?.lastCompletedTrick === undefined
    )
      return;
    previousCompletedKey.current = completedKey;
    const nextSweep = {
      plays: round.lastCompletedTrick.plays,
      winnerSeat: round.lastCompletedTrick.winnerSeat,
    };
    if (sweep === null) setSweep(nextSweep);
    else pendingSweeps.current.push(nextSweep);
  }, [completedKey, round?.lastCompletedTrick, sweep]);

  // The dismiss timer lives with the sweep itself: keying it off `round`
  // would cancel it on the next snapshot and leave the sweep stuck.
  useEffect(() => {
    if (sweep === null) return;
    const timer = setTimeout(
      () => setSweep(pendingSweeps.current.shift() ?? null),
      TRICK_SWEEP_MS,
    );
    return () => clearTimeout(timer);
  }, [sweep]);

  // Return the newly completed trick during the render that first receives
  // it. The effect persists it for the timer, but this synchronous fallback
  // prevents a blank/remounted frame after the final card is played.
  return sweep ?? freshSweep;
}

/** The single centered status message for the current phase, keyed for exits. */
function phaseMessage(view: PrivateGameView): { key: string; node: ReactNode } | null {
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
          <span className="deal-spinner">主</span>
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
        </div>
      ),
    };
  }
  return null;
}

export function TrickCenter({ view }: { view: PrivateGameView }) {
  const round = view.publicRound;
  const message = phaseMessage(view);
  const sweep = useTrickSweep(view);
  const reducedMotion = useReducedMotion() ?? false;
  const sweepVector =
    sweep === null || reducedMotion
      ? { x: 0, y: 0 }
      : SWEEP_VECTORS[relativeSeatPosition(sweep.winnerSeat, view.you.seat)];
  const displayedPlays = sweep?.plays ?? round?.currentTrick?.plays;
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
      {displayedPlays !== undefined && displayedPlays.length > 0 && (
        <motion.div
          className={`trick-plays ${sweep === null ? "" : "trick-sweep"}`}
          initial={false}
          animate={
            sweep === null
              ? { x: 0, y: 0, scale: 1, opacity: 1 }
              : { ...sweepVector, scale: 0.45, opacity: 0 }
          }
          transition={
            sweep === null
              ? { duration: 0.16 }
              : {
                  duration: 0.6,
                  ease: "easeIn",
                  delay: TRICK_RESULT_HOLD_MS / 1_000,
                }
          }
        >
          {displayedPlays.map((play) => (
            <motion.div
              className={`center-play play-${relativeSeatPosition(play.seat, view.you.seat)}`}
              key={play.seat}
              initial={{ opacity: 0, scale: 0.82 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              {play.cards.map((card) => (
                <PlayingCard key={card.id} card={card} />
              ))}
              {sweep === null && <span>Seat {play.seat + 1}</span>}
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
