"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo } from "react";
import type { PrivateGameView } from "@shengji/protocol";
import { MOMENT_FRIEND_REVEAL_STAMP_MS, MOMENT_TRUMP_STAMP_MS } from "../lib/constants";
import { ART_ASSET_IDS, artAssetPath, artAssetSrcSet } from "../lib/art-registry";
import type { GameMoment } from "../lib/moments";

type MomentLayerProps = {
  moments: GameMoment[];
  dismiss: (id: string) => void;
};

type DisplayedMoment = Extract<
  GameMoment,
  { type: "TRUMP_DECLARED" | "FRIEND_REVEALED" }
>;

export function isMomentLayerMoment(moment: GameMoment): moment is DisplayedMoment {
  return moment.type === "TRUMP_DECLARED" || moment.type === "FRIEND_REVEALED";
}

export function MomentLayer({
  moments,
  dismiss,
  view,
}: MomentLayerProps & { view?: PrivateGameView }) {
  const reducedMotion = useReducedMotion() ?? false;
  const displayed = useMemo(() => moments.filter(isMomentLayerMoment), [moments]);

  useEffect(() => {
    const timers = displayed.map((moment) =>
      setTimeout(
        () => dismiss(moment.id),
        moment.type === "TRUMP_DECLARED"
          ? MOMENT_TRUMP_STAMP_MS
          : MOMENT_FRIEND_REVEAL_STAMP_MS,
      ),
    );
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [dismiss, displayed]);

  return (
    <div className="moment-layer" aria-hidden="true">
      <AnimatePresence>
        {displayed.map((moment) => (
          <motion.div
            className={
              moment.type === "TRUMP_DECLARED"
                ? "moment-trump-declared"
                : "moment-friend-revealed"
            }
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
            {moment.type === "TRUMP_DECLARED" ? (
              <>
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
              </>
            ) : (
              <div className="moment-friend-stamp">
                <strong>FRIEND REVEALED · 找到朋友</strong>
                <span>
                  {view?.seats.find((seat) => seat.seat === moment.seat)?.name ??
                    `Seat ${moment.seat + 1}`}{" "}
                  joins the declarer
                </span>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
