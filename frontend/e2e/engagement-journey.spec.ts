import { expect, test, type Page } from "@playwright/test";

// 24.7 — сквозная приёмка participant engagement journey на реальных фигурах
// демо-seed: claim goal через Buddy-карту (22.3: анализ активируется кнопкой)
// → глубокая ссылка на курс Bootcamp → qualifying action (учебный день) →
// восстановление серии заморозкой (24.2) → недельный ритм (24.4) →
// evidence verification (23.x) → обновлённые goal/radar/readiness и честный
// reload. Фигуры повторяют committed контракты HEAD: features/engagement.tsx,
// engagement-client.ts, buddy-suggestion.tsx, bootcamp/catalog.tsx,
// analytics.tsx и development.tsx (public verification).

const PERSON_ID = "00000000-0000-0000-0000-000000000001";
const ASSIGNMENT_ID = "4f2a93a7-7d3d-4c11-9d22-000000000021";

const ACTOR = {
  person_id: PERSON_ID,
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: ["course_honor_board"],
  navigation: [
    "Главная",
    "Моя траектория",
    "Bootcamp",
    "Задачи",
    "Мои проекты",
    "События",
    "Рейтинг",
    "Портфолио",
    "Достижения",
    "Аналитика",
    "Сообщения",
    "AI-Buddy",
    "Настройки",
  ] as string[],
  csrf_token: "csrf-engagement-journey",
};

const overviewV1 = () => ({
  current_days: 4,
  best_days: 9,
  qualified_dates: ["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"],
  reason: "Учебная активность подтверждена: курсовой checkpoint отправлен.",
  today_saved: false,
  grace_available: true,
  frozen_dates: [],
  freeze_state: "break",
});

const overviewV2 = () => ({
  ...overviewV1(),
  current_days: 5,
  frozen_dates: ["2026-10-20"],
  freeze_state: "frozen",
  reason: "Вчерашний день закрыт заморозкой; заморозка не считается активностью.",
});

const overviewV3 = () => ({
  ...overviewV2(),
  current_days: 6,
  qualified_dates: ["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-21"],
  today_saved: true,
  reason: "Сегодняшнее квалифицируемое действие сохранено.",
});

const freezeV1 = () => ({ policy_version: 2, granted_total: 3, available: 2, consumed_total: 1 });
const freezeV2 = () => ({ policy_version: 2, granted_total: 3, available: 1, consumed_total: 2 });

const rhythmUnset = () => ({
  versioned: false,
  history_count: 0,
  version: null,
  preset: null,
  active_days: [],
  reminder_hour: null,
  reminder_window_hours: null,
  effective_from: null,
  week_start: "2026-10-19",
  week_end: "2026-10-25",
  target_days: null,
  done_days: null,
  hint: "Недельный ритм — согласование с расписанием; не влияет на факт стрика.",
  scheduled_from: null,
  scheduled_preset: null,
});

const rhythmSet = () => ({
  ...rhythmUnset(),
  versioned: true,
  history_count: 1,
  version: 1,
  preset: "all_week",
  active_days: [1, 2, 3, 4, 5, 6, 7],
  reminder_hour: 18,
  reminder_window_hours: 3,
  effective_from: "2026-10-26",
  target_days: 7,
  done_days: 1,
});

const buddy = () => ({
  ai_model_available: true,
  dismissed: false,
  policy_version: 1,
  suggestion: {
    suggestion_id: "sg-eng-1",
    kind: "domain_next",
    version: 1,
    generated_at: "2026-10-21T10:00:00+03:00",
    gap: "Квалифицируемое учебное действие",
    observation: "Стрик разорван вчерашним днём; учебный день сегодня не записан.",
    explanation: "Запишите учебный день курса Python: основа — checkpoint маршрута подтвердится.",
    benefit: "Цель подтверждается квалифицированным днём, серия продолжится с заморозкой.",
    auto_enrolled: false,
    idle_days: null,
    model_called: false,
    source_categories: ["agenda", "roadmap"],
    action: {
      available: true,
      canonical_path: "/workspace/2?course=python-base",
      checkpoint_id: null,
      deadline_at: null,
      effect_state: "ready",
      estimated_minutes: 45,
      kind: "bootcamp_day",
      points: null,
      points_note: "После проверки",
      ref: "course:python-base",
      skill_forecast: "Прогноз: курсовой checkpoint подтвердит базовый Python.",
      stale_reason: null,
      target_id: "python-base",
      target_kind: "course",
      target_version: null,
      title: "Записать учебный день сегодня",
    },
  },
  rank_score: "0.8",
  partial: false,
  coverage_note: "проверяемые данные",
});

const milestone = {
  key: "m1",
  position: 1,
  title: "Освоить основу маршрута",
  purpose: "Подтвердить первый course checkpoint",
  skill: "Python",
  target_kind: "course",
  target_key: "python-base",
  completed: false,
};

const snapshotV1 = () => ({
  snapshot_id: "growth-eng-journey-v1",
  generated_at: "2026-10-21T09:00:00+03:00",
  snapshot_version: 2,
  actor_timezone: "Europe/Moscow",
  definitions: { "impulse-growth-readiness": "доля завершённых checkpoints маршрута" },
  period_horizon: "week",
  period_boundaries: { week: { start: "2026-10-19", end: "2026-10-25" } },
  activity: { week: { total: 6, course_checkpoint: 1, project_submission: 0, revision_accepted: 0, event_participation: 0 } },
  activity_state: {
    week: {
      anchor_date: "2026-10-21",
      anchor_state: "current",
      earliest_available: "2026-10-13",
      latest_available: "2026-10-19",
      regime_total: 4,
    },
  },
  events: [],
  hours: { known: true, trusted_minutes: 240, self_reported_minutes: 0, intervals: [] },
  freshness: { known: true, latest_observed_at: "2026-10-21T09:00:00+03:00" },
  trajectories: [
    {
      track_key: "python",
      track_title: "Python-разработчик",
      policy_version: 1,
      milestones: [milestone],
      completion: { percent: 33, coverage: 1, partial: false },
      readiness_skills: [],
      readiness: { percent: 40, coverage: 1, partial: false },
      object_refs: [],
      next_step_ref: null,
    },
  ],
});

const snapshotV2 = () => {
  const base = snapshotV1();
  return {
    ...base,
    snapshot_id: "growth-eng-journey-v2",
    generated_at: "2026-10-21T14:00:00+03:00",
    activity: { week: { total: 7, course_checkpoint: 2, project_submission: 0, revision_accepted: 0, event_participation: 0 } },
    freshness: { known: true, latest_observed_at: "2026-10-21T14:00:00+03:00" },
    trajectories: [
      {
        track_key: "python",
        track_title: "Python-разработчик",
        policy_version: 1,
        milestones: [milestone],
        completion: { percent: 66, coverage: 1, partial: false },
        readiness_skills: [],
        readiness: { percent: 66, coverage: 1, partial: false },
        object_refs: [],
        next_step_ref: null,
      },
    ],
  };
};

const projectCredential = {
  artifact_keys: ["course-proof"],
  competencies: [
    {
      competency: "result",
      evidence_refs: ["artifact:course-proof"],
      finding: "Course checkpoint подтверждён учебным днём.",
      level: "Уверенный",
    },
  ],
  contribution_version: 1,
  credential_id: "cred-eng-1",
  customer_name: "Техносити",
  grade_label: "B",
  holder_name: ACTOR.display_name,
  payment_status: "paid",
  period: "октябрь 2026",
  personal_summary: "Прошёл курсовой checkpoint и записал учебный день.",
  project_key: "demo-rd-lab",
  review_explanation: "Course checkpoint подтверждён проверяемым документом.",
  signed_at: "2026-10-20T10:00:00Z",
  status: "verified",
  superseded_by: null,
  task_key: "semantic-search-rd",
  task_title: "Проверка прототипа на данных",
  verification_id: "ver-proj-eng-1",
};

function installRoutes(page: Page, options: { engagementAvailable?: boolean } = {}): void {
  const { engagementAvailable = true } = options;
  let loggedIn = false;
  let learningDaySaved = false;
  let completionReported = false;
  let freezeUsed = false;
  let rhythmSaved = false;

  void page.route("**/api/v1/config", (route) => route.fulfill({ json: { honor_board_enabled: false, demo_mode: false } }));
  void page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "participant-alex", display_name: ACTOR.display_name, roles: ["participant"] }] }));
  void page.route("**/api/v1/auth/demo-login", (route) => { loggedIn = true; return route.fulfill({ json: ACTOR }); });
  void page.route("**/api/v1/auth/logout", (route) => { loggedIn = false; return route.fulfill({ status: 204 }); });
  void page.route(/\/api\/v1\/me$/, (route) => (loggedIn ? route.fulfill({ json: ACTOR }) : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } })));
  void page.route("**/api/v1/me/active-role", (route) => route.fulfill({ json: ACTOR }));
  void page.route("**/api/v1/me/theme", (route) => route.fulfill({ json: route.request().postDataJSON() as Record<string, string> }));
  void page.route("**/api/v1/me/notifications", (route) => route.fulfill({ json: { items: [], unread: 0 } }));
  void page.route("**/api/v1/marketplace/tasks", (route) => route.fulfill({ json: [] }));
  void page.route("**/api/v1/agents/buddy/suggestion", (route) => route.fulfill({ json: buddy() }));
  void page.route("**/api/v1/agents/buddy/suggestion/dismiss", (route) => route.fulfill({ json: { suggestion_id: "sg-eng-1", feedback: "dismiss" } }));
  void page.route("**/api/v1/agents/buddy/suggestion/feedback", (route) => route.fulfill({ json: { suggestion_id: "sg-eng-1", feedback: "helpful" } }));
  void page.route(/\/api\/v1\/agents\/buddy\/suggestion\/target\?suggestion_id=sg-eng-1$/, (route) => route.fulfill({
    json: {
      target: {
        available: true,
        canonical_path: "/workspace/2?course=python-base",
        checkpoint_id: null,
        deadline_at: null,
        effect_state: "ready",
        estimated_minutes: 45,
        kind: "bootcamp_day",
        points: null,
        points_note: "После проверки",
        ref: "course:python-base",
        skill_forecast: "Прогноз: курсовой checkpoint подтвердит базовый Python.",
        stale_reason: null,
        target_id: "python-base",
        target_kind: "course",
        target_version: null,
        title: "Записать учебный день сегодня",
      },
    },
  }));

  if (engagementAvailable) {
    void page.route("**/api/v1/me/engagement/overview", (route) =>
      route.fulfill({ json: learningDaySaved ? overviewV3() : freezeUsed ? overviewV2() : overviewV1() }));
    void page.route("**/api/v1/me/engagement/freeze", (route) =>
      route.fulfill({ json: freezeUsed ? freezeV2() : freezeV1() }));
    void page.route("**/api/v1/me/engagement/freeze/use", (route) => {
      freezeUsed = true;
      return route.fulfill({ json: learningDaySaved ? overviewV3() : overviewV2() });
    });
    void page.route("**/api/v1/me/engagement/rhythm", (route) => {
      if (route.request().method() === "POST") {
        rhythmSaved = true;
        return route.fulfill({ json: { ...rhythmSet(), version: 1 } });
      }
      return route.fulfill({ json: rhythmSaved ? rhythmSet() : rhythmUnset() });
    });
  } else {
    void page.route("**/api/v1/me/engagement/**", (route) => route.fulfill({ status: 503, json: { code: "SERVICE_UNAVAILABLE", message: "Демонстрационный синглтон engagement недоступен." } }));
  }

  void page.route("**/api/v1/me/bootcamp/catalog", (route) => route.fulfill({
    json: [
      {
        key: "python-base",
        title: "Python: основа",
        track_keys: ["python"],
        source_url: "https://example.test/courses/python",
        access_state: "available",
        access_note: "Курс открыт в демо без регистрации во внешней LMS.",
        completion_state: completionReported ? "reported" : "not_started",
        pending_verification_note: completionReported ? "Завершение отправлено на проверку: повторно проходить тот же шаг не нужно." : null,
        relevant: true,
        relevance_reasons: ["Связан с активными направлениями: python."],
        recommendation_reason: "Этап «Освоить основу маршрута»: подтвердить первый course checkpoint.",
        must_take: {
          skill: "Python",
          current_level: "базовый",
          target_level: "уверенный",
          projected_impact: "Прогноз: checkpoint поднимает базовые навыки маршрута «Python-разработчик».",
          explanation: "Закрывает пробел навыка «Python»: сейчас «базовый», целевой уровень «уверенный».",
        },
        verified_evidence: null,
      },
    ],
  }));
  void page.route("**/api/v1/development/courses", (route) => route.fulfill({
    json: [
      {
        key: "python-base",
        title: "Python: основа",
        track_keys: ["python"],
        recommendation_reason: "Этап «Освоить основу маршрута»: подтвердить первый course checkpoint.",
        source_url: "https://example.test/courses/python",
        availability: "available",
        access_note: "Курс открыт в демо без регистрации во внешней LMS.",
        completion_status: completionReported ? "reported" : null,
        rating_eligible: true,
      },
    ],
  }));
  void page.route("**/api/v1/me/courses/*/detail", (route) => route.fulfill({
    json: {
      course_key: "python-base",
      title: "Python: основа",
      source_url: "https://example.test/courses/python",
      availability: "available",
      access_note: "Курс открыт в демо без регистрации во внешней LMS.",
      enrollment_status: null,
      verified: false,
      specialization: null,
      program_version: "2",
      workload_hours: 40,
      program_competencies: [["python", "базовый", "уверенный"]],
      objective: "Освоить базу Python и собрать конспект для будущего проекта.",
      milestone_title: "Освоить основу маршрута",
      next_step: "Записать учебный день и сохранить конспект как артефакт.",
      artifact: "Учебный конспект и демо-скрипт",
      cycle: [
        {
          competency: "Python",
          current_level: "базовый",
          projected_level: "уверенный",
          target_level: "уверенный",
          projected_confirmed: false,
          evidence: "Прогноз строится по программе курса",
        },
      ],
    },
  }));
  void page.route("**/api/v1/me/learning/streak", (route) => route.fulfill({
    json: {
      current_days: learningDaySaved ? 5 : 4,
      qualified_dates: learningDaySaved
        ? ["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-21"]
        : ["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"],
      reason: "Серия подтверждена курсовыми checkpoint.",
    },
  }));
  void page.route("**/api/v1/me/courses/*/learning-days", (route) => {
    learningDaySaved = true;
    return route.fulfill({ json: { current_days: 5, qualified_dates: ["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-21"], reason: "Учебный день записан." } });
  });
  void page.route("**/api/v1/me/courses/*/completion", (route) => {
    completionReported = true;
    return route.fulfill({ json: { course_key: "python-base", status: "reported" } });
  });

  void page.route("**/api/v1/me/growth/snapshot", (route) =>
    route.fulfill({ json: learningDaySaved || completionReported ? snapshotV2() : snapshotV1() }));
  void page.route("**/api/v1/me/growth/next-step", (route) => route.fulfill({
    json: {
      policy_version: 1,
      skill: {
        skill_key: "python",
        requested_skill: "Python",
        title: "Python",
        current_known: true,
        current_level: "базовый",
        target_level: "уверенный",
        policy_version: 1,
        counted_sources: ["course_checkpoint", "credential"],
        missing_evidence: learningDaySaved || completionReported ? [] : ["course_checkpoint"],
        explanation: learningDaySaved || completionReported
          ? "Checkpoint подтверждён учебным днём; уровень подтвердится после проверки evidence."
          : "Course checkpoint не принят: нужен подтверждённый учебный день.",
        fallback: null,
      } as Record<string, unknown>,
    },
  }));
  void page.route("**/api/v1/me/work", (route) => route.fulfill({
    json: [
      {
        assignment: { id: ASSIGNMENT_ID, task_id: "task-search-rd", person_id: PERSON_ID, status: "in_progress" },
        task: {
          key: "task-search-rd",
          title: "Проверка прототипа на данных",
          summary: "Проверить прототип на данных заказчика и подтвердить результат.",
          status: "in_progress",
          key_skills: ["Python"],
          gain_skills: ["Python"],
        },
        terms: { checkpoints: 2, deadline: "2026-11-15", end_at: "2026-11-30", points: 120 },
        allowed_artifacts: ["course-proof", "docs"],
        contributions: [],
        decisions: [],
      },
    ],
  }));
  void page.route("**/api/v1/me/assignments/*/contributions", (route) => route.fulfill({ json: [] }));
  void page.route("**/api/v1/me/assignments/*/deadline-requests", (route) => route.fulfill({ json: [] }));
  void page.route("**/api/v1/me/analytics/journey", (route) => route.fulfill({
    json: {
      stages: learningDaySaved || completionReported
        ? [{ label: "Проверяемое учебное действие", state: "done" }, { label: "Проверка evidence", state: "next" }]
        : [{ label: "Записать квалифицируемый учебный день", state: "next" }],
      successful: true,
      next_action: learningDaySaved || completionReported ? "Проверка evidence подтверждения" : "Записать квалифицируемый учебный день",
      earnings: { calculated: "0", approved: "0", paid: "0", failed: "0", currency: "RUB", unknown_items: 0 },
      freshness: "fresh",
      generated_at: "2026-10-21T10:00:00Z",
    },
  }));
  void page.route("**/api/v1/me/bootcamp/certificates", (route) => route.fulfill({ json: [] }));
  void page.route("**/api/v1/me/project-credentials", (route) => route.fulfill({ json: [projectCredential] }));
  void page.route("**/api/v1/project-credentials/*", (route) => route.fulfill({ json: { ...projectCredential, payment_status: "Оплачено" } }));
  void page.route("**/api/v1/competency-evidence", (route) => route.fulfill({ json: [] }));
  void page.route("**/api/v1/me/competency-evidence", (route) => route.fulfill({ json: [] }));
  void page.route("**/api/v1/development/tracks", (route) => route.fulfill({ json: { active_count: 1, max_active: 2, tracks: [{ key: "python", title: "Python-разработчик", status: "active", completed_milestones: [] }] } }));
  void page.route("**/api/v1/me/roadmaps", (route) => route.fulfill({ json: [{ track_key: "python", policy_version: 1, replacement_reason: null, milestones: [milestone], next_step: milestone }] }));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __printedPdfs: number };
    // Контекст браузера у каждого теста свежий, поэтому чистить хранилище
    // анимации не нужно: внутри вкладки флеш-логика должна видеть рост.
    w.__printedPdfs = 0;
    window.print = () => {
      w.__printedPdfs += 1;
    };
  });
});

test.describe("engagement journey: desktop acceptance", () => {
  test.use({ viewport: { width: 1440, height: 1280 } });

  test("buddy goal, qualifying day, freeze restore, rhythm agreement, verified evidence and honest reload", async ({ page }) => {
    // CI-воркеры медленные: полный journey с тремя reload и PDF-опросом требует запаса.
    test.setTimeout(90_000);
    installRoutes(page);
  const apiFailures: string[] = [];
  const consoleErrors: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/") && response.status() >= 400 && response.request().method() !== "GET") apiFailures.push(`${String(response.status())} ${response.url()}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page).toHaveURL(/\/workspace\/0$/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const themeToggle = page.locator(".theme-toggle");
  await expect(themeToggle).toHaveAttribute("aria-pressed", "true");

  // Claim goal: buddy-карта активируется кнопкой («Анализ запускается только
  // по кнопке», 22.3), получает объяснимую рекомендацию и предсказуемое действие.
  await page.getByTestId("buddy-suggestion-activate").click();
  const buddyAction = page.getByRole("button", { name: "Записать учебный день сегодня" });
  await expect(page.getByTestId("buddy-suggestion-kind")).toBeVisible();
  await expect(buddyAction).toBeVisible();
  await expect(page.locator(".buddy-action-meta")).toContainText("45 мин");
  await expect(page.locator(".buddy-action-meta")).toContainText("Прогноз: курсовой checkpoint подтвердит базовый Python.");

  // Buddy deep link: canonical навигация ведёт прямо на страницу курса.
  await buddyAction.click();
  await expect(page).toHaveURL(/\/workspace\/2\?.*course=python-base/);

  // Страница курса: программа и матрица компетенций из detail-контракта.
  await expect(page.getByRole("heading", { name: "Python: основа", exact: true })).toBeVisible();
  await expect(page.getByTestId("course-progress")).toContainText("Не начат");
  await expect(page.getByTestId("course-detail-facts")).toContainText("Освоить базу Python и собрать конспект для будущего проекта.");
  await expect(page.getByTestId("course-competency-0")).toContainText("Текущий: базовый → прогноз: уверенный");

  // Streak reveal до qualifying action: v1 (break) честно показывает разрыв серии.
  const streakButton = page.locator(".streak-utility .streak-button");
  await expect(streakButton).toHaveAccessibleName(/Учебный стрик: 4 дней/);
  const dialog = page.getByRole("dialog", { name: "Учебный стрик" });
  await expect(page.locator(".engagement-flash")).toHaveCount(0);
  await streakButton.click();
  await expect(dialog).toBeVisible();

  await expect(dialog.getByRole("img", { name: "Квалифицированные дни: 4, лучшая серия 9 дней" })).toBeVisible();
  await expect(dialog).toContainText("Пропущен вчерашний день. Заморозка может закрыть его один раз.");
  await expect(dialog).toContainText("2 в запасе · использовано 1");
  await expect(dialog).toContainText("Календарь показывает только квалифицированные дни; счёт без входов и сообщений.");

  // Freeze restore: 24.2 применяет заморозку ровно один раз и восстанавливает серию.
  await dialog.getByRole("button", { name: "Использовать заморозку" }).click();
  await expect(page.locator(".engagement-flash", { hasText: "4 → 5" })).toBeVisible();
  await expect(streakButton.locator("strong")).toHaveText("5");
  await expect(dialog.getByRole("img", { name: "Квалифицированные дни: 4, лучшая серия 9 дней" })).toBeVisible();
  await expect(dialog).toContainText("1 в запасе · использовано 2");
  await expect(dialog).toContainText("Вчерашний день закрыт заморозкой; заморозка не считается активностью.");
  await expect(dialog.getByRole("button", { name: "Использовать заморозку" })).not.toBeVisible();

  // Недельный ритм: 24.4 сохраняет соглашение одним POST и refetch отдаёт версию.
  const rhythm = dialog.locator(".engagement-rhythm-block");
  await expect(rhythm).toBeVisible();
  await expect(rhythm).toContainText("не настроен");
  await rhythm.getByRole("button", { name: "Вся неделя" }).click();
  await rhythm.getByLabel("Напоминание").selectOption("18");
  await rhythm.getByLabel("Окно напоминания").selectOption("3");
  await rhythm.getByRole("button", { name: "Сохранить ритм" }).click();
  await expect(rhythm).toContainText("Соглашение v1 сохранено; начинает действовать с 2026-10-26.");
  await expect(rhythm).toContainText("1 из 7 в этой неделе");
  await expect(rhythm).toContainText("Соглашение v1; всего версий 1");

  // Закрыть поповер и записать квалифицируемый учебный день в списке каталога.
  await streakButton.click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "← Вернуться в Bootcamp" }).click();
  const courseCard = page.getByTestId("course-python-base");
  await expect(courseCard).toBeVisible();
  await expect(page.getByRole("heading", { name: "Серия: 4 дн." })).toBeVisible();
  await courseCard.getByRole("button", { name: "Записать учебный день" }).click();
  await expect(page.getByRole("heading", { name: "Серия: 5 дн." })).toBeVisible();
  // Честный кэш: несвязанный POST не переписывает топбар без перезагрузки.
  await expect(page.getByRole("button", { name: /Учебный стрик: 5 дней/ })).toBeVisible();

  // Evidence-подтверждение курса (23.x) в списке каталога.
  await courseCard.getByRole("button", { name: "Отметить завершение" }).click();
  await expect(courseCard).toContainText("Ожидает проверки");
  await expect(courseCard).toContainText("Завершение отправлено на проверку: повторно проходить тот же шаг не нужно.");

  // Radar/readiness: снапшот пересчитался по квалифицируемым событиям.
  await page.goto("/workspace/1");
  await expect(page.getByTestId("trajectory-percent-python")).toContainText("66%");
  await expect(page.getByTestId("trajectory-card-python")).toContainText("Готовность роли: 66%");
  // Честная reload-поверхность: рост стрика фиксируется flat-анимацией 5 → 6.
  await expect(page.locator(".engagement-flash", { hasText: "5 → 6" })).toBeVisible();

  // Публичная проверка credential: документ открывается и в viewer, и по verify-URL.
  await page.goto("/workspace/9");
  const documents = page.getByTestId("document-item");
  await expect(documents.filter({ hasText: "Проверка прототипа на данных" })).toBeVisible();
  await documents.filter({ hasText: "Проверка прототипа на данных" }).getByRole("button", { name: "Проверить" }).click();
  const viewer = page.getByTestId("document-viewer");
  await expect(viewer).toContainText("Verification viewer · ver-proj-eng-1");
  await viewer.getByTestId("document-pdf").click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printedPdfs: number }).__printedPdfs)).toBeGreaterThanOrEqual(1);
  await viewer.getByRole("link", { name: "Открыть публичную проверку проектного credential" }).click();
  await expect(page).toHaveURL(/\/verify\/projects\/ver-proj-eng-1$/);
  await expect(page.getByRole("heading", { name: "Проверка прототипа на данных" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Матрица компетенций" })).toBeVisible();
  await expect(page.getByText("Course checkpoint подтверждён учебным днём.")).toBeVisible();

  // Честный reload: state journey сохраняется без обращения к engagement API (6 дней).
  await page.goto("/workspace/0");
  const streakReloaded = page.getByRole("button", { name: /Учебный стрик: 6 дней/ });
  await expect(streakReloaded).toBeVisible();
  // flash уже зафиксировал 5 → 6 при первом обновленном маунте (/workspace/1);
  // на home хранилище равно текущему значению — повторной анимации нет.
  await expect(page.locator(".engagement-flash")).toHaveCount(0);
  await streakReloaded.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img", { name: "Квалифицированные дни: 5, лучшая серия 9 дней" })).toBeVisible();
  await expect(dialog).toContainText("Сегодняшнее квалифицируемое действие сохранено.");
  const rhythmReloaded = dialog.locator(".engagement-rhythm-block");
  await expect(rhythmReloaded).toContainText("1 из 7 в этой неделе");
  await expect(rhythmReloaded).toContainText("Соглашение v1; всего версий 1");

  // Обе темы: светлая тема держит тот же journey честности.
  await themeToggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(dialog.getByRole("button", { name: "Вся неделя" })).toBeVisible();
  // Клавиатура: focusable streak-тогл продолжает управлять поповером.
  await streakReloaded.focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();

  expect(apiFailures, "неожиданные HTTP-ошибки API").toEqual([]);
  expect(consoleErrors, "необработанные ошибки страницы").toEqual([]);
  });
});

test.describe("mobile touch journey: engagement goal through freeze and rhythm in light theme", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("light theme goal, qualifying day, freeze and rhythm", async ({ page }) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    installRoutes(page);
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await page.goto("/");
    await page.locator('[data-persona="participant-alex"]').click();
    const themeToggle = page.locator(".theme-toggle");
    await themeToggle.tap();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(themeToggle).toHaveAttribute("aria-pressed", "false");

    await page.getByTestId("buddy-suggestion-activate").click();
    await page.getByRole("button", { name: "Записать учебный день сегодня" }).tap();
    await expect(page).toHaveURL(/\/workspace\/2\?.*course=python-base/);
    await expect(page.getByRole("heading", { name: "Python: основа", exact: true })).toBeVisible();

    // В списке каталога честный учебный день записывается с носителя.
    await page.getByRole("button", { name: "← Вернуться в Bootcamp" }).tap();
    await expect(page.getByTestId("course-python-base")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Серия: 4 дн." })).toBeVisible();
    await page.getByTestId("course-python-base").getByRole("button", { name: "Записать учебный день" }).tap();
    await expect(page.getByRole("heading", { name: "Серия: 5 дн." })).toBeVisible();

    // Streak: заморозка закрывает вчерашний разрыв; flash объясняет 4 → 5.
    const streakButton = page.locator(".streak-utility .streak-button");
    await expect(streakButton).toHaveAccessibleName(/Учебный стрик: 4 дней/);
    await streakButton.tap();
    const dialog = page.getByRole("dialog", { name: "Учебный стрик" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Пропущен вчерашний день. Заморозка может закрыть его один раз.");
    await dialog.getByRole("button", { name: "Использовать заморозку" }).tap();
    await expect(page.locator(".engagement-flash", { hasText: "4 → 6" })).toBeVisible();

    const rhythm = dialog.locator(".engagement-rhythm-block");
    await expect(rhythm).toBeVisible();
    await rhythm.getByRole("button", { name: "Вся неделя" }).tap();
    await rhythm.getByLabel("Напоминание").selectOption("18");
    await rhythm.getByLabel("Окно напоминания").selectOption("3");
    await rhythm.getByRole("button", { name: "Сохранить ритм" }).tap();
    await expect(rhythm).toContainText("Соглашение v1 сохранено; начинает действовать с 2026-10-26.");
    await expect(rhythm).toContainText("1 из 7 в этой неделе");

    expect(consoleErrors, "необработанные ошибки страницы").toEqual([]);
  });
});

test("engagement surfaces stay honest when the engagement API is unavailable", async ({ page }) => {
  test.setTimeout(60_000);
  installRoutes(page, { engagementAvailable: false });
  const consoleErrors: string[] = [];
  const apiFailures: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/") && response.status() >= 400 && response.request().method() !== "GET") apiFailures.push(`${String(response.status())} ${response.url()}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page).toHaveURL(/\/workspace\/0$/);

  // Индикатор остаётся честным: нет подмены «0» на выдуманные значения.
  const streakButton = page.getByRole("button", { name: /Учебный стрик: 0 дней/ });
  await expect(streakButton).toBeVisible();
  await expect(page.locator(".engagement-flash")).toHaveCount(0);
  await streakButton.click();
  const dialog = page.getByRole("dialog", { name: "Учебный стрик" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Пока ноль");
  await expect(dialog.getByText("Пока нет квалифицируемых действий")).toBeVisible();
  await expect(dialog).toContainText("0 в запасе · использовано 0");
  await expect(dialog.getByRole("button", { name: "Использовать заморозку" })).not.toBeVisible();
  await expect(dialog.locator(".engagement-rhythm-block")).toBeHidden();

  // Journey остаётся доступным: buddy-карта не блокируется отсутствием стрика.
  await page.getByTestId("buddy-suggestion-activate").click();
  await page.getByRole("button", { name: "Записать учебный день сегодня" }).click();
  await expect(page).toHaveURL(/\/workspace\/2\?.*course=python-base/);
  await expect(page.getByRole("heading", { name: "Python: основа", exact: true })).toBeVisible();

  // Список каталога: стрик и учебный день работают независимо от engagement API.
  await page.getByRole("button", { name: "← Вернуться в Bootcamp" }).click();
  const courseCard = page.getByTestId("course-python-base");
  await expect(courseCard).toBeVisible();
  await expect(page.getByRole("heading", { name: "Серия: 4 дн." })).toBeVisible();
  await courseCard.getByRole("button", { name: "Записать учебный день" }).click();
  await expect(page.getByRole("heading", { name: "Серия: 5 дн." })).toBeVisible();

  expect(apiFailures, "машина journeys не переходит без engagement, ошибки API недопустимы").toEqual([]);
  expect(consoleErrors, "необработанные ошибки страницы").toEqual([]);
});
