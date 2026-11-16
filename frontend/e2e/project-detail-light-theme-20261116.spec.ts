import { expect, test, type Page } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [], consent_scopes: [],
  navigation: ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Мои проекты", "События", "Настройки"],
  csrf_token: "project-detail-light-qa",
};
const items = [{
  id: "assignment-1", taskId: "task-assignment-1",
  title: "Прототип рекомендательной системы для статей",
  status: "in_progress", deadline: "2026-12-20T11:00:00Z",
}];
const work = items.map(item => ({
  assignment: { id: item.id, task_id: item.taskId, person_id: actor.person_id, status: item.status },
  task: { id: item.taskId, title: item.title, status: item.status, competency_tags: ["Аналитика", "Python"] },
  terms: { version: 1, deadline_at: item.deadline, deliverable: "Рабочий прототип", acceptance_criteria: ["Код", "Демонстрация", "Отчёт"] },
  contributions: [{ id: "contribution-1", version: 1, personal_summary: "Подготовлен модуль рекомендаций", artifact_keys: ["report"], status: "reported" }],
  decisions: [{ id: "review-1", contribution_id: "contribution-1", decision: "accepted", reason: "Результат проверен", deadline_at: null }],
  allowed_artifacts: ["report", "git-commit"],
}));
const tabs = ["Обзор", "Задачи", "Прогресс", "Мой вклад", "Команда", "Бонусы и выгоды"] as const;

async function openDetail(page: Page, mode: "light" | "dark") {
  await page.addInitScript((theme: string) => {
    localStorage.setItem("impulse-theme", theme);
    localStorage.setItem("impulse-visual-mode", theme === "light" ? "light" : "midnight");
  }, mode);
  let loggedIn = false;
  await page.route("**/api/v1/**", route => route.fulfill({ status: 404, json: { code: "UNMOCKED" } }));
  await page.route("**/api/v1/config", route => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({
    json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }],
  }));
  await page.route(/\/api\/v1\/me(?:\?.*)?$/, route =>
    loggedIn ? route.fulfill({ json: actor }) : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => {
    loggedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/me/work", route => route.fulfill({ json: work }));
  await page.route(/\/api\/v1\/me\/tasks\/task-assignment-[0-9]+$/, route => route.fulfill({ json: {
    task: { id: items[0].taskId, title: items[0].title },
    customer: { id: "customer-1", display_name: "Сбер" },
    mentor: { id: "mentor-1", display_name: "Мария Волкова" },
    team: [
      { person_id: actor.person_id, display_name: actor.display_name, status: "in_progress" },
      { person_id: "mentor-1", display_name: "Мария Волкова", status: "mentor" },
    ],
    checkpoints: ["Постановка", "Прототип", "Тестирование"].map((title, i) => ({
      key: "cp-" + String(i), title, status: i === 0 ? "completed" : "pending",
    })),
    personal: [], feedback: [], problem: "Спроектировать и проверить прототип рекомендательной системы",
  } }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/4", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".mpv2 .mp-table tbody tr")).toHaveCount(1);
  await page.locator(".mp-table-open").first().click();
  const dialog = page.getByRole("dialog", { name: items[0].title });
  await expect(dialog).toBeVisible();
  return dialog;
}

function brightness(color: string): number {
  const rgb = color.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  const srgb = color.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (!rgb && !srgb) throw new Error("Unsupported computed color: " + color);
  const values = rgb?.slice(1, 4).map(x => Number(x) / 255) ?? srgb?.slice(1, 4).map(Number);
  if (!values) throw new Error("Invalid computed color: " + color);
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
function linearLuminance(color: string): number {
  const rgb = color.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  const srgb = color.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (!rgb && !srgb) throw new Error("Unsupported computed color: " + color);
  const values = rgb?.slice(1, 4).map(x => Number(x) / 255) ?? srgb?.slice(1, 4).map(Number);
  if (!values) throw new Error("Invalid computed color: " + color);
  const channels = values.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
async function expectLight(page: Page, selector: string) {
  const surface = await page.locator(selector).first().evaluate(el => getComputedStyle(el).backgroundColor);
  expect(brightness(surface), selector + " background " + surface).toBeGreaterThan(0.8);
}
async function expectContrast(page: Page, textSelector: string, surfaceSelector: string) {
  const ink = await page.locator(textSelector).first().evaluate(el => getComputedStyle(el).color);
  const bg = await page.locator(surfaceSelector).first().evaluate(el => getComputedStyle(el).backgroundColor);
  const [i, b] = [linearLuminance(ink), linearLuminance(bg)];
  expect((Math.max(i, b) + 0.05) / (Math.min(i, b) + 0.05), textSelector).toBeGreaterThanOrEqual(4.5);
}

for (const width of [320, 390, 1440]) {
  test("light full-screen project detail remains readable at " + String(width) + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: width < 500 ? 760 : 900 });
    const dialog = await openDetail(page, "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    for (const selector of [".mp-detail[data-project-screen=detail]", ".mp-ref-hero", ".mp-ref-tabs", ".mp-detail-panel"]) {
      await expectLight(page, ".mpv2 " + selector);
    }
    await expectContrast(page, ".mp-ref-hero h1", ".mp-ref-hero");
    await expectContrast(page, ".mp-detail-panel h2", ".mp-detail-panel");
    for (const name of tabs) {
      await dialog.getByRole("tab", { name }).click();
      await expect(dialog.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
      const card = dialog.locator(".mp-ref-card, .mp-detail-panel").first();
      await expect(card).toBeVisible();
      await expectLight(page, ".mpv2 .mp-detail[data-project-screen=detail] .mp-ref-card, .mpv2 .mp-detail[data-project-screen=detail] .mp-detail-panel");
      if (name === "Обзор") {
        await expectLight(page, ".mpv2 .mp-overview-next");
        await expectContrast(page, ".mp-overview-next > header h2", ".mp-overview-next");
        await expect(dialog.locator(".mp-key-facts > span")).toHaveCount(4);
        await expectContrast(page, ".mp-key-facts > span", ".mp-detail-panel");
        await expect(dialog.locator(".mp-compact-progress > header > strong")).toBeVisible();
        await expectContrast(page, ".mp-compact-progress > header > strong", ".mp-compact-progress");
        await expect(dialog.locator(".mp-team-member small").first()).toBeVisible();
        await expectContrast(page, ".mp-team-member small", ".mp-detail-panel");
        await expectContrast(page, ".mp-outcome-band > span", ".mp-outcome-band");
        const action = dialog.locator(".mp-inline-action").first();
        await action.hover();
        await expectContrast(page, ".mp-inline-action:hover", ".mp-detail-panel");
      }
      if (name === "Задачи") {
        await expectLight(page, ".mpv2 .mp-ref-task-row");
        await expectContrast(page, ".mp-ref-task-copy strong", ".mp-ref-task-row");
        await expect(dialog.locator(".mp-ref-activity > span")).toContainText(["Ревью"]);
        await expectContrast(page, ".mp-ref-activity > span", ".mp-ref-card");
      }
      if (name === "Прогресс") {
        await expectLight(page, ".mpv2 .mp-ref-skill");
        await expectContrast(page, ".mp-ref-skill strong", ".mp-ref-skill");
        // Completion labels and pending markers sit on white progress cards.
        const stages = dialog.locator(".mp-ref-stage");
        await expect(stages).toHaveCount(3);
        for (const stage of await stages.all()) {
          const labelColor = await stage.locator("em").evaluate(el => getComputedStyle(el).color);
          const cardColor = await stage.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' mp-ref-card ')][1]").evaluate(el => getComputedStyle(el).backgroundColor);
          const a = linearLuminance(labelColor), b = linearLuminance(cardColor);
          expect((Math.max(a, b) + .05) / (Math.min(a, b) + .05), "stage progress label contrast").toBeGreaterThanOrEqual(4.5);
        }
      }
      if (name === "Мой вклад") {
        await expectLight(page, ".mpv2 .mp-ref-contrib-head");
        await expectLight(page, ".mpv2 .mp-ref-contrib-metrics > div");
        await expectContrast(page, ".mp-ref-contrib-metrics strong", ".mp-ref-contrib-metrics > div");
        await expectLight(page, ".mpv2 .mp-contribute-form textarea");
        await expectContrast(page, ".mp-explain-steps li > strong", ".mp-detail-panel");
      }
      if (name === "Команда") {
        await expectLight(page, ".mpv2 .mp-ref-responsibility > div");
        await expectContrast(page, ".mp-ref-person strong", ".mp-ref-card");
      }
      if (name === "Бонусы и выгоды") {
        await expectLight(page, ".mpv2 .mp-ref-rewards button");
        await expectContrast(page, ".mp-ref-rewards button strong", ".mp-ref-rewards button");
      }
    }
    if (width < 500) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
        .toBeLessThanOrEqual(2);
    }
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    if (bounds) {
      expect(bounds.x).toBeGreaterThanOrEqual(-1);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
}

test("dark project detail stays dark and modal closes with Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 });
  const dialog = await openDetail(page, "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const bg = await dialog.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(brightness(bg)).toBeLessThan(0.15);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
