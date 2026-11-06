import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  // The dev server compiles on first use and can take over 5 seconds when busy.
  expect: { timeout: 15_000 },
  timeout: 60_000,
  testDir: "./e2e",
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm dev --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    env: { TEST_SIGN_IN_ENABLED: "true" },
  },
});
