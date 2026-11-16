import { expect, test, type Page } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Мои проекты", "События", "Настройки"],
  csrf_token: "project-list-light-qa",
};

const projects = [
  { id: "assignment-1", title: "Прототип рекомендательной системы", status: "in_progress", company: "Сбер" },
  { id: "assignment-2", title: "MVP чат-ассистента", status: "submitted", company: "Т-Банк" },
];
const work = projects.map(item => ({
  assignment: { id: item.id, task_id: "task-" + item.id, person_id: actor.person_id, status: item.status },
  task: { id: "task-" + item.id, title: item.title, status: item.status },
  terms: { version: 1, deadline_at: "2026-12-25T11:00:00Z", deliverable: "Рабочий прототип", acceptance_criteria: ["Прототип", "Отчёт"] },
  contributions: [],
  decisions: [],
  allowed_artifacts: ["report"],
}));

async function enterProjects(page: Page, mode: "light" | "dark") {
  await page.addInitScript((theme: string) => {
    localStorage.setItem("impulse-theme", theme);
    localStorage.setItem("impulse-visual-mode", theme === "light" ? "light" : "midnight");
  }, mode);
  let loggedIn = false;
  await page.route("**/api/v1/**", route => route.fulfill({ status: 404, json: { code: "UNMOCKED" } }));
  await page.route("**/api/v1/config", route => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", route =>
    route.fulfill({ json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }] }));
  await page.route(/\/api\/v1\/me(?:\?.*)?$/, route =>
    loggedIn ? route.fulfill({ json: actor }) : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => {
    loggedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/me/work", route => route.fulfill({ json: work }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("button", { name: "Impulse — открыть разделы" }).click();
  const navigation = page.getByRole("dialog", { name: "Главное меню" });
  const group = navigation.getByRole("button", { name: "Практика", exact: true });
  if (await group.getAttribute("aria-expanded") !== "true") await group.click();
  await navigation.getByRole("link", { name: "Мои проекты", exact: true }).click();
  await expect(page.locator(".mpv2")).toBeVisible();
}

function parseRgb(value: string): number[] {
  const match = value.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!match) throw new Error("Unsupported computed color: " + value);
  return match.slice(1, 4).map(Number);
}
function luminance(value: string) {
  const rgb = parseRgb(value).map(n => n / 255).map(n =>
    n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
async function expectSurface(page: Page, selector: string, description: string) {
  const color = await page.locator(selector).first().evaluate(el => getComputedStyle(el).backgroundColor);
  expect(luminance(color), description + " must have a light surface").toBeGreaterThan(0.8);
}
async function expectTextContrast(page: Page, selector: string, backgroundSelector: string) {
  const colors = await page.locator(selector).first().evaluate((el, parent) => ({
    ink: getComputedStyle(el).color,
    background: getComputedStyle(el.closest(parent) || el).backgroundColor,
  }), backgroundSelector);
  const text = luminance(colors.ink), bg = luminance(colors.background);
  const contrast = (Math.max(text, bg) + 0.05) / (Math.min(text, bg) + 0.05);
  expect(contrast, selector + " must meet AA on " + backgroundSelector).toBeGreaterThanOrEqual(4.5);
}

for (const width of [320, 390, 1440]) {
  test("My Projects list keeps light backgrounds and legible labels at " + String(width) + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 840 });
    await enterProjects(page, "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const root = page.locator(".mpv2");
    await root.getByRole("group", { name: "Режим проектов" }).getByRole("button", { name: "Список" }).click();
    await expect(root.locator(".mp-table tbody tr")).toHaveCount(2);
    for (const [selector, description] of [
      [".mp-table-scroll", "table wrapper"],
      [".mp-table thead th", "table header"],
      [".mp-table tbody td", "table cell"],
      [".mp-list-search", "search"],
      [".mp-table-open", "open action"],
      [".mp-filters button", "filter"],
      [".mp-help", "help action"],
    ]) {
      await expectSurface(page, ".mpv2 " + selector, description);
    }
    await expectTextContrast(page, ".mp-table-project strong", ".mp-table tbody td");
    await expectTextContrast(page, ".mp-table th", ".mp-table th");
    await expectTextContrast(page, ".mp-table-project small", ".mp-table tbody td");
    await root.getByRole("button", { name: "Как это работает?" }).click();
    await expectSurface(page, ".mpv2 .mp-help-banner", "help explanation");
    await expect(page.getByRole("region", { name: "Как работают мои проекты" })).toBeVisible();
    await root.getByRole("button", { name: "Как это работает?" }).click();
    if (width < 500) {
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, "table scroll stays within its wrapper").toBeLessThanOrEqual(2);
    }
  });
}

test("light card layout retains readable project titles and white search", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 840 });
  await enterProjects(page, "light");
  const root = page.locator(".mpv2");
  await root.getByRole("group", { name: "Режим проектов" }).getByRole("button", { name: "Карточки" }).click();
  await expect(root.locator(".mp-project-tile")).toHaveCount(2);
  await expectSurface(page, ".mpv2 .mp-card-list__header", "card toolbar");
  await expectSurface(page, ".mpv2 .mp-card-list__header label", "card search");
  await expectSurface(page, ".mpv2 .mp-project-tile", "project card");
  await expectTextContrast(page, ".mp-project-tile__identity > strong", ".mp-project-tile");
  await expectTextContrast(page, ".mp-project-tile__identity small", ".mp-project-tile");
  await root.getByRole("button", { name: "Список" }).click();
  await expect(root.locator(".mp-table")).toBeVisible();
});

test("night palette preserves navy table header", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 840 });
  await enterProjects(page, "dark");
  await page.locator(".mpv2").getByRole("button", { name: "Список" }).click();
  const dark = await page.locator(".mp-table thead th").first().evaluate(el => getComputedStyle(el).backgroundColor);
  expect(luminance(dark)).toBeLessThan(0.1);
});
