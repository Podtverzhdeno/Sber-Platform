import { expect, test } from "@playwright/test";

import { overviewFixture } from "../src/features/participant-home-v2/fixture";
import type { DevelopmentOverviewView } from "../src/features/participant-home-v2/client";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Тестовый участник",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Портфолио"],
  csrf_token: "csrf-preview",
};

const roles: DevelopmentOverviewView["roles"] = [
  { track_key: "product", title: "Продуктовый аналитик", state: "active", attempt_number: 1, completed_milestones: 2, total_milestones: 7 },
  { track_key: "ml", title: "ML-инженер", state: "active", attempt_number: 1, completed_milestones: 3, total_milestones: 4 },
  { track_key: "python", title: "Python-разработчик", state: "paused", attempt_number: 1, completed_milestones: 2, total_milestones: 4 },
  { track_key: "data", title: "Аналитик данных", state: "unselected", attempt_number: null, completed_milestones: 0, total_milestones: 7 },
  { track_key: "backend", title: "Backend-разработчик", state: "unselected", attempt_number: null, completed_milestones: 0, total_milestones: 7 },
  { track_key: "ux", title: "UX/UI-дизайнер", state: "unselected", attempt_number: null, completed_milestones: 0, total_milestones: 7 },
  { track_key: "manager", title: "Менеджер проекта", state: "unselected", attempt_number: null, completed_milestones: 0, total_milestones: 7 },
];

const milestones = [
  "База и основы",
  "Исследование пользователей",
  "Продуктовые гипотезы",
  "Метрики и приоритизация",
  "Реальные задачи и проекты",
  "Подтверждение компетенций",
  "Новые возможности",
].map((title, index) => ({
  key: `stage-${String(index + 1)}`,
  position: index + 1,
  title,
  purpose: "Проверяемое действие в рамках освоения роли",
  skill: "Аналитическое мышление",
  target_kind: "task",
  target_key: `task-${String(index + 1)}`,
  completed: index < 2,
}));

const baselineOutcome = overviewFixture.next_outcome;
if (baselineOutcome === null) throw new Error("Fixture must include a next outcome");

const overview: DevelopmentOverviewView = {
  ...overviewFixture,
  roles,
  next_outcome: {
    ...baselineOutcome,
    trajectory_key: "product",
    trajectory_title: "Продуктовый аналитик",
    milestone_key: "stage-3",
    milestone_position: 3,
    target_kind: "task",
    target_key: "task-3",
    target_title: "Продуктовые гипотезы",
  },
};

async function showTrajectory(page: import("@playwright/test").Page) {
  let loggedIn = false;
  await page.route("**/api/v1/config", route => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({ json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }] }));
  await page.route("**/api/v1/me", route => loggedIn ? route.fulfill({ json: actor }) : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => {
    loggedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/participant/me/development-overview", route => route.fulfill({ json: overview }));
  await page.route("**/api/v1/me/roadmaps", route => route.fulfill({ json: [
    { track_key: "product", policy_version: 1, replacement_reason: null, milestones, next_step: milestones[2] },
  ] }));
  await page.route("**/api/v1/me/talent-passport", route => route.fulfill({ json: { verified_courses: [], skills: [], cases: [] } }));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/1?role=product");
  await expect(page.locator(".trajectory-v2-role-card")).toHaveCount(7);
}

async function captureState(page: import("@playwright/test").Page, name: string) {
  await test.info().attach(name, { body: await page.screenshot({ animations: "disabled", fullPage: name.endsWith("-mobile") }), contentType: "image/png" });
}

test("TRJ-SCREEN-03 and 04: desktop dialog cards and role menu geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 1038 });
  await showTrajectory(page);
  await expect(page.locator(".trajectory-v2-stage-path")).toBeVisible();
  await captureState(page, "TRJ-SCREEN-01-main");
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.getByRole("button", { name: /^О роли/ }).click();

  const dialog = page.locator(".trajectory-v2-role-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("tab")).toHaveCount(6);
  await expect(dialog.locator(".trajectory-v2-role-intro-card")).toHaveCount(4);
  await captureState(page, "TRJ-SCREEN-03-role-info");
  const rect = await dialog.boundingBox();
  if (rect === null) throw new Error("Role dialog has no bounding box");
  expect(rect.width).toBeGreaterThanOrEqual(900);
  expect(rect.width).toBeLessThanOrEqual(908);
  expect(Math.abs(rect.x + rect.width / 2 - 1672 / 2)).toBeLessThan(4);
  await dialog.getByRole("button", { name: "Закрыть" }).click();

  const trigger = page.getByRole("button", { name: "Действия роли" });
  await trigger.click();
  const menu = page.getByRole("menu", { name: "Действия роли" });
  await expect(menu).toBeVisible();
  await captureState(page, "TRJ-SCREEN-04-more-menu");
  const menuRect = await menu.boundingBox();
  const triggerRect = await trigger.boundingBox();
  if (menuRect === null || triggerRect === null) throw new Error("Menu or trigger has no bounding box");
  expect(Math.abs((menuRect.x + menuRect.width) - (triggerRect.x + triggerRect.width))).toBeLessThan(4);
});

test("TRJ-SCREEN-06: mobile role cards wrap in two columns and stages scroll horizontally", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await showTrajectory(page);

  const grid = page.locator(".trajectory-v2-roles ul");
  await expect(grid).toHaveCSS("display", "grid");
  const cards = page.locator(".trajectory-v2-role-card");
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  const third = await cards.nth(2).boundingBox();
  if (first === null || second === null || third === null) throw new Error("Role cards have no bounding boxes");
  expect(first.x).toBeLessThan(second.x);
  expect(Math.abs(first.y - second.y)).toBeLessThan(3);
  expect(third.y).toBeGreaterThan(first.y);

  const stagePath = page.locator(".trajectory-v2-stage-path");
  await expect(stagePath).toBeVisible();
  const dimensions = await stagePath.evaluate(el => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    flexFlow: getComputedStyle(el).flexFlow,
  }));
  expect(dimensions.flexFlow).toContain("nowrap");
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
  await captureState(page, "TRJ-SCREEN-06-mobile");
});

test("TRJ-SCREEN-02 and 05: stage result drawer and grade catalog states are capturable", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await showTrajectory(page);
  await expect(page.locator(".trajectory-v2-stage-path")).toBeVisible();

  await page.locator(".trajectory-v2-stage").first().click();
  await page.locator(".trajectory-v2-task-action").click();
  const drawer = page.locator(".trajectory-v2-drawer");
  await expect(drawer).toBeVisible();
  await captureState(page, "TRJ-SCREEN-02-view-task");
  await drawer.getByRole("button", { name: "Закрыть" }).first().click();

  await page.getByRole("button", { name: /Все уровни/ }).click();
  const grades = page.locator(".trajectory-v2-grades-dialog");
  await expect(grades).toBeVisible();
  await captureState(page, "TRJ-SCREEN-05-all-grades");
  await expect(grades.locator(".trajectory-v2-grade-option")).toHaveCount(4);
  await expect(grades.getByRole("heading", {name:/Уровни Impulse/})).toBeVisible();
  await expect(grades).toContainText("Учебные уровни и карьерные грейды Сбера — разные системы.");
});
