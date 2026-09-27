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
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { honor_board_enabled: true } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "participant-alex", display_name: "Алекс Речной", roles: ["participant"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: actor }));
  await page.route("**/api/v1/me/roadmaps", (route) => route.fulfill({ json: [{ track_key: "python", policy_version: 1, replacement_reason: null, milestones: [{ key: "foundation", position: 1, title: "Основа", purpose: "Подготовиться к проекту", skill: "Python", target_kind: "course", target_key: "python-base", completed: false }], next_step: { key: "foundation", position: 1, title: "Основа", purpose: "Подготовиться к проекту", skill: "Python", target_kind: "course", target_key: "python-base", completed: false } }] }));
});

test("participant activates second track and freezes one only when choosing third", async ({ page }) => {
  const statuses: Record<string, "active" | "frozen" | null> = { python: "active", data: null, product: null };
  const overview = () => ({ active_count: Object.values(statuses).filter((value) => value === "active").length, max_active: 2, tracks: [{ key: "python", title: "Python-разработчик", status: statuses.python, completed_milestones: [] }, { key: "data", title: "Аналитик данных", status: statuses.data, completed_milestones: [] }, { key: "product", title: "Продуктовый аналитик", status: statuses.product, completed_milestones: [] }] });
  await page.route("**/api/v1/development/tracks", (route) => route.fulfill({ json: overview() }));
  await page.route("**/api/v1/me/tracks", async (route) => {
    const command = route.request().postDataJSON() as { track_key: string; freeze_track_key?: string };
    if (command.freeze_track_key) statuses[command.freeze_track_key] = "frozen";
    statuses[command.track_key] = "active";
    await route.fulfill({ json: overview() });
  });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("button", { name: /Аналитик данных/ }).click();
  await expect(page.locator(".track-card").filter({ hasText: "Аналитик данных" })).toContainText("Активно");
  await page.getByRole("button", { name: /Продуктовый аналитик/ }).click();
  await expect(page.getByRole("dialog", { name: /Освободить место/ })).toBeVisible();
  await page.getByRole("button", { name: "Заморозить «Python-разработчик»" }).click();
  await expect(page.locator(".track-card").filter({ hasText: "Python-разработчик" })).toContainText("Заморожено");
  await expect(page.locator(".track-card").filter({ hasText: "Продуктовый аналитик" })).toContainText("Активно");
});

test("Bootcamp explains unavailable source, reported verification and streak", async ({ page }) => {
  let reported = false;
  let streak = 1;
  await page.route("**/api/v1/development/tracks", (route) => route.fulfill({ json: { active_count: 1, max_active: 2, tracks: [{ key: "python", title: "Python-разработчик", status: "active", completed_milestones: [] }] } }));
  await page.route("**/api/v1/development/courses", (route) => route.fulfill({ json: [{ key: "python-base", title: "Python: основа", track_keys: ["python"], recommendation_reason: "Подходит для направления python.", source_url: "https://example.test/python", availability: "unavailable", access_note: "Внешний курс пока не подключён; доступна исходная ссылка.", completion_status: reported ? "reported" : null, rating_eligible: false }] }));
  await page.route("**/api/v1/me/learning/streak", (route) => route.fulfill({ json: { current_days: streak, qualified_dates: ["2026-09-27"], reason: "Серия сохранена." } }));
  await page.route("**/api/v1/me/courses/*/completion", (route) => { reported = true; return route.fulfill({ json: { course_key: "python-base", status: "reported", rating_eligible: false, explanation: "Ожидает проверки" } }); });
  await page.route("**/api/v1/me/courses/*/learning-days", (route) => { streak = 2; return route.fulfill({ json: { current_days: 2, qualified_dates: ["2026-09-27", "2026-09-28"], reason: "Серия сохранена." } }); });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Bootcamp" }).click();
  await expect(page.getByText("Внешний курс пока не подключён; доступна исходная ссылка.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Открыть источник курса/ })).toHaveAttribute("rel", "noopener noreferrer");
  await page.getByRole("button", { name: "Отметить завершение" }).click();
  await expect(page.getByText("Баллы не начисляются до проверки источника.")).toBeVisible();
  await page.getByRole("button", { name: "Учебный шаг выполнен" }).click();
  await expect(page.getByRole("heading", { name: "Серия: 2 дн." })).toBeVisible();
  await expect(page.getByText(/зал славы/i)).toHaveCount(0);
});
