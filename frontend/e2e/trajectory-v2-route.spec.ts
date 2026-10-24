import { expect, test, type Page } from "@playwright/test";

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

const stages = [
  { key: "basic", position: 1, title: "Основы", purpose: "Пройти фундамент", skill: "Python", target_kind: "course", target_key: "python-base", completed: true },
  { key: "practice", position: 2, title: "Практика", purpose: "Выполнить прикладную задачу", skill: "API", target_kind: "task", target_key: "api-project", completed: false },
  { key: "result", position: 3, title: "Защита результата", purpose: "Подтвердить навыки", skill: "Проверка", target_kind: "task", target_key: "final-project", completed: false },
];

const overview = {
  as_of: "2026-10-24T10:00:00Z",
  permissions: { trajectory_switch: true, grade_request: false, share: false },
  next_outcome: { trajectory_key: "python", title: "Практика" },
  concepts: { career_grade: {
    policy_version: 1,
    state: "not_evaluable",
    reason: "grade_catalog_policy_not_published",
    hint: "Каталог пока не опубликован",
    current_grade: null,
    target_grade: null,
    readiness_percent: null,
  } },
  roles: [
    { track_key: "python", title: "Python-разработчик", state: "active", attempt_number: 1, completed_milestones: 1, total_milestones: 3 },
    { track_key: "data", title: "Data-аналитик", state: "paused", attempt_number: 2, completed_milestones: 0, total_milestones: 2 },
    { track_key: "product", title: "Продакт-менеджер", state: "unselected", attempt_number: null, completed_milestones: 0, total_milestones: 2 },
  ],
};

const checkpoints = stages.map((step, index) => ({
  ...step,
  state: index === 0 ? "COMPLETED" : index === 1 ? "CURRENT" : "LOCKED",
  state_label: index === 0 ? "Пройден" : index === 1 ? "Текущий шаг" : "Заблокирован",
  mandatory: true,
  actionable: index === 1,
  points_available: 20,
  points_earned: index === 0 ? 20 : 0,
  points_rule: "После проверки",
  policy_version: 1,
  locked_reasons: index === 2 ? [{ milestone_key: "practice", title: "Практика", ref: "checkpoint:practice" }] : [],
  branch: null,
}));

async function authorize(page: Page, brokenOverview = false) {
  let loggedIn = false;
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }] }));
  await page.route("**/api/v1/me", (route) => loggedIn ? route.fulfill({ json: actor }) : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => { loggedIn = true; return route.fulfill({ json: actor }); });
  await page.route("**/api/v1/participant/me/development-overview", (route) => brokenOverview
    ? route.fulfill({ status: 503, json: { code: "SERVICE_UNAVAILABLE" } })
    : route.fulfill({ json: overview }));
  await page.route("**/api/v1/me/trajectory-map", (route) => route.fulfill({ json: [
    { track_key: "python", policy_version: 1, replacement_reason: null, current_key: "practice",
      checkpoints, progress: { completed_mandatory: 1, total_mandatory: 3, percent: 33 } },
  ] }));
  await page.route("**/api/v1/me/trajectory-map/checkpoints/*", (route) => {
    const key = decodeURIComponent(route.request().url().split("/").pop() ?? "");
    const item = checkpoints.find((step) => step.key === key);
    if (!item) return route.fulfill({ status: 404, json: { code: "RESOURCE_NOT_FOUND" } });
    return route.fulfill({ json: { checkpoint: item, goal: item.purpose, outcome: "Проверенный результат",
      prerequisites: [], evidence_refs: [], replay: false, policy_version: 1,
      skill_impact: { skill: item.skill, current_level: "не подтверждено",
        target_level: "базовый", projected_level: null, forecast_only: true,
        explanation: "После проверки", missing_evidence: [], fallback: null } } });
  });
  await page.route("**/api/v1/development/roadmap-catalog", (route) => route.fulfill({ json: [
    { track_key: "python", policy_version: 1, replacement_reason: null, milestones: stages.map((step) => ({ ...step, completed: false })), next_step: null },
    { track_key: "data", policy_version: 1, replacement_reason: null, milestones: stages.slice(0, 2).map((step) => ({ ...step, completed: false })), next_step: null },
    { track_key: "product", policy_version: 1, replacement_reason: null, milestones: stages.slice(0, 2).map((step) => ({ ...step, completed: false })), next_step: null },
  ] }));
  await page.route("**/api/v1/me/task-recommendations/resolve?*", (route) => route.fulfill({ json: [{
    task_id: "00000000-0000-4000-8000-000000000123", title: "Практика по API",
    customer: { display_name: "Тестовый заказчик" },
  }] }));
  await page.route("**/api/v1/me/roadmaps", (route) => route.fulfill({ json: [
    { track_key: "python", policy_version: 1, replacement_reason: null, milestones: stages, next_step: stages[1] },
    { track_key: "data", policy_version: 1, replacement_reason: null, milestones: [stages[0]], next_step: stages[0] },
    { track_key: "product", policy_version: 1, replacement_reason: null, milestones: [stages[0]], next_step: stages[0] },
  ] }));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
}

test("redesigned trajectory is the default; classic view is available as safe rollback", async ({ page }) => {
  await authorize(page, true);
  await page.goto("/workspace/1");
  await expect(page.locator(".trajectory-redesign")).toBeVisible();
  await expect(page.getByText("Не удалось загрузить траекторию")).toBeVisible();
  await expect(page.getByRole("button", { name: "Повторить" })).toBeVisible();

  await page.goto("/workspace/1?v2=1");
  await expect(page.locator(".trajectory-redesign")).toBeVisible();

  await page.goto("/workspace/1?classic=1");
  await expect(page.locator(".trajectory-redesign")).toHaveCount(0);
});

test("role selection, map, stage drawer, grade state and Back remain coherent", async ({ page }) => {
  await authorize(page);
  await page.goto("/workspace/1");
  await expect(page.getByRole("heading", { name: "Моя траектория" })).toBeVisible();
  await expect(page.getByTestId("trajectory-role-card")).toHaveCount(3);
  await expect(page.getByTestId("trajectory-stages").locator("li")).toHaveCount(3);
  await expect(page.getByTestId("trajectory-grade-summary")).toContainText("Каталог грейдов ещё не утверждён");
  await expect(page.getByTestId("trajectory-role-detail")).toContainText("пройдено 1 из 3");

  await page.getByRole("button", { name: /Этап подробнее/ }).click();
  await expect(page.getByRole("dialog", { name: "Детали этапа" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Детали этапа" })).toHaveCount(0);

  await page.getByRole("button", { name: /Все уровни/ }).click();
  await expect(page.getByRole("dialog", { name: "Все уровни" })).toContainText("Каталог карьерных грейдов пока не опубликован");
  await page.keyboard.press("Escape");

  await page.getByTestId("trajectory-role-card").filter({ hasText: "Продакт-менеджер" }).click();
  await expect(page).toHaveURL(/role=product/);
  await expect(page.getByTestId("trajectory-role-detail")).toContainText("Познакомьтесь с направлением");
  await expect(page.getByTestId("trajectory-role-detail")).not.toContainText("1 из 3");
  await expect(page.getByTestId("trajectory-stages").locator("li")).toHaveCount(2);
  await expect(page.getByTestId("trajectory-stages")).toContainText("В каталоге");
  await page.goBack();
  await expect(page.getByTestId("trajectory-role-detail")).toContainText("Python-разработчик");
});

test("published preview and task resolver keep the approved layout and canonical UUID", async ({ page }) => {
  await authorize(page);
  await page.goto("/workspace/1?role=data");
  await expect(page.getByTestId("trajectory-stages").locator("li")).toHaveCount(2);
  await expect(page.getByTestId("trajectory-stages")).toContainText("В каталоге");
  await expect(page.getByTestId("trajectory-role-detail")).not.toContainText("1 из 3");
  await page.getByRole("button", { name: /Этап подробнее/ }).click();
  await expect(page.getByRole("dialog", { name: /Этап каталога:/ })).toContainText("не ваш персональный прогресс");
  await page.keyboard.press("Escape");

  await page.goto("/workspace/1?role=python&stage=practice");
  await page.getByRole("button", { name: /Этап подробнее/ }).click();
  await expect(page.getByRole("dialog", { name: "Детали этапа" })).toBeVisible();
  await page.getByRole("button", { name: /Открыть «Практика по API»/ }).click();
  await expect(page).toHaveURL(/\/workspace\/3\?task=00000000-0000-4000-8000-000000000123/);
});

test("mobile role selector and stage detail remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authorize(page);
  await page.goto("/workspace/1");
  await expect(page.getByTestId("trajectory-role-card").first()).toBeVisible();
  await page.getByTestId("trajectory-stages").getByRole("button", { name: /Защита результата/ }).click();
  await expect(page.getByTestId("trajectory-stage-detail")).toContainText("Защита результата");
  await expect(page.getByTestId("trajectory-stage-detail")).toContainText("Этап пока закрыт");
});

test("Buddy checkpoint deep links and pending verification preserve the correct stage", async ({ page }) => {
  await authorize(page);
  await page.goto("/workspace/1?checkpoint=practice");
  await expect(page.getByRole("dialog", { name: "Детали этапа" })).toContainText("Практика");
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/checkpoint=/);
  await expect(page.getByTestId("trajectory-stage-detail")).toContainText("Практика");

  await page.goto("/workspace/1?stage=result");
  await expect(page.getByTestId("trajectory-stage-detail")).toContainText("Этап пока закрыт");
});


test("reported completion does not block a following server-available checkpoint", async ({ page }) => {
  await authorize(page);
  await page.route("**/api/v1/me/trajectory-map", (route) => route.fulfill({ json: [
    { track_key: "python", policy_version: 1, replacement_reason: null, current_key: "result",
      checkpoints: checkpoints.map((step) => {
        if (step.key === "practice") return { ...step, state: "SUBMITTED", state_label: "На проверке", actionable: false };
        if (step.key === "result") return { ...step, state: "AVAILABLE", state_label: "Доступен", actionable: true, locked_reasons: [] };
        return step;
      }),
      progress: { completed_mandatory: 1, total_mandatory: 3, percent: 33 } },
  ] }));
  await page.goto("/workspace/1");
  await expect(page.getByTestId("trajectory-stages")).toContainText("На проверке");
  await expect(page.getByTestId("trajectory-stages")).toContainText("Доступен");
  await expect(page.getByTestId("trajectory-next")).toContainText("Защита результата");
  await expect(page.getByTestId("trajectory-stage-detail")).toContainText("Защита результата");
});


test("approved desktop reference keeps four role cards, a left roadmap and a right career rail", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1580, height: 1161 });
  await authorize(page);
  await page.goto("/workspace/1");
  await expect(page.getByTestId("trajectory-role-card")).toHaveCount(3);

  const roleBoxes = await page.getByTestId("trajectory-role-card").evaluateAll((nodes) =>
    nodes.map((node) => {
      const bounds = node.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width };
    }),
  );
  expect(roleBoxes.length).toBe(3);
  expect(roleBoxes.every((box) => box.y === roleBoxes[0]?.y)).toBe(true);
  expect(roleBoxes.every((box, i) => i === 0 || box.x > (roleBoxes[i - 1]?.x ?? 0))).toBe(true);

  const roadmap = await page.locator(".trajectory-redesign-roadmap").boundingBox();
  const grade = await page.getByTestId("trajectory-grade-summary").boundingBox();
  const next = await page.getByTestId("trajectory-next").boundingBox();
  const remaining = await page.locator(".trajectory-redesign-remaining").boundingBox();
  const passport = await page.locator(".trajectory-redesign-skills").boundingBox();
  expect(roadmap).not.toBeNull();
  expect(grade).not.toBeNull();
  expect(next).not.toBeNull();
  expect(remaining).not.toBeNull();
  expect(passport).not.toBeNull();
  if (roadmap && grade && next && remaining && passport) {
    expect(roadmap.x).toBeLessThan(grade.x);
    expect(Math.abs(roadmap.y - grade.y)).toBeLessThan(3);
    expect(Math.abs(roadmap.x - next.x)).toBeLessThan(3);
    expect(Math.abs(roadmap.x - remaining.x)).toBeLessThan(3);
    expect(Math.abs(grade.x - passport.x)).toBeLessThan(3);
    expect(next.y).toBeGreaterThan(roadmap.y);
    expect(remaining.y).toBeGreaterThan(next.y);
  }
  await page.screenshot({ path: "test-results/trajectory-approved-desktop.png", fullPage: true });
  await testInfo.attach("trajectory-approved-desktop", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});

test("approved 390px responsive layout retains all role and career cards without overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authorize(page);
  await page.goto("/workspace/1");
  await expect(page.getByTestId("trajectory-role-card")).toHaveCount(3);
  await expect(page.locator(".trajectory-redesign-grade")).toBeVisible();
  await expect(page.locator(".trajectory-redesign-skills")).toBeVisible();
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(horizontalOverflow).toBe(false);
  await page.screenshot({ path: "test-results/trajectory-approved-mobile.png", fullPage: true });
  await testInfo.attach("trajectory-approved-mobile", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});
