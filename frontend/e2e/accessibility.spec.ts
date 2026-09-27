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
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "participant-alex", display_name: "Алекс Речной", roles: ["participant"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: actor }));
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`navigation and accessibility at ${String(viewport.width)}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator('[data-persona="participant-alex"]').click();
    await page.getByRole("link", { name: "Bootcamp" }).click();
    await expect(page).toHaveURL(/\/workspace\/1$/);
    await expect(page.getByRole("heading", { name: "Bootcamp" })).toBeVisible();
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
