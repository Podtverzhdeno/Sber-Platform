import { expect, test, type Page } from "@playwright/test";

// 22.14 — сквозная приёмка participant growth journey на реальных фигурах
// демо-seed: тема → паспортный проект → checkpoint (личный вклад = evidence) →
// обновление снапшота → изменённая циклограмма/readiness → credential PDF.
// Фигуры повторяют committed контракты HEAD: impulse/domain/identity.py
// (ROLE_NAVIGATION и demo persona), features/work.tsx, features/analytics.tsx,
// features/next-result.tsx, features/trajectory-view.tsx и schema.ts.

const PERSON_ID = "00000000-0000-0000-0000-000000000001";
const ASSIGNMENT_ID = "4f2a93a7-7d3d-4c11-9d22-000000000001";
const TASK_ID = "4f2a93a7-7d3d-4c11-9d22-000000000002";
const CONTRIBUTION_ID = "4f2a93a7-7d3d-4c11-9d22-000000000003";

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
  ],
  csrf_token: "csrf-growth-journey",
};

const TASK = {
  id: TASK_ID,
  project_key: "demo-rd-lab",
  task_key: "semantic-search-rd",
  title: "Проверка прототипа на данных",
  status: "open",
  mode: "open",
};

const TERMS = {
  version: 1,
  deadline_at: "2026-12-01T18:00:00Z",
  deliverable: "Прототип и отчёт с метриками.",
  acceptance_criteria: ["Метрика подтверждена", "Данные проверены"],
  compensation: { paid: false, base_amount_per_assignee: null, b_total: null, a_total: null },
};

const MILESTONE = { key: "m2", position: 2, title: "Проверка прототипа", purpose: "Подтвердить результат данными", skill: "API и интеграции", target_kind: "task", target_key: "semantic-search-rd", completed: false };

const snapshotV1 = () => ({
  snapshot_id: "growth-snapshot-journey-v1",
  generated_at: "2026-10-20T09:00:00+03:00",
  snapshot_version: 2,
  actor_timezone: "Europe/Moscow",
  definitions: { "impulse-growth-readiness": "доля завершённых milestones и подтверждённых навыков" },
  period_boundaries: { day: {} },
  activity: { day: { total: 2, course_checkpoint: 0, project_submission: 1, revision_accepted: 1, event_participation: 0 } },
  activity_state: { day: {} },
  events: [],
  hours: { known: true, trusted_minutes: 180, self_reported_minutes: 0, intervals: [] },
  freshness: { known: true, latest_observed_at: "2026-10-20T09:00:00+03:00" },
  trajectories: [
    {
      track_key: "python",
      track_title: "Python-разработчик",
      policy_version: 1,
      milestones: [MILESTONE],
      completion: { percent: 54, coverage: 1, partial: false },
      readiness_skills: [],
      readiness: { percent: 40, coverage: 0, partial: true },
      object_refs: [],
      next_step_ref: "m2",
    },
  ],
});

const snapshotV2 = () => {
  const base = snapshotV1();
  return {
    ...base,
    snapshot_id: "growth-snapshot-journey-v2",
    generated_at: "2026-10-20T12:00:00+03:00",
    activity: { day: { total: 3, course_checkpoint: 0, project_submission: 2, revision_accepted: 1, event_participation: 0 } },
    freshness: { known: true, latest_observed_at: "2026-10-20T12:00:00+03:00" },
    trajectories: base.trajectories.map((trajectory) => ({
      ...trajectory,
      completion: { percent: 66, coverage: 1, partial: false },
      readiness: { percent: 66, coverage: 1, partial: false },
    })),
  };
};

const nextStepV1 = () => ({
  policy_version: 1,
  skill: {
    skill_key: "api_integrations",
    requested_skill: "API и интеграции",
    title: "API и интеграции",
    current_known: true,
    current_level: "Уверенный",
    target_level: "Сильный",
    policy_version: 1,
    counted_sources: ["contribution", "credential"],
    missing_evidence: ["project_submission"],
    explanation: "Проектный checkpoint не принят: нужен личный вклад с доказательством.",
    fallback: null,
  } as Record<string, unknown>,
  next_available: step(true, null),
  steps: [step(true, null)],
});

const nextStepV2 = () => ({
  policy_version: 1,
  skill: {
    skill_key: "api_integrations",
    requested_skill: "API и интеграции",
    title: "API и интеграции",
    current_known: true,
    current_level: "Уверенный",
    target_level: "Сильный",
    policy_version: 1,
    counted_sources: ["contribution", "credential"],
    missing_evidence: [],
    explanation: "Личный вклад отправлен на приёмку; уровень подтвердится после принятия заказчиком.",
    fallback: null,
  } as Record<string, unknown>,
  next_available: step(true, null),
  steps: [step(true, null)],
});

function step(available: boolean, staleReason: string | null) {
  return {
    trajectory_key: "python",
    milestone_key: "m2",
    position: 2,
    target_kind: "task",
    target_key: "semantic-search-rd",
    target_title: "Проверка прототипа на данных",
    available,
    score: 0.8,
    factors: ["Открытая задача совпадает с фокусом навыка"],
    reasons: ["Совпадение навыка и проекта"],
    stale_reason: staleReason,
  };
}

const BUDDY = {
  ai_model_available: true,
  dismissed: false,
  policy_version: 1,
  suggestion: {
    suggestion_id: "sg-1",
    kind: "domain_next",
    version: 1,
    generated_at: "2026-10-20T11:00:00+03:00",
    gap: "Проверенные project evidence",
    observation: "Проект «Проверка прототипа на данных» в работе, вклад не отправлен.",
    explanation: "Отправьте личный вклад с доказательством, чтобы checkpoint попал в снапшот.",
    benefit: "Проверяемый проектный результат в паспорте навыка.",
    auto_enrolled: false,
    idle_days: null,
    model_called: false,
    source_categories: ["agenda", "roadmap"],
    action: { kind: "go_to_workspace", label: "Открыть рабочую область проекта", ref: "/workspace/4" },
  },
  rank_score: "0.8",
  partial: false,
  coverage_note: "проверяемые данные",
};

const CERTIFICATE = {
  certificate_id: "cert-journey-1",
  course_key: "python-base",
  course_title: "Python: основа",
  holder_name: ACTOR.display_name,
  issued_at: "2026-10-15T10:00:00Z",
  period: "октябрь 2026",
  preview_marking: "Демо",
  program_version: 3,
  result: "91%",
  specialization: "Python-разработка",
  verification_id: "ver-cert-journey-1",
  workload_hours: 42,
  competencies: [{ competency: "Python", evidence: "Итоговый тест 91%", level: "Уверенный" }],
};

const PROJECT_CREDENTIAL = {
  artifact_keys: ["personal-proof"],
  competencies: [{ competency: "result", evidence_refs: ["artifact:result"], finding: "Прототип проверен данными.", level: "Уверенный" }],
  contribution_version: 1,
  credential_id: "cred-journey-1",
  customer_name: "Техносити",
  grade_label: "B",
  holder_name: ACTOR.display_name,
  payment_status: "paid",
  period: "октябрь 2026",
  personal_summary: "Собрал прототип и проверил метрику на данных.",
  project_key: "demo-rd-lab",
  review_explanation: "Дизайн и прототип проверены на данных.",
  signed_at: "2026-10-18T10:00:00Z",
  status: "verified",
  superseded_by: null,
  task_key: "semantic-search-rd",
  task_title: "Проверка прототипа на данных",
  verification_id: "ver-proj-journey-1",
};

function workItem(contributed: boolean) {
  return [
    {
      assignment: { id: ASSIGNMENT_ID, task_id: TASK_ID, person_id: PERSON_ID, status: "in_progress" },
      task: TASK,
      terms: TERMS,
      allowed_artifacts: ["personal-proof", "docs"],
      contributions: contributed
        ? [{ id: CONTRIBUTION_ID, version: 1, personal_summary: "Собрал прототип и проверил метрику на данных.", artifact_keys: ["personal-proof"], status: "submitted" }]
        : [],
      decisions: [],
    },
  ];
}

function installRoutes(page: Page): void {
  void page.route("**/api/v1/config", (route) => route.fulfill({ json: { honor_board_enabled: true, demo_mode: false } }));
  void page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "participant-alex", display_name: ACTOR.display_name, roles: ["participant"] }] }));
  let loggedIn = false;
  let contributed = false;
  void page.route("**/api/v1/auth/demo-login", (route) => { loggedIn = true; return route.fulfill({ json: ACTOR }); });
  void page.route("**/api/v1/auth/logout", (route) => { loggedIn = false; return route.fulfill({ status: 204 }); });
  void page.route(/\/api\/v1\/me$/, (route) => (loggedIn ? route.fulfill({ json: ACTOR }) : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } })));
  void page.route("**/api/v1/me/active-role", (route) => route.fulfill({ json: ACTOR }));
  void page.route("**/api/v1/me/theme", (route) => route.fulfill({ json: route.request().postDataJSON() as Record<string, string> }));
  void page.route("**/api/v1/me/notifications", (route) => route.fulfill({ json: { items: [], unread: 0 } }));
  void page.route("**/api/v1/agents/buddy/suggestion", (route) => route.fulfill({ json: BUDDY }));
  void page.route("**/api/v1/agents/buddy/suggestion/**", (route) => route.fulfill({ json: { suggestion_id: "sg-1", feedback: "helpful" } }));
  void page.route("**/api/v1/marketplace/tasks", (route) => route.fulfill({ json: [] }));
  void page.route("**/api/v1/me/growth/snapshot", (route) => route.fulfill({ json: contributed ? snapshotV2() : snapshotV1() }));
  void page.route("**/api/v1/me/growth/next-step", (route) => route.fulfill({ json: contributed ? nextStepV2() : nextStepV1() }));
  void page.route("**/api/v1/me/work", (route) => route.fulfill({ json: workItem(contributed) }));
  void page.route("**/api/v1/me/assignments/*/contributions", (route) => {
    contributed = true;
    return route.fulfill({ json: { id: CONTRIBUTION_ID, version: 1, personal_summary: "Собрал прототип и проверил метрику на данных.", artifact_keys: ["personal-proof"], status: "submitted" } });
  });
  void page.route("**/api/v1/me/assignments/*/deadline-requests", (route) => route.fulfill({ json: [] }));
  void page.route("**/api/v1/me/analytics/journey", (route) => route.fulfill({ json: { stages: [], successful: true, next_action: "Продолжайте подтверждение проектов", earnings: { calculated: "0", approved: "0", paid: "0", failed: "0", currency: "RUB", unknown_items: 0 }, freshness: "fresh", generated_at: "2026-10-20T10:00:00Z" } }));
  void page.route("**/api/v1/me/bootcamp/certificates", (route) => route.fulfill({ json: [CERTIFICATE] }));
  void page.route("**/api/v1/me/project-credentials", (route) => route.fulfill({ json: [PROJECT_CREDENTIAL] }));
  void page.route("**/api/v1/competency-evidence", (route) => route.fulfill({ json: [] }));
  void page.route("**/api/v1/me/competency-evidence", (route) => route.fulfill({ json: [] }));
  void page.route("**/api/v1/development/tracks", (route) => route.fulfill({ json: { active_count: 1, max_active: 2, tracks: [{ key: "python", title: "Python-разработчик", status: "active", completed_milestones: ["m1"] }] } }));
  void page.route("**/api/v1/me/roadmaps", (route) => route.fulfill({ json: [{ track_key: "python", policy_version: 1, replacement_reason: null, milestones: [MILESTONE], next_step: MILESTONE }] }));
  void page.route("**/api/v1/me/trajectory-map", (route) => route.fulfill({ json: [] }));
  void page.route("**/api/v1/bootcamp/certificates/*", (route) => route.fulfill({ json: { ...CERTIFICATE, preview_marking: "Демо · не является официальным сертификатом до подписания" } }));
  void page.route("**/api/v1/project-credentials/*", (route) => route.fulfill({ json: { ...PROJECT_CREDENTIAL, payment_status: "Оплачено" } }));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __printedPdfs: number }).__printedPdfs = 0;
    window.print = () => {
      (window as unknown as { __printedPdfs: number }).__printedPdfs += 1;
    };
  });
});

test("participant growth journey: theme, passport project, evidence checkpoint, snapshot refresh, changed readiness, credential PDF", async ({ page }) => {
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

  // Тема: тёмная → светлая, честные aria-состояния переключателя.
  const themeToggle = page.locator(".theme-toggle");
  await expect(themeToggle).toHaveAttribute("aria-pressed", "true");
  await themeToggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(themeToggle).toHaveAttribute("aria-pressed", "false");

  // Проект Skill Passport: карта «Следующий результат» с честным прогнозом
  // и указанием недостающего evidence (v1 снапшот).
  const passportCard = page.getByTestId("next-result-card");
  await expect(passportCard).toBeVisible();
  await expect(passportCard).toContainText("API и интеграции");
  await expect(passportCard.getByTestId("next-result-missing")).toContainText("project_submission");
  await expect(passportCard.getByTestId("next-result-forecast")).toContainText("только после проверки evidence");

  // Exact assignment deep link: рабочая область проекта прямо по URL.
  await page.goto(`/workspace/4?project=${ASSIGNMENT_ID}`);
  await expect(page.getByRole("heading", { name: "Проверка прототипа на данных" })).toBeVisible();
  await page.getByRole("button", { name: "Открыть чат команды" }).click();
  await expect(page).toHaveURL(/\/workspace\/10\?participant=project$/);
  await page.goBack();
  await page.getByRole("button", { name: "Загрузить новую версию" }).click();
  await expect(page.getByRole("status")).toContainText("Черновик новой версии подготовлен. Добавьте файлы и отправьте результат.");

  // Проектная карточка: checkpoint-форма личного вклада с клавиатуры.
  await page.goto("/workspace/4");
  const contributionForm = page.locator("form.contribution-form");
  const summaryField = contributionForm.getByLabel("Что сделали лично");
  await summaryField.focus();
  await page.keyboard.type("Собрал прототип и проверил метрику на данных.");
  await contributionForm.getByLabel("Ссылка на доказательство").fill("https://github.com/impulse/project/releases/latest");
  await contributionForm.getByRole("button", { name: "Отправить личный вклад" }).click();
  await expect(page.locator(".contribution-summary").first()).toContainText("Личный вклад · версия 1");

  // Снапшот обновился: вклад отправлен на приёмку, история доказательств
  // в карточке проекта показывает отправленную версию с артефактами.
  await expect(page.getByText("На приёмке").first()).toBeVisible();

  // Изменённая циклограмма и готовность роли на «Моей траектории» (v2: 54→66, 40→66).
  await page.goto("/workspace/1");
  await expect(page.getByTestId("trajectory-percent-python")).toContainText("66%");
  await expect(page.getByTestId("trajectory-card-python")).toContainText("Готовность роли: 66%");
  await page.getByTestId("trajectory-open-detail-python").click();
  await expect(page.getByTestId("trajectory-detail-percent")).toContainText("66%");
  await expect(page.getByTestId("cycle-readiness")).toContainText("66%");

  // Аналитика: документы с credential проекта; публичная проверка + §Печать / PDF.
  await page.goto("/workspace/9");
  const documents = page.getByTestId("document-item");
  await expect(documents.filter({ hasText: "Проверка прототипа на данных" })).toBeVisible();
  await documents.filter({ hasText: "Проверка прототипа на данных" }).getByRole("button", { name: "Проверить" }).click();
  const viewer = page.getByTestId("document-viewer").first();
  await expect(viewer).toContainText("ver-proj-journey-1");
  await viewer.getByTestId("document-pdf").click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printedPdfs: number }).__printedPdfs)).toBeGreaterThanOrEqual(1);
  await viewer.getByRole("link", { name: "Открыть публичную проверку проектного credential" }).click();
  await expect(page).toHaveURL(/\/verify\/projects\/ver-proj-journey-1$/);
  await expect(page.getByRole("heading", { name: "Проверка прототипа на данных" })).toBeVisible();
  await expect(page.getByText(/Прототип проверен данными/)).toBeVisible();

  // Паспорт карты после снапшота v2: недостающий evidence оприходован.
  await page.goto("/");
  await page.goto("/workspace/0");
  await expect(page.getByTestId("next-result-card")).toBeVisible();
  await expect(page.getByTestId("next-result-missing")).toHaveCount(0);

  // Чистота прогресса: сторонних 5xx/404 и необработанных ошибок нет.
  expect(apiFailures, "неожиданные HTTP-ошибки API").toEqual([]);
  expect(consoleErrors, "необработанные ошибки страницы").toEqual([]);
});

test.describe("mobile touch journey: theme, project evidence and readiness in light theme", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("theme, project evidence and readiness in light theme", async ({ page }) => {
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

  const openProjects = async (): Promise<void> => {
    await page.getByRole("button", { name: "Меню", exact: true }).click();
    await expect(page.getByRole("button", { name: "Меню", exact: true })).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("link", { name: "Мои проекты" }).click();
  };

  await openProjects();
  const contributionForm = page.locator("form.contribution-form");
  const summaryField = contributionForm.getByLabel("Что сделали лично");
  await summaryField.tap();
  await page.keyboard.type("Собрал прототип и проверил метрику на данных.");
  await contributionForm.getByLabel("Ссылка на доказательство").fill("https://github.com/impulse/project/releases/latest");
  await contributionForm.getByRole("button", { name: "Отправить личный вклад" }).tap();
  await expect(page.locator(".contribution-summary").first()).toContainText("Личный вклад · версия 1");

  await page.goto("/workspace/1");
  await expect(page.getByTestId("trajectory-percent-python")).toContainText("66%");
  await page.getByTestId("trajectory-open-detail-python").tap();
  await expect(page.getByTestId("cycle-readiness")).toContainText("66%");

  await page.goto("/workspace/9");
  const documents = page.getByTestId("document-item");
  await expect(documents.filter({ hasText: "Проверка прототипа на данных" })).toBeVisible();
  await documents.filter({ hasText: "Проверка прототипа на данных" }).getByRole("button", { name: "Проверить" }).tap();
  await expect(page.getByTestId("document-viewer").first()).toBeVisible();

  expect(consoleErrors, "необработанные ошибки страницы").toEqual([]);
  });
});
