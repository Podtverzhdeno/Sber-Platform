import { expect, test, type Page } from "@playwright/test";

const ACTOR = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Главная"],
  csrf_token: "csrf",
};
function installRoutes(page: Page): void {
  void page.route("**/api/v1/config", route => route.fulfill({ json: { honor_board_enabled: false } }));
  void page.route("**/api/v1/auth/personas", route => route.fulfill({ json: [{ key: "participant-alex", display_name: ACTOR.display_name, roles: ["participant"] }] }));
  void page.route("**/api/v1/me", route => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  void page.route("**/api/v1/auth/demo-login", route => route.fulfill({ json: ACTOR }));
  void page.route("**/api/v1/me/engagement/overview", route => route.fulfill({ json: {
    current_days: 11, best_days: 24, qualified_dates: [
      "2026-10-14","2026-10-15","2026-10-16","2026-10-17","2026-10-18","2026-10-19",
      "2026-10-20","2026-10-21","2026-10-22","2026-10-23","2026-10-24"
    ],
    today_saved: false, reason: "Отличный результат! Продолжай развиваться, и серия будет расти.", grace_available: false, frozen_dates: [], freeze_state: "idle",
  } }));
  void page.route("**/api/v1/me/engagement/freeze", route => route.fulfill({ json: {
    policy_version: 1, granted_total: 1, available: 1, consumed_total: 0,
  } }));
  void page.route("**/api/v1/me/engagement/rhythm", route => route.fulfill({ json: {
    versioned: true, history_count: 1, version: 1, preset: "workdays",
    active_days: [1,2,3,4,5], reminder_hour: 18, reminder_window_hours: 3,
    effective_from: "2026-10-19", week_start: "2026-10-19", week_end: "2026-10-25",
    target_days: 5, done_days: 5, hint: null, scheduled_from: null, scheduled_preset: null,
  } }));
}
test("compact streak composition: desktop 1122px", async ({ page }) => {
  test.setTimeout(75_000);
  await page.setViewportSize({ width: 1122, height: 1402 });
  installRoutes(page);
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page.locator(".theme-toggle")).toHaveCount(0);
  await page.getByRole("button", { name: /Учебный стрик: 11 дней/ }).click();
  const dialog = page.getByRole("dialog", { name: "Учебный стрик" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".streak-heading")).toContainText("Квалифицированная серия");
  await expect(dialog.locator(".streak-facts")).toContainText("24 дня");
  await expect(dialog.locator(".engagement-rhythm-block")).toBeVisible();
  const modal = await dialog.boundingBox();
  const week = await dialog.locator(".streak-week-card").boundingBox();
  if (!modal || !week) throw new Error("Reference geometry not rendered");
  expect(modal.width).toBeGreaterThanOrEqual(606);
  expect(modal.width).toBeLessThanOrEqual(625);
  expect(modal.x).toBeGreaterThan(240);
  expect(modal.x).toBeLessThan(260);
  expect(modal.height).toBeLessThanOrEqual(860);
  expect(week.width).toBeGreaterThan(545);
  expect(week.width).toBeLessThan(580);
  expect(week.x).toBeGreaterThanOrEqual(modal.x);
  const cards = await dialog.locator(".streak-facts").boundingBox();
  const rhythm = await dialog.locator(".engagement-rhythm-block").boundingBox();
  const save = await dialog.locator(".streak-save-button").boundingBox();
  if (!cards || !rhythm || !save) throw new Error("Streak landmarks not rendered");
  expect(cards.y).toBeGreaterThanOrEqual(week.y + week.height);
  expect(rhythm.y).toBeGreaterThanOrEqual(cards.y + cards.height);
  expect(save.y).toBeGreaterThanOrEqual(rhythm.y + rhythm.height);
  const milestone = await dialog.locator(".streak-next-goal").boundingBox();
  const closeButton = await dialog.getByRole("button", { name: "Закрыть", exact: true }).boundingBox();
  if (!milestone || !closeButton) throw new Error("Milestone callout or close button missing");
  expect(milestone.x + milestone.width).toBeLessThanOrEqual(closeButton.x - 3);
  const help = dialog.getByRole("button", { name: "Что такое недельный ритм?" });
  const helpBounds = await help.boundingBox();
  if (!helpBounds) throw new Error("Weekly rhythm help control is missing");
  expect(Math.abs(helpBounds.width - helpBounds.height)).toBeLessThanOrEqual(1);
  expect(helpBounds.width).toBeGreaterThanOrEqual(23);
  expect(helpBounds.width).toBeLessThanOrEqual(25);
  await help.hover();
  await expect(dialog.getByRole("tooltip")).toBeVisible();
  await page.screenshot({ path: "test-results/streak-reference-desktop.png" });
  await dialog.getByRole("button", { name: "Открыть полный календарь серии" }).click();
  await expect(dialog.getByText("2026-10-15")).toBeVisible();
  await dialog.getByRole("button", { name: /Вернуться к серии/ }).click();
  await expect(dialog.locator(".streak-week-card")).toBeVisible();
});

test("compact modal never exceeds 85vh on a laptop and retains a scrollable save action", async ({ page }) => {
  test.setTimeout(75_000);
  await page.setViewportSize({ width: 1440, height: 800 });
  installRoutes(page);
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("button", { name: /Учебный стрик: 11 дней/ }).click();
  const dialog = page.getByRole("dialog", { name: "Учебный стрик" });
  await expect(dialog).toBeVisible();
  const geometry = await dialog.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return { width: rect.width, height: rect.height, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
  });
  expect(geometry.width).toBeLessThanOrEqual(625);
  expect(geometry.height).toBeLessThanOrEqual(800 * 0.85 + 1);
  expect(geometry.scrollHeight).toBeGreaterThanOrEqual(geometry.clientHeight);
  const save = dialog.getByRole("button", { name: "Сохранить ритм" });
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeVisible();
  await page.screenshot({ path: "test-results/streak-reference-laptop.png" });
});

test("streak mobile 390px: no clipping and all actions reachable", async ({ page }) => {
  test.setTimeout(75_000);
  await page.setViewportSize({ width: 390, height: 844 });
  installRoutes(page);
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("button", { name: /Учебный стрик: 11 дней/ }).click();
  const dialog = page.getByRole("dialog", { name: "Учебный стрик" });
  await expect(dialog).toBeVisible();
  const geometry = await dialog.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return { x: rect.x, right: rect.right, width: rect.width, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  expect(geometry.x).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(391);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 2);
  await page.screenshot({ path: "test-results/streak-reference-mobile.png" });
  const mobileHelp = dialog.getByRole("button", { name: "Что такое недельный ритм?" });
  const mobileHelpBounds = await mobileHelp.boundingBox();
  if (!mobileHelpBounds) throw new Error("Mobile weekly rhythm help control is missing");
  expect(Math.abs(mobileHelpBounds.width - mobileHelpBounds.height)).toBeLessThanOrEqual(1);
  await mobileHelp.click();
  await expect(dialog.getByRole("tooltip")).toBeVisible();
  await dialog.getByRole("button", { name: "Открыть полный календарь серии" }).click();
  await expect(dialog.getByText("2026-10-24")).toBeVisible();
  await dialog.getByRole("button", { name: /Вернуться к серии/ }).click();
  await dialog.getByRole("button", { name: "Закрыть" }).click();
  await expect(dialog).toHaveCount(0);
});
