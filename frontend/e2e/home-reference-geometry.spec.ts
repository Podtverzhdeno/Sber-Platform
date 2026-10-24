import { expect, test, type Page } from "@playwright/test";

import { overviewFixture } from "../src/features/participant-home-v2/fixture";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Портфолио"],
  csrf_token: "reference-geometry",
};

async function openReferenceHome(page: Page) {
  let loggedIn = false;
  await page.route("**/api/v1/config", (route) =>
    route.fulfill({ json: { demo_mode: true } }),
  );
  await page.route("**/api/v1/auth/personas", (route) =>
    route.fulfill({
      json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }],
    }),
  );
  await page.route("**/api/v1/me", (route) =>
    loggedIn
      ? route.fulfill({ json: actor })
      : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }),
  );
  await page.route("**/api/v1/auth/demo-login", (route) => {
    loggedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/participant/me/development-overview", (route) =>
    route.fulfill({ json: overviewFixture }),
  );
  await page.route("**/api/v1/me/talent-passport", (route) =>
    route.fulfill({ json: { verified_courses: [], cases: [], skills: [] } }),
  );
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/0");
  await expect(page.locator(".home-v2-hero")).toBeVisible();
}

async function expectReferenceRect(
  page: Page,
  selector: string,
  reference: { x: number; y: number; width: number; height: number },
  tolerance = 10,
) {
  const actual = await page.locator(selector).boundingBox();
  expect(actual, `Expected ${selector} to render`).not.toBeNull();
  for (const field of ["x", "y", "width", "height"] as const) {
    const measured = actual?.[field];
    expect(
      measured,
      `${selector} ${field} must stay within ${String(tolerance)}px of the supplied ZIP screenshot`,
    ).toBeGreaterThanOrEqual(reference[field] - tolerance);
    expect(measured).toBeLessThanOrEqual(reference[field] + tolerance);
  }
}

test("desktop home tracks original ZIP card geometry at 1448px", async ({ page }) => {
  await page.setViewportSize({ width: 1448, height: 1057 });
  await openReferenceHome(page);
  await expectReferenceRect(page, ".home-v2-hero", { x: 252, y: 111, width: 566, height: 310 });
  await expectReferenceRect(page, ".home-v2-grade", { x: 829, y: 111, width: 264, height: 310 });
  await expectReferenceRect(page, ".home-v2-weekly", { x: 1104, y: 111, width: 315, height: 310 });
  await expectReferenceRect(page, ".home-v2-next-outcome", { x: 252, y: 437, width: 741, height: 172 });
  await expectReferenceRect(page, ".home-v2-tasks", { x: 252, y: 625, width: 741, height: 305 });
  await expectReferenceRect(page, ".home-v2-buddy", { x: 1009, y: 437, width: 410, height: 197 });
  await expectReferenceRect(page, ".home-v2-passport", { x: 1009, y: 650, width: 410, height: 262 });
});

test("mobile home tracks original ZIP card ordering and artwork at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReferenceHome(page);
  await expectReferenceRect(page, ".home-v2-hero", { x: 11, y: 76, width: 368, height: 367 }, 12);
  await expectReferenceRect(page, ".home-v2-grade", { x: 11, y: 455, width: 368, height: 291 }, 12);
  await expectReferenceRect(page, ".home-v2-weekly", { x: 11, y: 758, width: 368, height: 261 }, 14);
  await expectReferenceRect(page, ".home-v2-next-outcome", { x: 11, y: 1032, width: 368, height: 208 }, 14);
  const art = page.locator(".home-v2-hero-art");
  await expect(art).toHaveAttribute("src", "/home-reference/mountain-path.svg");
  await expect(page.locator(".home-v2-buddy-content img")).toHaveAttribute(
    "src", "/home-reference/buddy.svg",
  );
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});
