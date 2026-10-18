import { expect, test } from "@playwright/test";

test.skip("legacy customer pilot layout", async ({ page }) => {
  const actor = { person_id: "00000000-0000-0000-0000-000000000005", display_name: "Заказчик", active_role: "customer", assigned_roles: ["customer"], scopes: [], consent_scopes: [], navigation: ["Главная", "Мои задачи", "Кандидаты", "Приёмка", "Аналитика", "Сообщения"], csrf_token: "csrf" };
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "customer-roman", display_name: actor.display_name, roles: ["customer"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: actor }));
  await page.goto("/");
  await page.locator('[data-persona="customer-roman"]').click();
  const sidebar = page.getByRole("navigation", { name: "Навигация роли" });
  await expect(sidebar.getByRole("link")).toHaveCount(9);
  await expect(page.getByRole("navigation", { name: "Разделы заказчика" })).toHaveCount(0);
  const action = page.getByRole("button", { name: "Открыть задачу" });
  await expect(action).toBeVisible();
  await expect(action).toHaveCSS("color", "rgb(3, 32, 28)");
  await expect(action).toHaveCSS("background-image", /linear-gradient/);
  await sidebar.getByRole("link", { name: /Мои задачи/ }).click();
  await expect(page.locator(".customer-task-list .participant-task-row")).toHaveCount(4);
  await page.locator(".customer-task-list .participant-task-row").first().getByRole("button", { name: "Открыть задачу" }).click();
  await expect(page.getByRole("heading", { name: "Исполнители и менторы" })).toBeVisible();
  await expect(page.getByText("Ментор: Елена Волкова")).toBeVisible();
  await page.getByRole("button", { name: "Мария Ковалёва" }).click();
  await expect(page.getByText("Цифровой профиль компетенций")).toBeVisible();
  await expect(page.getByText("Ход мысли")).toBeVisible();
  await page.getByRole("button", { name: "Написать лично" }).click();
  await expect(page.getByRole("heading", { name: "Мария Ковалёва" })).toBeVisible();
  await sidebar.getByRole("link", { name: /Создать задачу/ }).click();
  await expect(page.getByRole("heading", { name: "Создать задачу" })).toBeVisible();
  await expect(page.getByText("Участники для адресного приглашения")).toBeVisible();
  await page.getByLabel("Название").fill("Персональный аналитический кейс");
  await page.getByLabel("Проблема и цель").fill("Проверить спрос по сезонам");
  await page.getByLabel("Ожидаемый результат").fill("Отчёт с расчётами");
  await page.getByLabel("Критерии успеха").fill("Воспроизводимый расчёт");
  await page.locator(".customer-candidate-picker input").first().check();
  for (let step = 0; step < 4; step += 1) await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await expect(page.getByRole("heading", { name: "Персональный аналитический кейс" })).toBeVisible();
  await expect(page.getByText("Ожидают ответа на приглашение: Мария Ковалёва")).toBeVisible();
});

test("customer creates drafts through the task scenario", async ({ page }) => {
  const actor = { person_id: "00000000-0000-0000-0000-000000000005", display_name: "Роман Заказчик", active_role: "customer", assigned_roles: ["customer"], scopes: [], consent_scopes: [], navigation: ["Главная", "Мои задачи", "Создать задачу", "Заявки", "Аналитика", "AI-помощник", "База участников", "Сообщения", "Настройки"], csrf_token: "csrf" };
  let loggedIn = false;
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { honor_board_enabled: false, demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "customer-roman", display_name: actor.display_name, roles: ["customer"] }] }));
  await page.route(/\/api\/v1\/me$/, (route) => (loggedIn ? route.fulfill({ json: actor }) : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } })));
  await page.route("**/api/v1/auth/demo-login", async (route) => { loggedIn = true; await route.fulfill({ json: actor }); });
  await page.route("**/api/v1/me/notifications", (route) => route.fulfill({ json: { items: [], unread: 0 } }));

  await page.goto("/");
  await page.locator('[data-persona="customer-roman"]').click();
  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "Создать задачу", exact: true }).click();
  await expect(page.getByText("Шаг 1 из 5")).toBeVisible();
  await page.getByLabel("Название задачи").fill("Платный R&D прототип");
  await page.getByLabel("Проблема и цель").fill("Нужно проверить продуктовую гипотезу на данных");
  await page.getByLabel("Ожидаемый результат").fill("Воспроизводимый эксперимент и MVP");
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page.getByLabel("Критерии успеха").fill("Метрика качества подтверждена отчётом");
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await expect(page).toHaveURL(/workspace\/1\?created=IMP-/);

  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "Мои задачи", exact: true }).click();
  await expect(page.locator('[data-reference="R-CUS-02"]')).toBeVisible();
  await page.getByRole("group", { name: "Статусы задач" }).getByRole("button", { name: "Черновики" }).click();
  await expect(page.locator(".premium-tr").filter({ hasText: "Платный R&D прототип" })).toBeVisible();

  await page.getByRole("button", { name: "Создать задачу" }).click();
  await expect(page.getByText("Шаг 1 из 5")).toBeVisible();
  await page.getByLabel("Название задачи").fill("Исследовательская проба");
  await page.getByLabel("Проблема и цель").fill("Нужно исследовать открытые подходы к решению");
  await page.getByLabel("Ожидаемый результат").fill("Сравнительный отчёт и рекомендации");
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page.getByLabel("Критерии успеха").fill("Сравнены минимум три подхода");
  for (let step = 0; step < 3; step += 1) await page.getByRole("button", { name: "Продолжить" }).click();
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await expect(page).toHaveURL(/workspace\/1\?created=IMP-/);

  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "Мои задачи", exact: true }).click();
  await page.getByRole("group", { name: "Статусы задач" }).getByRole("button", { name: "Все", exact: true }).click();
  await expect(page.locator(".premium-tr").filter({ hasText: "Платный R&D прототип" })).toBeVisible();
  await expect(page.locator(".premium-tr").filter({ hasText: "Исследовательская проба" })).toBeVisible();
  await page.getByRole("group", { name: "Статусы задач" }).getByRole("button", { name: "Черновики" }).click();
  await expect(page.locator(".premium-tr").filter({ hasText: "Исследовательская проба" })).toHaveCount(0);
  await expect(page.locator(".premium-tr").filter({ hasText: "Платный R&D прототип" })).toBeVisible();
});

test("customer screens candidates and invites to a task", async ({ page }) => {
  const actor = { person_id: "00000000-0000-0000-0000-000000000005", display_name: "Роман Заказчик", active_role: "customer", assigned_roles: ["customer"], scopes: [], consent_scopes: [], navigation: ["Главная", "Мои задачи", "Создать задачу", "Заявки", "Аналитика", "AI-помощник", "База участников", "Сообщения", "Настройки"], csrf_token: "csrf" };
  let loggedIn = false;
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "customer-roman", display_name: actor.display_name, roles: ["customer"] }] }));
  await page.route(/\/api\/v1\/me$/, (route) => (loggedIn ? route.fulfill({ json: actor }) : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } })));
  await page.route("**/api/v1/auth/demo-login", async (route) => { loggedIn = true; await route.fulfill({ json: actor }); });
  await page.route("**/api/v1/me/notifications", (route) => route.fulfill({ json: { items: [], unread: 0 } }));

  await page.goto("/");
  await page.locator('[data-persona="customer-roman"]').click();
  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "База участников", exact: true }).click();
  await expect(page.locator('[data-reference="R-CUS-08"]')).toBeVisible();
  await page.getByLabel("Поиск кандидатов").fill("NLP");
  await expect(page.locator(".candidate-row").filter({ hasText: "Роман Егоров" })).toBeVisible();
  await page.locator(".candidate-row").filter({ hasText: "Роман Егоров" }).click();
  await expect(page.getByText("Профиль участника")).toBeVisible();
  await expect(page.locator(".person-panel")).toContainText("Роман Егоров");
  await page.getByRole("button", { name: "Пригласить в задачу" }).click();
  await expect(page.getByText("Роман Егоров приглашён в задачу")).toBeVisible();
  await page.getByRole("button", { name: "Готово" }).click();
  await page.getByRole("button", { name: "Открыть профиль" }).click();
  await expect(page.getByRole("dialog", { name: /Цифровой профиль Роман Егоров/ }).getByRole("heading", { name: "Роман Егоров" })).toBeVisible();
});
