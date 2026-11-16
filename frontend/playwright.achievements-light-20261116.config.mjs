import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir:"./e2e",testMatch:"achievements-gallery-light-20261116.spec.ts",
  fullyParallel:false,workers:1,retries:0,reporter:"line",
  use:{baseURL:"http://127.0.0.1:4302",trace:"off",screenshot:"off",video:"off"},
  projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}}],
  webServer:{command:"npm run dev -- --host 127.0.0.1 --port 4302 --strictPort",url:"http://127.0.0.1:4302",reuseExistingServer:false},
});
