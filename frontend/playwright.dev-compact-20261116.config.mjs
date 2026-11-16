import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
 testDir:"./e2e",testMatch:"development-compact-20261116.spec.ts",
 fullyParallel:false,workers:1,retries:0,reporter:"line",
 use:{baseURL:"http://127.0.0.1:4223",trace:"retain-on-failure"},
 projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}}],
 webServer:{command:"npm run dev -- --host 127.0.0.1 --port 4223 --strictPort",url:"http://127.0.0.1:4223",reuseExistingServer:false},
});
