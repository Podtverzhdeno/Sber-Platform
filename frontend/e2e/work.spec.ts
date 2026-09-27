import { expect, test } from "@playwright/test";

const taskId = "00000000-0000-0000-0000-000000000701";
const assignmentId = "00000000-0000-0000-0000-000000000702";
const contributionId = "00000000-0000-0000-0000-000000000703";
const participantId = "00000000-0000-0000-0000-000000000001";

test("paid application moves through submission and customer revision", async ({ page }) => {
  let acceptedTerms = false;
  let hasAssignment = false;
  let assignmentStatus = "staffed";
  let contribution: Record<string, unknown> | null = null;
  let revision: Record<string, unknown> | null = null;

  const participant = {
    person_id: participantId,
    display_name: "Алекс Речной",
    active_role: "participant",
    assigned_roles: ["participant"],
    scopes: [], consent_scopes: [],
    navigation: ["Мой путь", "Bootcamp", "Задачи", "События", "Рейтинг", "Аналитика"],
    csrf_token: "csrf-participant",
  };
  const customer = {
    person_id: "00000000-0000-0000-0000-000000000003",
    display_name: "Роман Заказчик",
    active_role: "customer",
    assigned_roles: ["customer"],
    scopes: [], consent_scopes: [],
    navigation: ["Мои задачи", "Кандидаты", "Приёмка", "Аналитика"],
    csrf_token: "csrf-customer",
  };
  const task = { id: taskId, title: "MVP поиска программ", status: "published", places: 1 };
  const compensation = { paid: true, base_amount_per_assignee: "30000.00", currency: "RUB", b_multiplier: "1.5", a_multiplier: "2.50", b_total: "45000.00", a_total: "75000.00", quantum: "0.01", rounding_mode: "half_up", policy_version: 1, payout_condition: "После принятия личного вклада и публикации оценки человеком." };
  const terms = { version: 2, deadline_at: "2026-11-01T18:00:00Z", deliverable: "Работающий MVP и отчёт по метрикам.", acceptance_criteria: ["MVP воспроизводим", "Метрика описана"], support_mode: "buddy", compensation };
  const workItems = () => hasAssignment ? [{ assignment: { id: assignmentId, task_id: taskId, person_id: participantId, application_id: "00000000-0000-0000-0000-000000000704", status: assignmentStatus }, task, terms, contributions: contribution ? [contribution] : [], decisions: revision ? [revision] : [] }] : [];

  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { honor_board_enabled: false } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [
    { key: "participant-alex", display_name: participant.display_name, roles: ["participant"] },
    { key: "customer-roman", display_name: customer.display_name, roles: ["customer"] },
  ] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", async (route) => {
    const body = route.request().postDataJSON() as { persona_key: string };
    await route.fulfill({ json: body.persona_key === "customer-roman" ? customer : participant });
  });
  await page.route("**/api/v1/auth/logout", (route) => route.fulfill({ status: 204 }));
  await page.route("**/api/v1/development/tracks", (route) => route.fulfill({ json: { active_count: 1, max_active: 2, tracks: [] } }));
  await page.route("**/api/v1/me/roadmaps", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/marketplace/tasks", (route) => route.fulfill({ json: [{ task, terms, accepted_terms_version: acceptedTerms ? 2 : null }] }));
  await page.route("**/api/v1/me/work", (route) => route.fulfill({ json: workItems() }));
  await page.route("**/api/v1/me/reward-evidence", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/tasks/*/terms-consent", (route) => { acceptedTerms = true; return route.fulfill({ json: { task, terms, accepted_terms_version: 2 } }); });
  await page.route("**/api/v1/me/tasks/*/applications", (route) => { hasAssignment = true; return route.fulfill({ json: { id: "00000000-0000-0000-0000-000000000704", status: "applied" } }); });
  await page.route("**/api/v1/me/assignments/*/start", (route) => { assignmentStatus = "in_progress"; return route.fulfill({ json: { id: assignmentId, status: assignmentStatus } }); });
  await page.route("**/api/v1/me/assignments/*/contributions", async (route) => {
    const body = route.request().postDataJSON() as { personal_summary: string };
    assignmentStatus = "submitted";
    contribution = { id: contributionId, assignment_id: assignmentId, version: 1, personal_summary: body.personal_summary, artifact_keys: ["personal-proof"], status: "submitted" };
    await route.fulfill({ json: contribution });
  });
  await page.route("**/api/v1/customer/tasks", (route) => route.fulfill({ json: [task] }));
  await page.route("**/api/v1/customer/tasks/*/participant-preview", (route) => route.fulfill({ json: workItems() }));
  await page.route("**/api/v1/customer/contributions/*/decision", async (route) => {
    const body = route.request().postDataJSON() as { reason: string; deadline_at: string };
    assignmentStatus = "revision_requested";
    contribution = { ...(contribution ?? {}), status: "revision_requested" };
    revision = { id: "00000000-0000-0000-0000-000000000705", contribution_id: contributionId, contribution_version: 1, decision: "revision_requested", reason: body.reason, deadline_at: body.deadline_at, owner_id: participantId };
    await route.fulfill({ json: revision });
  });

  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Задачи" }).click();
  const moneyTooltipTrigger = page.getByText("База 30 000,00 ₽ · B 45 000,00 ₽ · A 75 000,00 ₽").first();
  await expect(moneyTooltipTrigger).toBeVisible();
  await moneyTooltipTrigger.focus();
  await expect(page.getByRole("tooltip").first()).toContainText("B ×1,5: 45 000,00 ₽");
  await expect(page.getByRole("tooltip").first()).toContainText("A ×2,50: 75 000,00 ₽");
  await page.getByRole("button", { name: "Открыть условия версии 2" }).click();
  const consent = page.getByRole("dialog", { name: "Условия задачи · версия 2" });
  await expect(consent.getByText("30 000,00 ₽", { exact: true })).toBeVisible();
  await expect(consent.getByText("45 000,00 ₽", { exact: true })).toBeVisible();
  await expect(consent.getByText("75 000,00 ₽", { exact: true })).toBeVisible();
  await expect(consent.getByText("После принятия личного вклада и публикации оценки человеком.")).toBeVisible();
  await consent.getByRole("button", { name: "Подтвердить условия и продолжить" }).click();
  await page.getByRole("button", { name: "Откликнуться" }).click();
  await page.getByRole("button", { name: "Начать работу" }).click();
  await page.getByLabel("Что сделали лично").fill("Я реализовал API поиска и подготовил воспроизводимую проверку метрики.");
  await page.getByLabel("Ссылка на доказательство").fill("https://example.test/commit/42");
  await page.getByRole("button", { name: "Отправить личный вклад" }).click();
  await expect(page.getByText("На приёмке").first()).toBeVisible();

  await page.getByRole("button", { name: "Выйти" }).click();
  await page.locator('[data-persona="customer-roman"]').click();
  await expect(page.getByText("Я реализовал API поиска и подготовил воспроизводимую проверку метрики.")).toBeVisible();
  await page.getByRole("button", { name: "Вернуть на доработку" }).click();

  await page.getByRole("button", { name: "Выйти" }).click();
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Задачи" }).click();
  await expect(page.getByText("Нужно уточнить результат и приложить воспроизводимые доказательства.")).toBeVisible();
  await expect(page.getByText(/Срок:/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Начать доработку" })).toBeVisible();
});
