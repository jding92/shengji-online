"use client";

import type {
  CardInstance,
  PrivateGameView,
  WireClientCommand,
} from "@shengji/protocol";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  cardFaceKey,
  getEffectiveSuit,
  parseThrow,
  parseTrickFormat,
  sumCardPoints,
} from "@shengji/engine";
import { useCardSelection } from "../hooks/use-card-selection";
import { THROW_BANNER_MS } from "../lib/constants";
import { compareForHandDisplay, relativeSeatPosition } from "../lib/cards";
import { CardBack, PlayingCard } from "./card";
import { Countdown } from "./countdown";
import { HandActions } from "./hand-actions";
import { HandDock } from "./hand-dock";
import { LeaveButton } from "./leave-button";
import { RoundSummaryModal } from "./round-summary-modal";
import { TableSeat } from "./table-seat";
import { ThemeSwitcher } from "./theme-switcher";
import { TrickCenter } from "./trick-center";

const SUIT_GLYPHS = {
  spades: "♠",
  hearts: "♥",
  clubs: "♣",
  diamonds: "♦",
} as const;

type GameTableProps = {
  view: PrivateGameView;
  sendCommand: (command: WireClientCommand) => boolean;
  onLeave: () => void;
  turnDeadline: string | null;
  serverNow: () => number;
  /** Extra sidebar content, e.g. the practice-mode player switcher. */
  sideSlot?: ReactNode;
};

export function GameTable({
  view,
  sendCommand,
  onLeave,
  turnDeadline,
  serverNow,
  sideSlot,
}: GameTableProps) {
  const round = view.publicRound;
  const actions = useMemo(() => new Set(view.legalActions), [view.legalActions]);
  // Sort trump-aware: before a suit is declared, treat the level rank as
  // no-trump so level cards group with the jokers instead of their suits.
  const cards = useMemo(() => {
    const trump = round?.trumpSpec ?? {
      mode: "no-trump" as const,
      rank: round?.trumpRank ?? "2",
    };
    return [...view.you.hand].sort((a, b) => compareForHandDisplay(a, b, trump));
  }, [view.you.hand, round?.trumpSpec, round?.trumpRank]);

  // Steady-state hand size = (all dealt cards − the buried bottom) ÷ players.
  // A standard deck here is 54 cards (52 + two jokers).
  const fullHandSize = Math.round(
    (view.ruleset.decks * 54 - view.ruleset.bottomSize) / view.ruleset.players,
  );
  const { selected, selectedCards, toggle, clear } = useCardSelection(cards);

  // Would the current selection lead as a throw (multiple components)?
  // Only meaningful when leading; followers may legally mix suits when void.
  const selectionKind = useMemo((): "normal" | "throw" | "unleadable" => {
    const trump = round?.trumpSpec;
    if (trump === undefined || selectedCards.length < 2) return "normal";
    try {
      parseTrickFormat(selectedCards, trump);
      return "normal";
    } catch {
      try {
        return parseThrow(selectedCards, trump).components.length > 1
          ? "throw"
          : "normal";
      } catch {
        return "unleadable";
      }
    }
  }, [selectedCards, round?.trumpSpec]);

  // Decision hints: bid-eligible cards while bidding; led-suit cards on your
  // turn to follow. An empty set means anything goes.
  const hinted = useMemo(() => {
    const ids = new Set<string>();
    if (actions.has("bid")) {
      for (const card of cards) {
        if (card.face.kind === "joker" || card.face.rank === round?.trumpRank) {
          ids.add(card.id);
        }
      }
      return ids;
    }
    const leadPlay = round?.currentTrick?.plays[0];
    if (
      view.phase === "playing" &&
      round?.currentTurnSeat === view.you.seat &&
      leadPlay !== undefined &&
      leadPlay.cards[0] !== undefined &&
      round.trumpSpec !== undefined
    ) {
      const trump = round.trumpSpec;
      const ledSuit = getEffectiveSuit(leadPlay.cards[0], trump);
      const suitCards = cards.filter(
        (card) => getEffectiveSuit(card, trump) === ledSuit,
      );
      // Following a pair or tractor: hint only the pairs you hold in the led
      // suit (they're what the format obliges); otherwise the whole suit.
      const ledHasTuples = (() => {
        try {
          return parseTrickFormat(leadPlay.cards, trump).components.some(
            ({ tupleSize }) => tupleSize >= 2,
          );
        } catch {
          try {
            return parseThrow(leadPlay.cards, trump).components.some(
              ({ tupleSize }) => tupleSize >= 2,
            );
          } catch {
            return false;
          }
        }
      })();
      if (ledHasTuples) {
        const byFace = new Map<string, CardInstance[]>();
        for (const card of suitCards) {
          const key = cardFaceKey(card.face);
          byFace.set(key, [...(byFace.get(key) ?? []), card]);
        }
        for (const group of byFace.values()) {
          if (group.length >= 2) for (const card of group) ids.add(card.id);
        }
        if (ids.size > 0) return ids;
      }
      for (const card of suitCards) ids.add(card.id);
    }
    return ids;
  }, [actions, cards, round, view.phase, view.you.seat]);

  // The throw banner auto-dismisses and can be clicked away; the engine
  // keeps lastThrow for the whole round, so visibility is client-side.
  const throwKey = round?.lastThrow
    ? `${round.lastThrow.seat}:${round.lastThrow.kind}:${round.lastThrow.explanation}`
    : null;
  const [dismissedThrow, setDismissedThrow] = useState<string | null>(null);
  useEffect(() => {
    if (throwKey === null) return;
    const timer = setTimeout(() => setDismissedThrow(throwKey), THROW_BANNER_MS);
    return () => clearTimeout(timer);
  }, [throwKey]);

  const submit = useCallback(
    (command: WireClientCommand) => {
      if (sendCommand(command)) clear();
    },
    [sendCommand, clear],
  );

  const primaryAction = useCallback((): WireClientCommand | null => {
    const cardIds = selectedCards.map(({ id }) => id);
    if (actions.has("play-cards") && cardIds.length > 0) {
      // Throws need the explicit two-tap button, never the Enter shortcut.
      if (actions.has("attempt-throw") && selectionKind !== "normal") return null;
      return { type: "PLAY_CARDS", cards: cardIds, intent: "normal" };
    }
    if (actions.has("bury-bottom") && cardIds.length === view.ruleset.bottomSize) {
      return { type: "BURY_BOTTOM", cards: cardIds };
    }
    if (actions.has("bid") && cardIds.length > 0) {
      return { type: "BID", cards: cardIds };
    }
    return null;
  }, [actions, selectedCards, selectionKind, view.ruleset.bottomSize]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "Escape") {
        clear();
        return;
      }
      if (event.key === "Enter") {
        const command = primaryAction();
        if (command !== null) submit(command);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [primaryAction, submit, clear]);

  const trumpSpec = round?.trumpSpec;
  const trumpDisplay =
    trumpSpec === undefined
      ? { glyph: "—", red: false, label: "Trump undeclared" }
      : trumpSpec.mode === "no-trump"
        ? { glyph: "NT", red: false, label: "No-trump" }
        : {
            glyph: SUIT_GLYPHS[trumpSpec.suit],
            red: trumpSpec.suit === "hearts" || trumpSpec.suit === "diamonds",
            label: `Trump ${trumpSpec.suit}`,
          };

  // One timer at a time: the bidding window, then the current turn's clock.
  const timerDeadline =
    view.phase === "dealing" || view.phase === "post-deal-bidding"
      ? round?.biddingDeadline
      : view.phase === "playing"
        ? (turnDeadline ?? undefined)
        : undefined;

  // The leader's buried bottom: a pile on the felt that expands on click,
  // plus a sidebar tab with the points tucked away. Leader-only knowledge.
  const buried = view.phase === "playing" ? view.you.buried : undefined;
  const [showBuried, setShowBuried] = useState(false);
  useEffect(() => {
    if (buried === undefined) setShowBuried(false);
  }, [buried === undefined]);

  const youSeat = view.seats.find((seat) => seat.playerId === view.you.playerId);
  const bidFor = (seatIndex: number) =>
    (view.phase === "dealing" || view.phase === "post-deal-bidding") &&
    round?.currentBid?.seat === seatIndex
      ? round.currentBid
      : undefined;

  return (
    <main className="game-shell">
      <aside className="side-panel">
        <div className="brand-lockup">
          <span className="brand-mark">升</span>
          <span>
            <strong>Sheng Ji</strong>
            <small>Room {view.roomId}</small>
          </span>
        </div>

        {/* Every readout is a half-width tile, including timer and bottom. */}
        <div className="round-pills">
          <span>
            <small>LEVEL / 级</small>
            <strong>{round?.trumpRank ?? "2"}</strong>
          </span>
          <span>
            <small>TRUMP / 主</small>
            <strong
              className={trumpDisplay.red ? "is-red-suit" : ""}
              aria-label={trumpDisplay.label}
            >
              {trumpDisplay.glyph}
            </strong>
          </span>
          <span>
            <small>POINTS / 分</small>
            <strong>
              {(round?.attackerPoints ?? 0) + (round?.throwPenaltyAdjustment ?? 0)}
            </strong>
          </span>
          {timerDeadline !== undefined && (
            <span className="timer-pill">
              <small>TIMER / 计时</small>
              <Countdown deadline={timerDeadline} now={serverNow} />
            </span>
          )}
          {buried && (
            <button
              type="button"
              className={`bottom-tab ${showBuried ? "is-open" : ""}`}
              onClick={() => setShowBuried((open) => !open)}
            >
              <small>BOTTOM / 底牌</small>
              <strong>{sumCardPoints(buried)} pts</strong>
            </button>
          )}
        </div>

        {sideSlot}

        <div className="side-actions">
          <ThemeSwitcher />
          <LeaveButton onLeave={onLeave} />
        </div>
      </aside>

      <section className="board">
        <AnimatePresence>
          {round?.lastThrow && dismissedThrow !== throwKey && (
            <motion.button
              type="button"
              className={`throw-banner throw-${round.lastThrow.kind}`}
              onClick={() => setDismissedThrow(throwKey)}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <strong>
                {round.lastThrow.kind === "failed"
                  ? "Throw failed"
                  : "Throw succeeds"}
              </strong>
              <span>{round.lastThrow.explanation}</span>
              {round.lastThrow.pointDeltaToAttackers !== 0 && (
                <b>
                  {round.lastThrow.pointDeltaToAttackers > 0 ? "+" : ""}
                  {round.lastThrow.pointDeltaToAttackers} points
                </b>
              )}
              <i>×</i>
            </motion.button>
          )}
        </AnimatePresence>

        <LayoutGroup>
          <section className="table-stage">
            <div className="felt-table">
              <div className="felt-ring" />
              {view.seats.map((seat) =>
                seat.playerId === view.you.playerId ? null : (
                  <TableSeat
                    key={seat.seat}
                    seat={seat}
                    position={relativeSeatPosition(seat.seat, view.you.seat)}
                    currentTurn={round?.currentTurnSeat === seat.seat}
                    isYou={false}
                    isLeader={round?.leaderSeat === seat.seat}
                    handTotal={fullHandSize}
                    bid={bidFor(seat.seat)}
                  />
                ),
              )}
              {/* Your seat sits on a row with the action buttons flanking it:
                  Clear to the left, the primary action to the right. */}
              {youSeat && (
                <div className="south-cluster">
                  <div className="south-slot south-left">
                    {selected.size > 0 && (
                      <button
                        type="button"
                        className="button button-ghost"
                        onClick={clear}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <TableSeat
                    seat={youSeat}
                    position="south"
                    currentTurn={round?.currentTurnSeat === youSeat.seat}
                    isYou
                    isLeader={round?.leaderSeat === youSeat.seat}
                    handTotal={fullHandSize}
                    bid={bidFor(youSeat.seat)}
                  />
                  <div className="south-slot south-right">
                    <HandActions
                      selectedCards={selectedCards}
                      selectionKind={selectionKind}
                      actions={actions}
                      bottomSize={view.ruleset.bottomSize}
                      trump={round?.trumpSpec}
                      submit={submit}
                    />
                  </div>
                </div>
              )}
              <TrickCenter view={view} />
              {buried && (
                <button
                  type="button"
                  className="buried-pile"
                  aria-expanded={showBuried}
                  title="Your buried bottom"
                  onClick={() => setShowBuried((open) => !open)}
                >
                  {Array.from({ length: 3 }, (_, index) => (
                    <CardBack key={index} compact />
                  ))}
                  <span className="card-count">底</span>
                </button>
              )}
              <AnimatePresence>
                {buried && showBuried && (
                  <motion.div
                    className="buried-panel"
                    role="button"
                    tabIndex={0}
                    aria-label="Hide buried bottom"
                    onClick={() => setShowBuried(false)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === "Escape") {
                        setShowBuried(false);
                      }
                    }}
                    initial={{ opacity: 0, y: 14, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  >
                    <small>
                      YOUR BOTTOM · {buried.length} cards · {sumCardPoints(buried)}{" "}
                      pts (multiplier applies if attackers take the last trick)
                    </small>
                    <div className="buried-panel-cards">
                      {buried.map((card) => (
                        <PlayingCard key={card.id} card={card} compact />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          <HandDock
            cards={cards}
            selected={selected}
            hinted={hinted}
            onToggle={toggle}
          />
        </LayoutGroup>

        <RoundSummaryModal view={view} actions={actions} submit={submit} />
      </section>
    </main>
  );
}
