import { expect, test } from "@playwright/test";

test("participant analytics keeps incomplete journey separate from success and paid money", async ({ page }) => {
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "participant-alex", display_name: "Алекс Речной", roles: ["participant"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: {} }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: { person_id: "1", display_name: "Алекс Речной", active_role: "participant", assigned_roles: ["participant"], scopes: [], consent_scopes: [], navigation: ["Мой путь", "Bootcamp", "Задачи", "События", "Рейтинг", "Портфолио", "Аналитика"], csrf_token: "csrf" } }));
  await page.route("**/api/v1/development/tracks", (route) => route.fulfill({ json: { active_count: 1, max_active: 2, tracks: [] } }));
  await page.route("**/api/v1/me/roadmaps", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/analytics/journey", (route) => route.fulfill({ json: { stages: [{ key: "direction", title: "Направление выбрано", status: "completed", completed: true, count: 1 }, { key: "learning", title: "Обучение подтверждено", status: "not_started", completed: false, count: 0 }, { key: "practice", title: "Реальный проект", status: "not_started", completed: false, count: 0 }, { key: "verified_experience", title: "Опыт подтверждён", status: "not_started", completed: false, count: 0 }], successful: false, next_action: "Завершите следующий курс roadmap и дождитесь подтверждения.", earnings: { calculated: "15000", approved: "0", paid: "0", failed: "0", currency: "RUB", unknown_items: 0 }, freshness: "fresh", generated_at: "2026-09-28T10:00:00Z" } }));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Аналитика" }).click();
  await expect(page.getByRole("heading", { name: "Ваш прогресс и подтверждённый результат" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "От обучения до выплаты" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Активность по неделям" })).toBeVisible();
  await expect(page.getByText("Путь продолжается")).toBeVisible();
  await expect(page.getByText("15 000 RUB")).toBeVisible();
  await expect(page.getByText("0 RUB", { exact: true })).toHaveCount(3);
  await expect(page.locator(".analytics-histogram i")).toHaveCount(8);
  const screenshot = await page.locator(".participant-analytics").screenshot();
  expect(screenshot.byteLength).toBeGreaterThan(1_000);
});
