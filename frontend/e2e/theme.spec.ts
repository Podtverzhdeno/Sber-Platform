import { expect, test } from "@playwright/test";

test.use({ colorScheme: "light" });

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Главная"],
  csrf_token: "csrf",
};

let themeCommands: Array<{ theme: string }> = [];

test.beforeEach(async ({ page }) => {
  themeCommands = [];
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { honor_board_enabled: false } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: actor }));
  await page.route("**/api/v1/me/theme", async (route) => {
    themeCommands.push(JSON.parse(route.request().postData() ?? "{}") as { theme: string });
    await route.fulfill({ json: actor });
  });
});

test("system theme is used until the participant makes an explicit choice", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page.locator(".theme-toggle")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(themeCommands).toEqual([]);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page.locator(".theme-toggle")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("topbar toggle applies the opposite theme immediately and persists it", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  const toggle = page.locator(".theme-toggle");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveAttribute("aria-label", "Тёмная тема включена. Переключить на светлую.");
  expect(themeCommands.at(-1)).toEqual({ theme: "dark" });
  const themedHtml = await page.evaluate("document.documentElement.outerHTML");
  expect(themedHtml).toContain('data-theme="dark"');
});

test("theme choice survives reload and responds to the keyboard", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  const toggle = page.locator(".theme-toggle");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(themeCommands.at(-1)).toEqual({ theme: "dark" });
  await page.reload();
  await expect(page.locator('[data-persona="participant-alex"]')).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page.locator(".theme-toggle")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Tab");
  await page.locator(".theme-toggle").focus();
  await page.keyboard.press("Space");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(themeCommands.at(-1)).toEqual({ theme: "light" });
});
