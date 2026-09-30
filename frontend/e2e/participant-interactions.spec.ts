import { expect, test } from "@playwright/test";

const navigation = ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Мои проекты", "События", "Рейтинг", "Портфолио", "Достижения", "Аналитика", "Сообщения", "AI-Buddy", "Настройки"];

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
  await page.route("**/api/v1/marketplace/tasks", (route) => route.fulfill({ json: [{
    task: { id: "task-market", title: "Исследование качества рекомендаций", status: "published", places: 3 },
    terms: { version: 1, deadline_at: "2026-10-20T18:00:00Z", deliverable: "Подготовить benchmark и MVP ранжирования", acceptance_criteria: ["Воспроизводимый отчёт", "Работающий API"], support_mode: "mentor", compensation: { paid: true, base_amount_per_assignee: "60000", currency: "RUB", b_multiplier: "1.5", a_multiplier: "2.5", b_total: "90000", a_total: "150000", quantum: "0.01", rounding_mode: "half_up", policy_version: 1, payout_condition: "Принятый личный вклад" } },
    accepted_terms_version: 1,
  }] }));
  await page.route("**/api/v1/me/tasks/task-market/applications", (route) => route.fulfill({ status: 201, json: { id: "application-1", status: "submitted" } }));
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
  await expect(page.getByRole("button", { name: "Продолжить курс →" })).toHaveClass(/streak-course-button/);
  await page.getByRole("searchbox", { name: "Глобальный поиск" }).fill("Python");
  await page.getByRole("option", { name: /Python для R&D/ }).click();
  await expect(page).toHaveURL(/workspace\/2\?course=python-base/);
  await page.getByRole("link", { name: "Мои проекты" }).click();
  await page.getByRole("button", { name: /Открыть рабочую область/ }).click();
  await expect(page.getByRole("heading", { name: "Загрузить решение" })).toBeVisible();
  await page.locator('.ctw-upload-button input[type="file"]').setInputFiles([
    { name: "solution-final.zip", mimeType: "application/zip", buffer: Buffer.from("solution") },
    { name: "metrics.pdf", mimeType: "application/pdf", buffer: Buffer.from("metrics") },
  ]);
  await expect(page.getByText("solution-final.zip")).toBeVisible();
  await expect(page.getByText("metrics.pdf")).toBeVisible();
  await expect(page.getByText("Никита Соколов")).toBeVisible();
  await page.getByRole("button", { name: "Открыть чат команды" }).click();
  await expect(page).toHaveURL(/\/workspace\/10\?participant=project$/);
  await expect(page.getByRole("heading", { name: "Сообщения" })).toBeVisible();
  await expect(page.locator(".chat-list button.active strong")).toContainText("Рекомендательная система");
  await page.getByLabel("Сообщение").fill("Готово к повторной проверке");
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByText("Готово к повторной проверке")).toBeVisible();
});

test("application confirms success and appears in my tasks", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Задачи", exact: true }).click();
  await page.getByRole("button", { name: /Список/ }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Исследование качества рекомендаций" })).toBeVisible();
  await page.getByRole("button", { name: /Карточки/ }).click();
  await page.getByRole("button", { name: "Откликнуться" }).click();
  await expect(page.getByText("Вы успешно откликнулись")).toBeVisible();
  await expect(page.getByRole("button", { name: /Заявка отправлена/ })).toBeVisible();
  await page.getByRole("button", { name: "Открыть мои задачи" }).click();
  await expect(page.getByRole("heading", { name: "Мои задачи" })).toBeVisible();
  await expect(page.getByText("Ожидает решения")).toBeVisible();
  await page.locator(".my-task-row--active").getByRole("button", { name: "Открыть карточку" }).click();
  await expect(page.getByRole("dialog", { name: "Прототип рекомендательной системы" })).toContainText("Роман Воронов");
  await expect(page.getByRole("dialog", { name: "Прототип рекомендательной системы" })).toContainText("Елена Наставник");
  await page.getByRole("button", { name: /Перейти в рабочую область/ }).click();
  await expect(page).toHaveURL(/\/workspace\/4$/);
  await expect(page.getByRole("heading", { name: "Загрузить решение" })).toBeVisible();
});

test("participant settings and AI Buddy controls are interactive", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Настройки" }).click();
  await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible();
  await page.getByRole("button", { name: /Видимость для HR/ }).click();
  await expect(page.getByText("Предпросмотр глазами HR")).toBeVisible();
  await page.getByRole("link", { name: "AI-Buddy" }).click();
  await page.getByRole("button", { name: "Что делать дальше?" }).click();
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByText(/Сейчас лучше завершить checkpoint/)).toBeVisible();
});

test("header notifications and rating indicators open real destinations", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page.getByRole("button", { name: "Рейтинг: 3 место, 450 баллов" })).toBeVisible();
  await page.getByRole("button", { name: /Уведомления: 3 непрочитанных/ }).click();
  await expect(page.getByRole("dialog", { name: "Центр уведомлений" })).toBeVisible();
  await expect(page.getByText("Новый комментарий ментора")).toBeVisible();
  await page.getByRole("button", { name: /Checkpoint принят/ }).click();
  await expect(page).toHaveURL(/\/workspace\/4$/);
  await page.getByRole("button", { name: "Рейтинг: 3 место, 450 баллов" }).click();
  await expect(page).toHaveURL(/\/workspace\/6$/);
  await expect(page.getByRole("heading", { name: "Рейтинг подтверждённого опыта" })).toBeVisible();
});
