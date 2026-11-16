import { expect, test, type Page } from "@playwright/test";

import { overviewFixture } from "../src/features/participant-home-v2/fixture";
import type { DevelopmentOverviewView } from "../src/features/participant-home-v2/client";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Портфолио"],
  csrf_token: "trajectory-light-regression",
};
const roles: DevelopmentOverviewView["roles"] = [
  { track_key: "product", title: "AI Engineer", state: "active", attempt_number: 1, completed_milestones: 3, total_milestones: 7 },
  { track_key: "ml", title: "AI Product Engineer", state: "unselected", attempt_number: null, completed_milestones: 0, total_milestones: 7 },
  { track_key: "python", title: "Python Engineer", state: "active", attempt_number: 1, completed_milestones: 2, total_milestones: 7 },
];
const milestones = [
  "Python & AI Foundations",
  "LLM API & Prompting",
  "RAG Pipeline",
  "Tool Calling & Agents",
  "Quality Evaluation",
  "Deployment & Monitoring",
  "Реальный проект",
].map((title, i) => ({
  key: "step-" + String(i + 1),
  position: i + 1,
  title,
  purpose: "Опубликованный этап",
  skill: "Agent Engineering",
  target_kind: "task",
  target_key: "task-" + String(i + 1),
  completed: i < 3,
}));
const baseline = overviewFixture.next_outcome;
if (baseline === null) throw new Error("Missing expected next outcome in fixture");
const overview: DevelopmentOverviewView = {
  ...overviewFixture,
  roles,
  primary_trajectory_key: "product",
  next_outcome: {
    ...baseline,
    trajectory_key: "product",
    trajectory_title: "AI Engineer",
    milestone_key: "step-4",
    milestone_position: 4,
    target_kind: "task",
    target_key: "task-4",
    target_title: "Tool Calling & Agents",
  },
};

async function showTrajectory(page: Page, mode: "light" | "dark") {
  await page.addInitScript((theme: string) => {
    localStorage.setItem("impulse-theme", theme);
    localStorage.setItem("impulse-visual-mode", theme === "light" ? "light" : "midnight");
  }, mode);
  let loggedIn = false;
  await page.route("**/api/v1/**", route => route.fulfill({ status: 404, json: { code: "NOT_MOCKED" } }));
  await page.route("**/api/v1/config", route => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({
    json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }],
  }));
  await page.route("**/api/v1/me", route => loggedIn
    ? route.fulfill({ json: actor })
    : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => {
    loggedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/participant/me/development-overview", route => route.fulfill({ json: overview }));
  await page.route("**/api/v1/me/roadmaps", route => route.fulfill({ json: [
    { track_key: "product", policy_version: 1, replacement_reason: null, milestones, next_step: milestones[3] },
  ] }));
  await page.route("**/api/v1/me/talent-passport", route => route.fulfill({ json: { verified_courses: [], skills: [], cases: [] } }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/1?role=product", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".trajectory-v2-role-card")).toHaveCount(3);
  await expect(page.locator(".trajectory-v2-role-detail")).toBeVisible();
}

function luminance(value: string) {
  const rgb = value.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  let values: number[];
  if (rgb) values = rgb.slice(1, 4).map(Number);
  else {
    const srgb = value.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (!srgb) throw new Error("Unexpected computed CSS color: " + value);
    values = srgb.slice(1, 4).map(v => Number(v) * 255);
  }
  const channels = values.map(n => {
    const v = n / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

async function lightSurface(page: Page, selector: string) {
  const background = await page.locator(selector).first().evaluate(el => getComputedStyle(el).backgroundColor);
  expect(luminance(background), selector + ": expected light surface, got " + background).toBeGreaterThan(0.8);
}

async function contrast(page: Page, textSelector: string, surfaceSelector: string) {
  const ink = await page.locator(textSelector).first().evaluate(el => getComputedStyle(el).color);
  const background = await page.locator(surfaceSelector).first().evaluate(el => getComputedStyle(el).backgroundColor);
  const a = luminance(ink), b = luminance(background);
  expect((Math.max(a, b) + .05) / (Math.min(a, b) + .05), textSelector + ": AA contrast").toBeGreaterThanOrEqual(4.5);
}

for (const width of [320, 390, 1440]) {
  test("light reference trajectory cards and text at " + String(width) + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: width < 500 ? 760 : 900 });
    await showTrajectory(page, "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    for (const selector of [
      ".trajectory-v2-role-card[data-tone='primary']",
      ".trajectory-v2-role-card[data-tone='unselected']",
      ".trajectory-v2-role-detail",
      ".trajectory-v2-stage-detail",
      ".trajectory-v2-reference-sidebar > section",
      ".trajectory-v2-milestone-node",
    ]) {
      await lightSurface(page, ".workspace-content .trajectory-v2 " + selector);
    }
    await contrast(page, ".trajectory-v2-role-detail h3", ".trajectory-v2-role-detail");
    await contrast(page, ".trajectory-v2-stage-header h3", ".trajectory-v2-stage-detail");
    await contrast(page, ".trajectory-v2-stage .trajectory-v2-milestone-title", ".trajectory-v2-role-detail");
    await contrast(page, ".trajectory-v2-role-card[data-tone='unselected'] strong", ".trajectory-v2-role-card[data-tone='unselected']");

    const info = page.getByRole("button", { name: /^О роли/ });
    await expect(info).toBeVisible();
    const buttonSurface = await info.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(luminance(buttonSurface)).toBeGreaterThan(0.8);

    const documentOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(documentOverflow, "no page-level horizontal scrolling").toBeLessThanOrEqual(2);
  });
}

test("dark trajectory preserves midnight reference visuals", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 });
  await showTrajectory(page, "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const role = page.locator(".trajectory-v2-role-card[data-tone='primary']").first();
  await expect(role).toBeVisible();
  // The reference uses both solid navy fills and dark gradients.
  // Assert the actual night surface, not a particular CSS paint mechanism.
  const roleSurface = await role.evaluate(el => ({
    color: getComputedStyle(el).backgroundColor,
    image: getComputedStyle(el).backgroundImage,
  }));
  expect(roleSurface.image !== "none" || luminance(roleSurface.color) < 0.2).toBe(true);
  const detail = page.locator(".trajectory-v2-stage-detail").first();
  const stageSurface = await detail.evaluate(el => ({
    color: getComputedStyle(el).backgroundColor,
    image: getComputedStyle(el).backgroundImage,
  }));
  expect(stageSurface.image !== "none" || luminance(stageSurface.color) < 0.2).toBe(true);
});
