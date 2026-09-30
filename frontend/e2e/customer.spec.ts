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

test("customer creates paid and unpaid drafts with participant payment preview", async ({ page }) => {
  const tasks: Record<string, unknown>[] = [];
  const created: Record<string, unknown>[] = [];
  const actor = { person_id: "00000000-0000-0000-0000-000000000005", display_name: "Роман Заказчик", active_role: "customer", assigned_roles: ["customer"], scopes: [], consent_scopes: [], navigation: ["Мои задачи", "Кандидаты", "Приёмка", "Аналитика"], csrf_token: "csrf" };
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { honor_board_enabled: false } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "customer-roman", display_name: actor.display_name, roles: ["customer"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: actor }));
  await page.route("**/api/v1/customer/tasks", (route) => route.fulfill({ json: tasks }));
  await page.route("**/api/v1/analytics/role", (route) => route.fulfill({ json: { role: "customer", metrics: [] } }));
  await page.route("**/api/v1/customer/tasks/*", (route) => {
    const task = tasks.find((item) => item.id === route.request().url().split("/").at(-1));
    return route.fulfill({ json: { task, problem: "Проверить гипотезу", deliverable: "MVP", acceptance_criteria: ["Критерий подтверждён"], data_constraints: "Синтетические данные", ip_terms: "По условиям", terms: { version: 1, compensation: { paid: true, base_amount_per_assignee: "50000", b_total: "75000", a_total: "100000" } }, applications: [], assignments: [], contributions: [], decisions: [] } });
  });
  await page.route("**/api/v1/customer/projects/*/tasks", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    created.push(body);
    const task = { id: `10000000-0000-0000-0000-00000000000${String(created.length)}`, project_key: "impulse-demo", task_key: body.task_key, title: body.title, status: "draft", nominated_mentor_id: null, support_mode: null, support_assignee_id: null, places: body.places };
    tasks.push(task);
    await route.fulfill({ json: task });
  });
  await page.route("**/api/v1/customer/tasks/*/applications", (route) => route.fulfill({ json: [] }));

  await page.goto("/");
  await page.locator('[data-persona="customer-roman"]').click();
  await page.getByRole("button", { name: /Создать задачу/ }).click();
  await page.getByLabel("Название").fill("Платный R&D прототип");
  await page.getByLabel("Проблема").fill("Нужно проверить продуктовую гипотезу на данных");
  await page.getByLabel("Ожидаемый результат").fill("Воспроизводимый эксперимент и MVP");
  await page.getByLabel("Критерий приёмки").fill("Метрика качества подтверждена отчётом");
  await expect(page.getByText(/База 50000 ₽ · B 75000 ₽ · A 100000 ₽/)).toBeVisible();
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await expect.poll(() => created.length).toBe(1);
  await expect(page.locator("#customer-detail-title")).toHaveText("Платный R&D прототип");

  await page.getByRole("button", { name: /Создать задачу/ }).click();
  await page.getByRole("button", { name: "Неоплачиваемая" }).click();
  await page.getByLabel("Название").fill("Исследовательская проба");
  await page.getByLabel("Проблема").fill("Нужно исследовать открытые подходы к решению");
  await page.getByLabel("Ожидаемый результат").fill("Сравнительный отчёт и рекомендации");
  await page.getByLabel("Критерий приёмки").fill("Сравнены минимум три подхода");
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await expect.poll(() => created.length).toBe(2);
  expect((created[0]?.compensation as { paid: boolean }).paid).toBe(true);
  expect((created[1]?.compensation as { paid: boolean }).paid).toBe(false);
  expect(created.every((item) => item.nominated_mentor_id === null)).toBe(true);
  await page.getByRole("navigation", { name: "Фильтр задач" }).getByRole("button", { name: "Черновики" }).click();
  await expect(page.getByText("2 показано")).toBeVisible();
  await page.getByRole("navigation", { name: "Фильтр задач" }).getByLabel("Сортировка").selectOption("deadline");
});

test("customer matches a confirmed case and invites to a closed task", async ({ page }) => {
  const actor = { person_id: "00000000-0000-0000-0000-000000000005", display_name: "Роман Заказчик", active_role: "customer", assigned_roles: ["customer"], scopes: [], consent_scopes: [], navigation: ["Главная", "Мои задачи", "Кандидаты", "Приёмка", "Аналитика"], csrf_token: "csrf" };
  const sourceId = "10000000-0000-0000-0000-000000000001";
  const targetId = "10000000-0000-0000-0000-000000000002";
  const candidateId = "20000000-0000-0000-0000-000000000001";
  let requestCount = 0;
  let invitationCount = 0;
  let savedCount = 0;
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { demo_mode: false } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "customer-roman", display_name: actor.display_name, roles: ["customer"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: actor }));
  await page.route("**/api/v1/customer/tasks", (route) => route.fulfill({ json: [{ id: targetId, title: "Закрытое испытание", status: "published", mode: "invitation_only", competency_tags: ["nlp"] }] }));
  await page.route("**/api/v1/customer/cases", (route) => route.fulfill({ json: [{ id: sourceId, title: "Проверенный NLP кейс", status: "published", mode: "open", competency_tags: ["nlp", "python"] }] }));
  await page.route("**/api/v1/customer/saved-candidates", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/customer/team-requests", async (route) => {
    const body = route.request().postDataJSON() as { required_tags: string[]; relevant_case_task_ids: string[] };
    expect(body.required_tags).toEqual(["nlp"]);
    expect(body.relevant_case_task_ids).toEqual([sourceId]);
    requestCount++;
    await route.fulfill({ json: { id: "30000000-0000-0000-0000-000000000001", owner_id: actor.person_id, version: 1, title: "NLP специалист", required_tags: ["nlp"], preferred_tags: ["python"], relevant_case_task_ids: [sourceId] } });
  });
  await page.route("**/api/v1/customer/team-requests/*/matches", (route) => route.fulfill({ json: [{ person_id: candidateId, display_name: "Алекс Речной", request_version: 1, matched_required: ["nlp"], matched_preferred: ["python"], evidence: [{ task_id: sourceId, contribution_id: "40000000-0000-0000-0000-000000000001", personal_summary: "Построил воспроизводимую модель", competency_tags: ["nlp", "python"], artifact_keys: ["notebook"] }] }] }));
  await page.route("**/api/v1/customer/tasks/*/invitations", async (route) => {
    const body = route.request().postDataJSON() as { person_id: string; request_id: string; evidence_contribution_id: string };
    expect(body.person_id).toBe(candidateId);
    expect(body.request_id).toBe("30000000-0000-0000-0000-000000000001");
    expect(body.evidence_contribution_id).toBe("40000000-0000-0000-0000-000000000001");
    invitationCount++;
    await route.fulfill({ json: { id: "50000000-0000-0000-0000-000000000001", task_id: targetId, person_id: candidateId, terms_version: 1, status: "pending" } });
  });
  await page.route("**/api/v1/customer/team-requests/*/saved/*", async (route) => {
    savedCount++;
    await route.fulfill({ json: { id: "60000000-0000-0000-0000-000000000001", request_id: "30000000-0000-0000-0000-000000000001", person_id: candidateId, evidence_contribution_id: "40000000-0000-0000-0000-000000000001", created_at: "2026-09-30T09:00:00Z" } });
  });

  await page.goto("/");
  await page.locator('[data-persona="customer-roman"]').click();
  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "Кандидаты" }).click();
  await page.getByLabel("Задача команды").fill("NLP специалист");
  await page.getByLabel("Обязательные навыки через запятую").fill("nlp");
  await page.getByLabel("Желательные навыки через запятую").fill("python");
  await page.getByLabel("Релевантный завершённый кейс").selectOption(sourceId);
  await page.getByRole("button", { name: "Показать кандидатов" }).click();
  await expect(page.getByText("Алекс Речной")).toBeVisible();
  await page.getByRole("button", { name: "Сохранить в резерв" }).click();
  await expect(page.getByText("Кандидат сохранён в резерве.")).toBeVisible();
  await page.getByLabel("Закрытая задача для приглашения").selectOption(targetId);
  await page.getByRole("button", { name: "Пригласить в задачу" }).click();
  await expect(page.getByText("Приглашение отправлено. Участник увидит условия задачи.")).toBeVisible();
  expect(requestCount).toBe(1);
  expect(invitationCount).toBe(1);
  expect(savedCount).toBe(1);
});
