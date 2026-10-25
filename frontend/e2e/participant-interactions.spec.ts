import { expect, test } from "@playwright/test";

const navigation = ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Мои проекты", "События", "Рейтинг", "Портфолио", "Достижения", "Аналитика", "Сообщения", "AI-Buddy", "Настройки"];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [
    { key: "participant-alex", display_name: "Алекс Речной", roles: ["participant"] },
    { key: "mentor-elena", display_name: "Елена Наставник", roles: ["mentor"] },
  ] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: {} }));
  // Published, deterministic API fixtures. No ranking values are embedded in the UI.
  await page.route("**/api/v1/rating-seasons", (route) => route.fulfill({ json: [
    { id: "season-e2e", key: "autumn-2026", title: "Сезон 2026", status: "open", version: 2, policy_version: 1 },
  ] }));
  await page.route("**/api/v1/rating-seasons/season-e2e/leaderboard", (route) => route.fulfill({ json: [
    { place: 1, person_id: "2", display_name: "Кирилл Меньшев", score: "550", successful_projects: 8,
      trophies: [{ trophy_type: "winner", title: "Победитель МАЯКИ", source_url: "https://example.test/proof" }], offers: [], anonymized: false },
    { place: 2, person_id: "3", display_name: "Мария Северова", score: "500", successful_projects: 7,
      trophies: [], offers: [], anonymized: false },
    { place: 3, person_id: "1", display_name: "Алекс Речной", score: "450", successful_projects: 6,
      trophies: [], offers: [], anonymized: false },
  ] }));

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
  await page.route("**/api/v1/me/work", (route) => route.fulfill({ json: [
    {
      assignment: { id: "assignment-1", task_id: "task-1", person_id: "1", status: "in_progress" },
      task: { id: "task-1", title: "Прототип рекомендательной системы", status: "published", places: 4 },
      terms: { version: 1, deadline_at: "2026-10-12T18:00:00Z", deliverable: "MVP", acceptance_criteria: ["Воспроизводимость"], support_mode: "mentor", compensation: { paid: true, base_amount_per_assignee: "50000", currency: "RUB", b_multiplier: "1.5", a_multiplier: "2.5", b_total: "75000", a_total: "125000", quantum: "0.01", rounding_mode: "half_up", policy_version: 1, payout_condition: "Принятый личный вклад" } },
      contributions: [{ id: "contribution-1", version: 2, personal_summary: "Реализован API и интеграционные тесты", artifact_keys: ["api"], status: "submitted" }],
      decisions: [],
    },
    {
      assignment: { id: "assignment-2", task_id: "task-2", person_id: "1", status: "accepted" },
      task: { id: "task-2", title: "Прогнозирование нагрузки контактного центра", status: "published", places: 2 },
      terms: { version: 1, deadline_at: "2026-09-30T18:00:00Z", deliverable: "Baseline и признаковая схема", acceptance_criteria: ["Воспроизводимые метрики"], support_mode: "mentor", compensation: { paid: true, base_amount_per_assignee: "50000", currency: "RUB", b_multiplier: "1.5", a_multiplier: "2.5", b_total: "75000", a_total: "125000", quantum: "0.01", rounding_mode: "half_up", policy_version: 1, payout_condition: "Принятый личный вклад" } },
      contributions: [{ id: "contribution-2", version: 1, personal_summary: "Подготовил признаки и baseline-модель", artifact_keys: ["notebook"], status: "accepted" }],
      decisions: [{ id: "decision-2", contribution_id: "contribution-2", decision: "accepted", reason: "Целевые метрики достигнуты", deadline_at: null, owner_id: "2" }],
    },
  ] }));
  await page.route("**/api/v1/search*", (route) => route.fulfill({ json: { items: [{ kind: "course", meta: "available", ref: "course:python-base", title: "Python для R&D" }] } }));
  await page.route("**/api/v1/me/notifications", (route) => route.fulfill({ json: { items: [
    { id: "note-mentor", kind: "message", title: "Новый комментарий ментора", body: "Елена Наставник оставила замечание в рабочей области", read: false, created_at: "2026-10-18T09:15:00Z", entity_type: "message", entity_id: null },
    { id: "note-checkpoint", kind: "checkpoint", title: "Checkpoint принят", body: "Версия 2 зачтена ментором", read: false, created_at: "2026-10-18T08:00:00Z", entity_type: "checkpoint", entity_id: null },
  ], unread: 3 } }));
  await page.route("**/api/v1/me/notifications/*/read", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/v1/me/notifications/read-all", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/v1/me/growth/next-step", (route) => route.fulfill({ json: {
    policy_version: 1,
    steps: [{
      trajectory_key: "python-dev",
      milestone_key: "m2",
      target_kind: "course",
      target_key: "rag-mvp",
      target_title: "RAG: надёжный поиск по документам",
      position: 2,
      score: 4.2,
      factors: ["trajectory_gap", "prerequisites_met", "availability_open"],
      reasons: ["Первый недостающий обязательный шаг активной траектории"],
      available: true,
      stale_reason: null,
    }],
    next_available: {
      trajectory_key: "python-dev",
      milestone_key: "m2",
      target_kind: "course",
      target_key: "rag-mvp",
      target_title: "RAG: надёжный поиск по документам",
      position: 2,
      score: 4.2,
      factors: ["trajectory_gap", "prerequisites_met", "availability_open"],
      reasons: ["Первый недостающий обязательный шаг активной траектории"],
      available: true,
      stale_reason: null,
    },
    skill: {
      policy_version: 1,
      skill_key: "python",
      requested_skill: "Python",
      title: "Python",
      current_level: "базовый",
      target_level: "уверенный",
      current_known: true,
      counted_sources: ["course:python-base"],
      missing_evidence: ["checkpoint:rag-checkpoint"],
      explanation:
        "Уровень «базовый» подтверждён источниками course:python-base. До целевого уровня «уверенный» нужны источники: checkpoint:rag-checkpoint.",
      fallback: null,
    },
  } }));
  await page.route("**/api/v1/me/competency-evidence", (route) => route.fulfill({ json: [
    { competency_key: "backend", counted: false, level: "P1", observed_at: "2026-10-18T09:30:00+03:00", reason: "Не совпал с текущим портфелем навыков", source_kind: "checkpoint", source_ref: "beh-1" },
    { competency_key: "backend", counted: true, level: "P2", observed_at: "2026-10-18T12:00:00+03:00", reason: "Вклад принят заказчиком", source_kind: "contribution", source_ref: "contribution-1" },
  ] }));
  await page.route("**/api/v1/me/bootcamp/certificates", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/learning/streak", (route) => route.fulfill({ json: { current_days: 3, qualified_dates: ["2026-10-16", "2026-10-17", "2026-10-18"], reason: "Учебная активность подтверждена." } }));
  await page.route("**/api/v1/me/engagement/overview", (route) => route.fulfill({ json: { current_days: 14, best_days: 14, qualified_dates: ["2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19"], reason: "Учебная активность подтверждена.", today_saved: true, grace_available: false } }));
  await page.route("**/api/v1/me/tasks/task-1", (route) => route.fulfill({ json: {
    task: { id: "task-1", title: "Прототип рекомендательной системы", status: "in_progress" },
    problem: "Собрать рекомендации на открытом корпусе и оценить качество",
    deliverable: "Работающий прототип и API",
    data_constraints: "Открытый корпус, без персональных данных",
    ip_terms: "Результаты принадлежат платформе и заказчику по условиям задачи.",
    accepted_terms_version: 2,
    allowed_artifacts: ["api"],
    applications: [],
    terms: {
      version: 2,
      deadline_at: "2026-10-12T18:00:00Z",
      deliverable: "Работающий прототип и API",
      acceptance_criteria: ["Воспроизводимость"],
      support_mode: "mentor",
      compensation: { paid: false, base_amount_per_assignee: null, currency: null, b_multiplier: "1", b_total: null, a_multiplier: "1", a_total: null, quantum: "0.01", rounding_mode: "half_up", payout_condition: "", policy_version: 1 },
    },
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
  await page.route("**/api/v1/agents/buddy/suggestion/target*", (route) => route.fulfill({
    json: {
      target: {
        kind: "checkpoint",
        ref: "checkpoint:rag-mvp",
        title: "Начать checkpoint: RAG: надёжный поиск по документам",
        canonical_path: "/workspace/2?course=python-base",
      },
    },
  }));
  await page.route("**/api/v1/agents/buddy/suggestion/dismiss", (route) => {
    buddyDismissed = true;
    return route.fulfill({ status: 204 });
  });
  await page.route("**/api/v1/me/growth/snapshot", (route) => route.fulfill({
    json: {
      snapshot_id: "growth-snapshot-e2e-1",
      generated_at: "2026-10-19T17:55:00+03:00",
      snapshot_version: 2,
      actor_timezone: "Europe/Moscow",
      definitions: {
        activity: "impulse-growth-activity-v3",
        hours: "impulse-growth-hours-v1",
        milestones: "impulse-growth-milestones-v2",
        readiness: "impulse-growth-readiness-v1",
        snapshot: "impulse-growth-snapshot-v2",
      },
      period_boundaries: {
        day: { start: "2026-10-19T00:00:00+03:00", end: "2026-10-20T00:00:00+03:00" },
        week: { start: "2026-10-13T00:00:00+03:00", end: "2026-10-20T00:00:00+03:00" },
        month: { start: "2026-10-01T00:00:00+03:00", end: "2026-11-01T00:00:00+03:00" },
        year: { start: "2026-01-01T00:00:00+03:00", end: "2027-01-01T00:00:00+03:00" },
      },
      activity: {
        day: { total: 2, course_checkpoint: 1, project_submission: 1, revision_accepted: 0, event_participation: 0 },
        week: { total: 4, course_checkpoint: 2, project_submission: 1, revision_accepted: 1, event_participation: 0 },
        month: { total: 1, course_checkpoint: 0, project_submission: 1, revision_accepted: 0, event_participation: 0 },
        year: { total: 14, course_checkpoint: 7, project_submission: 4, revision_accepted: 2, event_participation: 1 },
      },
      activity_state: {
        day: { version: 1, state: "success", total: 2, target_min: 1, target_max: 3, missing_category: null, text: "Активность 2 в рамках цели 1–3 квалифицированных событий за период.", action: null },
        week: { version: 1, state: "success", total: 4, target_min: 3, target_max: 7, missing_category: null, text: "Активность 4 в рамках цели 3–7 квалифицированных событий за период.", action: null },
        month: { version: 1, state: "risk", total: 1, target_min: 12, target_max: 30, missing_category: "course_checkpoint", text: "Активность 1 ниже цели 12–30 за период: нет ни одного события категории «курсы/checkpoints». Один цвет не объясняет состояние — см. текст.", action: "Начните checkpoint курса в Bootcamp" },
        year: { version: 1, state: "success", total: 14, target_min: 120, target_max: 300, missing_category: null, text: "Активность 14 в рамках цели 120–300 квалифицированных событий за период.", action: null },
      },
      events: [
        { kind: "project_submission", title: "Вклад: API поиска", occurred_at: "2026-10-18T12:00:00+03:00", source_kind: "contribution", source_ref: "contribution-1" },
        { kind: "course_checkpoint", title: "Checkpoint RAG", occurred_at: "2026-10-16T09:30:00+03:00", source_kind: "checkpoint", source_ref: "rag-mvp" },
      ],
      hours: {
        known: true,
        trusted_minutes: 210,
        self_reported_minutes: 45,
        intervals: [
          { start: "2026-10-16T09:30:00+03:00", end: "2026-10-16T11:00:00+03:00", source_kind: "checkpoint", source_ref: "rag-mvp" },
        ],
      },
      freshness: { known: true, latest_observed_at: "2026-10-18T12:00:00+03:00" },
      trajectories: [
        {
          track_key: "python-dev",
          track_title: "Python-разработчик",
          policy_version: 2,
          milestones: [
            { key: "m1", position: 1, title: "Курс Python для анализа данных", purpose: "Основа", skill: "Python", target_kind: "course", target_key: "python-base", target_title: "Python для R&D", status: "completed", known: true },
          ],
          completion: { percent: 66.7, coverage: 1, partial: false },
          readiness_skills: [
            { skill_key: "Python", title: "Python", current_level: "базовый", target_level: "уверенный", known: true },
          ],
          readiness: { percent: 50, coverage: 1, partial: false },
          object_refs: [],
          next_step_ref: "course:python-base",
        },
      ],
    },
  }));
  await page.route("**/api/v1/development/tracks", (route) => route.fulfill({ json: { active_count: 1, max_active: 2, tracks: [{ key: "python-dev", title: "Python-разработчик", status: "active", completed_milestones: ["m1"] }] } }));
  await page.route("**/api/v1/me/roadmaps", (route) => route.fulfill({ json: [
    {
      track_key: "python-dev",
      policy_version: 2,
      replacement_reason: null,
      milestones: [
        { key: "m1", position: 1, title: "Курс Python для анализа данных", purpose: "Основа для первого вклада", skill: "Python", target_kind: "course", target_key: "python-base", completed: true },
      ],
      next_step: null,
    },
  ] }));
  await page.route("**/api/v1/me/trajectory-map", (route) => route.fulfill({ json: [] }));
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

test("next result card keeps the chosen step explainable and deep-links it", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page.getByTestId("next-result-badge")).toContainText("базовый → уверенный");
  await expect(page.getByTestId("next-result-object")).toContainText(
    "Объект: Курс · RAG: надёжный поиск по документам",
  );
  await expect(page.getByTestId("next-result-reasons")).toContainText(
    "Первый недостающий обязательный шаг",
  );
  await expect(page.getByTestId("next-result-forecast")).toContainText(
    "после проверки evidence",
  );
  await page.getByTestId("next-result-target").click();
  await expect(page).toHaveURL(/\/workspace\/2\?course=rag-mvp$/);
});

test("kpi spark bars expose number, unit and period on focus without hover", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page.getByTestId("kpi-card-progress")).toBeVisible();
  const progressBars = page.getByTestId("kpi-spark-0").locator("i");
  await expect(progressBars).toHaveCount(6);
  await expect(progressBars.nth(5)).toHaveAttribute("aria-label", "68% · точка 6 из 6");
  // Keyboard focus reaches each bar without any pointer; tooltip data stays in the DOM
  await progressBars.nth(5).focus();
  await expect(progressBars.nth(5)).toBeFocused();
  await progressBars.nth(3).focus();
  await expect(progressBars.nth(3)).toHaveAttribute("data-tip", "54% · точка 4 из 6");
  await progressBars.nth(0).focus();
  await expect(progressBars.nth(0)).toHaveAttribute("data-tip", "31% · точка 1 из 6");
  // The streak card bars stay focusable even without a drill dialog
  const streakBars = page.getByTestId("kpi-spark-3").locator("i");
  await streakBars.nth(5).focus();
  await expect(streakBars.nth(5)).toHaveAttribute("aria-label", "14 дней · точка 6 из 6");
});

test("buddy outage keeps an honest error and the plain next result alive", async ({ page }) => {
  await page.route("**/api/v1/agents/buddy/suggestion", (route) => route.fulfill({
    status: 503,
    json: { code: "UNAVAILABLE" },
  }));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByTestId("buddy-suggestion-activate").click();
  await expect(page.getByTestId("buddy-suggestion-unavailable")).toContainText("не вызывает модель");
  await page.getByTestId("buddy-suggestion-retry").click();
  await expect(page.getByTestId("buddy-suggestion-unavailable")).toContainText("не вызывает модель");
  // The domain next-result flow stays reachable during the outage
  await expect(page.getByTestId("next-result-card")).toBeVisible();
  await expect(page.getByTestId("next-result-badge")).toContainText("базовый → уверенный");
});

test("participant home actions open project, buddy and linked routes", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("button", { name: /Открыть рабочую область/ }).click();
  await expect(page.getByRole("dialog", { name: "Рабочая область проекта" })).toBeVisible();
  await page.getByRole("dialog", { name: "Рабочая область проекта" }).getByText("Закрыть", { exact: true }).click();
  // openspec 22.26: the advice appears only after explicit activation
  await page.getByTestId("buddy-suggestion-activate").click();
  await expect(page.getByTestId("buddy-suggestion-kind")).toBeVisible();
  await page.getByTestId("buddy-suggestion-why").locator("summary").click();
  await expect(page.getByTestId("buddy-suggestion-explanation")).toBeVisible();
  await page.getByRole("button", { name: /Начать checkpoint/ }).click();
  await expect(page).toHaveURL(/\/workspace\/2\?course=python-base$/);
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByTestId("buddy-suggestion-activate").click();
  await expect(page.getByTestId("buddy-suggestion-kind")).toBeVisible();
  await page.getByTestId("buddy-suggestion-dismiss").click();
  await expect(page.getByTestId("buddy-suggestion-dismissed")).toBeVisible();
  await expect(page.locator(".metric-histogram")).toHaveCount(4);
  await expect(page.getByTestId("activity-scale").getByRole("combobox", { name: "Период активности" })).toHaveValue("day");
  await expect(page.getByTestId("activity-total")).toContainText("2");
  await page.getByTestId("activity-scale").getByRole("combobox", { name: "Период активности" }).selectOption("month");
  await expect(page.getByTestId("activity-total")).toContainText("1");
  await expect(page.getByTestId("activity-state-risk")).toContainText("ниже цели 12–30");
  await page.getByTestId("activity-scale").getByRole("combobox", { name: "Период активности" }).selectOption("year");
  await expect(page.getByTestId("activity-total")).toContainText("14");
  await expect(page.getByTestId("activity-state-success")).toContainText("в рамках цели 120–300");
  // KPI drill-down: card click, dialog contents, Back restores the plain dashboard
  await page.getByTestId("kpi-card-projects").click();
  await expect(page).toHaveURL(/kpi=projects/);
  await expect(page.getByRole("dialog", { name: /Проекты: активные, завершённые и требующие внимания/ })).toBeVisible();
  await expect(page.getByTestId("kpi-item-assignment-1")).toContainText("В работе");
  // The history group deep-links into the completed project workspace
  await page.getByTestId("kpi-open-project-assignment-2").click();
  await expect(page).toHaveURL(/\/workspace\/4\?project=assignment-2/);
  await expect(page.getByRole("heading", { name: "Прогнозирование нагрузки контактного центра" })).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("kpi-item-assignment-1")).toContainText("В работе");
  await page.goBack();
  await expect(page.getByRole("dialog", { name: /Проекты: активные/ })).not.toBeVisible();
  // Deep link restores the drill-down with concrete evidence after a full reload
  await page.goto("/workspace/0?kpi=verified&evidence=contribution-1");
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page.getByRole("dialog", { name: /Подтверждённый опыт/ })).toBeVisible();
  await expect(page.getByTestId("kpi-anchor-contribution-1")).toContainText("входит в KPI");
  await expect(page.getByTestId("kpi-anchor-contribution-1")).toHaveAttribute("data-kpi-evidence-current", "true");
  // Daily agenda: chip opens today, prev jumps one day back, deep link opens a concrete historical day
  await page.getByTestId("kpi-close").click();
  await expect(page).not.toHaveURL(/kpi=/);
  await page.locator(".date-chip--button").click();
  await expect(page).toHaveURL(/date=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByTestId("agenda-dialog")).toBeVisible();
  const dayBefore = new URLSearchParams(new URL(page.url()).search).get("date") ?? "";
  await page.getByTestId("agenda-prev").click();
  const dayAfter = new URLSearchParams(new URL(page.url()).search).get("date") ?? "";
  const expectedPrev = dayBefore === "" ? "" : new Date(new Date(`${dayBefore}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
  expect(dayAfter).toBe(expectedPrev);
  await page.getByTestId("agenda-today").click();
  await expect(page).not.toHaveURL(/date=/);
  await expect(page.getByTestId("agenda-dialog")).not.toBeVisible();
  // Deep link: previous empty/non-empty historical day opens on its own URL
  await page.goto("/workspace/0?date=2026-10-18");
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page.getByTestId("agenda-dialog")).toBeVisible();
  await expect(page.getByTestId(/agenda-item-event:/)).toContainText("Вклад: API поиска");
  await expect(page.getByTestId("agenda-history-note")).toContainText("не требуют повторного участия");
  await page.getByTestId("agenda-today").click();
  await expect(page).not.toHaveURL(/date=/);
  await expect(page.getByTestId("agenda-dialog")).not.toBeVisible();
  // The empty historical day shows an empty state instead of borrowing neighbours
  await page.goto("/workspace/0?date=2026-10-15");
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page.getByTestId("agenda-empty")).toContainText("квалифицированных действий нет");
  await page.getByTestId("agenda-today").click();
  await expect(page).not.toHaveURL(/date=/);
  await page.getByRole("button", { name: /Все действия/ }).click();
  await expect(page).toHaveURL(/\/workspace\/3$/);
});

test("rating list opens participant profile and returns to the same ranking", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Рейтинг" }).click();
  await expect(page.getByRole("heading", { name: "Все участники рейтинга" })).toBeVisible();
  await page.screenshot({ path: "test-results/rating-v2-main-list-1672x941.png", fullPage: true });
  await page.getByRole("button", { name: "Кирилл Меньшев" }).click();
  await expect(page).toHaveURL(/ratingView=profile/);
  await expect(page.getByRole("heading", { name: "Кирилл Меньшев" })).toBeVisible();
  await page.screenshot({ path: "test-results/rating-v2-profile-1672x941.png", fullPage: true });
  await expect(page.getByText("Победитель МАЯКИ")).toBeVisible();
  await page.getByRole("tab", { name: "Проекты" }).click();
  await expect(page.getByText(/Подтверждённых проектов: 8/)).toBeVisible();
  await expect(page.getByText("AI Study Assistant")).toHaveCount(0);
  await page.getByRole("button", { name: /Вернуться в рейтинг/ }).click();
  await expect(page.getByRole("heading", { name: "Все участники рейтинга" })).toBeVisible();
});

test("rating benefits navigate from the default list and back", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Рейтинг" }).click();
  await page.getByRole("button", { name: "Подробнее о рейтинге и наградах" }).click();
  await expect(page).toHaveURL(/ratingView=benefits/);
  await expect(page.getByRole("heading", { name: "Рейтинг подтверждённого опыта" })).toBeVisible();
  await page.screenshot({ path: "test-results/rating-v2-benefits-1672x941.png", fullPage: true });
  const rewards = page.locator(".ir-benefits-showcase .ir-benefit");
  await expect(rewards).toHaveCount(3);
  await expect(rewards.nth(0)).toContainText("ТОП 30");
  await expect(rewards.nth(1)).toContainText("ТОП 1");
  await expect(rewards.nth(2)).toContainText("ТОП 50");
  const rewardArt = rewards.locator(".ir-art");
  await expect(rewardArt).toHaveCount(3);
  for (const [index, tier] of ["top30", "top1", "top50"].entries()) {
    await expect(rewardArt.nth(index)).toHaveCSS(
      "background-image", new RegExp("/rating-reference/" + tier + "\\.svg"),
    );
    const asset = await page.request.get("/rating-reference/" + tier + ".svg");
    expect(asset.status()).toBe(200);
    expect(asset.headers()["content-type"]).toContain("image/svg+xml");
  }
  await rewards.nth(1).click();
  await expect(page.getByRole("dialog", { name: /ТОП 1/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /ТОП 1/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Смотреть весь список" }).click();
  await expect(page.getByRole("heading", { name: "Все участники рейтинга" })).toBeVisible();
});

test("rating filters, ordering and profile actions are interactive", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Рейтинг" }).click();
  const allRows = page.locator(".ir-leader-row");
  await expect(allRows).toHaveCount(3);
  await page.getByRole("button", { name: "ТОП 10", exact: true }).click();
  await expect(allRows).toHaveCount(3);
  await page.getByRole("searchbox", { name: "Поиск участников" }).fill("Алекс");
  await expect(allRows).toHaveCount(1);
  await expect(allRows.first()).toContainText("Алекс Речной");
  // Restore the fixture user on reload; the default auth mock otherwise
  // correctly returns 401 and would exercise login rather than URL state.
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: {
    person_id: "1", display_name: "Алекс Речной", active_role: "participant",
    assigned_roles: ["participant"], scopes: [], consent_scopes: [], navigation,
    csrf_token: "csrf",
  } }));
  await page.reload();
  await expect(allRows).toHaveCount(1);
  await page.getByRole("button", { name: "Алекс Речной" }).click();
  await expect(page.getByRole("heading", { name: "Алекс Речной" })).toBeVisible();
  await page.getByRole("button", { name: "В избранное" }).click();
  await expect(page.getByRole("button", { name: "В избранном" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Написать" }).click();
  await expect(page).toHaveURL(/\/workspace\/10/);
});

test("rating buttons animate smoothly and remain inside the viewport on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("button", { name: /Меню/ }).click();
  await page.getByRole("link", { name: "Рейтинг" }).click();
  const cta = page.getByRole("button", { name: "Подробнее о рейтинге и наградах" });
  await expect(cta).toBeVisible();
  const props = await cta.evaluate((el) => ({ transition: getComputedStyle(el).transitionProperty }));
  expect(props.transition).toContain("transform");
  await cta.click();
  await expect(page.locator(".ir-benefits-showcase .ir-benefit")).toHaveCount(3);
  const dimensions = await page.locator(".ir-page").evaluate((el) => ({
    viewportWidth: window.innerWidth,
    docWidth: document.documentElement.scrollWidth,
    pageWidth: el.getBoundingClientRect().width,
  }));
  expect(dimensions.docWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 2);
  expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 2);
});

test("trajectory views keep selection and open overview by deep link", async ({ page }) => {
  await page.goto("/workspace/1?legacy=1&view=list");
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page.getByTestId("trajectory-view-list")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("trajectory-view-cards")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("trajectory-row-python-dev")).toBeVisible();
  await expect(page.getByTestId("trajectory-percent-python-dev")).toContainText("67%");
  await page.getByTestId("trajectory-view-cards").click();
  await expect(page).toHaveURL(/view=cards/);
  await page.reload();
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page.getByTestId("trajectory-card-python-dev")).toBeVisible();
  await expect(page.getByTestId("trajectory-view-cards")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("trajectory-open-overview-python-dev").click();
  await expect(page.getByRole("dialog", { name: /Python-разработчик · обзор/ })).toBeVisible();
  await expect(page.getByTestId("trajectory-overview-body")).toContainText("Правила evidence");
  await expect(page.getByTestId("trajectory-overview-body")).toContainText("Этапы направления");
  await page.locator('[aria-label="Закрыть"]').click();
  await expect(page).not.toHaveURL(/track=/);
  await page.goto("/workspace/1?legacy=1&track=python-dev&pane=detail");
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page.getByRole("dialog", { name: /Python-разработчик · подробнее/ })).toBeVisible();
  await expect(page.getByTestId("trajectory-formula")).toContainText("равный вес");
  await expect(page.getByTestId("trajectory-contour-0")).toContainText("базовый → уверенный");
  await expect(page.getByTestId("trajectory-day-2026-10-16")).toBeVisible();
  await expect(page.getByTestId("trajectory-next-step")).toContainText("course · python-base");
  await page.getByTestId("trajectory-stage-m1").click();
  await expect(page).toHaveURL(/workspace\/2\?course=python-base/);
});

test("search, streak, task detail and messages are interactive", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("button", { name: /Учебный стрик/ }).click();
  await expect(page.getByRole("dialog", { name: "Учебный стрик" })).toContainText("14 дней подряд");
  await expect(page.getByRole("img", { name: "Квалифицированные дни: 14, лучшая серия 14 дней" })).toBeVisible();
  await page.getByRole("button", { name: /Учебный стрик/ }).click();
  await expect(page.getByRole("dialog", { name: "Учебный стрик" })).not.toBeVisible();
  await page.getByRole("searchbox", { name: "Глобальный поиск" }).fill("Python");
  await page.getByRole("option", { name: /Python для R&D/ }).click();
  await expect(page).toHaveURL(/workspace\/2$/);
  await page.getByRole("link", { name: "Мои проекты", exact: true }).click();
  await page.getByRole("button", { name: "Открыть проект →" }).first().click();
  await page.getByRole("button", { name: "Открыть рабочую область →" }).first().click();
  await expect(page.getByRole("heading", { name: "Прототип рекомендательной системы" })).toBeVisible();
  await expect(page.getByText("Загрузить решение")).toBeVisible();
  await page.getByRole("button", { name: "Открыть чат команды" }).click();
  await expect(page).toHaveURL(/\/workspace\/10\?task=task-1$/);
  await expect(page.getByRole("heading", { name: "Сообщения" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Текущий чат · Рекомендательная система" })).toBeVisible();
  await page.getByRole("textbox", { name: "Текст сообщения" }).fill("Готово к повторной проверке");
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByRole("list", { name: "История чата" }).getByText("Готово к повторной проверке", { exact: true })).toBeVisible();
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
  await page.locator(".my-task-row--active").getByRole("button", { name: "Открыть карточку" }).first().click();
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
  await expect(page.getByRole("button", { name: "Открыть рейтинг участников" })).toBeVisible();
  await page.getByRole("button", { name: /Уведомления: 3 непрочитанных/ }).click();
  await expect(page.getByRole("dialog", { name: "Центр уведомлений" })).toBeVisible();
  await expect(page.getByText("Новый комментарий ментора")).toBeVisible();
  await page.getByRole("button", { name: /Checkpoint принят/ }).click();
  await expect(page).toHaveURL(/\/workspace\/4$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Открыть рейтинг участников" }).click();
  await expect(page).toHaveURL(/\/workspace\/6$/);
  await expect(page.getByRole("heading", { name: "Все участники рейтинга" })).toBeVisible();
});
