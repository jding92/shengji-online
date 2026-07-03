"use client";

import type {
  CardInstance,
  PrivateGameView,
  WireClientCommand,
} from "@shengji/protocol";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cardFaceKey,
  compareCardsForSort,
  getEffectiveSuit,
  parseThrow,
  parseTrickFormat,
} from "@shengji/engine";
import { useCardSelection } from "../hooks/use-card-selection";
import { THROW_BANNER_MS } from "../lib/constants";
import { relativeSeatPosition } from "../lib/cards";
import { HandDock } from "./hand-dock";
import { LeaveButton } from "./leave-button";
import { RoundSummaryModal } from "./round-summary-modal";
import { TableSeat } from "./table-seat";
import { TrickCenter } from "./trick-center";

type GameTableProps = {
  view: PrivateGameView;
  sendCommand: (command: WireClientCommand) => boolean;
  onLeave: () => void;
  turnDeadline: string | null;
  serverNow: () => number;
};

export function GameTable({
  view,
  sendCommand,
  onLeave,
  turnDeadline,
  serverNow,
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
    return [...view.you.hand].sort((a, b) => compareCardsForSort(a, b, trump));
  }, [view.you.hand, round?.trumpSpec, round?.trumpRank]);
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
        <div className="topbar-actions">
          <button
            type="button"
            className="icon-button"
            title="Copy invite link"
            onClick={() => void navigator.clipboard.writeText(window.location.href)}
          >
            ↗
          </button>
          <LeaveButton onLeave={onLeave} />
        </div>
      </header>

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
              {round.lastThrow.kind === "failed" ? "Throw failed" : "Throw succeeds"}
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
            {view.seats.map((seat) => (
              <TableSeat
                key={seat.seat}
                seat={seat}
                position={relativeSeatPosition(seat.seat, view.you.seat)}
                currentTurn={round?.currentTurnSeat === seat.seat}
                isYou={seat.playerId === view.you.playerId}
                bid={
                  (view.phase === "dealing" || view.phase === "post-deal-bidding") &&
                  round?.currentBid?.seat === seat.seat
                    ? round.currentBid
                    : undefined
                }
              />
            ))}
            <TrickCenter
              view={view}
              turnDeadline={turnDeadline}
              serverNow={serverNow}
            />
          </div>
        </section>

        <HandDock
          cards={cards}
          selected={selected}
          selectedCards={selectedCards}
          hinted={hinted}
          selectionKind={selectionKind}
          onToggle={toggle}
          onClear={clear}
          actions={actions}
          bottomSize={view.ruleset.bottomSize}
          submit={submit}
        />
      </LayoutGroup>

      <RoundSummaryModal view={view} actions={actions} submit={submit} />
    </main>
  );
}
