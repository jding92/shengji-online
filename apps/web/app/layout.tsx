import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sheng Ji · 升级 Online",
  description: "A polished private online table for four-player Sheng Ji.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
