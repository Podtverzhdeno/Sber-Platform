import { expect, test } from "@playwright/test";

test("operator resolves current case version and sees timeline", async ({ page }) => {
  const item = { id: "90000000-0000-0000-0000-000000000001", case_type: "failed_payout", title: "Разобрать выплату", priority: "critical", status: "open", version: 1, source_refs: ["payout:failed"], dependency_refs: ["review:published"], due_at: null };
  const decisions: unknown[] = [];
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "operator-pavel", display_name: "Павел Оператор", roles: ["operator"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: {} }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: { person_id: "1", display_name: "Павел Оператор", active_role: "operator", assigned_roles: ["operator"], scopes: [], consent_scopes: [], navigation: ["Операционная очередь", "Проверки", "Споры", "Аналитика"], csrf_token: "csrf" } }));
  await page.route("**/api/v1/ops/cases", (route) => route.fulfill({ json: [item] }));
  await page.route(`**/api/v1/ops/cases/${item.id}/timeline`, (route) => route.fulfill({ json: decisions }));
  await page.route(`**/api/v1/ops/cases/${item.id}/decide`, async (route) => { item.status = "resolved"; item.version = 2; decisions.push({ id: "d1", case_version: 1, outcome: "resolved", reason: "Факты и зависимости проверены оператором.", created_at: new Date().toISOString() }); await route.fulfill({ json: item }); });
  await page.goto("/");
  await page.locator('[data-persona="operator-pavel"]').click();
  await expect(page.getByText("payout:failed")).toBeVisible();
  await page.getByRole("button", { name: "Принять решение" }).click();
  await expect(page.getByText("Решение по версии 1", { exact: false })).toBeVisible();
});
