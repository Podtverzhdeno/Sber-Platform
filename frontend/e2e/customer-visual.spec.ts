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
  await expect(page.getByRole("button", { name: /Учебный стрик/ })).toHaveCount(0);

  const sidebar = page.getByRole("navigation", { name: "Навигация роли" });
  await expect(sidebar.getByRole("link")).toHaveCount(9);
  for (const section of ["Главная", "Мои задачи", "Создать задачу", "Заявки", "Аналитика", "AI-помощник", "База участников", "Сообщения", "Настройки"]) {
    await sidebar.getByRole("link", { name: section, exact: true }).click();
    await expect(page.locator(".premium-page, .messenger-page, .customer-talent-analytics, .buddy-page, .create-task-workspace, .participant-settings").first()).toBeVisible();
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

test("customer accepts a result with rating and detailed review", async ({ page }) => {
  await openCustomer(page);
  await page.getByRole("navigation",{name:"Навигация роли"}).getByRole("link",{name:"Мои задачи",exact:true}).click();
  await page.getByRole("button",{name:"Принять результат",exact:true}).click();
  const acceptance=page.getByRole("dialog",{name:"Принять результат"});
  await expect(acceptance).toBeVisible();
  await acceptance.getByRole("button",{name:"Оценка 5"}).click();
  await acceptance.getByLabel("Развёрнутый отзыв").fill("Сильный результат: решение воспроизводимо, критерии выполнены, документация подробная.");
  await acceptance.getByRole("button",{name:"Подтвердить принятие"}).click();
  await expect(page.getByRole("dialog",{name:"Результат принят"})).toBeVisible();
  await page.getByRole("button",{name:"Готово"}).click();
  await expect(page.getByRole("button",{name:/Результат принят/,exact:true})).toBeDisabled();
});

test("customer returns a result for revision with a detailed reason", async ({ page }) => {
  await openCustomer(page);
  await page.getByRole("navigation",{name:"Навигация роли"}).getByRole("link",{name:"Мои задачи",exact:true}).click();
  await page.getByRole("button",{name:"Вернуть на доработку",exact:true}).click();
  const revision=page.getByRole("dialog",{name:"Вернуть на доработку"});
  await expect(revision).toBeVisible();
  await revision.getByLabel("Причина доработки").fill("Нужно добавить обработку ошибок API, обновить метрики и приложить результаты повторного тестирования.");
  await revision.getByRole("button",{name:"Отправить на доработку"}).click();
  await expect(page.getByRole("dialog",{name:"Отправлено на доработку"})).toBeVisible();
  await page.getByRole("button",{name:"Готово"}).click();
  await expect(page.getByText("На доработке",{exact:true}).first()).toBeVisible();
  await expect(page.getByRole("button",{name:"Запрос на доработку отправлен",exact:true})).toBeDisabled();
});

test("AI suggestions update the brief and a published task appears in My Tasks", async ({ page }) => {
  await openCustomer(page);
  await page.getByRole("navigation",{name:"Навигация роли"}).getByRole("link",{name:"Создать задачу",exact:true}).click();
  await page.getByLabel("Название задачи").fill("AI-поиск внутренних регламентов");
  await page.getByLabel("Проблема и цель").fill("Сотрудники долго ищут актуальные регламенты.");
  await page.getByLabel("Ожидаемый результат").fill("Рабочий поисковый прототип.");
  await page.locator(".create-ai-panel article",{hasText:"Добавьте целевую аудиторию решения"}).getByRole("button").click();
  await expect(page.getByRole("status")).toContainText("Рекомендация применена");
  await expect(page.getByLabel("Проблема и цель")).toHaveValue(/Целевая аудитория/);
  await page.locator(".create-ai-panel article",{hasText:"Укажите формат и источник данных"}).getByRole("button").click();
  await expect(page.getByLabel("Ожидаемый результат")).toHaveValue(/CSV\/JSON/);
  await page.getByRole("button",{name:"Продолжить"}).click();
  await page.getByLabel("Критерии успеха").fill("Precision@10 не ниже 0.8");
  for(let step=0;step<3;step+=1) await page.getByRole("button",{name:"Продолжить"}).click();
  await page.getByRole("button",{name:"Опубликовать"}).click();
  await expect(page).toHaveURL(/\/workspace\/1\?created=IMP-/);
  await expect(page.getByText("AI-поиск внутренних регламентов",{exact:true}).first()).toBeVisible();
  await expect(page.getByText("Опубликована",{exact:true}).first()).toBeVisible();
});

test("customer can send messages and each dialog keeps its own history", async ({ page }) => {
  await openCustomer(page);
  await page.getByRole("navigation",{name:"Навигация роли"}).getByRole("link",{name:"Сообщения",exact:true}).click();
  const composer=page.getByLabel("Сообщение");
  await expect(composer).toBeInViewport();
  await expect(page.getByRole("button",{name:"Прикрепить файл"})).toBeInViewport();
  await expect(page.getByRole("button",{name:"Отправить",exact:true})).toBeInViewport();
  await composer.fill("Проверил новую версию, спасибо.");
  await page.getByRole("button",{name:"Отправить",exact:true}).click();
  await expect(page.getByText("Проверил новую версию, спасибо.",{exact:true})).toBeVisible();
  await page.locator(".chat-list>button").nth(1).click();
  await expect(page.getByText("Проверил новую версию, спасибо.",{exact:true})).toHaveCount(0);
  await page.locator(".chat-list>button").first().click();
  await expect(page.getByText("Проверил новую версию, спасибо.",{exact:true})).toBeVisible();
});

test("customer settings show the customer profile without participant HR controls", async ({ page }) => {
  await openCustomer(page);
  await page.getByRole("navigation",{name:"Навигация роли"}).getByRole("link",{name:"Настройки",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Профиль заказчика"})).toBeVisible();
  await expect(page.getByLabel("ФИО")).toHaveValue("Алексей Речной");
  await expect(page.getByRole("button",{name:"Видимость для HR",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Подбор",exact:true})).toHaveCount(0);
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

test("customer messages open the linked task and selected participant profile", async ({ page }) => {
  await openCustomer(page);
  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "Сообщения", exact: true }).click();
  await page.getByRole("button", { name: "Посмотреть профиль" }).click();
  await expect(page).toHaveURL(/\/workspace\/6\?participant=p1&profile=open$/);
  await expect(page.getByRole("dialog", { name: /Цифровой профиль Никита Соколов/ })).toBeVisible();
  await page.getByRole("button", { name: "×" }).click();
  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "Сообщения", exact: true }).click();
  await page.getByRole("button", { name: "Открыть связанную задачу" }).click();
  await expect(page).toHaveURL(/\/workspace\/1\?task=IMP-2025-0412$/);
  await expect(page.locator(".ctw-page")).toBeVisible();
});

test("customer participant database contains an extended talent pool", async ({ page }) => {
  await openCustomer(page);
  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "База участников", exact: true }).click();
  await expect(page.getByText("23", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".talent-table .candidate-row")).toHaveCount(21);
  await expect(page.getByText("Мария Орлова", { exact: true })).toBeVisible();
  await expect(page.getByText("Роман Егоров", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "2", exact: true }).click();
  await expect(page.locator(".talent-table .candidate-row")).toHaveCount(4);
  await expect(page.getByText("Ксения Лапина", { exact: true })).toBeVisible();
  await expect(page.getByText("Павел Денисов", { exact: true })).toBeVisible();
  await expect(page.getByText("Надежда Юдина", { exact: true })).toBeVisible();
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

test("application filters change independently", async ({ page }) => {
  await openCustomer(page);
  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "Заявки", exact: true }).click();
  const direction = page.getByLabel("Направление");
  const level = page.getByLabel("Уровень");
  const match = page.getByLabel("Match");
  await direction.selectOption("AI / ML");
  await expect(direction).toHaveValue("AI / ML");
  await expect(level).toHaveValue("Все");
  await match.selectOption("90");
  await expect(direction).toHaveValue("AI / ML");
  await expect(level).toHaveValue("Все");
  await expect(match).toHaveValue("90");
});

test("customer applications identify and filter by project", async ({ page }) => {
  await openCustomer(page);
  await page.getByRole("navigation",{name:"Навигация роли"}).getByRole("link",{name:"Заявки",exact:true}).click();
  await expect(page.locator(".applications-candidate-row.candidate-head")).toContainText("Проект");
  await expect(page.locator(".application-project").first()).toContainText("IMP-");
  const project=page.getByLabel("Проект заявки");
  await project.selectOption({index:1});
  const selectedTitle=await project.locator("option:checked").textContent();
  await expect(page.locator(".application-project b")).toHaveText(Array(await page.locator(".application-project b").count()).fill(selectedTitle??""));
});

test("customer analytics updates metrics for the selected period", async ({ page }) => {
  await openCustomer(page);
  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "Аналитика", exact: true }).click();
  await page.getByRole("button", { name: /Последние 90 дней/ }).click();
  await expect(page.getByRole("button", { name: /Последние 30 дней/ })).toBeVisible();
  const business = page.locator(".cta-business");
  await expect(business).toContainText("Активные задачи");
  await expect(business).toContainText("8");
  await expect(business).toContainText("+2");
  await expect(business).toContainText("Команды в работе");
  await expect(business).toContainText("12");
  await expect(business).toContainText("Участники");
  await expect(business).toContainText("47");
  await expect(business).toContainText("Завершено задач");
  await expect(business).toContainText("24");
  await expect(page.locator(".cta-kpi-grid")).toContainText("612");
});
