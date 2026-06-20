"use client";

import type {
  CardInstance,
  PrivateGameView,
  WireClientCommand,
} from "@shengji/protocol";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CardBack, PlayingCard } from "./card";

const rankOrder = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const suitOrder = ["clubs", "diamonds", "spades", "hearts"];

function cardSort(a: CardInstance, b: CardInstance): number {
  if (a.face.kind === "joker" && b.face.kind !== "joker") return 1;
  if (a.face.kind !== "joker" && b.face.kind === "joker") return -1;
  if (a.face.kind === "joker" && b.face.kind === "joker") {
    return a.face.joker === b.face.joker
      ? a.id.localeCompare(b.id)
      : a.face.joker === "small"
        ? -1
        : 1;
  }
  if (a.face.kind === "standard" && b.face.kind === "standard") {
    const suit = suitOrder.indexOf(a.face.suit) - suitOrder.indexOf(b.face.suit);
    if (suit !== 0) return suit;
    const rank = rankOrder.indexOf(a.face.rank) - rankOrder.indexOf(b.face.rank);
    return rank !== 0 ? rank : a.id.localeCompare(b.id);
  }
  return 0;
}

function relativePosition(seat: number, you: number | null): string {
  const relative = you === null ? seat : (seat - you + 4) % 4;
  return ["south", "east", "north", "west"][relative] ?? "north";
}

function Countdown({ deadline }: { deadline: string | undefined }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  if (deadline === undefined) return null;
  const remaining = Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1_000));
  return (
    <span className={remaining <= 5 ? "countdown is-urgent" : "countdown"}>
      {remaining}s
    </span>
  );
}

function Seat({
  seat,
  position,
  currentTurn,
  isYou,
}: {
  seat: PrivateGameView["seats"][number];
  position: string;
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
              : `Level ${seat.rank} · ${seat.seat % 2 === 0 ? "Jade" : "Ember"}`}
          </small>
        </span>
        {!seat.connected && seat.playerId !== null && <i className="offline-dot" />}
      </div>
    </div>
  );
}

type GameTableProps = {
  view: PrivateGameView;
  sendCommand: (command: WireClientCommand) => boolean;
};

export function GameTable({ view, sendCommand }: GameTableProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const lastSelected = useRef<number | null>(null);
  const cards = useMemo(() => [...view.you.hand].sort(cardSort), [view.you.hand]);
  const round = view.publicRound;
  const actions = new Set(view.legalActions);

  useEffect(() => {
    const owned = new Set(view.you.hand.map(({ id }) => id));
    setSelected((current) => new Set([...current].filter((id) => owned.has(id))));
  }, [view.you.hand]);

  function toggleCard(card: CardInstance, index: number, shift: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (shift && lastSelected.current !== null) {
        const start = Math.min(lastSelected.current, index);
        const end = Math.max(lastSelected.current, index);
        for (const rangeCard of cards.slice(start, end + 1)) next.add(rangeCard.id);
      } else if (next.has(card.id)) next.delete(card.id);
      else next.add(card.id);
      return next;
    });
    lastSelected.current = index;
  }

  const selectedCards = cards.filter(({ id }) => selected.has(id));

  function submit(command: WireClientCommand) {
    if (sendCommand(command)) {
      setSelected(new Set());
      lastSelected.current = null;
    }
  }

  const trumpLabel =
    round?.trumpSpec?.mode === "no-trump"
      ? "No-trump / 无主"
      : round?.trumpSpec?.mode === "suit"
        ? `${round.trumpSpec.suit} / 主`
        : "Undeclared";

  return (
    <main className="game-shell">
      <header className="table-topbar">
        <div className="brand-lockup">
          <span className="brand-mark">升</span>
          <span>
            <strong>Sheng Ji</strong>
            <small>Room {view.roomId}</small>
          </span>
        </div>
        <div className="round-pills">
          <span>
            <small>LEVEL / 级</small>
            <strong>{round?.trumpRank ?? "2"}</strong>
          </span>
          <span>
            <small>TRUMP / 主</small>
            <strong className="capitalize">{trumpLabel}</strong>
          </span>
          <span>
            <small>ATTACKERS / 分</small>
            <strong>
              {(round?.attackerPoints ?? 0) + (round?.throwPenaltyAdjustment ?? 0)}
            </strong>
          </span>
        </div>
        <button
          type="button"
          className="icon-button"
          title="Copy invite link"
          onClick={() => void navigator.clipboard.writeText(window.location.href)}
        >
          ↗
        </button>
      </header>

      <AnimatePresence>
        {round?.lastThrow && (
          <motion.div
            className={`throw-banner throw-${round.lastThrow.kind}`}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <strong>
              {round.lastThrow.kind === "failed" ? "Throw failed" : "Throw succeeds"}
            </strong>
            <span>{round.lastThrow.explanation}</span>
            {round.lastThrow.pointDeltaToAttackers !== 0 && (
              <b>
                {round.lastThrow.pointDeltaToAttackers > 0 ? "+" : ""}
                {round.lastThrow.pointDeltaToAttackers} points
              </b>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <section className="table-stage">
        <div className="felt-table">
          <div className="felt-ring" />
          {view.seats.map((seat) => (
            <Seat
              key={seat.seat}
              seat={seat}
              position={relativePosition(seat.seat, view.you.seat)}
              currentTurn={round?.currentTurnSeat === seat.seat}
              isYou={seat.playerId === view.you.playerId}
            />
          ))}

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
                  <Countdown deadline={round.biddingDeadline} />
                  <strong>
                    {round.currentBid ? "Raise or pass" : "Declare trump"}
                  </strong>
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
                  {view.you.seat === round?.leaderSeat
                    ? "Bury 8 cards"
                    : "Leader is burying"}
                </strong>
                <small>
                  Bottom points count only if attackers take the last trick.
                </small>
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
                </div>
              )}
          </div>
        </div>
      </section>

      <section className="hand-dock">
        <div className="hand-meta">
          <span>
            YOUR HAND <b>{cards.length}</b>
          </span>
          <span>{selected.size} selected</span>
        </div>
        <div className="hand-scroll" role="group" aria-label="Your hand">
          {cards.map((card, index) => (
            <PlayingCard
              key={card.id}
              card={card}
              selected={selected.has(card.id)}
              onSelect={(event) => toggleCard(card, index, event.shiftKey)}
            />
          ))}
        </div>

        <div className="action-dock">
          {actions.has("pass-bid") && (
            <button
              className="button button-ghost"
              type="button"
              onClick={() => submit({ type: "PASS_BID" })}
            >
              Pass
            </button>
          )}
          {actions.has("bid") && (
            <button
              className="button button-gold"
              type="button"
              disabled={selectedCards.length === 0}
              onClick={() =>
                submit({ type: "BID", cards: selectedCards.map(({ id }) => id) })
              }
            >
              Bid selected
            </button>
          )}
          {actions.has("bury-bottom") && (
            <button
              className="button button-primary"
              type="button"
              disabled={selectedCards.length !== view.ruleset.bottomSize}
              onClick={() =>
                submit({
                  type: "BURY_BOTTOM",
                  cards: selectedCards.map(({ id }) => id),
                })
              }
            >
              Bury {selectedCards.length} / {view.ruleset.bottomSize}
            </button>
          )}
          {actions.has("attempt-throw") && (
            <button
              className="button button-ghost"
              type="button"
              disabled={selectedCards.length < 2}
              onClick={() =>
                submit({
                  type: "PLAY_CARDS",
                  cards: selectedCards.map(({ id }) => id),
                  intent: "throw",
                })
              }
            >
              Throw / 甩牌
            </button>
          )}
          {actions.has("play-cards") && (
            <button
              className="button button-primary"
              type="button"
              disabled={selectedCards.length === 0}
              onClick={() =>
                submit({
                  type: "PLAY_CARDS",
                  cards: selectedCards.map(({ id }) => id),
                  intent: "normal",
                })
              }
            >
              Play selected
            </button>
          )}
        </div>
      </section>

      <AnimatePresence>
        {view.phase === "round-scoring" && round?.outcome && (
          <motion.div
            className="modal-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.section
              className="round-summary"
              initial={{ y: 24, scale: 0.96 }}
              animate={{ y: 0, scale: 1 }}
            >
              <p className="eyebrow">ROUND {round.roundNumber} COMPLETE</p>
              <h2>
                {round.outcome.winner === "defenders"
                  ? "Defenders hold"
                  : "Attackers break through"}
              </h2>
              <div className="summary-score">
                <span>
                  <small>Attacker points</small>
                  <strong>{round.outcome.attackerPoints}</strong>
                </span>
                <span>
                  <small>Level change</small>
                  <strong>+{round.outcome.levelDelta}</strong>
                </span>
              </div>
              <p>Bottom and throw adjustments are included in the final total.</p>
              {actions.has("start-next-round") ? (
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => submit({ type: "START_NEXT_ROUND" })}
                >
                  Start next round
                </button>
              ) : (
                <small>Waiting for the next leader…</small>
              )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
