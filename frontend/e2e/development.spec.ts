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
  await page.route("**/api/v1/me/growth/snapshot", (route) => route.fulfill({
    json: {
      snapshot_id: "growth-snapshot-e2e-1",
      generated_at: "2026-10-19T17:55:00+03:00",
      snapshot_version: 2,
      actor_timezone: "Europe/Moscow",
      definitions: { activity: "impulse-growth-activity-v3", hours: "impulse-growth-hours-v1", milestones: "impulse-growth-milestones-v2", readiness: "impulse-growth-readiness-v1", snapshot: "impulse-growth-snapshot-v2" },
      period_boundaries: { day: { start: "2026-10-19T00:00:00+03:00", end: "2026-10-20T00:00:00+03:00" } },
      activity: { day: { total: 0, course_checkpoint: 0, project_submission: 0, revision_accepted: 0, event_participation: 0 } },
      activity_state: {},
      events: [],
      hours: { known: true, trusted_minutes: 0, self_reported_minutes: 0, intervals: [] },
      freshness: { known: false, latest_observed_at: "2026-10-18T12:00:00+03:00" },
      trajectories: [
        {
          track_key: "python",
          track_title: "Python-разработчик",
          policy_version: 1,
          milestones: [
            { key: "foundation", position: 1, title: "Основа", purpose: "Подготовиться к проекту", skill: "Python", target_kind: "course", target_key: "python-base", target_title: "Основа", status: "available", known: true },
          ],
          completion: { percent: 33.4, coverage: 1, partial: true },
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
  await page.route("**/api/v1/me/courses/*/detail", (route) => route.fulfill({
    json: {
      course_key: "python-base",
      title: "Python: основа",
      source_url: "https://example.test/python",
      availability: "unavailable",
      access_note: "Внешний курс пока не подключён; доступна исходная ссылка.",
      enrollment_status: null,
      verified: false,
      specialization: "Python / Data / ML",
      program_version: "1.0.0",
      workload_hours: 40,
      program_competencies: [["Синтаксис и идиомы Python", "базовый", "Итоговое задание курса"]],
      objective: "Подготовиться к первому вкладу в направлении python.",
      milestone_title: "Основа",
      next_step: "Основа",
      artifact: "Итоговое задание курса",
      cycle: [{ competency: "Синтаксис и идиомы Python", current_level: "не подтверждено", projected_level: "базовый", target_level: "базовый", projected_confirmed: false, evidence: "Итоговое задание курса" }],
    },
  }));
  await page.route("**/api/v1/competency-evidence", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/competency-evidence", (route) => route.fulfill({ json: [] }));
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
  await page.getByRole("button", { name: "Открыть траекторию" }).click();
  await expect(page.getByRole("heading", { name: "Python: основа" })).toBeVisible();
  await expect(page.getByTestId("course-competency-0")).toContainText("Прогноз: базовый");
  await expect(page.getByTestId("course-competency-0")).toContainText("до подтверждения на checkpoint");
  await expect(page.getByText("Подготовиться к первому вкладу в направлении python.")).toBeVisible();
  await expect(page.getByText("Checkpoint 3").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Открыть учебный материал/ })).toHaveAttribute("rel", "noopener noreferrer");
  await page.getByRole("button", { name: /Вернуться в Bootcamp/ }).click();
  await page.getByRole("button", { name: "Отметить завершение" }).click();
  await expect(page.getByText("Результат отправлен на проверку. После подтверждения курс появится в портфолио.")).toBeVisible();
  await page.getByRole("button", { name: "Учебный шаг выполнен" }).click();
  await expect(page.getByRole("heading", { name: "Серия: 2 дн." })).toBeVisible();
  await expect(page.getByText(/зал славы/i)).toHaveCount(0);
});
