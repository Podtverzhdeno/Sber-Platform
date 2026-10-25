import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
 testDir:"./e2e",testMatch:/production-trajectory-audit\.spec\.ts/,
 timeout:110_000,workers:1,retries:0,reporter:"line",
 use:{baseURL:"https://sber-platform-production.up.railway.app",trace:"retain-on-failure",colorScheme:"dark"},
 projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}}],
});
