"use client";

import type { PrivateGameView, WireClientCommand } from "@shengji/protocol";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const CONFETTI_COLORS = ["var(--gold)", "var(--accent-bright)", "var(--ink)"];

/** Deterministic gold-and-red paper burst; pure CSS/motion, no dependencies. */
function ConfettiBurst() {
  const reducedMotion = useReducedMotion() ?? false;
  if (reducedMotion) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 18 }, (_, index) => (
        <motion.span
          key={index}
          className="confetti-piece"
          style={{
            left: `${6 + index * 5}%`,
            background: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
          }}
          initial={{ y: -16, opacity: 1, rotate: 0 }}
          animate={{
            y: 260 + (index % 4) * 30,
            x: ((index % 5) - 2) * 34,
            rotate: (index % 2 === 0 ? 1 : -1) * (200 + index * 14),
            opacity: 0,
          }}
          transition={{ duration: 1.6, delay: index * 0.05, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

/** Counts from 0 to the final score as the modal opens. */
function ScoreCountUp({ value }: { value: number }) {
  const reducedMotion = useReducedMotion() ?? false;
  const [display, setDisplay] = useState(reducedMotion ? value : 0);
  useEffect(() => {
    if (reducedMotion) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value, reducedMotion]);
  return <strong>{display}</strong>;
}

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
  const gameOver = view.phase === "game-over";
  const outcome =
    view.phase === "round-scoring" || gameOver ? round?.outcome : undefined;
  return (
    <AnimatePresence>
      {round !== undefined && outcome !== undefined && (
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
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
          >
            <ConfettiBurst />
            {gameOver ? (
              <>
                <p className="eyebrow">GAME OVER · 升级</p>
                <motion.span
                  className="victory-mark"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                >
                  升
                </motion.span>
                <h2>
                  {outcome.winner === "defenders"
                    ? "Defenders win the game"
                    : "Attackers win the game"}
                </h2>
              </>
            ) : (
              <>
                <p className="eyebrow">ROUND {round.roundNumber} COMPLETE</p>
                <h2>
                  {outcome.winner === "defenders"
                    ? "Defenders hold"
                    : "Attackers break through"}
                </h2>
              </>
            )}
            <div className="summary-score">
              <span>
                <small>Attacker points</small>
                <ScoreCountUp value={outcome.attackerPoints} />
              </span>
              <span>
                <small>Level change</small>
                <motion.strong
                  initial={{ scale: 1.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 20,
                    delay: 0.7,
                  }}
                >
                  +{outcome.levelDelta}
                </motion.strong>
              </span>
            </div>
            {gameOver ? (
              <p>Thanks for playing — start a new room for another climb.</p>
            ) : (
              <p>Bottom and throw adjustments are included in the final total.</p>
            )}
            {!gameOver && actions.has("start-next-round") && (
              <button
                className="button button-primary"
                type="button"
                onClick={() => submit({ type: "START_NEXT_ROUND" })}
              >
                Start next round
              </button>
            )}
            {!gameOver && !actions.has("start-next-round") && (
              <small>Waiting for the next leader…</small>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
