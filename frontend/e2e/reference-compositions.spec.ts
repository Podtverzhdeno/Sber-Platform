import { expect, test, type Page } from "@playwright/test";

// Reference-specific compositions for the remaining R-* flows from
// visual-reference-catalog.md. Partner doc: visual-route-traceability.md.

type Actor = {
  person_id: string;
  display_name: string;
  active_role: string;
  assigned_roles: string[];
  scopes: string[];
  consent_scopes: string[];
  navigation: string[];
  csrf_token: string;
};

const participantNavigation = [
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
];
const mentorNavigation = [
  "Главная",
  "Проверка вкладов",
  "Мои проекты",
  "Участники",
  "Сообщения",
  "Аналитика",
  "AI-помощник",
  "План недели",
];
const managerNavigation = [
  "Главная",
  "Инициативы",
  "Команда",
  "Аналитика",
  "Результаты",
  "Календарь команды",
  "База участников",
  "Настройки",
];
const operatorNavigation = [
  "Главная",
  "Операционная очередь",
  "Проверки",
  "Задачи и проекты",
  "Выплаты",
  "Споры",
  "Пользователи",
  "События и трофеи",
  "Аналитика",
];
const customerNavigation = [
  "Главная",
  "Мои задачи",
  "Создать задачу",
  "Заявки",
  "Аналитика",
  "AI-помощник",
  "База участников",
  "Сообщения",
  "Настройки",
];

const personOf = (role: string): string => `00000000-0000-0000-0000-0000000000${role === "mentor" ? "01" : role === "participant" ? "02" : role === "customer" ? "03" : role === "manager" ? "04" : "05"}`;
const actorOf = (role: string, display: string, navigation: string[]): Actor => ({
  person_id: personOf(role),
  display_name: display,
  active_role: role,
  assigned_roles: [role],
  scopes: [],
  consent_scopes: [],
  navigation,
  csrf_token: "reference-csrf",
});

async function installAuth(page: Page, actor: Actor, options: { key: string; display_name: string; roles: string[]; demoMode?: boolean }): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { honor_board_enabled: false, demo_mode: options.demoMode === true } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: options.key, display_name: options.display_name, roles: options.roles }] }));
  let loggedIn = false;
  await page.route(/\/api\/v1\/me$/, (route) => (loggedIn ? route.fulfill({ json: actor }) : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } })));
  await page.route("**/api/v1/auth/demo-login", async (route) => {
    loggedIn = true;
    await route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/auth/logout", async (route) => {
    loggedIn = false;
    await route.fulfill({ status: 204 });
  });
  await page.route("**/api/v1/me/notifications", (route) => route.fulfill({ json: { items: [], unread: 0 } }));
}

async function openWorkspace(page: Page, key: string): Promise<void> {
  await page.goto("/");
  await page.locator(`[data-persona="${key}"]`).click();
}

const screenshot = (page: Page, reference: string): Promise<void> =>
  expect(page).toHaveScreenshot(`${reference.toLowerCase()}-desktop.png`, {
    animations: "disabled",
    fullPage: true,
    maxDiffPixelRatio: 0.01,
    maxDiffPixels: reference === "R-PAR-01" ? 12_000 : 6_000,
  });

const participantBase = {
  key: "participant-alex",
  display_name: "Алекс Речной",
};

const catalogCards = [
  {
    key: "openspec-sdd",
    title: "OpenSpec и SDD",
    track_keys: ["python"],
    source_url: "https://example.test/courses/openspec",
    access_state: "available",
    access_note: "Доступен в демо без регистрации во внешней LMS.",
    completion_state: "not_started",
    relevant: true,
    relevance_reasons: [
      "Связан с активными направлениями: python.",
      "Закрывает незакрытый пробел: этап маршрута ещё не подтверждён.",
    ],
    recommendation_reason: "Этап «Освоить основу маршрута»: создать базу первой задачи.",
    must_take: {
      skill: "OpenSpec",
      current_level: "базовый",
      target_level: "уверенный",
      projected_impact:
        "Прогноз: курс ведёт к этапу «Освоить основу маршрута» траектории «Python-разработчик». Повышение применяется только после подтверждения checkpoint.",
      explanation:
        "Закрывает пробел навыка «OpenSpec»: сейчас «базовый», целевой уровень «уверенный».",
    },
    pending_verification_note: null,
    verified_evidence: null,
  },
  {
    key: "python-base",
    title: "Python: основа",
    track_keys: ["python"],
    source_url: "https://example.test/courses/python",
    access_state: "unavailable",
    access_note: "Внешний курс пока не подключён; доступна исходная ссылка.",
    completion_state: "reported",
    relevant: true,
    relevance_reasons: ["Связан с активными направлениями: python."],
    recommendation_reason: "Этап «Освоить основу маршрута»: завершение отправлено на проверку.",
    must_take: {
      skill: "OpenSpec",
      current_level: "базовый",
      target_level: "уверенный",
      projected_impact:
        "Прогноз: курс ведёт к этапу «Освоить основу маршрута» траектории «Python-разработчик». Повышение применяется только после подтверждения checkpoint.",
      explanation:
        "Закрывает пробел навыка «OpenSpec»: сейчас «базовый», целевой уровень «уверенный».",
    },
    pending_verification_note:
      "Завершение отправлено на проверку: повторно проходить тот же шаг не нужно, прогноз применится только после подтверждения.",
    verified_evidence: null,
  },
  {
    key: "agent-development",
    title: "Агентная разработка",
    track_keys: ["python"],
    source_url: "https://example.test/courses/agents",
    access_state: "prerequisite_not_met",
    access_note: "Требуется подтверждённый prerequisite: OpenSpec и SDD.",
    completion_state: "not_started",
    relevant: false,
    relevance_reasons: [],
    recommendation_reason: "Общий курс каталога, не привязан к активной траектории.",
    must_take: null,
    pending_verification_note: null,
    verified_evidence: null,
  },
  {
    key: "greenhouse-esg",
    title: "Отчётность ESG",
    track_keys: ["data"],
    source_url: "https://example.test/courses/esg",
    access_state: "available",
    access_note: "",
    completion_state: "verified",
    relevant: false,
    relevance_reasons: [],
    recommendation_reason:
      "Этап «Освоить основу маршрута» подтверждён: доказательство в карточке курсов.",
    must_take: null,
    pending_verification_note: null,
    verified_evidence: "course:greenhouse-esg",
  },
];

interface ParticipantMocks {
  workStatus?: string;
  contributionSummary?: string | null;
}

async function installParticipantData(page: Page, options: ParticipantMocks = {}): Promise<void> {
  const task = { id: "task-market", title: "MVP поиска программ", status: "published", places: 1 };  const terms = {
    version: 2,
    deadline_at: "2026-11-01T18:00:00Z",
    deliverable: "Работающий MVP и отчёт по метрикам.",
    acceptance_criteria: ["MVP воспроизводим", "Метрика описана"],
    support_mode: "buddy",
    compensation: {
      paid: true,
      base_amount_per_assignee: "30000.00",
      currency: "RUB",
      b_multiplier: "1.5",
      a_multiplier: "2.50",
      b_total: "45000.00",
      a_total: "75000.00",
      quantum: "0.01",
      rounding_mode: "half_up",
      policy_version: 1,
      payout_condition: "После принятия личного вклада и публикации оценки человеком.",
    },
  };
  await page.route("**/api/v1/me/growth/next-step", (route) => route.fulfill({
    json: {
      policy_version: 1,
      steps: [
        {
          trajectory_key: "python-dev",
          milestone_key: "m2",
          target_kind: "course",
          target_key: "rag-mvp",
          target_title: "RAG: надёжный поиск по документам",
          position: 2,
          score: 4,
          factors: ["trajectory_gap", "milestone_priority"],
          reasons: ["coverage_inserted"],
          available: true,
          stale_reason: null,
        },
      ],
      next_available: {
        trajectory_key: "python-dev",
        milestone_key: "m2",
        target_kind: "course",
        target_key: "rag-mvp",
        target_title: "RAG: надёжный поиск по документам",
        position: 2,
        score: 4,
        factors: ["trajectory_gap", "milestone_priority"],
        reasons: ["coverage_inserted"],
        available: true,
        stale_reason: null,
      },
      skill: {
        policy_version: 1,
        skill_key: "python",
        title: "Python",
        requested_skill: "Python",
        current_level: "базовый",
        target_level: "уверенный",
        current_known: true,
        counted_sources: ["course:python-base"],
        missing_evidence: ["checkpoint:rag-checkpoint", "project:semantic-search-rd"],
        explanation:
          "Уровень «базовый» подтверждён источниками course:python-base. До целевого уровня «уверенный» нужны источники: checkpoint:rag-checkpoint, project:semantic-search-rd. Выбран шаг «course:rag-mvp (RAG: надёжный поиск по документам)», но он не закрывает недостающие источники — карта не обещает повышение уровня.",
        fallback: null,
      },
    },
  }));
  const buddySuggestionPayload = {
    policy_version: 1,
    ai_model_available: false,
    dismissed: false,
    suggestion: {
      kind: "bootcamp_idle",
      version: 1,
      suggestion_id: "bootcamp_idle:2026-09-20T09:00:00+00:00:2026-10-19",
      generated_at: "2026-10-19T17:55:00+03:00",
      observation:
        "Практика Bootcamp давно не подтверждалась: 29 дн. без проверенного checkpoint.",
      gap: "Навыки траектории «Python-разработчик» растут, пока checkpoint не пройден: портфолио не получает нового подтверждённого результата.",
      action: {
        kind: "checkpoint",
        ref: "checkpoint:rag-mvp",
        title: "Начать checkpoint: RAG: надёжный поиск по документам",
      },
      benefit:
        "Проверочный checkpoint даёт подтверждённый результат и закрывает недостающий источник в Skill Passport.",
      source_categories: ["checkpoint", "course", "skill_evidence"],
      explanation:
        "Автоматический анализ разрешённых данных: дата последнего verified course-checkpoint из Bootcamp-сертификатов и целевой шаг активной траектории. Модель не вызывается; сегменты без лишних деталей.",
      idle_days: 29,
      model_called: false,
      auto_enrolled: false,
    },
  };
  let buddyDismissed = false;
  await page.route("**/api/v1/agents/buddy/suggestion", (route) => route.fulfill({
    json: buddyDismissed
      ? { ...buddySuggestionPayload, dismissed: true, suggestion: null }
      : buddySuggestionPayload,
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
            { skill_key: "Python", title: "Python", current_level: "базовый", known: true },
          ],
          readiness: { percent: 50, coverage: 1, partial: false },
          object_refs: [],
          next_step_ref: "course:python-base",
        },
      ],
    },
  }));
  await page.route("**/api/v1/development/tracks", (route) => route.fulfill({
    json: {
      active_count: 1,
      max_active: 2,
      tracks: [
        { key: "python-dev", title: "Python-разработчик", status: "active", completed_milestones: ["m1"] },
        { key: "analyst", title: "Аналитик данных", status: null, completed_milestones: [] },
      ],
    },
  }));
  await page.route("**/api/v1/me/roadmaps", (route) => route.fulfill({
    json: [
      {
        track_key: "python-dev",
        policy_version: 2,
        replacement_reason: null,
        milestones: [
          { key: "m1", position: 1, title: "Курс Python для анализа данных", purpose: "Основа для первого вклада", skill: "Python", target_kind: "course", target_key: "python-base", completed: true },
        ],
        next_step: { key: "m2", position: 2, title: "Практика в рабочем окружении", purpose: "Артефакт в рабочем репозитории", skill: "Python", target_kind: "course", target_key: "python-base", completed: false },
      },
    ],
  }));
  await page.route("**/api/v1/me/trajectory-map", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/development/courses", (route) => route.fulfill({
    json: [
      { key: "python-base", title: "Основы Python для анализа данных", track_keys: ["python-dev"], recommendation_reason: "Подготовка к первому принятому вкладу.", source_url: "https://education.sber.ru/python-base", availability: "Открыт", access_note: "Доступен по подписке Impulse.", completion_status: "active", rating_eligible: true },
      { key: "rag-mvp", title: "RAG: надёжный поиск по документам", track_keys: ["python-dev"], recommendation_reason: "Связан с текущим MVP проекта.", source_url: "https://education.sber.ru/rag", availability: "Открыт", access_note: "Практикум в среде платформы.", completion_status: null, rating_eligible: true },
    ],
  }));
  await page.route(/\/api\/v1\/me\/courses\/[^/]+\/detail$/, (route) => route.fulfill({
    json: {
      course_key: "python-base",
      title: "Основы Python для анализа данных",
      source_url: "https://education.sber.ru/python-base",
      availability: "Открыт",
      access_note: "Доступен по подписке Impulse.",
      enrollment_status: "active",
      verified: false,
      specialization: "Python / Data / ML",
      program_version: "2.0.0",
      workload_hours: 40,
      program_competencies: [["Работа с табличными данными", "базовый", "Итоговое задание курса"]],
      objective: "Собрать базу для первого вклада в реальный проект команды.",
      milestone_title: "Курс Python для анализа данных",
      next_step: "Практика в рабочем окружении",
      artifact: "Ноутбук с подтверждённым исследованием",
      cycle: [{ competency: "Работа с табличными данными", current_level: "не подтверждено", projected_level: "базовый", target_level: "базовый", projected_confirmed: false, evidence: "Итоговое задание курса" }],
    },
  }));
  await page.route("**/api/v1/me/learning/streak", (route) => route.fulfill({ json: { current_days: 3, qualified_dates: ["2026-10-16", "2026-10-17", "2026-10-18"], reason: "Учебная активность подтверждена." } }));
  await page.route("**/api/v1/me/competency-evidence", (route) => route.fulfill({
    json: [
      { competency_key: "python", counted: true, level: "P2", observed_at: "2026-10-18T12:00:00+03:00", reason: "Вклад версии 2 принят заказчиком: отбор стал воспроизводимым", source_kind: "contribution", source_ref: "contribution-1" },
      { competency_key: "rag", counted: false, level: "P1", observed_at: "2026-10-17T14:00:00+03:00", reason: "Checkpoint не совпал с активным портфелем навыков", source_kind: "checkpoint", source_ref: "checkpoint-rag-global" },
    ],
  }));
  await page.route("**/api/v1/me/bootcamp/certificates", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/bootcamp/catalog", (route) => route.fulfill({ json: catalogCards }));
  await page.route("**/api/v1/marketplace/tasks", (route) => route.fulfill({ json: [{ task, terms, accepted_terms_version: 2 }] }));
  await page.route("**/api/v1/me/work", (route) => route.fulfill({
    json: [
      {
        assignment: { id: "assignment-1", task_id: task.id, person_id: personOf("participant"), application_id: "application-1", status: options.workStatus ?? "in_progress" },
        task,
        terms,
        contributions: options.contributionSummary ? [{ id: "contribution-1", version: 1, personal_summary: options.contributionSummary, artifact_keys: ["personal-proof"], status: "submitted" }] : [],
        decisions: [],
      },
    ],
  }));
  await page.route("**/api/v1/me/tasks/task-market", (route) => route.fulfill({
    json: {
      task,
      problem: "Научные библиотеки не агрегированы: участникам нужен MVP поиска.",
      deliverable: terms.deliverable,
      acceptance_criteria: terms.acceptance_criteria,
      deadline_at: terms.deadline_at,
      data_constraints: "Только синтетические демонстрационные данные.",
      ip_terms: "Авторство сохраняется в портфолио участника.",
      terms,
      terms_history: [{ version: 1, deadline_at: "2026-10-01T18:00:00Z", deliverable: "Черновик MVP и заметки." }],
      accepted_terms_version: 2,
      invitation_status: null,
      customer: { id: "customer-1", display_name: "Роман Воронов" },
      mentor: { id: personOf("mentor"), display_name: "Елена Наставник" },
      support: { mode: "buddy", assignee: { id: personOf("mentor"), display_name: "Елена Наставник" } },
      team: [{ person_id: personOf("participant"), display_name: "Алекс Речной", status: "in_progress" }],
      membership: { id: "assignment-1", task_id: task.id, person_id: personOf("participant"), status: "in_progress" },
      checkpoints: [{ key: "cp-1", title: "Зачем нужен навык", status: "completed" }],
      personal: options.contributionSummary ? [{ id: "contribution-1", assignment_id: "assignment-1", version: 1, personal_summary: options.contributionSummary, artifact_keys: ["personal-proof"], status: "submitted" }] : [],
      feedback: [],
    },
  }));
  await page.route("**/api/v1/me/portfolio", (route) => route.fulfill({
    json: {
      person_id: personOf("participant"),
      display_name: "Алекс Речной",
      demo_data: false,
      contributions: [
        { contribution_id: "c-1", project_title: "Прототип рекомендательной системы", personal_summary: "Разработал ранжирование и воспроизводимый benchmark.", artifact_keys: ["repository", "evaluation-report.pdf"], grade: "A", review_reason: "Качество выше критериев, воспроизводимо.", verification_status: "verified" },
        { contribution_id: "c-2", project_title: "Прогнозирование нагрузки контактного центра", personal_summary: "Подготовил признаки и baseline-модель.", artifact_keys: ["notebook"], grade: "B", review_reason: "Целевые метрики достигнуты.", verification_status: "verified" },
      ],
      courses: [{ key: "openspec", title: "OpenSpec и SDD", status: "verified" }],
      credentials: [{ verification_id: "COURSE-OS-2026-0142", title: "OpenSpec и SDD", status: "Проверяемый", credential_type: "course", issuer: "Impulse Bootcamp" }],
      trophies: [{ title: "Победитель МАЯКИ", organizer: "Сбер", source_url: "https://developer.sber.ru/mayaki", trophy_type: "hackathon" }],
      offers: [],
      visibility: { hr_profile: true, public_profile: true, public_trophies: true },
    },
  }));
  await page.route("**/api/v1/me/talent-passport", (route) => route.fulfill({
    json: {
      verified_courses: ["python-base"],
      skills: [{ key: "python", practical_level: "confirmed", confirmed_case_count: 2 }],
      cases: [{ contribution_id: "c-1", submitted_at: "2026-10-01T09:00:00Z", reviewer_id: "customer-1" }],
    },
  }));
  await page.route("**/api/v1/me/project-credentials", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/profile", (route) => route.fulfill({
    json: {
      person_id: personOf("participant"),
      display_name: "Алекс Речной",
      city: "Москва",
      university: "МФТИ",
      study_year: "3 курс",
      primary_track: "Python-разработчик",
      email: "alex@example.com",
      telegram: "@alex",
      about: "Расту в ML-разработку.",
      avatar_url: "",
      locale: "ru-RU",
      theme: "dark",
      timezone: "Europe/Moscow",
      buddy_enabled: true,
      skills: [{ title: "Python", origin: "verified_course", verified: true }],
    },
  }));
  await page.route("**/api/v1/me/visibility", (route) => route.fulfill({ json: { visibility: {} } }));
}

interface ChannelFixtures {
  channels: {
    id: string;
    kind: string;
    title: string;
    role: string;
    task_id?: string;
  }[];
  messages: Record<string, { author: string; text: string }[]>;
}

const messagingFixtures: Record<string, ChannelFixtures> = {
  participant: {
    channels: [
      { id: "channel-project", kind: "task_team", title: "Рекомендательная система", role: "member", task_id: "task-market" },
      { id: "channel-mentor", kind: "personal", title: "Елена Наставник", role: "mentor" },
    ],
    messages: {
      "channel-project": [{ author: "Елена Наставник", text: "Дедлайн по интеграции API — в пятницу. Успеете?" }],
      "channel-mentor": [{ author: "Елена Наставник", text: "Прочитайте checkpoint 3, потом разберём вопросы." }],
    },
  },
  mentor: {
    channels: [
      { id: "channel-project", kind: "task_team", title: "Рекомендательная система", role: "mentor", task_id: "task-market" },
      { id: "channel-mentor", kind: "personal", title: "Алекс Речной", role: "member" },
    ],
    messages: {
      "channel-project": [{ author: "Алекс Речной", text: "Отправил первую версию решения в рабочую область." }],
      "channel-mentor": [{ author: "Алекс Речной", text: "Спасибо, начну checkpoint 3 сегодня." }],
    },
  },
  customer: {
    channels: [
      { id: "channel-project", kind: "task_team", title: "Рекомендательная система", role: "customer", task_id: "task-market" },
      { id: "channel-mentor", kind: "customer", title: "Елена Наставник", role: "mentor" },
    ],
    messages: {
      "channel-project": [{ author: "Елена Наставник", text: "Результат доступен на приёмке; посмотрите evidence." }],
      "channel-mentor": [{ author: "Елена Наставник", text: "Обновил rubric и checklist проекта." }],
    },
  },
};

async function installMessaging(page: Page, role: string): Promise<void> {
  const fixture = messagingFixtures[role];
  const messages: Record<string, { id: string; author_id: string | null; author_name: string | null; kind: string; body: string; artifact_refs: string[]; sequence: number; created_at: string }[]> = {};
  for (const channel of fixture.channels) {
    messages[channel.id] = (fixture.messages[channel.id] ?? []).map((message, index) => ({
      id: `message-${String(index + 1)}`,
      author_id: message.author === "Алекс Речной" ? personOf("participant") : message.author === "Елена Наставник" ? personOf("mentor") : personOf("customer"),
      author_name: message.author,
      kind: "text",
      body: message.text,
      artifact_refs: [],
      sequence: index + 1,
      created_at: `2026-10-0${String(Math.min(8, index + 1))}T09:30:00Z`,
    }));
  }
  await page.route("**/api/v1/me/messaging/channels", (route) => route.fulfill({
    json: fixture.channels.map((channel) => ({
      id: channel.id,
      kind: channel.kind,
      title: channel.title,
      status: "active",
      task_id: channel.task_id ?? null,
      role: channel.role,
      muted: false,
      sender_enabled: true,
      unread: 0,
      participants: [
        { id: personOf("participant"), display_name: "Алекс Речной", role: "member" },
        { id: personOf("mentor"), display_name: "Елена Наставник", role: "mentor" },
        { id: personOf("customer"), display_name: "Роман Воронов", role: "customer" },
      ],
      last_message: messages[channel.id].at(-1) ?? null,
      created_at: "2026-10-01T09:00:00Z",
    })),
  }));
  await page.route("**/api/v1/me/messaging/channels/*/messages", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { body: string };
      const url = route.request().url();
      const channelId = url.split("/").at(-2) ?? "channel-project";
      const created = {
        id: `message-${String(messages[channelId].length + 1)}`,
        author_id: personOf(role),
        author_name: role === "customer" ? "Роман Воронов" : role === "mentor" ? "Елена Наставник" : "Алекс Речной",
        kind: "text",
        body: body.body,
        artifact_refs: [],
        sequence: messages[channelId].length + 1,
        created_at: new Date().toISOString(),
      };
      messages[channelId] = [...messages[channelId], created];
      await route.fulfill({ json: created });
      return;
    }
    const url = route.request().url();
    const channelId = url.split("/").at(-2) ?? "channel-project";
    await route.fulfill({ json: messages[channelId] ?? [] });
  });
  await page.route("**/api/v1/me/messaging/channels/*/context", (route) => route.fulfill({
    json: {
      project_key: "impulse-demo",
      task_title: "MVP поиска программ",
      deadline_at: "2026-11-01T18:00:00Z",
      contribution_version: null,
      contribution_accepted: null,
      review_status: null,
    },
  }));
}

async function installAnalytics(page: Page, role: string): Promise<void> {
  const metric = (key: string, label: string, unit: string, value: string | null, numerator: number, denominator: number) => ({
    key,
    label,
    unit,
    value,
    numerator,
    denominator,
    period_start: "2026-09-18T00:00:00Z",
    period_end: "2026-10-18T00:00:00Z",
    cohort: `impulse-demo:${role}:30d`,
    freshness: "fresh",
    definition: "Проверяемая формула периода 30 дней.",
    suppressed: false,
    suppression_reason: null,
  });
  await page.route("**/api/v1/analytics/role", (route) => route.fulfill({
    json: {
      role,
      metrics: role === "operator"
        ? [
            metric("operator_sla_median_hours", "Медиана SLA очереди", "hours", "18.0", 18, 1),
            metric("operator_overdue_share", "Доля просроченных дел", "percent", "12.50", 2, 16),
            metric("operator_disputes_share", "Споры в обработке", "percent", "6.25", 1, 16),
            metric("operator_verified_results", "Подтверждено результатов", "count", "24", 24, 1),
          ]
        : [metric(`${role}_metric`, "Проверяемый показатель", "count", "3", 3, 1)],
    },
  }));
}

test("R-PAR-01 dashboard composition and action", async ({ page }) => {
  const actor = actorOf("participant", participantBase.display_name, participantNavigation);
  await installAuth(page, actor, { key: participantBase.key, display_name: participantBase.display_name, roles: ["participant"] });
  await installParticipantData(page);
  await openWorkspace(page, participantBase.key);
  await expect(page.locator('[data-reference="R-PAR-01"]')).toBeVisible();
  await screenshot(page, "R-PAR-01");
  // openspec 22.26: the card starts user-initiated; advice only after activation
  await page.getByTestId("buddy-suggestion-activate").click();
  await expect(page.getByTestId("buddy-suggestion-kind")).toBeVisible();
  await page.getByTestId("buddy-suggestion-why").locator("summary").click();
  await expect(page.getByTestId("buddy-suggestion-explanation")).toBeVisible();
  await page.getByTestId("buddy-suggestion-dismiss").click();
  await expect(page.getByTestId("buddy-suggestion-dismissed")).toBeVisible();
});

test("R-PAR-02 journey composition and mentor consultation", async ({ page }) => {
  const actor = actorOf("participant", participantBase.display_name, participantNavigation);
  await installAuth(page, actor, { key: participantBase.key, display_name: participantBase.display_name, roles: ["participant"] });
  await installParticipantData(page);
  await openWorkspace(page, participantBase.key);
  await page.getByRole("link", { name: "Моя траектория", exact: true }).click();
  await expect(page.locator('[data-reference="R-PAR-02"]')).toBeVisible();
  await screenshot(page, "R-PAR-02");
  await page.getByRole("button", { name: "Получить рекомендацию ментора" }).click();
  await expect(page.getByRole("button", { name: "Отправить запрос" })).toBeVisible();
  await page.getByRole("button", { name: "Отправить запрос" }).click();
  await expect(page.getByText("Запрос отправлен")).toBeVisible();
  await page.getByRole("button", { name: "Продолжить самостоятельно" }).click();
  await expect(page.getByRole("button", { name: "Отправить запрос" })).toHaveCount(0);
});

test("R-PAR-03 bootcamp course detail and return", async ({ page }) => {
  const actor = actorOf("participant", participantBase.display_name, participantNavigation);
  await installAuth(page, actor, { key: participantBase.key, display_name: participantBase.display_name, roles: ["participant"] });
  await installParticipantData(page);
  await page.goto("/workspace/2?course=python-base");
  await page.locator(`[data-persona="${participantBase.key}"]`).click();
  await expect(page.locator('[data-reference="R-PAR-03"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Основы Python для анализа данных" })).toBeVisible();
  await screenshot(page, "R-PAR-03");
  await page.getByRole("button", { name: "← Вернуться в Bootcamp" }).click();
  await expect(page.getByRole("heading", { name: "Учитесь ради следующего результата" })).toBeVisible();
});

test("R-PAR-04 task catalog filter", async ({ page }) => {
  const actor = actorOf("participant", participantBase.display_name, participantNavigation);
  await installAuth(page, actor, { key: participantBase.key, display_name: participantBase.display_name, roles: ["participant"] });
  await installParticipantData(page);
  await openWorkspace(page, participantBase.key);
  await page.getByRole("link", { name: "Задачи", exact: true }).click();
  await expect(page.locator('[data-reference="R-PAR-04"]')).toBeVisible();
  await page.getByRole("group", { name: "Категория задач" }).getByRole("button", { name: "ML / AI" }).click();
  await expect(page.getByRole("group", { name: "Категория задач" }).getByRole("button", { name: "ML / AI" })).toHaveAttribute("aria-pressed", "true");
  await screenshot(page, "R-PAR-04");
});

test("R-PAR-05 task card preview", async ({ page }) => {
  const actor = actorOf("participant", participantBase.display_name, participantNavigation);
  await installAuth(page, actor, { key: participantBase.key, display_name: participantBase.display_name, roles: ["participant"] });
  await installParticipantData(page);
  await openWorkspace(page, participantBase.key);
  await page.getByRole("link", { name: "Задачи", exact: true }).click();
  await page.getByRole("button", { name: "Открыть карточку" }).click();
  const preview = page.locator('[data-reference="R-PAR-05"]');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("Научные библиотеки не агрегированы");
  await expect(preview).toHaveScreenshot("r-par-05-desktop.png", { animations: "disabled", maxDiffPixelRatio: 0.01 });
});

test("R-PAR-06 projects composition and workspace", async ({ page }) => {
  const actor = actorOf("participant", participantBase.display_name, participantNavigation);
  await installAuth(page, actor, { key: participantBase.key, display_name: participantBase.display_name, roles: ["participant"] });
  await installParticipantData(page);
  await openWorkspace(page, participantBase.key);
  await page.getByRole("link", { name: "Мои проекты", exact: true }).click();
  await expect(page.locator('[data-reference="R-PAR-06"]')).toBeVisible();
  await screenshot(page, "R-PAR-06");
  await page.getByRole("button", { name: "Открыть проект →" }).click();
  await page.getByRole("button", { name: "Открыть рабочую область →" }).click();
  await expect(page.getByRole("heading", { name: "MVP поиска программ" })).toBeVisible();
  await expect(page.getByText("Загрузить решение")).toBeVisible();
});

test("R-PAR-07 participant messaging send", async ({ page }) => {
  const actor = actorOf("participant", participantBase.display_name, participantNavigation);
  await installAuth(page, actor, { key: participantBase.key, display_name: participantBase.display_name, roles: ["participant"] });
  await installParticipantData(page);
  await installMessaging(page, "participant");
  await openWorkspace(page, participantBase.key);
  await page.getByRole("link", { name: "Сообщения", exact: true }).click();
  await expect(page.locator('[data-reference="R-PAR-07"]')).toBeVisible();
  await page.getByTestId("composer-textarea").fill("Принял правки по чеклисту, обновляю артефакт.");
  await page.getByTestId("composer-send").click();
  await expect(page.locator(".msg-chat__rows").getByText("Принял правки по чеклисту, обновляю артефакт.", { exact: true })).toBeVisible();
  await screenshot(page, "R-PAR-07");
});

test("R-PAR-08 portfolio composition and case dialog", async ({ page }) => {
  const actor = actorOf("participant", participantBase.display_name, participantNavigation);
  await installAuth(page, actor, { key: participantBase.key, display_name: participantBase.display_name, roles: ["participant"] });
  await installParticipantData(page);
  await openWorkspace(page, participantBase.key);
  await page.getByRole("link", { name: "Портфолио", exact: true }).click();
  await expect(page.locator('[data-reference="R-PAR-08"]')).toBeVisible();
  await screenshot(page, "R-PAR-08");
  await page.getByRole("button", { name: "Открыть кейс" }).first().click();
  await expect(page.getByRole("dialog", { name: "Карточка принятого вклада" })).toBeVisible();
  await page.getByRole("button", { name: "Закрыть" }).click();
  await expect(page.getByRole("dialog", { name: "Карточка принятого вклада" })).toHaveCount(0);
});

test("R-PAR-10 achievements filter", async ({ page }) => {
  const actor = actorOf("participant", participantBase.display_name, participantNavigation);
  await installAuth(page, actor, { key: participantBase.key, display_name: participantBase.display_name, roles: ["participant"] });
  await installParticipantData(page);
  await openWorkspace(page, participantBase.key);
  await page.getByRole("link", { name: "Достижения", exact: true }).click();
  await expect(page.locator('[data-reference="R-PAR-10"]')).toBeVisible();
  await page.getByRole("button", { name: "Трофей", exact: true }).click();
  const list = page.locator(".achievement-list");
  await expect(list).toContainText("Победитель МАЯКИ 2025");
  await expect(list).not.toContainText("Рекомендательная система");
  await screenshot(page, "R-PAR-10");
});

test("R-PAR-11 buddy quick prompt and send", async ({ page }) => {
  const actor = actorOf("participant", participantBase.display_name, participantNavigation);
  await installAuth(page, actor, { key: participantBase.key, display_name: participantBase.display_name, roles: ["participant"] });
  await installParticipantData(page);
  await openWorkspace(page, participantBase.key);
  await page.getByRole("link", { name: "AI-Buddy", exact: true }).click();
  await expect(page.locator('[data-reference="R-PAR-11"]')).toBeVisible();
  await page.getByRole("button", { name: "Подбери курс", exact: true }).click();
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByText("Сейчас лучше завершить checkpoint по API")).toBeVisible();
  await screenshot(page, "R-PAR-11");
});

test("R-PAR-12 settings tabs", async ({ page }) => {
  const actor = actorOf("participant", participantBase.display_name, participantNavigation);
  await installAuth(page, actor, { key: participantBase.key, display_name: participantBase.display_name, roles: ["participant"] });
  await installParticipantData(page);
  await openWorkspace(page, participantBase.key);
  await page.getByRole("link", { name: "Настройки", exact: true }).click();
  await expect(page.locator('[data-reference="R-PAR-12"]')).toBeVisible();
  await screenshot(page, "R-PAR-12");
  await page.getByRole("navigation", { name: "Разделы настроек" }).getByRole("button", { name: "Безопасность" }).click();
  await expect(page.getByRole("heading", { name: "Конфиденциальность и безопасность" })).toBeVisible();
});

test("R-MEN-01 mentor dashboard composition and assistant", async ({ page }) => {
  const actor = actorOf("mentor", "Елена Наставник", mentorNavigation);
  await installAuth(page, actor, { key: "mentor-elena", display_name: actor.display_name, roles: ["mentor"] });
  await openWorkspace(page, "mentor-elena");
  await expect(page.locator('[data-reference="R-MEN-01"]')).toBeVisible();
  await screenshot(page, "R-MEN-01");
  await page.getByRole("button", { name: /Открыть AI-помощник/ }).click();
  await expect(page.locator('[data-reference="R-MEN-07"]')).toBeVisible();
});

test("R-MEN-03 projects search", async ({ page }) => {
  const actor = actorOf("mentor", "Елена Наставник", mentorNavigation);
  await installAuth(page, actor, { key: "mentor-elena", display_name: actor.display_name, roles: ["mentor"] });
  await openWorkspace(page, "mentor-elena");
  await page.getByRole("link", { name: "Мои проекты", exact: true }).click();
  await expect(page.locator('[data-reference="R-MEN-03"]')).toBeVisible();
  await page.getByLabel("Поиск проекта").fill("Сжатие");
  const master = page.locator(".mentor-master");
  await expect(master).toContainText("Сжатие изображений");
  await expect(master).not.toContainText("Рекомендательная система");
  await screenshot(page, "R-MEN-03");
});

test("R-MEN-04 participants search and selection", async ({ page }) => {
  const actor = actorOf("mentor", "Елена Наставник", mentorNavigation);
  await installAuth(page, actor, { key: "mentor-elena", display_name: actor.display_name, roles: ["mentor"] });
  await openWorkspace(page, "mentor-elena");
  await page.getByRole("link", { name: "Участники", exact: true }).click();
  await expect(page.locator('[data-reference="R-MEN-04"]')).toBeVisible();
  await page.getByLabel("Поиск участника").fill("Алекс");
  const master = page.locator(".mentor-master");
  await expect(master).toContainText("Алекс Речной");
  await expect(master).not.toContainText("Анна Смирнова");
  await master.getByRole("button", { name: /Алекс Речной/ }).click();
  await expect(master.locator("button.active", { hasText: "Алекс Речной" })).toBeVisible();
  await screenshot(page, "R-MEN-04");
});

test("R-MEN-05 mentor messaging send", async ({ page }) => {
  const actor = actorOf("mentor", "Елена Наставник", mentorNavigation);
  await installAuth(page, actor, { key: "mentor-elena", display_name: actor.display_name, roles: ["mentor"] });
  await installMessaging(page, "mentor");
  await openWorkspace(page, "mentor-elena");
  await page.getByRole("link", { name: "Сообщения", exact: true }).click();
  await expect(page.locator('[data-reference="R-MEN-05"]')).toBeVisible();
  await page.getByTestId("composer-textarea").fill("Проверил evidence, отправляю rubric-комментарий.");
  await page.getByTestId("composer-send").click();
  await expect(page.locator(".msg-chat__rows").getByText("Проверил evidence, отправляю rubric-комментарий.", { exact: true })).toBeVisible();
  await screenshot(page, "R-MEN-05");
});

test("R-MEN-06 analytics period control", async ({ page }) => {
  const actor = actorOf("mentor", "Елена Наставник", mentorNavigation);
  await installAuth(page, actor, { key: "mentor-elena", display_name: actor.display_name, roles: ["mentor"] });
  await openWorkspace(page, "mentor-elena");
  await page.getByRole("link", { name: "Аналитика", exact: true }).click();
  await expect(page.locator('[data-reference="R-MEN-06"]')).toBeVisible();
  await page.getByLabel("Период").selectOption("7 дней");
  await expect(page.getByLabel("Период")).toHaveValue("7 дней");
  await screenshot(page, "R-MEN-06");
});

test("R-MEN-07 assistant scenario switch", async ({ page }) => {
  const actor = actorOf("mentor", "Елена Наставник", mentorNavigation);
  await installAuth(page, actor, { key: "mentor-elena", display_name: actor.display_name, roles: ["mentor"] });
  await openWorkspace(page, "mentor-elena");
  await page.getByRole("link", { name: "AI-помощник", exact: true }).click();
  await expect(page.locator('[data-reference="R-MEN-07"]')).toBeVisible();
  await page.locator(".assistant-scenarios").getByRole("button", { name: /Сравни версии/ }).click();
  await expect(page.locator(".assistant-scenarios").getByRole("button", { name: /Сравни версии/ })).toHaveClass(/active/);
  await screenshot(page, "R-MEN-07");
});

test("R-MEN-08 week plan view toggle", async ({ page }) => {
  const actor = actorOf("mentor", "Елена Наставник", mentorNavigation);
  await installAuth(page, actor, { key: "mentor-elena", display_name: actor.display_name, roles: ["mentor"] });
  await openWorkspace(page, "mentor-elena");
  await page.getByRole("link", { name: "План недели", exact: true }).click();
  await expect(page.locator('[data-reference="R-MEN-08"]')).toBeVisible();
  await expect(page.getByText("Неделя: 28 сентября — 4 октября")).toBeVisible();
  await screenshot(page, "R-MEN-08");
  await page.locator(".view-toggle").getByRole("button", { name: "День", exact: true }).click();
  await expect(page.getByText(/День: 28 сентября/)).toBeVisible();
});

test("R-MGR-05 manager results and csv export", async ({ page }) => {
  const actor = actorOf("manager", "Ольга Руководитель", managerNavigation);
  await installAuth(page, actor, { key: "manager-olga", display_name: actor.display_name, roles: ["manager"] });
  await page.route("**/api/v1/manager/overview", (route) => route.fulfill({ json: { initiatives: [], task_count: 0, accepted_result_count: 0, reused_result_count: 0 } }));
  await openWorkspace(page, "manager-olga");
  await page.getByRole("link", { name: "Результаты", exact: true }).click();
  await expect(page.locator('[data-reference="R-MGR-05"]')).toBeVisible();
  await expect(page.locator(".demo-data-chip")).toBeVisible();
  await screenshot(page, "R-MGR-05");
  await page.getByRole("button", { name: "Экспортировать отчёт" }).click();
  await expect(page.getByRole("status")).toContainText("Отчёт по инициативам выгружен в CSV.");
});

test("R-CUS-01 customer home to create", async ({ page }) => {
  const actor = actorOf("customer", "Роман Воронов", customerNavigation);
  await installAuth(page, actor, { key: "customer-roman", display_name: actor.display_name, roles: ["customer"], demoMode: true });
  await openWorkspace(page, "customer-roman");
  await expect(page.locator('[data-reference="R-CUS-01"]')).toBeVisible();
  await screenshot(page, "R-CUS-01");
  await page.getByRole("button", { name: "Создать задачу" }).first().click();
  await expect(page.locator('[data-reference="R-CUS-03"]')).toBeVisible();
});

test("R-CUS-02 customer task portfolio filter", async ({ page }) => {
  const actor = actorOf("customer", "Роман Воронов", customerNavigation);
  await installAuth(page, actor, { key: "customer-roman", display_name: actor.display_name, roles: ["customer"], demoMode: true });
  await openWorkspace(page, "customer-roman");
  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "Мои задачи", exact: true }).click();
  await expect(page.locator('[data-reference="R-CUS-02"]')).toBeVisible();
  await page.getByRole("group", { name: "Статусы задач" }).getByRole("button", { name: "На проверке" }).click();
  await expect(page.getByRole("group", { name: "Статусы задач" }).getByRole("button", { name: "На проверке" })).toHaveAttribute("aria-pressed", "true");
  await screenshot(page, "R-CUS-02");
});

test("R-CUS-03 create task stepper", async ({ page }) => {
  const actor = actorOf("customer", "Роман Воронов", customerNavigation);
  await installAuth(page, actor, { key: "customer-roman", display_name: actor.display_name, roles: ["customer"], demoMode: true });
  await openWorkspace(page, "customer-roman");
  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "Создать задачу", exact: true }).click();
  await expect(page.locator('[data-reference="R-CUS-03"]')).toBeVisible();
  await expect(page.getByText("Шаг 1 из 5")).toBeVisible();
  await page.getByRole("button", { name: "Продолжить" }).click();
  await expect(page.getByText("Шаг 2 из 5")).toBeVisible();
  await screenshot(page, "R-CUS-03");
});

test("R-CUS-04 applications search", async ({ page }) => {
  const actor = actorOf("customer", "Роман Воронов", customerNavigation);
  await installAuth(page, actor, { key: "customer-roman", display_name: actor.display_name, roles: ["customer"], demoMode: true });
  await openWorkspace(page, "customer-roman");
  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "Заявки", exact: true }).click();
  await expect(page.locator('[data-reference="R-CUS-04"]')).toBeVisible();
  await page.getByLabel("Направление").selectOption("AI / ML");
  await expect(page.getByLabel("Направление")).toHaveValue("AI / ML");
  await expect(page.getByText(/^[1-9][0-9]* заявок показано$/)).toBeVisible();
  await screenshot(page, "R-CUS-04");
});

test("R-CUS-05 task detail acceptance", async ({ page }) => {
  const actor = actorOf("customer", "Роман Воронов", customerNavigation);
  await installAuth(page, actor, { key: "customer-roman", display_name: actor.display_name, roles: ["customer"], demoMode: true });
  await openWorkspace(page, "customer-roman");
  await page.goto("/workspace/1?task=acceptance-1&result=open");
  await expect(page.locator('[data-reference="R-CUS-05"]')).toBeVisible();
  await screenshot(page, "R-CUS-05");
  await page.getByRole("button", { name: "Ответить" }).click();
  await expect(page).toHaveURL(/workspace\/7\?task=/);
  await expect(page.locator('[data-reference="R-CUS-09"]')).toBeVisible();
});

test("R-CUS-06 analytics period control", async ({ page }) => {
  const actor = actorOf("customer", "Роман Воронов", customerNavigation);
  await installAuth(page, actor, { key: "customer-roman", display_name: actor.display_name, roles: ["customer"], demoMode: true });
  await openWorkspace(page, "customer-roman");
  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "Аналитика", exact: true }).click();
  await expect(page.locator('[data-reference="R-CUS-06"]')).toBeVisible();
  await page.locator(".cta-period").click();
  await expect(page.locator(".cta-period")).toContainText("Последние 30 дней");
  await screenshot(page, "R-CUS-06");
});

test("R-CUS-07 assistant prompt", async ({ page }) => {
  const actor = actorOf("customer", "Роман Воронов", customerNavigation);
  await installAuth(page, actor, { key: "customer-roman", display_name: actor.display_name, roles: ["customer"], demoMode: true });
  await openWorkspace(page, "customer-roman");
  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "AI-помощник", exact: true }).click();
  await expect(page.locator('[data-reference="R-CUS-07"]')).toBeVisible();
  await page.getByRole("button", { name: "Оценить риски", exact: true }).click();
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByText("Подготовил рекомендацию по задаче")).toBeVisible();
  await screenshot(page, "R-CUS-07");
});

test("R-CUS-08 talent database filter", async ({ page }) => {
  const actor = actorOf("customer", "Роман Воронов", customerNavigation);
  await installAuth(page, actor, { key: "customer-roman", display_name: actor.display_name, roles: ["customer"], demoMode: true });
  await openWorkspace(page, "customer-roman");
  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "База участников", exact: true }).click();
  await expect(page.locator('[data-reference="R-CUS-08"]')).toBeVisible();
  await page.getByRole("group", { name: "Фильтр участников" }).getByRole("button", { name: "Match от 70%" }).click();
  await expect(page.getByRole("group", { name: "Фильтр участников" }).getByRole("button", { name: "Match от 70%" })).toHaveAttribute("aria-pressed", "true");
  await screenshot(page, "R-CUS-08");
});

test("R-CUS-09 customer messaging send", async ({ page }) => {
  const actor = actorOf("customer", "Роман Воронов", customerNavigation);
  await installAuth(page, actor, { key: "customer-roman", display_name: actor.display_name, roles: ["customer"], demoMode: true });
  await installMessaging(page, "customer");
  await openWorkspace(page, "customer-roman");
  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "Сообщения", exact: true }).click();
  await expect(page.locator('[data-reference="R-CUS-09"]')).toBeVisible();
  await page.getByTestId("composer-textarea").fill("Принял результат, остаётся финальный артефакт.");
  await page.getByTestId("composer-send").click();
  await expect(page.locator(".msg-chat__rows").getByText("Принял результат, остаётся финальный артефакт.", { exact: true })).toBeVisible();
  await screenshot(page, "R-CUS-09");
});

test("R-OPS-03 evidence checks filter", async ({ page }) => {
  const actor = actorOf("operator", "Павел Оператор", operatorNavigation);
  await installAuth(page, actor, { key: "operator-pavel", display_name: actor.display_name, roles: ["operator"] });
  await page.route("**/api/v1/ops/cases", (route) => route.fulfill({ json: [] }));
  await openWorkspace(page, "operator-pavel");
  await page.getByRole("link", { name: "Проверки", exact: true }).click();
  await expect(page.locator('[data-reference="R-OPS-03"]')).toBeVisible();
  await page.getByRole("button", { name: "Приоритетные" }).click();
  await page.locator("button.active", { hasText: "Приоритетные" }).waitFor();
  await screenshot(page, "R-OPS-03");
});

test("R-OPS-06 disputes filter", async ({ page }) => {
  const actor = actorOf("operator", "Павел Оператор", operatorNavigation);
  await installAuth(page, actor, { key: "operator-pavel", display_name: actor.display_name, roles: ["operator"] });
  await page.route("**/api/v1/ops/cases", (route) => route.fulfill({ json: [] }));
  await openWorkspace(page, "operator-pavel");
  await page.getByRole("link", { name: "Споры", exact: true }).click();
  await expect(page.locator('[data-reference="R-OPS-06"]')).toBeVisible();
  await page.getByRole("button", { name: "Просроченные" }).click();
  await page.locator("button.active", { hasText: "Просроченные" }).waitFor();
  await screenshot(page, "R-OPS-06");
});

test("R-OPS-09 operator analytics glossary", async ({ page }) => {
  const actor = actorOf("operator", "Павел Оператор", operatorNavigation);
  await installAuth(page, actor, { key: "operator-pavel", display_name: actor.display_name, roles: ["operator"] });
  await installAnalytics(page, "operator");
  await openWorkspace(page, "operator-pavel");
  await page.getByRole("link", { name: "Аналитика", exact: true }).click();
  await expect(page.locator('[data-reference="R-OPS-09"]')).toBeVisible();
  await screenshot(page, "R-OPS-09");
  await page.getByText("Как рассчитано").first().click();
  await expect(page.getByText("Числитель").first()).toBeVisible();
  await expect(page.getByText("Медиана SLA очереди")).toBeVisible();
});
