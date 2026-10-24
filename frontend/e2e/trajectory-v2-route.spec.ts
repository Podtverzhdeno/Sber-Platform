import { expect, test } from "@playwright/test";

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

test("opt-in trajectory v2 is API-backed and legacy route stays available", async ({ page }) => {
  let loggedIn = false;
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }] }));
  await page.route("**/api/v1/me", (route) => loggedIn ? route.fulfill({ json: actor }) : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => { loggedIn = true; return route.fulfill({ json: actor }); });
  await page.route("**/api/v1/participant/me/development-overview", (route) => route.fulfill({ status: 503, json: { code: "SERVICE_UNAVAILABLE" } }));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();

  await page.goto("/workspace/1?v2=1");
  await expect(page.locator(".trajectory-v2")).toBeVisible();
  await expect(page.getByText("Не удалось загрузить траекторию.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Повторить" })).toBeVisible();

  await page.goto("/workspace/1");
  await expect(page.locator(".trajectory-v2")).toHaveCount(0);
});
