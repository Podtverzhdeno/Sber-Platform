import type { Page } from "@playwright/test";
import { overviewFixture } from "../src/features/participant-home-v2/fixture";

/** Deterministic UI-only API fixtures. Never represent real completion, LMS or
 * participant progress; intended exclusively for screenshot/interaction QA. */
const AI_TRACKS = ["product", "ml", "python", "data", "backend", "design", "manager"];
const COURSE_TITLES = [
  "OpenSpec и SDD", "Агентная разработка", "Python: основа", "FastAPI",
  "SQL", "Аналитика продукта", "Машинное обучение", "Git и командная работа",
  "Тестирование", "Безопасность данных", "Презентация результата",
  "Корпоративная культура",
];
export const bootcampCatalogFixture = COURSE_TITLES.map((title, index) => ({
  key: `demo-course-${String(index + 1)}`,
  title,
  track_keys: [AI_TRACKS[index % AI_TRACKS.length]],
  source_url: "https://docs.python.org/3/tutorial/",
  access_state: index === 4 ? "unavailable" : "available",
  access_note: index === 4 ? "Внешний курс временно не подключён" : "Доступен",
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
  navigation: ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Портфолио", "Аналитика"],
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
  await page.route("**/api/v1/me/bootcamp/catalog", route => route.fulfill({ json: bootcampCatalogFixture }));
  // Trajectory requires its own server-authored role snapshot; failing closed
  // without a fixture is correct, but would hide the shared learning panel.
  await page.route("**/api/v1/participant/me/development-overview", route =>
    route.fulfill({ json: overviewFixture }));
  await page.route("**/api/v1/me/roadmaps", route => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/roadmap-catalog", route => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/talent-passport", route => route.fulfill({
    json: { verified_courses: [], cases: [], skills: [] },
  }));
  await page.route("**/api/v1/me/portfolio", route => route.fulfill({
    json: { demo_data: true, courses: [], contributions: [] },
  }));

  const study = new Map<string, { completed_units: number; certificate_id: string | null; practice_status: string | null; practice_submitted_at: string | null; practice_task_key: string | null; practice_description: string | null; practice_artifact_url: string | null }>();
  await page.route("**/api/v1/me/bootcamp/impulse-study/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const match = path.match(/\/impulse-study\/(demo-course-\d+)(?:\/lessons\/(\d+)\/complete|\/(finish)|\/(practice))?$/);
    if (!match) { await route.fulfill({ status: 404, json: { code: "NOT_FOUND" } }); return; }
    const course = match[1];
    const previous = study.get(course) ?? { completed_units: 0, certificate_id: null, practice_status: null, practice_submitted_at: null, practice_task_key: null, practice_description: null, practice_artifact_url: null };
    const record = { ...previous };
    if (route.request().method() === "POST" && match[2]) {
      const index = Number(match[2]);
      if (index === record.completed_units) record.completed_units += 1;
      else if (index > record.completed_units) { await route.fulfill({ status: 409, json: { code: "LESSON_ORDER" } }); return; }
    }
    if (route.request().method() === "POST" && match[3]) {
      if (record.completed_units !== 8) { await route.fulfill({ status: 409, json: { code: "COURSE_INCOMPLETE" } }); return; }
      record.certificate_id = "a1b2c3d4-e5f6-47ab-8c12-000000000099";
    }
    if (route.request().method() === "POST" && match[4]) {
      if (!record.certificate_id) { await route.fulfill({ status: 409, json: { code: "COURSE_INCOMPLETE" } }); return; }
      const body = route.request().postDataJSON() as { description: string; artifact_url: string | null; practice_task_key: string | null };
      if (!/^lesson:[0-7]$/.test(body.practice_task_key ?? "")) {
        await route.fulfill({ status: 422, json: { code: "INVALID_PRACTICE_TASK" } });
        return;
      }
      record.practice_status = "pending";
      record.practice_submitted_at = "2026-10-25T13:00:00Z";
      record.practice_task_key = body.practice_task_key;
      record.practice_description = body.description;
      record.practice_artifact_url = body.artifact_url;
    }
    study.set(course, record);
    await route.fulfill({ json: {
      course_key: course, completed_units: record.completed_units, total_units: 8,
      certificate_id: record.certificate_id, finished: Boolean(record.certificate_id),
      practice_status: record.practice_status,
      practice_task_key: record.practice_task_key,
      practice_description: record.practice_description,
      practice_artifact_url: record.practice_artifact_url,
      practice_submitted_at: record.practice_submitted_at,
      practical_certificate_id: null,
    } });
  });

  // The same mutable fixture answers the cross-section summary: finishing in
  // Bootcamp must become observable in both Analytics and Trajectory.
  await page.route("**/api/v1/me/bootcamp/impulse-study/summary", route => {
    const courses = Array.from(study.entries()).map(([key, state]) => ({
      course_key: key,
      title: bootcampCatalogFixture.find(item => item.key === key)?.title ?? key,
      completed_units: state.completed_units,
      total_units: 8,
      finished: Boolean(state.certificate_id),
      certificate_id: state.certificate_id,
      finished_at: state.certificate_id ? "2026-10-25T12:00:00Z" : null,
      updated_at: "2026-10-25T12:00:00Z",
      practice_status: state.practice_status,
      practice_task_key: state.practice_task_key,
      practice_submitted_at: state.practice_submitted_at,
      practical_certificate_id: null,
    }));
    return route.fulfill({ json: {
      started_courses: courses.length,
      finished_courses: courses.filter(course => course.finished).length,
      completed_lessons: courses.reduce((sum, course) => sum + course.completed_units, 0),
      approved_practices: 0,
      credited_practices: courses.filter(course => course.finished && course.practice_status === "pending").length,
      courses,
    } });
  });

  await page.route("**/api/v1/me/learning/streak", route =>
    route.fulfill({ json: { current_days: 11, qualified_dates: [], reason: "Демо-показ" } }));
  await page.route("**/api/v1/me/bootcamp/certificates", route => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/courses/*/detail", route =>
    route.fulfill({ status: 404, json: { code: "RESOURCE_NOT_FOUND" } }));
}
