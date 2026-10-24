import { expect, test } from "@playwright/test";

test("Bootcamp v2 is opt-in and fails closed when published projection is unavailable", async ({ page }) => {
  let loggedIn = false;
  const actor = {
    person_id: "00000000-0000-0000-0000-000000000001",
    display_name: "Алекс Речной",
    active_role: "participant",
    assigned_roles: ["participant"],
    scopes: [],
    consent_scopes: [],
    navigation: ["Главная", "Моя траектория", "Bootcamp"],
    csrf_token: "csrf-bootcamp-v2",
  };
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [
    { key: "participant-alex", display_name: "Алекс Речной", roles: ["participant"] },
  ] }));
  await page.route("**/api/v1/me", (route) => loggedIn
    ? route.fulfill({ json: actor })
    : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => {
    loggedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/me/bootcamp/overview**", (route) =>
    route.fulfill({ status: 503, json: { code: "BOOTCAMP_PROVIDER_UNAVAILABLE" } }));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/2?v2=1");
  await expect(page.getByRole("heading", { name: "Bootcamp · новый интерфейс" })).toBeVisible();
  await expect(page.getByText(/не подменяются демоданными/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Открыть действующий Bootcamp" })).toBeVisible();
  await page.getByRole("button", { name: "Открыть действующий Bootcamp" }).click();
  await expect(page).not.toHaveURL(/v2=1/);
  await expect(page.getByRole("heading", { name: "Bootcamp · новый интерфейс" })).toHaveCount(0);
});
