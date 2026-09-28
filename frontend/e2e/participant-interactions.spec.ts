import { expect, test } from "@playwright/test";

const navigation = ["Главная", "Мой путь", "Bootcamp", "Задачи", "События", "Рейтинг", "Портфолио", "Аналитика", "Сообщения"];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [
    { key: "participant-alex", display_name: "Алекс Речной", roles: ["participant"] },
    { key: "mentor-elena", display_name: "Елена Наставник", roles: ["mentor"] },
  ] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: {} }));
  await page.route("**/api/v1/auth/demo-login", async (route) => {
    const { persona_key } = route.request().postDataJSON() as { persona_key: string };
    const mentor = persona_key === "mentor-elena";
    await route.fulfill({ json: {
      person_id: mentor ? "2" : "1", display_name: mentor ? "Елена Наставник" : "Алекс Речной",
      active_role: mentor ? "mentor" : "participant", assigned_roles: [mentor ? "mentor" : "participant"],
      scopes: [], consent_scopes: [], navigation: mentor ? ["Главная", "Очередь ревью", "Назначения", "Аналитика"] : navigation, csrf_token: "csrf",
    } });
  });
  await page.route("**/api/v1/auth/logout", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/v1/marketplace/tasks", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/work", (route) => route.fulfill({ json: [{
    assignment: { id: "assignment-1", task_id: "task-1", person_id: "1", status: "in_progress" },
    task: { id: "task-1", title: "Прототип рекомендательной системы", status: "published", places: 4 },
    terms: { version: 1, deadline_at: "2026-10-12T18:00:00Z", deliverable: "MVP", acceptance_criteria: ["Воспроизводимость"], support_mode: "mentor", compensation: { paid: true, base_amount_per_assignee: "50000", currency: "RUB", b_multiplier: "1.5", a_multiplier: "2.5", b_total: "75000", a_total: "125000", quantum: "0.01", rounding_mode: "half_up", policy_version: 1, payout_condition: "Принятый личный вклад" } },
    contributions: [{ id: "contribution-1", version: 2, personal_summary: "Реализован API и интеграционные тесты", artifact_keys: ["api"], status: "submitted" }],
    decisions: [],
  }] }));
});

test("logout returns persona picker and allows another role", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page.getByRole("heading", { name: "Добро пожаловать, Алекс!" })).toBeVisible();
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page.getByRole("heading", { name: "Кем вы хотите посмотреть платформу?" })).toBeVisible();
  await page.locator('[data-persona="mentor-elena"]').click();
  await expect(page.getByRole("heading", { name: "Добро пожаловать, Елена!" })).toBeVisible();
});

test("participant home actions open project, buddy and linked routes", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("button", { name: /Открыть рабочую область/ }).click();
  await expect(page.getByRole("dialog", { name: "Рабочая область проекта" })).toBeVisible();
  await page.getByRole("dialog", { name: "Рабочая область проекта" }).getByText("Закрыть", { exact: true }).click();
  await page.getByRole("button", { name: /Получить рекомендацию/ }).click();
  await expect(page.getByRole("dialog", { name: "Рекомендация AI Buddy" })).toBeVisible();
  await page.getByRole("button", { name: "Понятно" }).click();
  await expect(page.locator(".metric-histogram")).toHaveCount(4);
  await page.getByRole("button", { name: /Все действия/ }).click();
  await expect(page).toHaveURL(/\/workspace\/3$/);
});

test("rating opens selected public profile", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Рейтинг" }).click();
  await page.getByRole("button", { name: "Кирилл Меньшев" }).click();
  await expect(page.getByRole("heading", { name: "Кирилл Меньшев" })).toBeVisible();
  await expect(page.getByText("Оценка A")).toBeVisible();
  await expect(page.getByText("Победитель МАЯКИ")).toBeVisible();
  await page.getByRole("button", { name: /Вернуться в рейтинг/ }).click();
  await expect(page.getByRole("heading", { name: "Рейтинг подтверждённого опыта" })).toBeVisible();
});

test("search, streak, task detail and messages are interactive", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("button", { name: /Учебный стрик/ }).click();
  await expect(page.getByRole("dialog", { name: "Учебный стрик" })).toContainText("14 дней подряд");
  await page.getByRole("searchbox", { name: "Глобальный поиск" }).fill("Python");
  await page.getByRole("option", { name: /Python для R&D/ }).click();
  await expect(page).toHaveURL(/workspace\/2\?course=python-base/);
  await page.getByRole("link", { name: "Задачи" }).click();
  await page.getByRole("button", { name: /Открыть рабочую область/ }).click();
  await expect(page.getByRole("heading", { name: "Checkpoints проекта" })).toBeVisible();
  await expect(page.getByText("Роман Воронов")).toBeVisible();
  await page.getByRole("link", { name: "Сообщения" }).click();
  await expect(page.getByRole("heading", { name: "Сообщения" })).toBeVisible();
  await page.getByLabel("Сообщение").fill("Готово к повторной проверке");
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByText("Готово к повторной проверке")).toBeVisible();
});
