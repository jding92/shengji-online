import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
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
      command: "pnpm --dir ../.. --filter @shengji/server dev",
      url: "http://127.0.0.1:3001/api/health",
      reuseExistingServer: process.env.PW_REUSE_SERVER === "1",
      timeout: 30_000,
      env: {
        DATABASE_PATH: "/tmp/shengji-playwright.sqlite",
        DEAL_INTERVAL_MS: "3",
        BID_POST_DEAL_SECONDS: "120",
        BID_RESPONSE_SECONDS: "2",
      },
    },
    {
      command: "pnpm --dir ../.. --filter @shengji/web dev",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: process.env.PW_REUSE_SERVER === "1",
      timeout: 30_000,
    },
  ],
});
