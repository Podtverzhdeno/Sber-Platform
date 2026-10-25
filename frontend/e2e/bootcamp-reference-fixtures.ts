import type { Page } from "@playwright/test";

/** Deterministic UI-only API fixtures. Never represent real completion, LMS or
 * participant progress; intended exclusively for screenshot/interaction QA. */
const AI_TRACKS = ["product", "ml", "python", "data", "backend", "design", "manager"];
const COURSE_TITLES = [
  "OpenSpec и SDD", "Агентная разработка", "Python: основа", "FastAPI",
  "SQL", "Аналитика продукта", "Машинное обучение", "Git и командная работа",
  "Тестирование", "Безопасность данных", "Презентация результата",
  "Корпоративная культура",
];
const catalog = COURSE_TITLES.map((title, index) => ({
  key: `demo-course-${String(index + 1)}`,
  title,
  track_keys: [AI_TRACKS[index % AI_TRACKS.length]],
  source_url: "https://docs.python.org/3/tutorial/",
  access_state: index === 9 ? "prerequisite_not_met" : "available",
  access_note: index === 9 ? "Сначала необходимо выполнить условия" : "Доступен",
  completion_state: "not_started",
  relevant: true,
  relevance_reasons: ["Курс связан с выбранной AI-ролью"],
  recommendation_reason: "Практика на основе выбранной траектории",
  must_take: index === 0 ? {
    skill: "System design", current_level: null, target_level: "базовый",
    projected_impact: "Проверяемый учебный результат после оценки",
    explanation: "Курс входит в учебную траекторию",
  } : null,
  pending_verification_note: null,
  verified_evidence: null,
}));

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [], consent_scopes: [],
  navigation: ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Портфолио"],
  csrf_token: "csrf-e2e-bootcamp-reader",
};

export async function installBootcampReferenceApi(page: Page): Promise<void> {
  let authenticated = false;
  await page.route("**/api/v1/config", route =>
    route.fulfill({ json: { demo_mode: true, honor_board_enabled: false } }));
  await page.route("**/api/v1/auth/personas", route =>
    route.fulfill({ json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }] }));
  await page.route(/\/api\/v1\/me(?:\?.*)?$/, route =>
    authenticated ? route.fulfill({ json: actor }) :
      route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => {
    authenticated = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/me/bootcamp/catalog", route => route.fulfill({ json: catalog }));
  await page.route("**/api/v1/me/learning/streak", route =>
    route.fulfill({ json: { current_days: 11, qualified_dates: [], reason: "Демо-показ" } }));
  await page.route("**/api/v1/me/bootcamp/certificates", route => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/courses/*/detail", route =>
    route.fulfill({ status: 404, json: { code: "RESOURCE_NOT_FOUND" } }));
}
