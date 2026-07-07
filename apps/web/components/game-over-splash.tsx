"use client";

import { motion, useReducedMotion } from "motion/react";
import { ART, art2x } from "../lib/art";

const SPLASH_CONFETTI_COLORS = ["var(--gold)", "var(--accent-bright)", "var(--ink)"];

function SplashConfetti() {
  const reducedMotion = useReducedMotion() ?? false;
  if (reducedMotion) return null;
  return (
    <div className="confetti game-over-confetti" aria-hidden="true">
      {Array.from({ length: 24 }, (_, index) => (
        <motion.span
          key={index}
          className="confetti-piece"
          style={{
            left: `${4 + index * 4}%`,
            background: SPLASH_CONFETTI_COLORS[index % SPLASH_CONFETTI_COLORS.length],
          }}
          initial={{ y: -18, opacity: 1, rotate: 0 }}
          animate={{
            y: 300 + (index % 5) * 26,
            x: ((index % 7) - 3) * 28,
            rotate: (index % 2 === 0 ? 1 : -1) * (220 + index * 12),
            opacity: 0,
          }}
          transition={{ duration: 1.8, delay: index * 0.035, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

export function GameOverSplash({ victory }: { victory: boolean }) {
  const art = victory ? ART.splash.victory : ART.splash.defeat;
  const title = victory ? "VICTORY · 勝" : "DEFEAT · 敗";

  return (
    <div className="game-over-splash">
      {victory && <SplashConfetti />}
      <img
        className="game-over-splash-art"
        src={art}
        srcSet={`${art2x(art)} 2x`}
        alt=""
      />
      <div className="game-over-splash-title">
        <p className="eyebrow">GAME OVER · 升级</p>
        <h2>{title}</h2>
      </div>
    </div>
  );
}
