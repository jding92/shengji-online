import type { Metadata } from "next";
import { Baloo_2, Press_Start_2P } from "next/font/google";
import "./globals.css";

/*
 * Display faces for the themed skins. Press Start 2P drives the "Retro"
 * theme's hard 8-bit look. Baloo 2 — a chunky, rounded display sans — gives
 * the "Default" theme its polished modern-game feel (distinct from Retro,
 * and its digits never read ambiguously). CJK glyphs (升级) fall back to a
 * serif, which reads like the hand-painted logos on old Chinese card clients.
 */
const pixel = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
});

const gameFont = Baloo_2({
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-game-face",
});

export const metadata: Metadata = {
  title: "Sheng Ji · 升级 Online",
  description: "A polished private online table for four-player Sheng Ji.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="default"
      suppressHydrationWarning
      className={`${pixel.variable} ${gameFont.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
