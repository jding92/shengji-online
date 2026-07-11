"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo } from "react";
import { MOMENT_TRUMP_STAMP_MS } from "../lib/constants";
import { ART_ASSET_IDS, artAssetPath, artAssetSrcSet } from "../lib/art-registry";
import type { GameMoment } from "../lib/moments";

type MomentLayerProps = {
  moments: GameMoment[];
  dismiss: (id: string) => void;
};

type DisplayedMoment = Extract<GameMoment, { type: "TRUMP_DECLARED" }>;

export function isMomentLayerMoment(moment: GameMoment): moment is DisplayedMoment {
  return moment.type === "TRUMP_DECLARED";
}

export function MomentLayer({ moments, dismiss }: MomentLayerProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const displayed = useMemo(() => moments.filter(isMomentLayerMoment), [moments]);

  useEffect(() => {
    const timers = displayed.map((moment) =>
      setTimeout(() => dismiss(moment.id), MOMENT_TRUMP_STAMP_MS),
    );
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [dismiss, displayed]);

  return (
    <div className="moment-layer" aria-hidden="true">
      <AnimatePresence>
        {displayed.map((moment) => (
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
            <img
              className="moment-trump-vignette"
              data-art-asset={ART_ASSET_IDS.trumpBurst}
              src={artAssetPath(ART_ASSET_IDS.trumpBurst)}
              srcSet={artAssetSrcSet(ART_ASSET_IDS.trumpBurst)}
              alt=""
              draggable={false}
            />
            <img
              className="moment-trump-stamp"
              data-art-asset={ART_ASSET_IDS.gameplayUi("trump-declaration")}
              src={artAssetPath(ART_ASSET_IDS.gameplayUi("trump-declaration"))}
              srcSet={artAssetSrcSet(ART_ASSET_IDS.gameplayUi("trump-declaration"))}
              alt=""
              draggable={false}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
