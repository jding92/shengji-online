"use client";

import type { PrivateGameView } from "@shengji/protocol";
import { motion } from "motion/react";
import { Countdown } from "./countdown";
import { PlayingCard } from "./card";

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
  return (
    <div className="trick-center">
      {view.phase === "dealing" && (
        <motion.div
          className="phase-message"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="deal-spinner">升</span>
          <strong>Dealing the cards</strong>
          <small>Bids are open during the deal.</small>
        </motion.div>
      )}
      {view.phase === "post-deal-bidding" &&
        round !== undefined &&
        round.currentTrick === undefined && (
          <div className="phase-message bid-message">
            <Countdown deadline={round.biddingDeadline} now={serverNow} />
            <strong>{round.currentBid ? "Raise or pass" : "Declare trump"}</strong>
            <small>
              {round.currentBid
                ? `Seat ${round.currentBid.seat + 1}: ${round.currentBid.count} × ${round.currentBid.tier}`
                : "Select level cards or a joker pair."}
            </small>
          </div>
        )}
      {view.phase === "bottom-exchange" && (
        <div className="phase-message">
          <span className="bottom-icon">底</span>
          <strong>
            {view.you.seat === round?.leaderSeat ? "Bury 8 cards" : "Leader is burying"}
          </strong>
          <small>Bottom points count only if attackers take the last trick.</small>
        </div>
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
      {view.phase === "playing" &&
        round !== undefined &&
        round.currentTrick === undefined && (
          <div className="table-watermark">
            <span>升</span>
            <small>
              {round.currentTurnSeat === view.you.seat
                ? "Your lead"
                : "Waiting for lead"}
            </small>
            {round.currentTurnSeat === view.you.seat && (
              <Countdown deadline={turnDeadline ?? undefined} now={serverNow} />
            )}
          </div>
        )}
    </div>
  );
}
