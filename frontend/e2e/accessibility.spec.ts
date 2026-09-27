import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Мой путь", "Bootcamp", "Задачи", "События", "Рейтинг", "Аналитика"],
  csrf_token: "csrf",
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { honor_board_enabled: false } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "participant-alex", display_name: "Алекс Речной", roles: ["participant"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: actor }));
  await page.route("**/api/v1/development/tracks", (route) => route.fulfill({ json: { active_count: 1, max_active: 2, tracks: [{ key: "python", title: "Python-разработчик", status: "active", completed_milestones: [] }] } }));
  await page.route("**/api/v1/me/roadmaps", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/development/courses", (route) => route.fulfill({ json: [{ key: "openspec", title: "OpenSpec и SDD", track_keys: ["python"], recommendation_reason: "Для направления python", source_url: "https://example.test/course", availability: "available", access_note: "Доступен в демо", completion_status: null, rating_eligible: false }] }));
  await page.route("**/api/v1/me/learning/streak", (route) => route.fulfill({ json: { current_days: 2, qualified_dates: ["2026-09-26", "2026-09-27"], reason: "Серия сохранена." } }));
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`navigation and accessibility at ${String(viewport.width)}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator('[data-persona="participant-alex"]').click();
    if (viewport.width < 1024) {
      await page.getByRole("button", { name: "Меню", exact: true }).click();
      await expect(page.getByRole("button", { name: "Меню", exact: true })).toHaveAttribute("aria-expanded", "true");
    }
    await page.getByRole("link", { name: "Bootcamp" }).click();
    await expect(page).toHaveURL(/\/workspace\/1$/);
    await expect(page.getByRole("heading", { name: "Учитесь ради следующего результата" })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((item) => ["critical", "serious"].includes(item.impact ?? ""))).toEqual([]);
  });
}

test("page guard rejects a section outside role navigation", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.evaluate("window.history.pushState({}, '', '/workspace/99'); window.dispatchEvent(new PopStateEvent('popstate')); ");
  await expect(page.getByRole("heading", { name: "Раздел недоступен" })).toBeVisible();
  await expect(page.locator(".next-action")).toHaveCount(0);
});
