"use client";

import type { PrivateGameView } from "@shengji/protocol";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { Countdown } from "./countdown";
import { PlayingCard } from "./card";

/** The single centered status message for the current phase, keyed for exits. */
function phaseMessage(
  view: PrivateGameView,
  turnDeadline: string | null,
  serverNow: () => number,
): { key: string; node: ReactNode } | null {
  const round = view.publicRound;
  if (view.phase === "dealing") {
    return {
      key: "dealing",
      node: (
        <div className="phase-message">
          <span className="deal-spinner">升</span>
          <strong>Dealing the cards</strong>
          <small>Bids are open during the deal.</small>
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
              ? `Seat ${round.currentBid.seat + 1}: ${round.currentBid.count} × ${round.currentBid.tier}`
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
  return (
    <div className="trick-center">
      <AnimatePresence mode="wait">
        {message && (
          <motion.div
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
