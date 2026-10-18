import { expect, test } from "@playwright/test";

// Linked R-CUS-01..R-CUS-09 journey on the real customer workspace:
// draft -> submit/platform publish -> applications (honest novice label) ->
// accept -> revision decision -> rework -> acceptance decision ->
// analytics with explicit numerators -> repeat as a fresh draft.

const taskId = "00000000-0000-0000-0000-010000000001";
const repeatId = "00000000-0000-0000-0000-010000000002";
const applicationId = "00000000-0000-0000-0000-010000000003";
const contributionId = "00000000-0000-0000-0000-010000000004";
const detailIdPattern = /\/api\/v1\/customer\/tasks\/[0-9a-f-]{36}$/;

test("customer lifecycle: draft, publish, accept, revise, rework, accept, analytics, repeat", async ({ page }) => {
  const task: Record<string, unknown> = { id: taskId, project_key: "impulse-demo", task_key: "journey-task", title: "Сценарий полного цикла", status: "draft", mode: "open", places: 2, deadline_at: "2026-12-01T18:00:00Z" };
  const repeatTask: Record<string, unknown> = { ...task, id: repeatId, task_key: "journey-repeat", status: "draft" };
  const tasks: Record<string, unknown>[] = [];
  let repeatCreated = false;
  let application: Record<string, unknown> = { id: applicationId, task_id: taskId, person_id: "00000000-0000-0000-0000-000000000001", accepted_terms_version: 1, status: "applied", version: 1, participant_name: "Игорь Лесной", verified_case_count: 0 };
  let decisions: Record<string, unknown>[] = [];
  const actor = {
    person_id: "00000000-0000-0000-0000-000000000005",
    display_name: "Роман Заказчик",
    active_role: "customer",
    assigned_roles: ["customer"],
    scopes: [],
    consent_scopes: [],
    navigation: ["Мои задачи", "Приёмка", "Сообщения", "Аналитика"],
    csrf_token: "csrf-customer",
  };
  const terms = { version: 1, deadline_at: "2026-12-01T18:00:00Z", deliverable: "Прототип и отчёт.", acceptance_criteria: ["Метрика подтверждена"], compensation: { paid: false, base_amount_per_assignee: null, b_total: null, a_total: null } };
  const detailFor = (id: string) => ({
    task: id === repeatId ? repeatTask : task,
    problem: "Проверить сквозной сценарий платформы.",
    deliverable: "Прототип и отчёт.",
    acceptance_criteria: ["Метрика подтверждена"],
    data_constraints: "Только синтетические демонстрационные данные.",
    ip_terms: "Авторство сохраняется в портфолио.",
    terms: task.status === "draft" || id === repeatId ? null : terms,
    applications: id === repeatId || task.status === "draft" ? [] : [application],
    assignments: application.status === "accepted" && id !== repeatId ? [{ id: "00000000-0000-0000-0000-010000000005", status: "staffed" }] : [],
    contributions: application.status === "accepted" && id !== repeatId ? [{ id: contributionId, personal_summary: "Собрал прототип и проверил метрику.", status: "submitted", artifact_keys: ["repo"] }] : [],
    decisions,
  });
  const metric = (key: string, label: string, unit: string, value: string | null, numerator: number, denominator: number) => ({ key, label, unit, value, numerator, denominator, period_start: "2026-10-01T00:00:00Z", period_end: "2026-10-18T00:00:00Z", cohort: "customer:customer:30d", freshness: "fresh", definition: "Проверяемая формула периода.", suppressed: false, suppression_reason: null });

  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { demo_mode: false } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "customer-roman", display_name: actor.display_name, roles: ["customer"] }] }));
  let loggedIn = false;
  await page.route("**/api/v1/auth/demo-login", (route) => { loggedIn = true; return route.fulfill({ json: actor }); });
  await page.route("**/api/v1/auth/logout", (route) => { loggedIn = false; return route.fulfill({ status: 204 }); });
  await page.route(/\/api\/v1\/me$/, (route) => loggedIn ? route.fulfill({ json: actor }) : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/customer/tasks", (route) => route.fulfill({ json: repeatCreated ? [...tasks, repeatTask] : tasks }));
  await page.route("**/api/v1/customer/projects/*/tasks", (route) => {
    tasks.push(task);
    return route.fulfill({ json: task });
  });
  await page.route("**/api/v1/customer/tasks/*/applications", (route) => {
    const id = route.request().url().split("/").at(-2) ?? taskId;
    if (id === repeatId || task.status === "draft") return route.fulfill({ json: [] });
    return route.fulfill({ json: [application] });
  });
  await page.route("**/api/v1/customer/applications/*/accept", (route) => {
    application = { ...application, status: "accepted", version: 2 };
    return route.fulfill({ json: application });
  });
  await page.route("**/api/v1/customer/contributions/*/decision", (route) => {
    const body = route.request().postDataJSON() as { decision: string; reason: string; deadline_at: string | null };
    decisions = [
      ...decisions.filter((item) => item.contribution_id !== contributionId),
      { contribution_id: contributionId, contribution_version: 1, decision: body.decision, reason: body.reason, deadline_at: body.deadline_at, owner_id: actor.person_id },
    ];
    return route.fulfill({ json: { id: "00000000-0000-0000-0000-010000000006", contribution_id: contributionId, contribution_version: 1, decision: body.decision, reason: body.reason, deadline_at: body.deadline_at, owner_id: actor.person_id } });
  });
  await page.route("**/api/v1/customer/tasks/*/submit", (route) => {
    task.status = "published";
    return route.fulfill({ json: task });
  });
  await page.route("**/api/v1/customer/tasks/*/repeat", (route) => {
    const body = route.request().postDataJSON() as { task_key: string };
    expect(body.task_key).toContain("repeat-");
    repeatCreated = true;
    return route.fulfill({ json: repeatTask });
  });
  await page.route("**/api/v1/customer/tasks/*/participant-preview", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/analytics/role", (route) => route.fulfill({ json: { role: "customer", metrics: [
    metric("customer_tasks", "Задачи заказчика", "count", "1", 1, 1),
    metric("customer_acceptance_rate", "Доля принятых результатов", "percent", "50.00", 1, 2),
    metric("customer_revisions", "Запрошенные доработки", "count", "1", 1, 1),
    metric("customer_time_to_result_hours", "Среднее время до результата", "count", "2.5", 1, 1),
    metric("customer_active_people", "Активных участников", "count", "1", 1, 1),
  ] } }));
  await page.route(detailIdPattern, (route) => route.fulfill({ json: detailFor(route.request().url().split("/").at(-1) ?? taskId) }));

  await page.goto("/");
  await page.locator('[data-persona="customer-roman"]').click();
  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "Мои задачи" }).click();
  await page.getByRole("button", { name: /Создать задачу/ }).click();
  await page.getByLabel("Название").fill("Сценарий полного цикла");
  await page.getByLabel("Компетенции кейса через запятую").fill("ML");
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByLabel("Проблема").fill("Проверить сквозной сценарий платформы");
  await page.getByLabel("Результат", { exact: true }).fill("Прототип и отчёт");
  await page.getByLabel("Критерии приёмки построчно").fill("Метрика подтверждена");
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByLabel("Дедлайн").fill("2026-12-01T18:00");
  await page.getByLabel("Ограничения данных").fill("Только синтетические демонстрационные данные.");
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await expect(page.getByText("Условия: версия 1 · открытая заявка")).toBeVisible();
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await expect(page.locator("#customer-detail-title")).toHaveText("Сценарий полного цикла");
  await expect(page.getByText("Условия: версия ещё не опубликована")).toBeVisible();
  await expect(page.getByText("Заявок: 0 · Назначений: 0 · Вкладов: 0")).toBeVisible();

  await page.getByRole("button", { name: "Закрыть" }).first().click();
  await page.getByRole("button", { name: "Отправить на модерацию" }).click();
  await expect(page.getByRole("button", { name: "Отправить на модерацию" })).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "›" }).click();
  await expect(page.getByText("Условия: версия 1")).toBeVisible();
  await expect(page.getByTestId("application-experience")).toHaveText("Опыт не подтверждён");
  await expect(page.getByTestId("application-row")).toHaveCount(1);
  await expect(page.getByText("Заявок: 1 · Назначений: 0 · Вкладов: 0")).toBeVisible();

  await page.getByRole("button", { name: "Принять в работу" }).click();
  await expect(page.getByText("Заявок: 1 · Назначений: 1 · Вкладов: 1")).toBeVisible();

  await page.getByLabel("Причина решения").fill("Нужны повторные замеры метрики.");
  await page.getByRole("button", { name: "Вернуть на доработку" }).click();
  await expect(page.getByText("Решение: revision_requested · Нужны повторные замеры метрики.")).toBeVisible();
  decisions = [];

  await page.getByRole("link", { name: "Открыть аналитику" }).click();
  await expect(page.getByText("Запрошенные доработки")).toBeVisible();
  await expect(page.getByText("Среднее время до результата")).toBeVisible();
  await expect(page.getByText("Доля принятых результатов")).toBeVisible();
  await expect(page.getByText("50.00%")).toBeVisible();
  await page.getByText("Как рассчитано").first().click();
  await expect(page.getByText("Числитель").first()).toBeVisible();

  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "Мои задачи" }).click();
  await page.reload();
  await page.getByRole("button", { name: "›" }).click();
  await page.getByLabel("Причина решения").fill("Метрика подтверждена в новой версии.");
  await page.getByRole("button", { name: "Принять результат" }).click();
  await expect(page.getByText("Решение: accepted · Метрика подтверждена в новой версии.")).toBeVisible();

  await page.getByRole("button", { name: "Повторить как новый черновик" }).click();
  await expect(page.getByText("2 показано")).toBeVisible();
  await expect(page.getByText("Заявок: 0 · Назначений: 0 · Вкладов: 0")).toBeVisible();
  await expect(page.getByTestId("application-row")).toHaveCount(0);
});
