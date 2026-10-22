import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Browser scenarios mutate the same seeded personas. Keep CI deterministic
  // until every scenario owns an isolated database fixture.
  workers: process.env.CI ? 1 : undefined,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    colorScheme: "dark",
  },
  expect: {
    toHaveScreenshot: { maxDiffPixels: 6000 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});
