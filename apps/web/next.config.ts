import type { NextConfig } from "next";

const serverOrigin = process.env.GAME_SERVER_ORIGIN ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  rewrites() {
    return Promise.resolve([
      { source: "/api/:path*", destination: `${serverOrigin}/api/:path*` },
    ]);
  },
};

export default nextConfig;
