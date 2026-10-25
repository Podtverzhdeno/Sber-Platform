import { expect, test, type Page } from "@playwright/test";

/** Real API and PostgreSQL: do not install route mocks or invent read models. */
type Actor = { person_id: string; navigation: string[] };
type Assignment = { id: string };
type Applied = { id: string; version: number };
type WorkItem = {
  task: { id: string; title: string };
  assignment: { id: string; status: string };
  contributions: { id: string; status: string }[];
};
type Passport = {
  person_id: string;
  cases: { contribution_id: string }[];
  skills: { key: string; confirmed_case_count: number }[];
};
type Portfolio = {
  person_id: string;
  contributions: {
    contribution_id: string; project_title: string; verification_status: string;
  }[];
};
type Journey = {
  person_id: string;
  accepted_case_count: number;
  projects: { assignment_id: string; accepted_contribution_ids: string[] }[];
  ratings: unknown[];
};

async function api<T>(
  page: Page,
  path: string,
  options: { method?: string; csrf?: string; data?: unknown } = {},
): Promise<T> {
  const response = await page.context().request.fetch(path, {
    method: options.method ?? "GET",
    headers: options.csrf ? { "X-CSRF-Token": options.csrf } : undefined,
    data: options.data,
    failOnStatusCode: false,
  });
  const result = await response.json() as T;
  expect(response.status(), `${options.method ?? "GET"} ${path}: ${JSON.stringify(result)}`).toBe(200);
  return result;
}
async function signIn(page: Page, personaKey: string): Promise<string> {
  const login = await api<{ csrf_token: string }>(page, "/api/v1/auth/demo-login", {
    method: "POST", data: { persona_key: personaKey },
  });
  return login.csrf_token;
}
async function post<T>(page: Page, path: string, csrf: string, data?: unknown): Promise<T> {
  return api<T>(page, path, { method: "POST", csrf, data });
}

test("real project lifecycle propagates accepted evidence to all participant screens after reload", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  const customer = await signIn(page, "customer-roman");
  const title = "Проверка реального проекта: интеграция API и доказательства";
  const task = await post<{ id: string }>(
    page, "/api/v1/customer/projects/demo-rd-lab/tasks", customer,
    {
      task_key: "browser-project-evidence-2026",
      title,
      problem: "Подтвердить результат через сквозной жизненный цикл.",
      deliverable: "Репозиторий с воспроизводимым тестом API.",
      acceptance_criteria: ["Репозиторий доступен", "API покрыт тестами"],
      deadline_at: "2027-02-01T18:00:00Z",
      data_constraints: "Только синтетические тестовые данные",
      ip_terms: "Авторство личного вклада подтверждает заказчик",
      nominated_mentor_id: null,
      allowed_artifacts: ["repo"],
      competency_tags: ["python", "architecture"],
      case_rubric: {
        version: 1, result: "Воспроизводимое решение", reasoning: "Обоснование архитектуры",
        uncertainty: "Риски и допущения", ai_use: "Прозрачность ИИ", defense: "Защита результата",
      },
      compensation: {
        paid: true, base_amount_per_assignee: "10000.00", currency: "RUB",
        a_multiplier: "2.50", quantum: "0.01", rounding_mode: "half_up",
        policy_version: 1, payout_condition: "После принятия",
      },
    },
  );
  const taskId = task.id;
  await post(page, `/api/v1/customer/tasks/${taskId}/submit`, customer);
  const operator = await signIn(page, "operator-pavel");
  await post(page, `/api/v1/operations/tasks/${taskId}/moderate`, operator);
  await post(page, `/api/v1/operations/tasks/${taskId}/support`, operator, { mode: "operator" });
  await post(page, `/api/v1/operations/tasks/${taskId}/publish`, operator);

  const participant = await signIn(page, "participant-alex");
  const actor = await api<Actor>(page, "/api/v1/me");
  const projectsIndex = actor.navigation.indexOf("Мои проекты");
  const portfolioIndex = actor.navigation.indexOf("Портфолио");
  const buddyIndex = actor.navigation.findIndex(section => section === "AI-Buddy" || section === "AI Buddy");
  expect(projectsIndex).toBeGreaterThanOrEqual(0);
  expect(portfolioIndex).toBeGreaterThanOrEqual(0);
  expect(buddyIndex).toBeGreaterThanOrEqual(0);
  const baselineJourney = await api<Journey>(page, "/api/v1/me/journey/snapshot");
  const portfolioBefore = await api<Portfolio>(page, "/api/v1/me/portfolio");
  const passportBefore = await api<Passport>(page, "/api/v1/me/talent-passport");
  const ratingBefore = await api<unknown[]>(page, "/api/v1/me/rating/standings");
  const detail = await api<{ terms: { version: number } }>(page, `/api/v1/me/tasks/${taskId}`);
  await post(page, `/api/v1/me/tasks/${taskId}/terms-consent`, participant, {
    terms_version: detail.terms.version,
  });
  const applied = await post<Applied>(
    page, `/api/v1/me/tasks/${taskId}/applications`, participant,
  );

  const pending = await api<Journey>(page, "/api/v1/me/journey/snapshot");
  expect(pending.accepted_case_count).toBe(baselineJourney.accepted_case_count);
  expect(pending.projects).toEqual(baselineJourney.projects);
  expect((await api<Passport>(page, "/api/v1/me/talent-passport")).cases).toEqual(passportBefore.cases);

  const customerAgain = await signIn(page, "customer-roman");
  const assigned = await post<Assignment>(
    page, `/api/v1/customer/applications/${applied.id}/accept`,
    customerAgain, { expected_version: applied.version },
  );
  const assignmentId = assigned.id;

  const participantAgain = await signIn(page, "participant-alex");
  const workBefore = await api<WorkItem[]>(page, "/api/v1/me/work");
  expect(workBefore.some(item => item.assignment.id === assignmentId)).toBe(true);
  // The assigned project must be visible in the actual React screen.
  await page.goto(`/workspace/${String(projectsIndex)}?project=${encodeURIComponent(assignmentId)}`);
  await expect(page.locator('[data-project-screen="detail"]')).toBeVisible();
  await expect(page.locator('[data-project-screen="detail"]')).toContainText(title);
  await post(page, `/api/v1/me/assignments/${assignmentId}/start`, participantAgain);
  const submitted = await post<{ id: string }>(
    page, `/api/v1/me/assignments/${assignmentId}/contributions`,
    participantAgain,
    {
      personal_summary: "Разработал API и проверяемые тесты принятого результата.",
      artifacts: [{ key: "repo", uri: "https://example.test/impulse/project/commit/99" }],
    },
  );
  const contributionId = submitted.id;
  const unaccepted = await api<Journey>(page, "/api/v1/me/journey/snapshot");
  expect(unaccepted.accepted_case_count).toBe(baselineJourney.accepted_case_count);
  expect((await api<Portfolio>(page, "/api/v1/me/portfolio")).contributions).toEqual(
    portfolioBefore.contributions,
  );

  const finalCustomer = await signIn(page, "customer-roman");
  await post(page, `/api/v1/customer/contributions/${contributionId}/decision`, finalCustomer, {
    decision: "accepted", reason: "Код, ссылка и критерии приёмки проверены.",
  });
  await signIn(page, "participant-alex");
  await page.reload();
  const workAfter = await api<WorkItem[]>(page, "/api/v1/me/work");
  expect(workAfter.some(item =>
    item.assignment.id === assignmentId &&
    item.contributions.some(c => c.id === contributionId && c.status === "accepted")
  )).toBe(true);
  const passportAfter = await api<Passport>(page, "/api/v1/me/talent-passport");
  expect(passportAfter.person_id).toBe(actor.person_id);
  expect(passportAfter.cases.some(item => item.contribution_id === contributionId)).toBe(true);
  expect(passportAfter.skills.some(item => item.key === "python" && item.confirmed_case_count > 0)).toBe(true);
  const portfolioAfter = await api<Portfolio>(page, "/api/v1/me/portfolio");
  expect(portfolioAfter.person_id).toBe(actor.person_id);
  expect(portfolioAfter.contributions.some(item =>
    item.contribution_id === contributionId &&
    item.project_title === title &&
    item.verification_status === "verified"
  )).toBe(true);
  const journey = await api<Journey>(page, "/api/v1/me/journey/snapshot");
  expect(journey.person_id).toBe(actor.person_id);
  expect(journey.accepted_case_count).toBe(baselineJourney.accepted_case_count + 1);
  expect(journey.projects.some(item =>
    item.assignment_id === assignmentId &&
    item.accepted_contribution_ids.includes(contributionId)
  )).toBe(true);
  expect(journey.ratings).toEqual([]);
  expect(await api<unknown[]>(page, "/api/v1/me/rating/standings")).toEqual(ratingBefore);

  // These screens must independently render persisted source data after a hard navigation.
  await page.goto(`/workspace/${String(projectsIndex)}?project=${encodeURIComponent(assignmentId)}&tab=contribution`);
  await expect(page.locator('[data-project-screen="detail"]')).toContainText(
    "Разработал API и проверяемые тесты принятого результата.",
  );
  await page.goto(`/workspace/${String(portfolioIndex)}`);
  await expect(page.getByTestId("portfolio-v2")).toBeVisible();
  await expect(page.getByTestId("portfolio-v2")).toContainText(title);
  await page.getByRole("tab", { name: "Skill Passport" }).click();
  await expect(page.getByRole("region", { name: "Подтверждающие кейсы" })).toContainText("python");

  await page.goto(`/workspace/${String(buddyIndex)}`);
  const buddy = page.getByTestId("buddy-live-context");
  await expect(buddy).toBeVisible();
  await expect(buddy.getByTestId("buddy-accepted-count")).toHaveText(
    String(baselineJourney.accepted_case_count + 1),
  );

  // Other participants must not inherit Alex's accepted personal evidence.
  await signIn(page, "participant-maria");
  const otherPortfolio = await api<Portfolio>(page, "/api/v1/me/portfolio");
  expect(otherPortfolio.contributions.some(item => item.contribution_id === contributionId)).toBe(false);
  const otherPassport = await api<Passport>(page, "/api/v1/me/talent-passport");
  expect(otherPassport.cases.some(item => item.contribution_id === contributionId)).toBe(false);
  const otherJourney = await api<Journey>(page, "/api/v1/me/journey/snapshot");
  expect(otherJourney.projects.some(item =>
    item.accepted_contribution_ids.includes(contributionId)
  )).toBe(false);
});
