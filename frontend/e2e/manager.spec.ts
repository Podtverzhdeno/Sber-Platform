import { expect, test } from "@playwright/test";

test("manager sees accepted artifacts and safe reuse aggregates only", async ({ page }) => {
  const actor = { person_id: "00000000-0000-0000-0000-000000000006", display_name: "Ольга Руководитель", active_role: "manager", assigned_roles: ["manager", "customer"], scopes: [], consent_scopes: [], navigation: ["Инициативы", "Результаты", "Аналитика"], csrf_token: "csrf" };
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { honor_board_enabled: false } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "manager-olga", display_name: actor.display_name, roles: actor.assigned_roles }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: actor }));
  await page.route("**/api/v1/manager/overview", (route) => route.fulfill({ json: { task_count: 1, accepted_result_count: 1, reused_result_count: 1, initiatives: [{ project_key: "ai-lab", task_id: "10000000-0000-0000-0000-000000000001", task_title: "Поиск по базе знаний", status: "accepted", deadline_at: "2026-12-20T18:00:00Z", accepted_results: [{ contribution_id: "20000000-0000-0000-0000-000000000001", task_id: "10000000-0000-0000-0000-000000000001", task_title: "Поиск по базе знаний", personal_summary: "Подготовлен воспроизводимый API и отчёт.", artifact_keys: ["reuse:search-api"], reused: true }] }] } }));

  await page.goto("/");
  await page.locator('[data-persona="manager-olga"]').click();
  await expect(page.getByText("Подготовлен воспроизводимый API и отчёт.")).toBeVisible();
  await expect(page.getByText("Использован повторно")).toBeVisible();
  const content = (await page.locator(".manager-workspace").innerText()).toLowerCase();
  expect(content).not.toContain("личный чат");
  expect(content).not.toContain("выплата участника");
  expect(content).not.toContain("закрытый комментарий");
});
