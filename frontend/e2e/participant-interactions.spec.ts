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
  await page.route("**/api/v1/me/profile", (route) => route.fulfill({ json: {
    person_id: "1", display_name: "Алекс Речной", city: "Москва", university: "МГУ", study_year: "4 курс",
    primary_track: "Python", email: "alex@example.test", telegram: "@alex_rechnoy", about: "", avatar_url: "",
    locale: "ru-RU", theme: "dark", timezone: "Europe/Moscow", buddy_enabled: true, skills: [],
  } }));
  await page.route("**/api/v1/me/visibility", (route) => route.fulfill({ json: { visibility: { hr_basic: true, hr_skills: true, hr_projects: true, hr_achievements: true, hr_learning: true, hr_contacts: false } } }));
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
  await page.route("**/api/v1/search*", (route) => route.fulfill({ json: { items: [{ kind: "course", meta: "available", ref: "course:python-base", title: "Python для R&D" }] } }));
  await page.route("**/api/v1/me/notifications", (route) => route.fulfill({ json: { items: [
    { id: "note-mentor", kind: "message", title: "Новый комментарий ментора", body: "Елена Наставник оставила замечание в рабочей области", read: false, created_at: "2026-10-18T09:15:00Z", entity_type: "message", entity_id: null },
    { id: "note-checkpoint", kind: "checkpoint", title: "Checkpoint принят", body: "Версия 2 зачтена ментором", read: false, created_at: "2026-10-18T08:00:00Z", entity_type: "checkpoint", entity_id: null },
  ], unread: 3 } }));
  await page.route("**/api/v1/me/notifications/*/read", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/v1/me/notifications/read-all", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/v1/me/tasks/task-1", (route) => route.fulfill({ json: {
    task: { id: "task-1", title: "Прототип рекомендательной системы", status: "in_progress" },
    problem: "Собрать рекомендации на открытом корпусе и оценить качество",
    deadline_at: "2026-10-12T18:00:00Z",
    customer: { id: "3", display_name: "Роман Воронов" },
    mentor: { id: "2", display_name: "Елена Наставник" },
    support: { mode: "mentor", assignee: { id: "2", display_name: "Елена Наставник" } },
    acceptance_criteria: ["Воспроизводимость"],
    terms_history: [],
    checkpoints: [],
    personal: [{ id: "contribution-1", version: 2, status: "submitted", artifact_keys: ["api"] }],
    feedback: [],
    membership: { id: "assignment-1", status: "in_progress" },
    invitation_status: null,
  } }));
  const messagingMessages: Record<string, Array<{ id: string; author_id: string | null; author_name: string | null; kind: string; body: string; artifact_refs: string[]; sequence: number; created_at: string }>> = {
    "channel-project": [{ id: "message-1", author_id: "2", author_name: "Елена Наставник", kind: "text", body: "Нужно согласовать формат допуска сегментов", artifact_refs: [], sequence: 1, created_at: "2026-10-08T09:30:00Z" }],
    "channel-mentor": [],
  };
  await page.route("**/api/v1/me/messaging/channels", (route) => route.fulfill({ json: [
    { id: "channel-project", kind: "project", title: "Рекомендательная система", status: "active", task_id: "task-1", role: "member", muted: false, sender_enabled: true, unread: 0, participants: [{ id: "1", display_name: "Алекс Речной", role: "member" }, { id: "2", display_name: "Елена Наставник", role: "mentor" }, { id: "3", display_name: "Роман Воронов", role: "customer" }], last_message: messagingMessages["channel-project"].at(-1) ?? null, created_at: "2026-10-01T09:00:00Z" },
    { id: "channel-mentor", kind: "mentor", title: "Елена Наставник", status: "active", task_id: null, role: "member", muted: false, sender_enabled: true, unread: 0, participants: [{ id: "1", display_name: "Алекс Речной", role: "member" }, { id: "2", display_name: "Елена Наставник", role: "mentor" }], last_message: null, created_at: "2026-10-01T09:05:00Z" },
  ] }));
  await page.route("**/api/v1/me/messaging/channels/*/messages", async (route) => {
    const channelId = route.request().url().split("/").at(-2) ?? "channel-project";
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { body: string };
      const created = { id: `message-${String(messagingMessages[channelId].length + 1)}`, author_id: "1", author_name: "Алекс Речной", kind: "text", body: body.body, artifact_refs: [], sequence: messagingMessages[channelId].length + 1, created_at: new Date().toISOString() };
      messagingMessages[channelId].push(created);
      await route.fulfill({ json: created });
      return;
    }
    await route.fulfill({ json: messagingMessages[channelId] ?? [] });
  });
  await page.route("**/api/v1/me/messaging/channels/*/context", (route) => route.fulfill({ json: { project_key: "impulse-demo", task_title: "Прототип рекомендательной системы", deadline_at: "2026-10-12T18:00:00Z", contribution_version: 2, contribution_accepted: null, review_status: null } }));
  let buddyDismissed = false;
  const buddySuggestion = {
    kind: "bootcamp_idle",
    version: 1,
    suggestion_id: "bootcamp_idle:2026-09-20T09:00:00+00:00:2026-10-19",
    generated_at: "2026-10-19T17:55:00+03:00",
    observation: "Практика Bootcamp давно не подтверждалась: 29 дн. без проверенного checkpoint.",
    gap: "Навыки траектории «Python-разработчик» растут, пока checkpoint не пройден: портфолио не получает нового подтверждённого результата.",
    action: { kind: "checkpoint", ref: "checkpoint:rag-mvp", title: "Начать checkpoint: RAG: надёжный поиск по документам" },
    benefit: "Проверочный checkpoint даёт подтверждённый результат и закрывает недостающий источник в Skill Passport.",
    source_categories: ["checkpoint", "course", "skill_evidence"],
    explanation: "Автоматический анализ разрешённых данных: дата последнего verified course-checkpoint из Bootcamp-сертификатов и целевой шаг активной траектории. Модель не вызывается; сегменты без лишних деталей.",
    idle_days: 29,
    model_called: false,
    auto_enrolled: false,
  };
  await page.route("**/api/v1/agents/buddy/suggestion", (route) => route.fulfill({
    json: buddyDismissed
      ? { policy_version: 1, ai_model_available: false, dismissed: true, suggestion: null }
      : { policy_version: 1, ai_model_available: false, dismissed: false, suggestion: buddySuggestion },
  }));
  await page.route("**/api/v1/agents/buddy/suggestion/dismiss", (route) => {
    buddyDismissed = true;
    return route.fulfill({ status: 204 });
  });
});

test("logout returns persona picker and allows another role", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page.getByRole("heading", { name: "Добро пожаловать, Алекс!" })).toBeVisible();
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page.getByRole("heading", { name: "Выберите роль, чтобы присоединиться" })).toBeVisible();
  await expect(page.locator('[data-persona="mentor-elena"]')).toBeDisabled();
  await expect(page.locator('[data-persona="participant-alex"]')).toBeEnabled();
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page.getByRole("heading", { name: "Добро пожаловать, Алекс!" })).toBeVisible();
});

test("participant home actions open project, buddy and linked routes", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("button", { name: /Открыть рабочую область/ }).click();
  await expect(page.getByRole("dialog", { name: "Рабочая область проекта" })).toBeVisible();
  await page.getByRole("dialog", { name: "Рабочая область проекта" }).getByText("Закрыть", { exact: true }).click();
  await page.getByTestId("buddy-suggestion-why").locator("summary").click();
  await expect(page.getByTestId("buddy-suggestion-explanation")).toBeVisible();
  await page.getByRole("button", { name: /Начать checkpoint/ }).click();
  await expect(page).toHaveURL(/\/workspace\/2\?course=python-base$/);
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByTestId("buddy-suggestion-dismiss").click();
  await expect(page.getByTestId("buddy-suggestion-dismissed")).toBeVisible();
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
  await expect(page).toHaveURL(/workspace\/2$/);
  await page.getByRole("link", { name: "Мои проекты", exact: true }).click();
  await page.getByRole("button", { name: "Открыть рабочую область →" }).click();
  await expect(page.getByRole("heading", { name: "Прототип рекомендательной системы" })).toBeVisible();
  await expect(page.getByText("Загрузить решение")).toBeVisible();
  await page.getByRole("button", { name: "Открыть чат команды" }).click();
  await expect(page).toHaveURL(/\/workspace\/10\?participant=project$/);
  await expect(page.getByRole("heading", { name: "Сообщения" })).toBeVisible();
  await expect(page.locator(".chat-list button.active strong")).toContainText("Рекомендательная система");
  await page.getByLabel("Сообщение").fill("Готово к повторной проверке");
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByRole("paragraph").filter({ hasText: "Готово к повторной проверке" })).toBeVisible();
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Рейтинг: 3 место, 450 баллов" }).click();
  await expect(page.getByRole("dialog", { name: "Баллы и место в рейтинге" })).toBeVisible();
  await expect(page.getByText("постоянных баллов")).toBeVisible();
  await expect(page.getByText("До 2 места")).toBeVisible();
  await page.getByRole("link", { name: "Открыть рейтинг →" }).click();
  await expect(page).toHaveURL(/\/workspace\/6$/);
  await expect(page.getByRole("heading", { name: "Рейтинг подтверждённого опыта" })).toBeVisible();
});
