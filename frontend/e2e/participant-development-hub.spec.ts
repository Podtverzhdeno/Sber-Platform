import { expect, test, type Page } from "@playwright/test";
import { overviewFixture } from "../src/features/participant-home-v2/fixture";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Мои проекты", "Портфолио"],
  csrf_token: "csrf-preview",
};

async function installDevelopmentDemo(page: Page) {
  let loggedIn = false;
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({
    json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }],
  }));
  await page.route(/\/api\/v1\/me$/, (route) =>
    loggedIn ? route.fulfill({ json: actor }) :
      route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => {
    loggedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/participant/me/development-overview", (route) => route.fulfill({
    json: overviewFixture,
  }));
  await page.route("**/api/v1/me/bootcamp/impulse-level**", (route) => route.fulfill({
    json: {
      track_key: "python",
      level: 0, max_level: 3, cycle_number: 1, curriculum_state: "published",
      completed_courses: 1, required_courses: 2,
      credited_practices: 1, approved_practices: 0, required_practices: 2,
      required_course_keys: ["python-base", "rag-mvp"],
      advance_ready: false, history: [], policy_version: 1,
    },
  }));
  await page.route("**/api/v1/me/bootcamp/impulse-study/summary", (route) => route.fulfill({
    json: {
      started_courses: 2, finished_courses: 1, completed_lessons: 11,
      approved_practices: 0, credited_practices: 1,
      courses: [
        { course_key: "python-base", title: "Основы Python", completed_units: 8, total_units: 8,
          finished: true, finished_at: "2026-11-10T10:00:00Z", certificate_id: "CERT-PY",
          updated_at: "2026-11-10T10:00:00Z", practice_status: "approved", practical_certificate_id: null },
        { course_key: "rag-mvp", title: "Надёжный RAG", completed_units: 3, total_units: 8,
          finished: false, finished_at: null, certificate_id: null,
          updated_at: "2026-11-11T10:00:00Z", practice_status: null, practical_certificate_id: null },
      ],
    },
  }));
  const milestones = [
    { key: "foundation", position: 1, title: "Основы Python", purpose: "Первая база",
      skill: "Python", target_kind: "course", target_key: "python-base",
      completed: true, deliverable: null, lab: null, estimated_hours: null },
    { key: "rag", position: 2, title: "Надёжный RAG", purpose: "Практика",
      skill: "RAG", target_kind: "course", target_key: "rag-mvp",
      completed: false, deliverable: null, lab: null, estimated_hours: null },
  ];
  const roadmap = { track_key: "python", policy_version: 1, replacement_reason: null,
    milestones, next_step: milestones[1] };
  await page.route("**/api/v1/me/roadmaps", (route) => route.fulfill({ json: [roadmap] }));
  await page.route("**/api/v1/me/roadmap-catalog", (route) => route.fulfill({ json: [roadmap] }));
  await page.route("**/api/v1/me/talent-passport", (route) => route.fulfill({
    json: { verified_courses: [], skills: [], cases: [] },
  }));
  await page.route("**/api/v1/me/portfolio", (route) => route.fulfill({
    json: { demo_data: true, courses: [], contributions: [] },
  }));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
}

test("new Development hub renders real required courses and preserves legacy route", async ({ page }) => {
  await installDevelopmentDemo(page);
  await page.goto("/workspace/1");
  await expect(page.getByTestId("development-hub")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Развитие" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Подразделы развития" })).toBeVisible();
  await expect(page.getByTestId("trajectory-role-card").first()).toBeVisible();
  await page.getByRole("button", { name: "Уровни", exact: true }).click();
  await expect(page).toHaveURL(/hub=levels/);
  await expect(page.getByTestId("development-level-requirements")).toBeVisible();
  await expect(page.getByText("Надёжный RAG")).toBeVisible();
  await expect(page.getByTestId("development-practice-count")).toContainText("1 из 2");
  await expect(page.getByRole("link", { name: "Открыть курс Надёжный RAG" }))
    .toHaveAttribute("href", "/workspace/2?role=python&course=rag-mvp&panel=detail");

  await page.getByRole("button", { name: "Траектории" }).click();
  await expect(page).not.toHaveURL(/hub=levels/);
  await expect(page.getByTestId("trajectory-role-card").first()).toBeVisible();

  await page.goto("/workspace/1?hub=legacy");
  await expect(page.getByTestId("development-hub")).toHaveCount(0);
  await expect(page.locator('.trajectory-v2[data-reference="R-PAR-02"]')).toBeVisible();
});

test("Development levels keep the document within 320px, 390px and desktop widths", async ({ page }) => {
  await installDevelopmentDemo(page);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/workspace/1?hub=levels");
    await expect(page.getByTestId("development-level-requirements")).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, "Document must not overflow at width " + String(width)).toBeLessThanOrEqual(width + 1);
  }
});
