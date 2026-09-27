import { expect, test } from "@playwright/test";

const customer = {
  person_id: "00000000-0000-0000-0000-000000000005",
  display_name: "Роман Заказчик",
  active_role: "customer",
  assigned_roles: ["customer"],
  scopes: ["own-tasks:write", "applications:read", "acceptance:write"],
  consent_scopes: [],
  navigation: ["Мои задачи", "Кандидаты", "Приёмка", "Аналитика"],
  csrf_token: "visual-csrf",
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/config", async (route) => route.fulfill({ json: { honor_board_enabled: false } }));
  await page.route("**/api/v1/auth/personas", async (route) => route.fulfill({ json: [{ key: "customer-roman", display_name: customer.display_name, roles: ["customer"] }] }));
  await page.route("**/api/v1/me", async (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", async (route) => route.fulfill({ json: customer }));
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`customer dashboard visual contract · ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await page.locator('[data-persona="customer-roman"]').click();
    await expect(page.getByRole("heading", { name: "Добро пожаловать, Роман!" })).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(page.locator(".sidebar")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(page.locator(".metric-card").first()).toHaveCSS("border-radius", "13px");
    await expect(page).toHaveScreenshot(`customer-dashboard-${viewport.name}.png`, {
      animations: "disabled",
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
}
