import { expect, test, type Page } from "@playwright/test";

async function setupCustomer(page: Page, navigation: string[]): Promise<void> {
  const actor = {
    person_id: "00000000-0000-0000-0000-000000000005",
    display_name: "Алексей",
    active_role: "customer",
    assigned_roles: ["customer"],
    scopes: [], consent_scopes: [], navigation, csrf_token: "customer-demo-chat",
  };
  let loggedIn = false;
  await page.route("**/api/v1/**", route =>
    route.fulfill({ status: 404, json: { code: "NOT_MOCKED" } }));
  await page.route("**/api/v1/config", route =>
    route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", route =>
    route.fulfill({ json: [{ key: "customer-roman", display_name: actor.display_name, roles: ["customer"] }] }));
  await page.route(/\/api\/v1\/me(?:\?.*)?$/, route => loggedIn
    ? route.fulfill({ json: actor })
    : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => {
    loggedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/me/messaging/channels", route =>
    route.fulfill({ json: [] }));
  await page.goto("/");
  await page.locator('[data-persona="customer-roman"]').click();
}

for (const width of [320, 390, 1440]) {
  test(`synthetic candidate safely opens authorized Messages list at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await setupCustomer(page, [
      "Главная", "Мои задачи", "Создать задачу", "Заявки", "Аналитика",
      "AI-помощник", "База участников", "Сообщения", "Настройки",
    ]);
    await page.goto("/workspace/1");
    const action = page.locator(".task-team-compact").getByRole("button", { name: "Открыть чаты" }).first();
    await expect(action).toBeEnabled();
    await action.click();
    await expect(page).toHaveURL(/\/workspace\/7$/);
    expect(page.url()).not.toContain("participant=p1");
    expect(page.url()).not.toContain("task=IMP-");
    await expect(page.locator(".messenger-page")).toBeVisible();

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `No global overflow at ${String(width)}px`).toBeLessThanOrEqual(2);
  });
}

test("Messages destination follows original server-approved order", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setupCustomer(page, ["Главная", "Сообщения", "Мои задачи"]);
  await page.goto("/workspace/2");
  await page.locator(".task-team-compact").getByRole("button", { name: "Открыть чаты" }).first().click();
  await expect(page).toHaveURL(/\/workspace\/1$/);
  await expect(page.locator(".messenger-page")).toBeVisible();
});

test("Synthetic candidate cannot open messaging without server authorization", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await setupCustomer(page, ["Главная", "Мои задачи"]);
  await page.goto("/workspace/1");
  const action = page.locator(".task-team-compact").getByRole("button", { name: "Открыть чаты" }).first();
  await expect(action).toBeDisabled();
  await expect(page.getByRole("button", { name: "Написать", exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/\/workspace\/1$/);
});
