import { expect, test } from "@playwright/test";

import { overviewFixture } from "../src/features/participant-home-v2/fixture";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Тестовый участник",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Портфолио"],
  csrf_token: "csrf-trajectory-source-test",
};

const roadmap = {
  track_key: "python", policy_version: 1, replacement_reason: null,
  milestones: [{
    key: "foundation", position: 1,
    title: "Фундамент", purpose: "Начать Bootcamp",
    skill: "Python", target_kind: "course", target_key: "python-base",
    completed: false,
  }],
  next_step: {
    key: "foundation", position: 1,
    title: "Фундамент", purpose: "Начать Bootcamp",
    skill: "Python", target_kind: "course", target_key: "python-base",
    completed: false,
  },
};

async function enterSourcePage(page: import("@playwright/test").Page) {
  let loggedIn = false;
  await page.route("**/api/v1/config", route => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({ json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }] }));
  await page.route(/\/api\/v1\/me$/, route => loggedIn ?
    route.fulfill({ json: actor }) :
    route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => {
    loggedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/participant/me/development-overview", route => route.fulfill({ json: overviewFixture }));
  await page.route("**/api/v1/me/roadmaps", route => route.fulfill({ json: [roadmap] }));
  await page.route("**/api/v1/me/talent-passport", route => route.fulfill({ json: { skills: [], cases: [], verified_courses: [] } }));
  await page.route("**/api/v1/me/work", route => route.fulfill({ json: [] }));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/1?source=1");
  await expect(page.locator(".trj-source")).toBeVisible();
}

test("source-driven trajectory renders approved catalog and sparse stage truth from API", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await enterSourcePage(page);
  const source = page.locator(".trj-source");
  await expect(source.locator(".role-card")).toHaveCount(7);
  await expect(source.locator(".milestone")).toHaveCount(7);
  await expect(source.locator(".milestone.unpublished")).toHaveCount(6);
  await expect(source.getByRole("heading", { name: "Моя траектория" })).toBeVisible();
  await expect(source.getByText("Грейд —")).toBeVisible();
  await expect(source.getByText("Проверяем")).toBeVisible();
  await expect(source.getByText(/детализация отдельных заданий пока недоступна/)).toBeVisible();

  await test.info().attach("source-real-api-desktop-1672x941", {
    body: await page.screenshot({ animations: "disabled" }), contentType: "image/png",
  });

  await source.getByRole("button", { name: /^О роли/ }).click();
  await expect(page.getByRole("dialog", { name: /AI Security Engineer/ })).toBeVisible();
  await test.info().attach("TRJ-SCREEN-03-role-info-react", {
    body: await page.screenshot({ animations: "disabled" }), contentType: "image/png",
  });
  await page.keyboard.press("Escape");

  await source.getByRole("button", { name: /Все уровни/ }).click();
  await expect(page.getByRole("dialog", { name: "Все уровни" })).toBeVisible();
  await expect(page.getByText(/Полный каталог уровней/)).toBeVisible();
  await test.info().attach("TRJ-SCREEN-05-grades-react", {
    body: await page.screenshot({ animations: "disabled" }), contentType: "image/png",
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Все уровни" })).toHaveCount(0);

  await source.getByRole("button", { name: "Действия роли" }).click();
  await expect(page.getByRole("menu", { name: "Действия роли" })).toBeVisible();
  await test.info().attach("TRJ-SCREEN-04-more-menu-react", {
    body: await page.screenshot({ animations: "disabled" }), contentType: "image/png",
  });
  await page.keyboard.press("Escape");

  await source.getByRole("button", { name: "Продолжить" }).click();
  await expect(page.locator(".trajectory-v2-drawer")).toBeVisible();
  await test.info().attach("TRJ-SCREEN-02-view-task-react", {
    body: await page.screenshot({ animations: "disabled" }), contentType: "image/png",
  });
  await page.keyboard.press("Escape");
});

test("source-driven trajectory switches to a catalog-only direction without invented progress", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterSourcePage(page);
  const source = page.locator(".trj-source");
  const roles = source.locator(".role-card");
  const first = await roles.nth(0).boundingBox();
  const second = await roles.nth(1).boundingBox();
  const third = await roles.nth(2).boundingBox();
  if (!first || !second || !third) throw new Error("Source role geometry missing");
  expect(Math.abs(first.y - second.y)).toBeLessThan(3);
  expect(second.x).toBeGreaterThan(first.x);
  expect(third.y).toBeGreaterThan(first.y);

  const timeline = await source.locator(".roadmap-steps").evaluate(el => ({
    scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
  }));
  expect(timeline.scrollWidth).toBeGreaterThan(timeline.clientWidth);
  await test.info().attach("source-real-api-mobile-390x844", {
    body: await page.screenshot({ animations: "disabled", fullPage: true }), contentType: "image/png",
  });
  await source.getByRole("button", { name: /AI Agent Engineer/ }).click();
  await expect(source.getByText(/Роль ещё не выбрана/)).toBeVisible();
  await expect(source.getByText(/этапы, задачи и подтверждённый прогресс/)).toBeVisible();
  await expect(source.getByText("Грейд —")).toBeVisible();
});
