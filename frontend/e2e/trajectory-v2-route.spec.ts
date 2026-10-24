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
  await page.setViewportSize({ width: 1672, height: 941 });
  let loggedIn = false;
  const roles = [
    { track_key: "product", title: "Продуктовый аналитик", state: "active", attempt_number: 1, completed_milestones: 2, total_milestones: 7 },
    { track_key: "ml", title: "ML-инженер", state: "active", attempt_number: 1, completed_milestones: 3, total_milestones: 4 },
    { track_key: "python", title: "Python-разработчик", state: "paused", attempt_number: 1, completed_milestones: 2, total_milestones: 4 },
    { track_key: "data", title: "Аналитик данных", state: "unselected", attempt_number: null, completed_milestones: 0, total_milestones: 0 },
  ];
  const milestones = ["База и основы", "Исследование пользователей", "Продуктовые гипотезы", "Метрики и приоритизация", "Реальные задачи и проекты", "Подтверждение компетенций", "Новые возможности"].map((title, index) => ({
    key: `m${String(index+1)}`, position: index+1, title, purpose: `Практика: ${title}`,
    skill: "Аналитика данных", target_kind: "task", target_key: `reference-task-${String(index+1)}`, completed: index < 2,
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
  await page.route("**/api/v1/me/portfolio", route => route.fulfill({ json: {
    demo_data: true,
    person_id: actor.person_id,
    display_name: actor.display_name,
    courses: [
      { key: "demo-course-1", title: "OpenSpec и SDD", status: "verified" },
      { key: "demo-course-2", title: "Агентная разработка", status: "verified" },
      { key: "demo-course-3", title: "Python: основа", status: "verified" },
    ],
    contributions: [{ contribution_id: "00000000-0000-0000-0000-000000000022", project_title: "R&D лаборатория — демо", grade: "B", verification_status: "verified" }],
    credentials: [],
    trophies: [],
    offers: [],
    visibility: {},
  } }));

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
  await page.screenshot({ path: "test-results/trajectory-v2-desktop-candidate.png", fullPage: true, animations: "disabled" });
  await page.locator('[data-testid="trajectory-user-statistics"] summary').click();
  await expect(page.getByText("Курсов подтверждено")).toBeVisible();
  await expect(page.getByText(/R&D лаборатория — демо/)).toBeVisible();
  await page.screenshot({ path: "test-results/trajectory-v2-statistics-candidate.png", animations: "disabled" });
  await page.locator('[data-testid="trajectory-user-statistics"] summary').click();

  const [h,r,left,stage,right] = await Promise.all([heading,rolesGrid,roleCard,stageCard,rightRail].map(x => x.boundingBox()));
  expect(h && r && left && stage && right).toBeTruthy();
  if (!h || !r || !left || !stage || !right) return;
  expect(r.y).toBeGreaterThanOrEqual(h.y+h.height-2);
  expect(Math.abs(left.y-right.y)).toBeLessThan(32);
  expect(left.x+left.width).toBeLessThanOrEqual(right.x+5);
  expect(stage.y).toBeGreaterThanOrEqual(left.y+left.height-2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1673);
  await page.locator(".trajectory-v2-stage-path [data-stage-state='completed']").first().click();
  await page.locator(".trajectory-v2-stage-detail").getByRole("button", { name: "Посмотреть →" }).click();
  await expect(page.getByTestId("trajectory-drawer-overlay")).toBeVisible();
  await page.screenshot({ path: "test-results/trajectory-v2-task-drawer-candidate.png", animations: "disabled" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Продуктовые гипотезы/ }).first().click();
  await page.getByRole("button", { name: "Действия роли" }).click();
  await expect(page.getByTestId("trajectory-actions-menu")).toBeVisible();
  await page.screenshot({ path: "test-results/trajectory-v2-actions-candidate.png", animations: "disabled" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "О роли →" }).click();
  await expect(page.getByRole("dialog", { name: /Продуктовый аналитик/ })).toBeVisible();
  await page.screenshot({ path: "test-results/trajectory-v2-role-candidate.png", animations: "disabled" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Все уровни →" }).click();
  await expect(page.locator(".trajectory-v2-grade-option")).toHaveCount(6);
  await page.screenshot({ path: "test-results/trajectory-v2-grades-candidate.png", animations: "disabled" });
  await page.getByRole("button", { name: "Закрыть" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".trajectory-v2-role-card").first()).toBeVisible();
  await page.screenshot({ path: "test-results/trajectory-v2-mobile-candidate.png", fullPage: true, animations: "disabled" });
  await expect(stageCard).toBeVisible();
  const [mobileLeft, mobileRight] = await Promise.all([stageCard.boundingBox(),rightRail.boundingBox()]);
  expect(mobileLeft && mobileRight).toBeTruthy();
  if (!mobileLeft || !mobileRight) return;
  expect(mobileRight.y).toBeGreaterThanOrEqual(mobileLeft.y+mobileLeft.height-2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
});
