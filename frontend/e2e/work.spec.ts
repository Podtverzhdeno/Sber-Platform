import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const taskId = "00000000-0000-0000-0000-000000000701";
const assignmentId = "00000000-0000-0000-0000-000000000702";
const contributionId = "00000000-0000-0000-0000-000000000703";
const applicationId = "00000000-0000-0000-0000-000000000704";
const submittedAssignmentId = "00000000-0000-0000-0000-000000000707";
const deadlineRequestId = "00000000-0000-0000-0000-000000000708";
const participantId = "00000000-0000-0000-0000-000000000001";
const teammateId = "00000000-0000-0000-0000-000000000002";

const participant = {
  person_id: participantId,
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [], consent_scopes: [],
  navigation: ["Мой путь", "Bootcamp", "Задачи", "Мои проекты", "События", "Рейтинг", "Аналитика"],
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
const detailPayload = (applicationStatus = "applied") => ({
  task,
  problem: "Ручной поиск программ занимает недели.",
  deliverable: terms.deliverable,
  acceptance_criteria: terms.acceptance_criteria,
  deadline_at: terms.deadline_at,
  data_constraints: "—",
  ip_terms: "IP остаётся у участника.",
  terms,
  terms_history: [],
  accepted_terms_version: 2,
  invitation_status: null,
  customer: { id: "00000000-0000-0000-0000-000000000003", display_name: "Роман Заказчик" },
  mentor: null,
  support: null,
  team: [],
  membership: null,
  checkpoints: [],
  personal: [],
  feedback: [],
  applications: [{ id: applicationId, status: applicationStatus }],
});
const workItem = (assignment: string, status: string, contributions: unknown[] = []) => ({
  assignment: { id: assignment, task_id: taskId, person_id: participantId, application_id: applicationId, status },
  task,
  terms,
  allowed_artifacts: [],
  contributions,
  decisions: [],
});

async function mockShell(page: Page) {
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
}

test("paid application moves through submission and customer revision", async ({ page }) => {
  let acceptedTerms = false;
  let hasAssignment = false;
  let assignmentStatus = "staffed";
  let contribution: Record<string, unknown> | null = null;
  let revision: Record<string, unknown> | null = null;
  const workItems = () => hasAssignment ? [{ assignment: { id: assignmentId, task_id: taskId, person_id: participantId, application_id: applicationId, status: assignmentStatus }, task, terms, contributions: contribution ? [contribution] : [], decisions: revision ? [revision] : [] }] : [];

  await mockShell(page);
  await page.route("**/api/v1/marketplace/tasks", (route) => route.fulfill({ json: [{ task, terms, accepted_terms_version: acceptedTerms ? 2 : null }] }));
  await page.route("**/api/v1/me/work", (route) => route.fulfill({ json: workItems() }));
  await page.route("**/api/v1/me/reward-evidence", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/tasks/*/terms-consent", (route) => { acceptedTerms = true; return route.fulfill({ json: { task, terms, accepted_terms_version: 2 } }); });
  await page.route("**/api/v1/me/tasks/*/applications", (route) => { hasAssignment = true; return route.fulfill({ json: { id: applicationId, status: "applied" } }); });
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
  await page.getByRole("button", { name: "Открыть условия версии 2" }).click();
  const consent = page.getByRole("dialog", { name: "Условия задачи · версия 2" });
  await expect(consent.getByText("Работающий MVP и отчёт по метрикам.")).toBeVisible();
  await consent.getByRole("button", { name: "Подтвердить условия и продолжить" }).click();
  await page.getByRole("button", { name: "Откликнуться" }).click();
  await expect(page.getByText("Вы успешно откликнулись")).toBeVisible();
  await expect(page.getByText("✓ Заявка отправлена")).toBeVisible();
  await expect(page.getByText("Проект сформирован · рабочая область доступна")).toBeVisible();
  await page.getByRole("button", { name: "Открыть мои задачи" }).click();
  await expect(page.getByRole("heading", { name: "Мои задачи" })).toBeVisible();
  await expect(page.getByText("В работе").first()).toBeVisible();
  await expect(page.getByText(/30\s?000\s?₽/)).toHaveCount(0);

  await page.getByRole("link", { name: "Мои проекты" }).click();
  await expect(page.getByRole("heading", { name: "Проекты в работе" })).toBeVisible();
  await expect(page.getByText("Можно начинать")).toBeVisible();
  await page.getByRole("button", { name: "Начать работу" }).click();
  await expect(page.getByLabel("Что сделали лично")).toBeVisible();
  await page.getByLabel("Что сделали лично").fill("Я реализовал API поиска и подготовил воспроизводимую проверку метрики.");
  await page.getByLabel("Ссылка на доказательство").fill("https://example.test/commit/42");
  await page.getByRole("button", { name: "Отправить личный вклад" }).click();
  await expect(page.getByText("Личный вклад · версия 1")).toBeVisible();
  await expect(page.getByText("На приёмке").first()).toBeVisible();

  await page.getByRole("button", { name: "Выйти" }).click();
  await page.locator('[data-persona="customer-roman"]').click();
  await page.getByRole("link", { name: "Приёмка" }).click();
  await expect(page.getByText("Я реализовал API поиска и подготовил воспроизводимую проверку метрики.")).toBeVisible();
  await page.getByRole("button", { name: "Вернуть на доработку" }).click();
  await expect(page.getByText("Нужна доработка")).toBeVisible();

  await page.getByRole("button", { name: "Выйти" }).click();
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Мои проекты" }).click();
  await expect(page.getByText("Нужно уточнить результат и приложить воспроизводимые доказательства.")).toBeVisible();
  await expect(page.getByText(/Срок:/)).toBeVisible();
  await page.getByRole("button", { name: "Начать доработку" }).click();
  await expect(page.getByLabel("Что сделали лично")).toBeVisible();
});

test("withdraw confirmation revives the apply CTA and allows reapply", async ({ page }) => {
  let withdrawCalls = 0;
  let applyCalls = 0;
  const withdrawBodies: (string | null)[] = [];

  await mockShell(page);
  await page.addInitScript((seed) => { sessionStorage.setItem("impulse_applied_tasks", JSON.stringify([seed])); }, taskId);
  await page.route("**/api/v1/marketplace/tasks", (route) => route.fulfill({ json: [{ task, terms, accepted_terms_version: 2 }] }));
  await page.route("**/api/v1/me/work", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/reward-evidence", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/tasks/" + taskId, (route) => route.fulfill({ json: detailPayload("applied") }));
  await page.route("**/api/v1/me/applications/*/withdraw", async (route) => {
    withdrawCalls += 1;
    withdrawBodies.push(route.request().postData());
    await route.fulfill({ json: { id: applicationId, status: "withdrawn" } });
  });
  await page.route("**/api/v1/me/tasks/*/applications", async (route) => {
    applyCalls += 1;
    await route.fulfill({ json: { id: applicationId, status: "applied" } });
  });

  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Задачи" }).click();
  await expect(page.getByRole("heading", { name: "Мои задачи" })).toBeVisible();
  await expect(page.getByText("Ожидает решения")).toBeVisible();

  const sentButton = page.getByRole("button", { name: "✓ Заявка отправлена" });
  await sentButton.click();
  const dialog = page.getByRole("dialog", { name: "Отозвать заявку?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("MVP поиска программ")).toBeVisible();
  await expect(dialog.getByText(/Текущий статус:.*заявка отправлена/)).toBeVisible();
  await dialog.getByRole("button", { name: "Отмена" }).click();
  await expect(dialog).toBeHidden();
  await expect(sentButton).toBeFocused();
  expect(withdrawCalls).toBe(0);

  await sentButton.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(sentButton).toBeFocused();
  expect(withdrawCalls).toBe(0);

  await sentButton.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Подтвердить отзыв" }).click();
  await expect(page.getByText("Заявка отозвана")).toBeVisible();
  expect(withdrawCalls).toBe(1);
  expect(withdrawBodies[0]).toBeNull();

  const reapply = page.getByRole("button", { name: "Откликнуться" });
  await expect(reapply).toBeVisible();
  await reapply.click();
  await expect(page.getByText("Вы успешно откликнулись")).toBeVisible();
  await expect(page.getByText("✓ Заявка отправлена")).toBeVisible();
  expect(applyCalls).toBe(1);
});

test("surfaces the honest error when customer already accepted the application", async ({ page }) => {
  await mockShell(page);
  await page.addInitScript((seed) => { sessionStorage.setItem("impulse_applied_tasks", JSON.stringify([seed])); }, taskId);
  await page.route("**/api/v1/marketplace/tasks", (route) => route.fulfill({ json: [{ task, terms, accepted_terms_version: 2 }] }));
  await page.route("**/api/v1/me/work", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/reward-evidence", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/tasks/" + taskId, (route) => route.fulfill({ json: detailPayload("applied") }));
  await page.route("**/api/v1/me/applications/*/withdraw", (route) => route.fulfill({ status: 409, json: { code: "ACCEPTED_WITHDRAW_FORBIDDEN", message: "Заявка уже принята заказчиком.", retryable: false } }));

  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Задачи" }).click();
  await expect(page.getByRole("heading", { name: "Мои задачи" })).toBeVisible();
  await page.getByRole("button", { name: "Отозвать заявку" }).click();
  const dialog = page.getByRole("dialog", { name: "Отозвать заявку?" });
  await dialog.getByRole("button", { name: "Подтвердить отзыв" }).click();
  const honest = "Заявка уже принята — отзыв недоступен. Продолжайте работу в рабочей области.";
  await expect(page.getByText(honest).first()).toBeVisible();
  await expect(dialog).toBeVisible();
});

test("opens the exact assignment workspace through the project deep link", async ({ page }) => {
  await mockShell(page);
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: participant }));
  await page.route("**/api/v1/marketplace/tasks", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/work", (route) => route.fulfill({ json: [workItem(assignmentId, "in_progress")] }));
  await page.route("**/api/v1/me/reward-evidence", (route) => route.fulfill({ json: [] }));

  await page.goto(`/workspace/3?project=${assignmentId}`);
  await expect(page.getByRole("heading", { name: "MVP поиска программ" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Проекты в работе" })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("project")).toBe(assignmentId);
  expect(new URL(page.url()).searchParams.get("detail")).toBeNull();
});

test("opens an API-backed teammate card, metric objects and the exact direct chat", async ({ page }) => {
  await mockShell(page);
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: participant }));
  await page.route("**/api/v1/marketplace/tasks", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/work", (route) => route.fulfill({ json: [workItem(assignmentId, "in_progress")] }));
  await page.route("**/api/v1/me/reward-evidence", (route) => route.fulfill({ json: [] }));
  await page.route(`**/api/v1/me/tasks/${taskId}`, (route) => route.fulfill({ json: {
    ...detailPayload(),
    team: [{ person_id: teammateId, display_name: "Мария Воронова", status: "submitted" }],
    checkpoints: [{ key: "research", title: "Исследование", status: "completed" }, { key: "api", title: "API", status: "in_progress" }],
    personal: [{ id: contributionId, assignment_id: assignmentId, version: 2, personal_summary: "API готов", artifact_keys: ["openapi-v2"], status: "submitted" }],
    feedback: [{ contribution_id: contributionId, contribution_version: 2, review_version: 1, grade: "B", explanation: "Нужен benchmark", status: "draft" }],
  } }));
  await page.route(`**/api/v1/me/tasks/${taskId}/team/${teammateId}/quick-card`, (route) => route.fulfill({ json: {
    person_id: teammateId,
    task_id: taskId,
    assignment_status: "submitted",
    contribution_status: "submitted",
    availability: "on_review",
    project_role: "Исполнитель",
    responsibility: "API готов",
    display_name: "Мария Воронова",
    portfolio_available: true,
    profile: { city: "Москва", university: null, telegram: null, about: null, skills: [{ title: "FastAPI", origin: "project", verified: true }] },
  } }));

  await page.goto(`/workspace/3?project=${assignmentId}`);
  await page.getByRole("button", { name: /Мария Воронова/ }).click();
  const card = page.getByRole("dialog", { name: "Карточка участника" });
  await expect(card).toContainText("API готов");
  await expect(card).toContainText("FastAPI");
  await card.getByRole("button", { name: "Закрыть" }).click();

  await page.getByRole("button", { name: "Выполнено этапов" }).click();
  await expect(page.getByRole("dialog", { name: "Расчёт ключевой метрики" })).toContainText("1 / 2");
  await page.getByRole("button", { name: "Закрыть" }).click();
  await page.getByRole("button", { name: /Мария Воронова/ }).click();
  await card.getByRole("button", { name: "Сообщение" }).click();
  await expect(page).toHaveURL(new RegExp(`/workspace/10\\?participant=${teammateId}&task=${taskId}$`));
});

test("keeps project layout, filter and selection in the URL", async ({ page }) => {
  await mockShell(page);
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: participant }));
  await page.route("**/api/v1/marketplace/tasks", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/work", (route) => route.fulfill({ json: [
    workItem(assignmentId, "in_progress"),
    workItem(submittedAssignmentId, "submitted", [{ id: contributionId, assignment_id: submittedAssignmentId, version: 1, personal_summary: "Сдал измеримую проверку метрики.", artifact_keys: ["personal-proof"], status: "submitted" }]),
  ] }));
  await page.route("**/api/v1/me/reward-evidence", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/assignments/*/deadline-requests", (route) => route.fulfill({ json: [] }));

  await page.goto("/workspace/3");
  await expect(page.getByRole("heading", { name: "Проекты в работе" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Открыть проект →" })).toHaveCount(2);

  await page.getByRole("button", { name: "На приёмке" }).click();
  await expect(page).toHaveURL(/filter=submitted/);
  await expect(page.getByText("Сдал измеримую проверку метрики.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Открыть проект →" })).toHaveCount(1);

  await page.getByRole("group", { name: "Вид проектов" }).getByRole("button", { name: "Список" }).click();
  await expect(page).toHaveURL(/layout=list/);
  await expect(page.locator('[role="list"]').first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Открыть проект →" })).toHaveCount(1);

  await page.getByRole("button", { name: "Открыть проект →" }).click();
  await expect(page).toHaveURL(new RegExp(`project=${submittedAssignmentId}&detail=1`));
  await expect(page.getByRole("heading", { name: "MVP поиска программ", level: 3 })).toBeVisible();
  await expect(page.getByText("Переносы срока не запрашивались")).toBeVisible();

  await page.getByRole("button", { name: "Вернуться к списку проектов" }).click();
  await expect(page).toHaveURL(/layout=list&?[^=]*filter=submitted|filter=submitted.*layout=list/);
  expect(new URL(page.url()).searchParams.get("project")).toBeNull();
  await expect(page.getByRole("button", { name: "Открыть проект →" })).toHaveCount(1);
});

test("proposes a deadline change and surfaces the pending duplicate honestly", async ({ page }) => {
  let proposalCalls = 0;
  const proposalBodies: Record<string, unknown>[] = [];
  const deadlineList: Record<string, unknown>[] = [];

  await mockShell(page);
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: participant }));
  await page.route("**/api/v1/marketplace/tasks", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/work", (route) => route.fulfill({ json: [workItem(assignmentId, "in_progress")] }));
  await page.route("**/api/v1/me/reward-evidence", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/assignments/*/deadline-requests", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: deadlineList });
      return;
    }
    proposalCalls += 1;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    proposalBodies.push(body);
    if (proposalCalls > 1) {
      await route.fulfill({ status: 409, json: { code: "DEADLINE_CHANGE_PENDING", message: "Запрос уже ожидает решения.", retryable: false } });
      return;
    }
    const created = { id: deadlineRequestId, task_id: taskId, base_terms_version: body.base_terms_version, proposed_deadline_at: body.proposed_deadline_at, reason: body.reason, impact: body.impact, status: "pending", decision_comment: null, decided_at: null, created_at: "2026-10-20T15:00:00Z" };
    deadlineList.push(created);
    await route.fulfill({ status: 201, json: created });
  });

  await page.goto(`/workspace/3?project=${assignmentId}&detail=1`);
  await expect(page.getByText("Переносы срока не запрашивались")).toBeVisible();
  await page.getByLabel("Предлагаемый срок").fill("2026-11-05T18:00");
  await page.getByLabel("Обоснование").fill("Нагрузка выросла вдвое из-за нового интегратора.");
  await page.getByLabel("Влияние на приёмку").fill("Приёмка сдвигается на неделю.");
  await page.getByRole("button", { name: "Запросить перенос срока" }).click();

  await expect(page.getByText("Ожидает решения заказчика")).toBeVisible();
  await expect(page.getByText(/Предложенный срок:/)).toBeVisible();
  expect(proposalBodies[0]).toMatchObject({ base_terms_version: 2, reason: "Нагрузка выросла вдвое из-за нового интегратора.", impact: "Приёмка сдвигается на неделю." });
  expect(String(proposalBodies[0]?.proposed_deadline_at)).toContain("2026-11-05");

  await page.getByRole("button", { name: "Запросить перенос срока" }).click();
  await expect(page.getByText("Уже есть активный запрос на перенос срока — дождитесь решения заказчика.")).toBeVisible();
  expect(proposalCalls).toBe(2);
});

test("collapses workspace sections by keyboard and keeps drafts across reload", async ({ page }) => {
  await mockShell(page);
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: participant }));
  await page.route("**/api/v1/marketplace/tasks", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/work", (route) => route.fulfill({ json: [workItem(assignmentId, "in_progress")] }));
  await page.route("**/api/v1/me/reward-evidence", (route) => route.fulfill({ json: [] }));

  await page.goto(`/workspace/3?project=${assignmentId}`);
  await expect(page.locator(".ctw-page")).toBeVisible();
  await expect(page.locator("#ctw-body-about")).toBeVisible();

  const aboutToggle = page.getByRole("button", { name: /Описание/ });
  await aboutToggle.focus();
  await page.keyboard.press("Enter");
  await expect(aboutToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#ctw-body-about")).toBeHidden();
  await expect(page.locator("#ctw-body-results")).toBeVisible();
  await expect(page.getByText("4 результата")).toBeVisible();

  await page.reload();
  const restored = page.getByRole("button", { name: /Описание/ });
  await expect(restored).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#ctw-body-about")).toBeHidden();
  await expect(page.locator("#ctw-body-results")).toBeVisible();

  await restored.click();
  await expect(restored).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#ctw-body-about")).toBeVisible();
  await expect(page.getByText("Работающий прототип и API")).toBeVisible();
});
