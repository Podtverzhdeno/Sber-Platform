import { expect, test, type Page } from "@playwright/test";

import { catalogItem, catalogPage, catalogTerms, insufficientItem } from "../src/features/task-catalog-v2/fixture";

const participant = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Синтетический участник",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Мой путь", "Задачи", "Мои проекты"],
  csrf_token: "csrf-catalog-visual",
};

const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
] as const;

test.skip(process.platform !== "linux", "visual baselines ship for linux (CI parity)");

async function installRoutes(page: Page): Promise<void> {
  await page.route("**/api/v1/me/**", (route) => route.fulfill({ status: 404, json: { code: "NOT_MOCKED" } }));
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: {
    honor_board_enabled: false,
    task_catalog_v2_enabled: true,
    demo_mode: true,
  } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [
    { key: "participant-synthetic", display_name: participant.display_name, roles: ["participant"] },
  ] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: participant }));
  await page.route("**/api/v1/development/tracks", (route) => route.fulfill({ json: { active_count: 1, max_active: 2, tracks: [] } }));
  await page.route("**/api/v1/me/roadmaps", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/task-recommendations?*", (route) => route.fulfill({ json: catalogPage([catalogItem, insufficientItem]) }));
  await page.route(`**/api/v1/me/task-recommendations/${catalogItem.task_id}`, (route) => route.fulfill({ json: catalogItem }));
  await page.route(`**/api/v1/me/task-recommendations/${insufficientItem.task_id}`, (route) => route.fulfill({ json: insufficientItem }));
  await page.route(`**/api/v1/me/task-recommendations/${catalogItem.task_id}/terms`, (route) => route.fulfill({ json: catalogTerms }));
  await page.route("**/api/v1/me/task-recommendations/analytics/events", (route) => route.fulfill({ status: 202, json: { event_id: "00000000-0000-0000-0000-000000000902", duplicate: false } }));
}

async function openCatalog(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.addInitScript((value) => {
    window.localStorage.setItem("impulse-theme", value);
  }, theme);
  await installRoutes(page);
  await page.goto("/");
  await page.locator('[data-persona="participant-synthetic"]').click();
  await expect(page.locator(".workspace")).toBeVisible();
  const menu = page.getByRole("button", { name: "Меню", exact: true });
  if (await menu.isVisible().catch(() => false)) {
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
  }
  await page.getByRole("link", { name: "Задачи", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Задачи для вашего следующего результата" })).toBeVisible();
  await expect(page.locator(".catalog-v2-card")).toHaveCount(2);
  await page.evaluate(() => document.fonts.ready);
}

for (const viewport of viewports) {
  test.describe(`task catalog ${String(viewport.width)}x${String(viewport.height)}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: "reduce" });
    for (const theme of ["light", "dark"] as const) {
      test(theme, async ({ page }) => {
        await openCatalog(page, theme);
        await expect(page).toHaveScreenshot(
          `task-catalog-v2-${String(viewport.width)}x${String(viewport.height)}-${theme}.png`,
          { animations: "disabled", fullPage: true, maxDiffPixelRatio: 0.01 },
        );
      });
    }
  });
}
