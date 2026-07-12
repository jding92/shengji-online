import { defineConfig, devices } from "@playwright/test";

const webPort = Number.parseInt(process.env.PLAYWRIGHT_WEB_PORT ?? "3000", 10);
const serverPort = Number.parseInt(process.env.PLAYWRIGHT_SERVER_PORT ?? "3001", 10);
const webOrigin = `http://127.0.0.1:${webPort}`;
const serverOrigin = `http://127.0.0.1:${serverPort}`;

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
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
      command: "pnpm --dir ../.. --filter @shengji/web dev",
      url: webOrigin,
      reuseExistingServer: process.env.PW_REUSE_SERVER === "1",
      timeout: 30_000,
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
