import { expect, test, type Page } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Рейтинг"],
  csrf_token: "csrf-test",
};

async function openTopbar(page: Page, place: number | null, published = true) {
  let loggedIn = false;
  await page.route("**/api/v1/config", route => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({
    json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }],
  }));
  await page.route(/\/api\/v1\/me$/, route => loggedIn
    ? route.fulfill({ json: actor })
    : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => {
    loggedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/rating-seasons", route => route.fulfill({
    json: published ? [{ id: "autumn", key: "autumn", status: "published", version: 1, title: "Осень" }] : [],
  }));
  await page.route("**/api/v1/rating-seasons/autumn/leaderboard", route => route.fulfill({
    json: place === null ? [
      { person_id: "someone-else", place: 1, anonymized: false, score: "100", successful_projects: 1, display_name: "Другой", trophies: [], offers: [] },
    ] : [
      { person_id: actor.person_id, place, anonymized: false, score: "80", successful_projects: 1, display_name: actor.display_name, trophies: [], offers: [] },
    ],
  }));
  await page.route("**/api/v1/participant/me/development-overview", route => route.fulfill({ status: 503, json: { code: "SERVICE_UNAVAILABLE" } }));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/0");
}

test("compact flame chip and miniature bell retain their interactions", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await openTopbar(page, 8);
  const streak = page.locator(".topbar .streak-button");
  const bell = page.locator(".topbar .notification-button");
  await expect(streak).toBeVisible();
  await expect(streak.locator("svg")).toHaveCount(0); // The redundant chevron is removed.
  const size = await streak.boundingBox();
  if (!size) throw new Error("Streak geometry missing");
  expect(size.width).toBeLessThanOrEqual(80);
  expect(size.height).toBeLessThanOrEqual(38);
  await expect(bell.locator("svg")).toHaveCSS("width", "16px");
  await streak.click();
  await expect(page.getByRole("dialog", { name: "Учебный стрик" })).toBeVisible();
  await page.getByRole("button", { name: "Закрыть серию" }).click();
  await bell.click();
  await expect(page.getByRole("dialog", { name: "Центр уведомлений" })).toBeVisible();
});

test("ranking shows the published personal place instead of another participant's", async ({ page }) => {
  await openTopbar(page, 8);
  const rank = page.locator(".topbar .ranking-utility--personal");
  await expect(rank).toContainText("Место 8");
  await expect(rank).toHaveAttribute("aria-label", "Открыть рейтинг участников. Ваше место: 8");
  await rank.click();
  await expect(page).toHaveURL(/\/workspace\/4/);
});

test("ranking displays a dash when the person has no published position", async ({ page }) => {
  await openTopbar(page, null);
  const rank = page.locator(".topbar .ranking-utility--personal");
  await expect(rank).toContainText("Место —");
  await expect(rank).not.toContainText("Место 8");
});
