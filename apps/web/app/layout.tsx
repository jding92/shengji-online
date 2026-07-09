import type { Metadata, Viewport } from "next";
import { Archivo_Black, Ma_Shan_Zheng } from "next/font/google";
import "./globals.css";

/*
 * Mythic uses one poster display face plus brush-script CJK so seals and the
 * 升级 wordmark keep ink character on machines without Kaiti installed.
 */
const displayFont = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});
const cjkFont = Ma_Shan_Zheng({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-cjk",
});

export const metadata: Metadata = {
  title: "Sheng Ji · 升级 Online",
  description: "A polished private online table for four-player Sheng Ji.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/art/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/art/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/art/icons/apple-touch-180.png", sizes: "180x180" }],
  },
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
    <html
      lang="en"
      data-theme="mythic"
      className={`${displayFont.variable} ${cjkFont.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
