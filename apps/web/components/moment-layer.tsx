"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo } from "react";
import { MOMENT_POINTS_FLOAT_MS, MOMENT_TRUMP_STAMP_MS } from "../lib/constants";
import { ART, art2x } from "../lib/art";
import type { GameMoment } from "../lib/moments";

type MomentLayerProps = {
  moments: GameMoment[];
  dismiss: (id: string) => void;
};

type DisplayedMoment = Extract<
  GameMoment,
  { type: "TRUMP_DECLARED" } | { type: "TRICK_WON" }
>;

function isDisplayedMoment(moment: GameMoment): moment is DisplayedMoment {
  return (
    moment.type === "TRUMP_DECLARED" ||
    (moment.type === "TRICK_WON" && moment.points > 0)
  );
}

export function MomentLayer({ moments, dismiss }: MomentLayerProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const displayed = useMemo(() => moments.filter(isDisplayedMoment), [moments]);

  useEffect(() => {
    const timers = displayed.map((moment) =>
      setTimeout(
        () => dismiss(moment.id),
        moment.type === "TRUMP_DECLARED"
          ? MOMENT_TRUMP_STAMP_MS
          : MOMENT_POINTS_FLOAT_MS,
      ),
    );
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [dismiss, displayed]);

  return (
    <div className="moment-layer" aria-hidden="true">
      <AnimatePresence>
        {displayed.map((moment) =>
          moment.type === "TRUMP_DECLARED" ? (
            <motion.div
              className="moment-trump-declared"
              key={moment.id}
              initial={
                reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.4, rotate: -7 }
              }
              animate={
                reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }
              }
              exit={
                reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, rotate: 4 }
              }
              transition={
                reducedMotion
                  ? { duration: 0.18 }
                  : { type: "spring", stiffness: 420, damping: 18 }
              }
            >
              <span className="moment-trump-vignette" />
              <img
                className="moment-trump-stamp"
                src={ART.ui.trumpDeclaration}
                srcSet={`${art2x(ART.ui.trumpDeclaration)} 2x`}
                alt=""
              />
            </motion.div>
          ) : (
            <motion.div
              className="moment-points-float"
              key={moment.id}
              initial={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, x: "0%", y: "0%", scale: 0.9 }
              }
              animate={
                reducedMotion
                  ? { opacity: 1 }
                  : {
                      opacity: [0, 1, 1, 0],
                      x: "-18%",
                      y: "-34%",
                      scale: [0.9, 1.06, 1],
                    }
              }
              exit={{ opacity: 0 }}
              transition={
                reducedMotion
                  ? { duration: 0.18 }
                  : { duration: MOMENT_POINTS_FLOAT_MS / 1_000, ease: "easeOut" }
              }
            >
              <img
                className="moment-points-art"
                src={ART.ui.pointsGlow}
                srcSet={`${art2x(ART.ui.pointsGlow)} 2x`}
                alt=""
              />
              <strong>+{moment.points} 分</strong>
            </motion.div>
          ),
        )}
      </AnimatePresence>
    </div>
  );
}
