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
  await expect(sidebar.getByRole("link")).toHaveCount(8);
  for (const section of ["Главная", "Мои задачи", "Создать задачу", "Заявки", "Аналитика", "AI-помощник", "База участников", "Сообщения"]) {
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
  await expect(page.getByRole("button",{name:"Фильтры"})).toHaveCount(0);
  await sidebar.getByRole("link",{name:"Заявки",exact:true}).click();
  await page.getByRole("button",{name:"Открыть профиль"}).click();
  await expect(page.getByRole("dialog",{name:/Цифровой профиль/})).toBeVisible();
  await page.getByRole("button",{name:"×"}).click();
  await page.getByRole("button",{name:"В шорт-лист"}).click();
  await expect(page.getByRole("dialog",{name:"Добавлен в шорт-лист"})).toBeVisible();
  await page.getByRole("button",{name:"Готово"}).click();
  await sidebar.getByRole("link",{name:"База участников",exact:true}).click();
  await page.getByRole("button",{name:"Пригласить в задачу"}).click();
  await expect(page.getByRole("dialog",{name:"Готово"})).toBeVisible();
});

test("customer opens the selected participant profile and direct dialog", async ({ page }) => {
  await openCustomer(page);
  await page.getByRole("navigation",{name:"Навигация роли"}).getByRole("link",{name:"Мои задачи",exact:true}).click();
  await page.getByRole("button",{name:"Профиль",exact:true}).first().click();
  await expect(page.getByRole("dialog",{name:/Никита Соколов/})).toBeVisible();
  await page.getByRole("button",{name:"×"}).click();
  await page.getByRole("navigation",{name:"Навигация роли"}).getByRole("link",{name:"Мои задачи",exact:true}).click();
  await page.getByRole("button",{name:"Написать",exact:true}).first().click();
  await expect(page.getByRole("heading",{name:"Никита Соколов"})).toBeVisible();
  await expect(page).toHaveURL(/participant=p1/);
});

test("customer participant dialogs keep separate histories", async ({ page }) => {
  await openCustomer(page);
  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "Сообщения", exact: true }).click();
  await expect(page.getByText("Обновил рекомендательную модель")).toBeVisible();
  await page.getByRole("button", { name: /Анна Морозова/ }).click();
  await expect(page.getByText("Подготовила анализ ошибок мультимодальной модели")).toBeVisible();
  await expect(page.getByText("Обновил рекомендательную модель")).not.toBeVisible();
});

test("customer participant database contains an extended talent pool", async ({ page }) => {
  await openCustomer(page);
  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "База участников", exact: true }).click();
  await expect(page.locator(".talent-table .candidate-row")).toHaveCount(13);
  await expect(page.getByText("Мария Орлова", { exact: true })).toBeVisible();
  await expect(page.getByText("Роман Егоров", { exact: true })).toBeVisible();
});

test("customer opens the shared task workspace from my tasks", async ({ page }) => {
  await openCustomer(page);
  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "Мои задачи", exact: true }).click();
  await page.getByRole("button", { name: "Открыть задачу", exact: true }).click();
  await expect(page.locator(".ctw-page")).toBeVisible();
  await expect(page.getByText("Промежуточные артефакты")).toBeVisible();
  await page.getByRole("button", { name: "Материалы", exact: true }).click();
  await expect(page.getByRole("button", { name: "Материалы", exact: true })).toHaveClass(/active/);
});
