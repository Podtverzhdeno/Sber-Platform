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

test("customer draft survives reload locally and moderation creates exactly one server task", async ({ page }) => {
  const actor = { person_id: "00000000-0000-0000-0000-000000000005", display_name: "Роман Заказчик", active_role: "customer", assigned_roles: ["customer"], scopes: [], consent_scopes: [], navigation: ["Главная", "Мои задачи", "Создать задачу", "Заявки", "Аналитика", "AI-помощник", "База участников", "Сообщения", "Настройки"], csrf_token: "csrf" };
  const taskId = "00000000-0000-0000-0000-000000000988";
  let loggedIn = false;
  let created = 0;
  let submitted = 0;
  let persistedTask: { id:string; project_key:string; task_key:string; title:string; status:"draft"|"submitted"; places:number; mode:string; competency_tags:string[] } | null = null;
  let submittedBrief: { task_key:string; title:string; problem:string; deliverable:string; acceptance_criteria:string[]; mode:string } | null = null;

  await page.route("**/api/v1/config", route => route.fulfill({ json: { honor_board_enabled:false, demo_mode:true } }));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({ json:[{key:"customer-roman",display_name:actor.display_name,roles:["customer"]}] }));
  await page.route(/\/api\/v1\/me$/, route => loggedIn ? route.fulfill({json:actor}) : route.fulfill({status:401,json:{code:"AUTH_REQUIRED"}}));
  await page.route("**/api/v1/auth/demo-login", async route => { loggedIn=true; await route.fulfill({json:actor}); });
  await page.route("**/api/v1/me/notifications", route => route.fulfill({json:{items:[],unread:0}}));
  await page.route("**/api/v1/customer/tasks", route => route.fulfill({json:persistedTask?[persistedTask]:[]}));
  await page.route("**/api/v1/customer/projects/demo-rd-lab/tasks", route => {
    created += 1;
    submittedBrief = route.request().postDataJSON() as typeof submittedBrief;
    if (!submittedBrief) throw new Error("Missing submitted brief");
    persistedTask = {id:taskId,project_key:"demo-rd-lab",task_key:submittedBrief.task_key,
      title:submittedBrief.title,status:"draft",places:2,mode:submittedBrief.mode,competency_tags:[]};
    return route.fulfill({json:persistedTask});
  });
  await page.route("**/api/v1/customer/tasks/*/submit", route => {
    submitted += 1;
    if (!persistedTask) throw new Error("Cannot submit a task without a server draft");
    persistedTask = {...persistedTask,status:"submitted"};
    return route.fulfill({json:persistedTask});
  });

  await page.goto("/");
  await page.locator('[data-persona="customer-roman"]').click();
  await page.getByRole("navigation",{name:"Навигация роли"}).getByRole("link",{name:"Создать задачу",exact:true}).click();
  const wizard = page.getByRole("region",{name:"Создание задачи заказчиком"});
  await expect(wizard).toBeVisible();
  await expect(wizard.getByRole("heading",{name:"Основная информация"})).toBeVisible();
  await wizard.getByLabel("Название задачи").fill("Платный R&D прототип");
  await wizard.getByLabel("Краткое описание").fill("Исследовательская задача для команды");
  await wizard.getByLabel("Подробное описание").fill("Нужно проверить продуктовую гипотезу на данных");
  await wizard.getByRole("button",{name:/^Далее/}).click();
  await wizard.getByLabel("Ожидаемый результат").fill("Воспроизводимый эксперимент и MVP");
  await wizard.getByLabel("Критерии приёмки").fill("Метрика качества подтверждена отчётом");
  await wizard.getByRole("button",{name:"Сохранить черновик"}).click();
  await expect(wizard.getByRole("status")).toContainText("Черновик сохранён в этом браузере");
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem("impulse-customer-task-wizard-v2") ?? "null") as {step:number;brief:{title:string;criteria:string}} | null);
  expect(draft?.step).toBe(1);
  expect(draft?.brief.title).toBe("Платный R&D прототип");
  expect(draft?.brief.criteria).toBe("Метрика качества подтверждена отчётом");
  expect(created,"Saving a local draft must not falsely create a server task").toBe(0);

  await page.reload();
  await expect(wizard.getByRole("heading",{name:"Критерии и сроки"})).toBeVisible();
  await expect(wizard.getByLabel("Критерии приёмки")).toHaveValue("Метрика качества подтверждена отчётом");
  for (let step=0; step<3; step+=1) await wizard.getByRole("button",{name:/^Далее/}).click();
  await expect(wizard.getByText("Бриф готов к отправке")).toBeVisible();
  await wizard.getByRole("button",{name:"Отправить на модерацию"}).click();
  await expect(page).toHaveURL(new RegExp("/workspace/1\\?created="+taskId+"$"));
  expect(created,"The task create request must not be duplicated").toBe(1);
  expect(submitted,"Moderation submission must occur exactly once").toBe(1);
  expect(submittedBrief).toMatchObject({
    title:"Платный R&D прототип",
    problem:"Нужно проверить продуктовую гипотезу на данных",
    acceptance_criteria:["Метрика качества подтверждена отчётом"],
  });
  expect(persistedTask).toMatchObject({status:"submitted"});
  await expect.poll(async()=>page.evaluate(()=>localStorage.getItem("impulse-customer-task-wizard-v2"))).toBeNull();
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
