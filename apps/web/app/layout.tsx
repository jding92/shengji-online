import type { Metadata, Viewport } from "next";
import { Archivo_Black } from "next/font/google";
import "./globals.css";

/*
 * Mythic uses one poster display face. CJK glyphs (升级) fall back to a serif,
 * which reads like the hand-painted logos on old Chinese card clients.
 */
const displayFont = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Sheng Ji · 升级 Online",
  description: "A polished private online table for four-player Sheng Ji.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="mythic" className={displayFont.variable}>
      <body>{children}</body>
    </html>
  );
}
