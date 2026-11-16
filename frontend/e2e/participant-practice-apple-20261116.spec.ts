import { expect, test, type Page } from "@playwright/test";

import { catalogItem, catalogPage } from "../src/features/task-catalog-v2/fixture";

type Mode = "light" | "blue" | "midnight";
const navigation = [
  "Главная", "Моя траектория", "Bootcamp", "Задачи", "Мои проекты",
  "Портфолио", "События", "Аналитика", "Настройки",
];
const authorizedLinks = [
  { label: "Задачи", href: "/workspace/3" },
  { label: "В работе", href: "/workspace/4?filter=active" },
  { label: "Мои проекты", href: "/workspace/4" },
] as const;

async function signIn(page: Page, mode: Mode, allowed: readonly string[] = navigation) {
  await page.addInitScript((visualMode: Mode) => {
    localStorage.setItem("impulse-visual-mode", visualMode);
    localStorage.setItem("impulse-theme", visualMode === "light" ? "light" : "dark");
  }, mode);
  const actor = {
    person_id: "00000000-0000-4000-8000-000000000002",
    display_name: "Синтетический участник",
    active_role: "participant", assigned_roles: ["participant"],
    scopes: [], consent_scopes: [], navigation: allowed, csrf_token: "practice-apple-qa",
  };
  let authenticated = false;
  await page.route("**/api/v1/**", route => route.fulfill({
    status: 404, json: { code: "NOT_MOCKED" },
  }));
  await page.route("**/api/v1/config", route => route.fulfill({
    json: { demo_mode: true, task_catalog_v2_enabled: true },
  }));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({
    json: [{ key: "practice-participant", display_name: actor.display_name, roles: ["participant"] }],
  }));
  await page.route(/\/api\/v1\/me(?:\?.*)?$/, route => authenticated
    ? route.fulfill({ json: actor })
    : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => {
    authenticated = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/me/task-recommendations?*", route =>
    route.fulfill({ json: catalogPage([catalogItem]) }));
  await page.route("**/api/v1/me/work", route => route.fulfill({ json: [] }));
  await page.goto("/");
  await page.locator('[data-persona="practice-participant"]').click();
}

async function checkPracticeNav(page: Page, width: number) {
  const nav = page.getByRole("navigation", { name: "Подразделы практики" });
  await expect(nav.getByRole("link")).toHaveCount(3);
  await expect(nav).toBeInViewport();
  const dimensions = await nav.evaluate(node => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
  }));
  expect(dimensions.scrollWidth, "All destinations visible without a carousel")
    .toBeLessThanOrEqual(dimensions.clientWidth + 2);

  for (const entry of authorizedLinks) {
    const link = nav.getByRole("link", { name: entry.label });
    await expect(link).toHaveAttribute("href", entry.href);
    await expect(link).toBeInViewport();
    const rect = await link.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect?.height, "Minimum 44px target").toBeGreaterThanOrEqual(44);
    expect(rect?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((rect?.x ?? 0) + (rect?.width ?? 0)).toBeLessThanOrEqual(width + 1);
  }

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "Entire page must not overflow horizontally").toBeLessThanOrEqual(2);
}

for (const mode of ["light", "blue", "midnight"] as const) {
  for (const width of [320, 390, 560, 820, 1440]) {
    test(`Practice navigation and catalog are usable at ${String(width)}px in ${mode}`, async ({ page }) => {
      test.slow(); // Two data-backed destinations and browser history.
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, mode);
      await page.goto("/workspace/3");
      await expect(page.locator("html")).toHaveAttribute("data-impulse-visual-mode", mode);
      await checkPracticeNav(page, width);

      const nav = page.getByRole("navigation", { name: "Подразделы практики" });
      await expect(nav.getByRole("link", { name: "Задачи" })).toHaveAttribute("aria-current", "page");
      const grid = page.locator(".catalog-v2-kpis");
      await expect(grid).toBeVisible();
      await expect(grid.locator(".catalog-v2-kpi")).toHaveCount(4);
      const kpi = grid.locator(".catalog-v2-kpi").first();
      if (mode === "light") await expect(kpi).toHaveCSS("background-color", "rgb(255, 255, 255)");
      if (width <= 560) {
        const first = await grid.locator(".catalog-v2-kpi").nth(0).boundingBox();
        const next = await grid.locator(".catalog-v2-kpi").nth(1).boundingBox();
        const third = await grid.locator(".catalog-v2-kpi").nth(2).boundingBox();
        expect(Math.abs((first?.y ?? 0) - (next?.y ?? 0))).toBeLessThanOrEqual(2);
        expect(third?.y ?? 0).toBeGreaterThan((first?.y ?? 0) + 50);
      }

      const filter = page.locator(".catalog-v2-filter-expander");
      await expect(filter).toHaveAccessibleName("Все фильтры");
      await expect(filter).toHaveAttribute("aria-expanded", "false");
      const filterBounds = await filter.boundingBox();
      expect(filterBounds?.height).toBeGreaterThanOrEqual(44);
      await filter.click();
      await expect(filter).toHaveAccessibleName("Скрыть фильтры");
      await expect(filter).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByLabel("Навык", { exact: true })).toBeVisible();
      await filter.click();
      await expect(filter).toHaveAccessibleName("Все фильтры");
      await expect(filter).toHaveAttribute("aria-expanded", "false");

      if ((width === 320 || width === 1440) && (mode === "light" || mode === "midnight")) {
        await page.screenshot({ path: `test-results/practice-apple-${mode}-${String(width)}.png` });
      }

      await nav.getByRole("link", { name: "В работе" }).click();
      await expect(page).toHaveURL(/\/workspace\/4\?filter=active/);
      await expect(page.getByRole("navigation", { name: "Подразделы практики" })
        .getByRole("link", { name: "В работе" })).toHaveAttribute("aria-current", "page");
      await checkPracticeNav(page, width);
      await page.getByRole("navigation", { name: "Подразделы практики" })
        .getByRole("link", { name: "Мои проекты" }).click();
      await expect(page).toHaveURL(/\/workspace\/4$/);
      await page.goBack({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/workspace\/4\?filter=active/);
    });
  }
}

test("practice keeps server-authorized dynamic indexes and never exposes denied projects", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await signIn(page, "light", ["Главная", "Задачи"]);
  await page.goto("/workspace/1");
  const nav = page.getByRole("navigation", { name: "Подразделы практики" });
  await expect(nav.getByRole("link")).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Задачи" })).toHaveAttribute("href", "/workspace/1");
  await expect(nav.getByRole("link", { name: "Мои проекты" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "В работе" })).toHaveCount(0);
});

test("reduced motion preserves keyboard access to practice actions", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, "light");
  await page.goto("/workspace/3");
  const link = page.getByRole("navigation", { name: "Подразделы практики" })
    .getByRole("link", { name: "Задачи" });
  await link.focus();
  await expect(link).toBeFocused();
  const duration = await link.evaluate(element => Number.parseFloat(getComputedStyle(element).transitionDuration));
  expect(duration).toBeLessThanOrEqual(0.001);
});
