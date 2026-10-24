import { expect, test } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Главная", "Моя траектория", "Bootcamp", "Задачи"],
  csrf_token: "csrf-preview",
};

test("trajectory v2 is default and legacy route stays available", async ({ page }) => {
  let loggedIn = false;
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }] }));
  await page.route("**/api/v1/me", (route) => loggedIn ? route.fulfill({ json: actor }) : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => { loggedIn = true; return route.fulfill({ json: actor }); });
  await page.route("**/api/v1/participant/me/development-overview", (route) => route.fulfill({ status: 503, json: { code: "SERVICE_UNAVAILABLE" } }));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();

  await page.goto("/workspace/1");
  await expect(page.locator(".trajectory-v2")).toBeVisible();
  await expect(page.getByText("Не удалось загрузить траекторию.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Повторить" })).toBeVisible();

  await page.goto("/workspace/1?legacy=1");
  await expect(page.locator(".trajectory-v2")).toHaveCount(0);
});


test("approved trajectory layout has seven role cards, side-by-side rail and separate stage card", async ({ page }) => {
  await page.setViewportSize({ width: 1547, height: 929 });
  let loggedIn = false;
  const roles = [
    { track_key: "product", title: "Продуктовый аналитик", state: "active", attempt_number: 1, completed_milestones: 2, total_milestones: 7 },
    { track_key: "ml", title: "ML-инженер", state: "active", attempt_number: 1, completed_milestones: 3, total_milestones: 4 },
    { track_key: "python", title: "Python-разработчик", state: "paused", attempt_number: 1, completed_milestones: 2, total_milestones: 4 },
    { track_key: "data", title: "Аналитик данных", state: "unselected", attempt_number: null, completed_milestones: 0, total_milestones: 0 },
  ];
  const milestones = ["База и основы", "Исследование пользователей", "Продуктовые гипотезы", "Метрики и приоритизация", "Реальные задачи и проекты", "Подтверждение компетенций", "Новые возможности"].map((title, index) => ({
    key: `m${index+1}`, position: index+1, title, purpose: `Практика: ${title}`,
    skill: "Аналитика данных", target_kind: "task", target_key: `reference-task-${index+1}`, completed: index < 2,
  }));
  const overview = {
    as_of: "2026-10-24T19:00:00Z",
    roles,
    next_outcome: { trajectory_key: "product", trajectory_title: "Продуктовый аналитик", milestone_key: "m3", milestone_position: 3, policy_version: 1, reasons: [], stale_reason: null, target_key: "reference-task-3", target_kind: "task", target_title: "Оценка и приоритизация гипотез" },
    concepts: {
      career_grade: { auto_transition: false, catalog_version: null, current_grade: "5", hint: "До следующего уровня один шаг", policy_version: 1, readiness_percent: 88, reason: null, state: "ready", target_grade: "6" },
      competency_level: { canonical_surface: "", universe_version: "", value_state: "" },
      rating_xp: { canonical_surface: "", universe_version: "", value_state: "" },
      readiness_percent: { canonical_surface: "", universe_version: "", value_state: "" },
      review_grade: { canonical_surface: "", universe_version: "", value_state: "" },
      stage_progress: { canonical_surface: "", universe_version: "", value_state: "" },
    },
  };
  await page.route("**/api/v1/config", route => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({ json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }] }));
  await page.route(/\/api\/v1\/me$/, route => loggedIn ? route.fulfill({ json: { ...actor, navigation: ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Портфолио"] } }) : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => { loggedIn = true; return route.fulfill({ json: { ...actor, navigation: ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Портфолио"] } }); });
  await page.route("**/api/v1/participant/me/development-overview", route => route.fulfill({ json: overview }));
  await page.route("**/api/v1/me/roadmaps", route => route.fulfill({ json: [{ track_key: "product", policy_version: 1, replacement_reason: null, milestones, next_step: milestones[2] }] }));
  await page.route("**/api/v1/me/talent-passport", route => route.fulfill({ json: { verified_courses: [], cases: [], skills: [{ key: "Аналитика данных", practical_level: "verified", confirmed_case_count: 3 }, { key: "Коммуникация", practical_level: "verified", confirmed_case_count: 2 }] } }));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/1");
  const heading = page.locator(".trajectory-v2-heading");
  const rolesGrid = page.locator(".trajectory-v2-roles");
  const roleCard = page.locator(".trajectory-v2-role-detail");
  const stageCard = page.locator(".trajectory-v2-stage-detail");
  const rightRail = page.locator(".trajectory-v2-reference-sidebar");
  await expect(page.locator(".trajectory-v2-role-card")).toHaveCount(7);
  await expect(stageCard).toBeVisible();
  const [h,r,left,stage,right] = await Promise.all([heading,rolesGrid,roleCard,stageCard,rightRail].map(x => x.boundingBox()));
  expect(h && r && left && stage && right).toBeTruthy();
  if (!h || !r || !left || !stage || !right) return;
  expect(r.y).toBeGreaterThanOrEqual(h.y+h.height-2);
  expect(Math.abs(left.y-right.y)).toBeLessThan(32);
  expect(left.x+left.width).toBeLessThanOrEqual(right.x+5);
  expect(stage.y).toBeGreaterThanOrEqual(left.y+left.height-2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1548);
  await page.getByRole("button", { name: "О роли →" }).click();
  await expect(page.getByRole("dialog", { name: /Продуктовый аналитик/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Все уровни →" }).click();
  await expect(page.locator(".trajectory-v2-grade-option")).toHaveCount(6);
});

test("trajectory mobile retains reachable roles and the stage card", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/workspace/1?legacy=1");
  await expect(page.locator(".trajectory-v2")).toHaveCount(0);
});
