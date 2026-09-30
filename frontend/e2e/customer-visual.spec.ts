import { expect, test } from "@playwright/test";

test("customer premium workspace renders every route without overflow", async ({ page }) => {
  const actor = { person_id: "00000000-0000-0000-0000-000000000005", display_name: "Алексей", active_role: "customer", assigned_roles: ["customer"], scopes: [], consent_scopes: [], navigation: ["Главная"], csrf_token: "csrf" };
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "customer-roman", display_name: actor.display_name, roles: ["customer"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: actor }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.locator('[data-persona="customer-roman"]').click();

  const sidebar = page.getByRole("navigation", { name: "Навигация роли" });
  await expect(sidebar.getByRole("link")).toHaveCount(9);
  for (const section of ["Главная", "Мои задачи", "Заявки", "Приёмка", "Аналитика", "AI-помощник", "Кандидаты", "Сообщения"]) {
    await sidebar.getByRole("link", { name: section, exact: true }).click();
    await expect(page.locator(".premium-page")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, `${section} has horizontal overflow`).toBe(false);
    await page.screenshot({ path: `test-results/customer-${section.replace(/[^a-zа-я0-9]+/giu, "-")}.png`, fullPage: true });
  }
});
