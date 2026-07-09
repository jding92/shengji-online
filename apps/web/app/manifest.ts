import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sheng Ji · 升级 Online",
    short_name: "Sheng Ji",
    description: "A polished private online table for four-player Sheng Ji.",
    start_url: "/",
    display: "standalone",
    background_color: "#080906",
    theme_color: "#080906",
    icons: [
      { src: "/art/icons/pwa-192.png", sizes: "192x192", type: "image/png" },
      { src: "/art/icons/pwa-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
