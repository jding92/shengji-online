"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import type { GameMoment } from "../lib/moments";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
};

const GOLD = ["#f8d978", "#f2b84b", "#fff1b0"];
const EMBER = ["#f8d978", "#f2b84b", "#ff4b55", "#d61d2f"];

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function resizeCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  context?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function makeBurst(
  count: number,
  x: number,
  y: number,
  colors: readonly string[],
  power: number,
): Particle[] {
  return Array.from({ length: count }, () => {
    const angle = randomBetween(-Math.PI, 0);
    const speed = randomBetween(power * 0.35, power);
    return {
      x,
      y,
      vx: Math.cos(angle) * speed + randomBetween(-0.7, 0.7),
      vy: Math.sin(angle) * speed - randomBetween(0.4, 1.3),
      gravity: randomBetween(0.035, 0.075),
      size: randomBetween(2.2, 5.8),
      life: 0,
      maxLife: randomBetween(42, 78),
      color: colors[Math.floor(Math.random() * colors.length)] ?? colors[0]!,
    };
  });
}

export function FxCanvas({
  moments,
  gameVictory,
}: {
  moments: GameMoment[];
  gameVictory: boolean;
}) {
  const reducedMotion = useReducedMotion() ?? false;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particles = useRef<Particle[]>([]);
  const frame = useRef<number | null>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (canvas === null) return;
    resizeCanvas(canvas);
    const handleResize = () => resizeCanvas(canvas);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const context = canvas.getContext("2d");
    if (context === null) return;
    const ctx = context;

    function draw() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particles.current = particles.current
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy,
          vy: particle.vy + particle.gravity,
          life: particle.life + 1,
        }))
        .filter((particle) => particle.life < particle.maxLife);

      for (const particle of particles.current) {
        const age = particle.life / particle.maxLife;
        ctx.globalAlpha = Math.max(0, 1 - age);
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(
          particle.x,
          particle.y,
          particle.size * (1 - age * 0.35),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (particles.current.length > 0) {
        frame.current = requestAnimationFrame(draw);
      } else {
        frame.current = null;
      }
    }

    function wake() {
      if (frame.current === null && particles.current.length > 0) {
        frame.current = requestAnimationFrame(draw);
      }
    }

    for (const moment of moments) {
      if (seen.current.has(moment.id)) continue;
      seen.current.add(moment.id);
      if (moment.type === "TRICK_WON" && moment.points >= 15) {
        particles.current.push(
          ...makeBurst(
            24,
            window.innerWidth * 0.52,
            window.innerHeight * 0.43,
            GOLD,
            5,
          ),
        );
      }
      if (moment.type === "GAME_OVER" && gameVictory) {
        particles.current.push(
          ...makeBurst(
            80,
            window.innerWidth * 0.5,
            window.innerHeight * 0.72,
            EMBER,
            7,
          ),
        );
      }
    }
    wake();
  }, [gameVictory, moments, reducedMotion]);

  if (reducedMotion) return null;
  return <canvas ref={canvasRef} className="fx-canvas" aria-hidden="true" />;
}
