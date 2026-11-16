import { defineConfig, devices } from "@playwright/test";

// Dedicated visual acceptance port; parallel Impulse E2E sessions use 4173.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "messages-light-mobile-20261116.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4188",
    colorScheme: "light",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4188 --strictPort",
    url: "http://127.0.0.1:4188",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
