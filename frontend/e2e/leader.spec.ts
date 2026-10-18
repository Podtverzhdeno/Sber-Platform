import { expect, test } from "@playwright/test";

type CandidateMatch = {
  person_id: string;
  display_name: string;
  request_version: number;
  matched_required: string[];
  matched_preferred: string[];
  evidence: {
    task_id: string;
    contribution_id: string;
    personal_summary: string;
    competency_tags: string[];
    artifact_keys: string[];
  }[];
};

test("leader pilot journey runs case matching, closed invitation and reserve", async ({
  page,
}) => {
  const closedTask = {
    id: "task-closed",
    title: "Закрытая MVP задача направления NLP",
    status: "published",
    mode: "invitation_only",
    competency_tags: ["NLP"],
  };
  const caseTask = {
    id: "task-case",
    title: "Кейс прототипа рекомендательной системы",
    status: "published",
    mode: "open",
    competency_tags: ["NLP", "CV"],
  };
  const teamRequest = {
    id: "req-1",
    version: 1,
    title: "Ищем NLP инженера",
    required_tags: ["NLP"],
    preferred_tags: [],
    relevant_case_task_ids: ["task-case"],
  };
  const candidate: CandidateMatch = {
    person_id: "p-alex",
    display_name: "Алекс Речной",
    request_version: 1,
    matched_required: ["NLP"],
    matched_preferred: [],
    evidence: [
      {
        task_id: "task-case",
        contribution_id: "c-1",
        personal_summary: "Собрал прототип и воспроизводимый benchmark.",
        competency_tags: ["NLP"],
        artifact_keys: ["repo"],
      },
    ],
  };
  const savedSelection: {
    id: string;
    request_id: string;
    person_id: string;
    created_at: string;
    match: CandidateMatch;
  }[] = [];

  await page.route("**/api/v1/config", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/v1/auth/personas", (route) =>
    route.fulfill({
      json: [
        { key: "customer-roman", display_name: "Роман Заказчик", roles: ["customer"] },
      ],
    }),
  );
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: {} }));
  await page.route("**/api/v1/demo-search", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/notifications", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/v1/me/notifications/read-all", (route) =>
    route.fulfill({ json: {} }),
  );
  await page.route("**/api/v1/auth/demo-login", (route) =>
    route.fulfill({
      json: {
        person_id: "5",
        display_name: "Роман Заказчик",
        active_role: "customer",
        assigned_roles: ["customer"],
        scopes: [],
        consent_scopes: [],
        navigation: ["Главная", "База участников", "Сообщения"],
        csrf_token: "csrf",
      },
    }),
  );
  await page.route("**/api/v1/customer/tasks", (route) =>
    route.fulfill({ json: [closedTask] }),
  );
  await page.route("**/api/v1/customer/cases", (route) =>
    route.fulfill({ json: [caseTask] }),
  );
  await page.route("**/api/v1/customer/team-requests", (route) =>
    route.fulfill({ json: teamRequest }),
  );
  await page.route("**/api/v1/customer/team-requests/req-1/matches", (route) =>
    route.fulfill({ json: [candidate] }),
  );
  await page.route("**/api/v1/customer/tasks/task-closed/invitations", (route) =>
    route.fulfill({
      json: {
        id: "inv-1",
        task_id: "task-closed",
        person_id: "p-alex",
        status: "pending",
        expires_at: "2026-10-24T09:00:00Z",
        terms_version: 1,
      },
    }),
  );
  await page.route("**/api/v1/customer/team-requests/req-1/saved/*", (route) =>
    route.fulfill({
      json: {
        id: "r-1",
        request_id: "req-1",
        person_id: "p-alex",
        created_at: "2026-10-01T09:00:00Z",
        match: candidate,
      },
    }),
  );
  await page.route("**/api/v1/customer/saved-candidates", (route) =>
    route.fulfill({ json: savedSelection }),
  );

  await page.goto("/");
  await page.locator('[data-persona="customer-roman"]').click();
  await page.getByRole("link", { name: "База участников" }).click();
  await expect(
    page.getByRole("heading", { name: "Подбор по подтверждённым кейсам" }),
  ).toBeVisible();
  await expect(page.getByText("Опубликуйте хотя бы один кейс")).toHaveCount(0);

  await page.getByLabel("Задача команды").fill("Ищем NLP инженера");
  await page.getByLabel("Обязательные навыки через запятую").fill("NLP");
  await page
    .getByLabel("Релевантный завершённый кейс")
    .selectOption("task-case");
  await page.getByRole("button", { name: "Показать кандидатов" }).click();

  await expect(page.getByText("Запрос версии 1")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Подходящие участники" })).toBeVisible();
  const candidateRow = page.locator(".customer-task-row", { hasText: "Алекс Речной" });
  await expect(candidateRow).toContainText("Подтверждено: NLP");
  await expect(candidateRow).toContainText("Собрал прототип и воспроизводимый benchmark.");

  await page.getByLabel("Закрытая задача для приглашения").selectOption("task-closed");
  await page.getByRole("button", { name: "Пригласить в задачу" }).click();
  await expect(
    page.getByText("Приглашение отправлено. Участник увидит условия задачи."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Сохранить в резерв" }).click();
  await expect(page.getByText("Кандидат сохранён в резерве.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Кадровый резерв" })).toBeVisible();
  await expect(page.getByText("В резерве")).toBeVisible();

  const cabinetScreenshot = await page.locator(".customer-candidates").screenshot();
  expect(cabinetScreenshot.byteLength).toBeGreaterThan(1_000);
});
