import type { Metadata } from "next";
import { Archivo_Black, Baloo_2, Press_Start_2P } from "next/font/google";
import "./globals.css";

/*
 * Display faces for the themed skins. Press Start 2P drives the "Retro"
 * theme's hard 8-bit look. Baloo 2 — a chunky, rounded display sans — gives
 * the "Classic" theme its polished modern-game feel (distinct from Retro,
 * and its digits never read ambiguously). Archivo Black is the "Phantom"
 * theme's shouty poster face. CJK glyphs (升级) fall back to a serif, which
 * reads like the hand-painted logos on old Chinese card clients.
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

const phantomFont = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-phantom-face",
});

export const metadata: Metadata = {
  title: "Sheng Ji · 升级 Online",
  description: "A polished private online table for four-player Sheng Ji.",
};

/*
 * Restores the saved theme before first paint. Runs as a blocking inline
 * script so a returning "retro" player never flashes the phantom skin.
 * The id list must stay in sync with THEMES in lib/theme.ts.
 */
const themeInitScript = `try{var t=localStorage.getItem("shengji-theme");if(t==="phantom"||t==="default"||t==="retro"||t==="minimal")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="phantom"
      suppressHydrationWarning
      className={`${pixel.variable} ${gameFont.variable} ${phantomFont.variable}`}
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
