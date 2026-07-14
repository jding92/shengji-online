import { defineConfig, devices } from "@playwright/test";

const webPort = Number.parseInt(process.env.PLAYWRIGHT_WEB_PORT ?? "3000", 10);
const serverPort = Number.parseInt(process.env.PLAYWRIGHT_SERVER_PORT ?? "3001", 10);
const webOrigin = `http://127.0.0.1:${webPort}`;
const serverOrigin = `http://127.0.0.1:${serverPort}`;

export default defineConfig({
  testDir: "./tests",
  // The N-player and finding-friends specs each drive 4-8 live browser
  // contexts against one shared dev server that is also running several bot
  // games from earlier specs, so a heavy trick-completing test can legitimately
  // take over a minute under full-suite load.
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // The multi-context round specs are heavy; under full-suite load a deal can
  // occasionally miss its window. One retry absorbs that margin flakiness.
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: webOrigin,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE === undefined
          ? {}
          : {
              launchOptions: {
                executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
              },
            }),
      },
    },
  ],
  webServer: [
    {
      command:
        "pnpm --dir ../.. --filter @shengji/server build && pnpm --dir ../.. --filter @shengji/server start",
      url: `${serverOrigin}/api/health`,
      reuseExistingServer: process.env.PW_REUSE_SERVER === "1",
      timeout: 30_000,
      env: {
        DATABASE_PATH: "/tmp/shengji-playwright.sqlite",
        PORT: String(serverPort),
        DEAL_INTERVAL_MS: "3",
        BID_POST_DEAL_SECONDS: "15",
        BID_RESPONSE_SECONDS: "2",
      },
    },
    {
      // A production build, not `next dev`: the suite drives up to eight live
      // game contexts at once, and dev-mode React cannot keep the deals flowing
      // for the multi-context specs under that load. The build is a one-time
      // startup cost; NEXT_PUBLIC_WS_URL is inlined at build time so it is set
      // for the whole command.
      command:
        "pnpm --dir ../.. --filter @shengji/protocol build && " +
        `pnpm --dir ../.. --filter @shengji/web build && ` +
        `pnpm --dir ../.. --filter @shengji/web exec next start -p ${webPort}`,
      url: webOrigin,
      reuseExistingServer: process.env.PW_REUSE_SERVER === "1",
      timeout: 180_000,
      env: {
        PORT: String(webPort),
        ...(process.env.PLAYWRIGHT_WEB_PORT === undefined
          ? {}
          : { NEXT_DIST_DIR: `.next-playwright-${webPort}` }),
        GAME_SERVER_ORIGIN: serverOrigin,
        NEXT_PUBLIC_WS_URL: `ws://127.0.0.1:${serverPort}/ws`,
      },
    },
  ],
});
