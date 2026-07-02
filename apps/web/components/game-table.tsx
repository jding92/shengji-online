"use client";

import type { PrivateGameView, WireClientCommand } from "@shengji/protocol";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo } from "react";
import { useCardSelection } from "../hooks/use-card-selection";
import { compareCardsForHand, relativeSeatPosition } from "../lib/cards";
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
  const cards = useMemo(
    () => [...view.you.hand].sort(compareCardsForHand),
    [view.you.hand],
  );
  const { selected, selectedCards, toggle, clear } = useCardSelection(cards);
  const round = view.publicRound;
  const actions = useMemo(() => new Set(view.legalActions), [view.legalActions]);

  const submit = useCallback(
    (command: WireClientCommand) => {
      if (sendCommand(command)) clear();
    },
    [sendCommand, clear],
  );

  const primaryAction = useCallback((): WireClientCommand | null => {
    const cardIds = selectedCards.map(({ id }) => id);
    if (actions.has("play-cards") && cardIds.length > 0) {
      return { type: "PLAY_CARDS", cards: cardIds, intent: "normal" };
    }
    if (actions.has("bury-bottom") && cardIds.length === view.ruleset.bottomSize) {
      return { type: "BURY_BOTTOM", cards: cardIds };
    }
    if (actions.has("bid") && cardIds.length > 0) {
      return { type: "BID", cards: cardIds };
    }
    return null;
  }, [actions, selectedCards, view.ruleset.bottomSize]);

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
            <TableSeat
              key={seat.seat}
              seat={seat}
              position={relativeSeatPosition(seat.seat, view.you.seat)}
              currentTurn={round?.currentTurnSeat === seat.seat}
              isYou={seat.playerId === view.you.playerId}
            />
          ))}
          <TrickCenter view={view} turnDeadline={turnDeadline} serverNow={serverNow} />
        </div>
      </section>

      <HandDock
        cards={cards}
        selected={selected}
        selectedCards={selectedCards}
        onToggle={toggle}
        onClear={clear}
        actions={actions}
        bottomSize={view.ruleset.bottomSize}
        submit={submit}
      />

      <RoundSummaryModal view={view} actions={actions} submit={submit} />
    </main>
  );
}
