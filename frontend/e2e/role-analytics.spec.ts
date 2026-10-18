import { expect, test } from "@playwright/test";

test("role analytics explains formulas and shows stale data instead of zero", async ({ page }) => {
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "operator-pavel", display_name: "Павел Оператор", roles: ["operator"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: {} }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: { person_id: "1", display_name: "Павел Оператор", active_role: "operator", assigned_roles: ["operator"], scopes: [], consent_scopes: [], navigation: ["Операционная очередь", "Проверки", "Споры", "Аналитика"], csrf_token: "csrf" } }));
  await page.route("**/api/v1/ops/cases", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/analytics/role", (route) => route.fulfill({ json: { role: "operator", metrics: [{ key: "mentor_overdue_share", label: "Доля просроченных", numerator: 2, denominator: 8, value: null, unit: "percent", period_start: "2026-08-29T10:00:00Z", period_end: "2026-09-28T10:00:00Z", cohort: "impulse-demo:mentor:30d", freshness: "stale", definition: "Просроченные ревью / все ожидающие ревью ментора.", suppressed: false, suppression_reason: null }] } }));
  await page.goto("/");
  await page.locator('[data-persona="operator-pavel"]').click();
  await page.getByRole("link", { name: "Аналитика" }).click();
  await expect(page.getByText("Данные задерживаются")).toBeVisible();
  await expect(page.getByText("Нет данных")).toBeVisible();
  await expect(page.getByText("0%", { exact: true })).toHaveCount(0);
  await page.getByText("Как рассчитано").click();
  await expect(page.getByText("Просроченные ревью / все ожидающие ревью ментора.")).toBeVisible();
  await expect(page.getByText("impulse-demo:mentor:30d")).toBeVisible();
});
