import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  let reported = false;
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { honor_board_enabled: false } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "participant-alex", display_name: "Алекс Речной", roles: ["participant"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: { person_id: "00000000-0000-0000-0000-000000000001", display_name: "Алекс Речной", active_role: "participant", assigned_roles: ["participant"], scopes: [], consent_scopes: [], navigation: ["Мой путь", "Bootcamp", "Задачи", "События", "Рейтинг", "Аналитика"], csrf_token: "csrf" } }));
  await page.route("**/api/v1/development/tracks", (route) => route.fulfill({ json: { active_count: 1, max_active: 2, tracks: [] } }));
  await page.route("**/api/v1/me/roadmaps", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/ecosystem/events", (route) => route.fulfill({ json: { items: [{ key: "mayaki-2026", title: "МАЯКИ 2026", event_type: "educational_program", organizer: "Сбер", conditions: "Подать заявку до дедлайна.", source_url: "https://example.test/mayaki", deadline_at: "2026-10-10T20:59:00Z", starts_at: "2026-11-01T09:00:00Z", status: "open", track_keys: ["python"], recommendation_reason: "Практика для выбранного направления.", source_checked_at: "2026-09-27T09:00:00Z", source_status: "current" }], next_cursor: null, has_more: false } }));
  await page.route("**/api/v1/me/event-claims", (route) => route.fulfill({ json: reported ? [{ id: "00000000-0000-0000-0000-000000000099", event_key: "mayaki-2026", claim_type: "participation", status: "reported", trophy_created: false, evidence_state: "provisional", verification_explanation: "Участие заявлено вами; трофей и баллы не созданы." }] : [] }));
  await page.route("**/api/v1/me/events/*/claims", (route) => { reported = true; return route.fulfill({ json: { id: "00000000-0000-0000-0000-000000000099", event_key: "mayaki-2026", claim_type: "participation", status: "reported", trophy_created: false, evidence_state: "provisional", verification_explanation: "Участие заявлено вами; трофей и баллы не созданы." } }); });
});

test("open event grants frozen points while completed event accepts proof", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "События" }).click();
  const source = page.getByRole("link", { name: "Перейти к событию" });
  await source.focus();
  await expect(source).toBeFocused();
  await expect(source).toHaveAttribute("href", "https://example.test/mayaki");
  await expect(source).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.getByRole("button", { name: /Подтвердить результат/ })).toHaveCount(1);
  await page.getByRole("button", { name: "Зарегистрироваться · +5" }).click();
  await expect(page.getByText("+5 frozen")).toBeVisible();
  await expect(page.getByText(/5 баллов заморожены/)).toBeVisible();
  await page.getByRole("button", { name: /Подтвердить результат/ }).click();
  await expect(page.getByRole("dialog", { name: /Подтвердить результат/ })).toBeVisible();
  await page.getByRole("dialog", { name: /Подтвердить результат/ }).locator("select").selectOption("winner");
  await page.getByRole("button", { name: "Отправить на проверку" }).click();
});
