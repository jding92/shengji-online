"use client";

import type { PrivateGameView, WireClientCommand } from "@shengji/protocol";
import { AnimatePresence, motion } from "motion/react";

export function RoundSummaryModal({
  view,
  actions,
  submit,
}: {
  view: PrivateGameView;
  actions: ReadonlySet<PrivateGameView["legalActions"][number]>;
  submit: (command: WireClientCommand) => void;
}) {
  const round = view.publicRound;
  return (
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
  );
}
