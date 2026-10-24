import { expect, test } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Главная", "Моя траектория", "Bootcamp", "Задачи"],
  csrf_token: "csrf",
};

test("home v2 avoids redundant welcome hero and preserves legacy rollback", async ({ page }) => {
  let loggedIn = false;
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }] }));
  await page.route("**/api/v1/me", (route) =>
    loggedIn ? route.fulfill({ json: actor }) : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }),
  );
  await page.route("**/api/v1/auth/demo-login", (route) => {
    loggedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/participant/me/development-overview", (route) =>
    route.fulfill({ status: 503, json: { code: "SERVICE_UNAVAILABLE", message: "offline" } }),
  );
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/0?v2=1");
  await expect(page.getByRole("button", { name: "Вернуться к классической главной" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Добро пожаловать/ })).toHaveCount(0);
  await expect(page.getByText("Не удалось загрузить обзор развития.")).toBeVisible();
  await page.getByRole("button", { name: "Вернуться к классической главной" }).click();
  await expect(page).not.toHaveURL(/v2=1/);
  await expect(page.getByRole("heading", { name: /Добро пожаловать/ })).toBeVisible();
});
