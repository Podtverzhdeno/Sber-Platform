import { expect, test } from "@playwright/test";

async function openCustomer(page: import("@playwright/test").Page) {
  const actor = { person_id: "00000000-0000-0000-0000-000000000005", display_name: "Алексей", active_role: "customer", assigned_roles: ["customer"], scopes: [], consent_scopes: [], navigation: ["Главная"], csrf_token: "csrf" };
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "customer-roman", display_name: actor.display_name, roles: ["customer"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: actor }));
  await page.goto("/");
  await page.locator('[data-persona="customer-roman"]').click();
}

test("customer premium workspace renders every route without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openCustomer(page);

  const sidebar = page.getByRole("navigation", { name: "Навигация роли" });
  await expect(sidebar.getByRole("link")).toHaveCount(9);
  for (const section of ["Главная", "Мои задачи", "Создать задачу", "Заявки", "Результаты", "Аналитика", "AI-помощник", "Кандидаты", "Сообщения"]) {
    await sidebar.getByRole("link", { name: section, exact: true }).click();
    await expect(page.locator(".premium-page, .messenger-page, .analytics-dashboard, .buddy-page, .create-task-workspace").first()).toBeVisible();
    const overflow = await page.evaluate<boolean>("document.documentElement.scrollWidth > document.documentElement.clientWidth");
    expect(overflow, `${section} has horizontal overflow`).toBe(false);
    await page.screenshot({ path: `test-results/customer-${section.replace(/[^a-zа-я0-9]+/giu, "-")}.png`, fullPage: true });
  }
});

test("customer task, application and candidate actions are interactive", async ({ page }) => {
  await openCustomer(page);
  const sidebar=page.getByRole("navigation",{name:"Навигация роли"});
  await sidebar.getByRole("link",{name:"Мои задачи",exact:true}).click();
  await page.getByLabel("Поиск по задачам").fill("аномалий");
  await expect(page.locator(".premium-tr")).toHaveCount(2);
  await page.getByRole("button",{name:"Фильтры"}).click();
  await expect(page.getByRole("dialog",{name:"Фильтры задач"})).toBeVisible();
  await page.getByRole("button",{name:"Готово"}).click();
  await sidebar.getByRole("link",{name:"Заявки",exact:true}).click();
  await page.getByRole("button",{name:"Открыть профиль"}).click();
  await expect(page.getByRole("dialog",{name:/Цифровой профиль/})).toBeVisible();
  await page.getByRole("button",{name:"×"}).click();
  await page.getByRole("button",{name:"В шорт-лист"}).click();
  await expect(page.getByRole("dialog",{name:"Добавлен в шорт-лист"})).toBeVisible();
  await page.getByRole("button",{name:"Готово"}).click();
  await sidebar.getByRole("link",{name:"Кандидаты",exact:true}).click();
  await page.getByRole("button",{name:"Пригласить в задачу"}).click();
  await expect(page.getByRole("dialog",{name:"Готово"})).toBeVisible();
});
