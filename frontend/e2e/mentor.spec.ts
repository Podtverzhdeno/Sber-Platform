import { expect, test } from "@playwright/test";

test("mentor routes rubric queue into workspace and opens messenger context", async ({
  page,
}) => {
  const queueItem = {
    review: {
      id: "r1",
      contribution_id: "c1",
      contribution_version: 2,
      rubric_id: "rub1",
      rubric_version: 3,
      version: 1,
      grade: "A",
      assessments: [
        { criterion_key: "result", finding: "Принято.", evidence_refs: ["artifact:mvp"] },
      ],
      explanation: "Решение подписано ментором.",
      status: "human_confirmed",
      draft_origin: "ai_suggestion",
      confirmed_by: "mentor-id-0001",
      published_by: null,
    },
    payout: null,
    task_title: "MVP для mentor journey",
    deadline_at: "2026-10-05T18:00:00Z",
    personal_summary: "Собрал пайплайн и benchmark.",
    artifact_keys: ["artifact:mvp"],
    contribution_accepted: true,
    authorship_conflict_open: false,
    participant_name: "Алекс Речной",
    project_key: "impulse-demo",
    task_kind: "task",
    rubric_key: "impulse-5plus-demo",
    rubric_version: 3,
    rubric_criteria: [
      { key: "result", title: "Качество и полнота результата" },
      { key: "ownership", title: "Самостоятельность и ответственность" },
    ],
  };
  const channel = {
    id: "ch-1",
    kind: "task_team",
    title: "MVP для mentor journey",
    status: "active",
    task_id: "task-1",
    role: "mentor",
    muted: false,
    sender_enabled: true,
    unread: 1,
    participants: [
      { person_id: "mentor-1", role: "mentor" },
      { person_id: "participant-9", role: "member" },
    ],
    last_message: null,
    created_at: "2026-09-01T09:00:00Z",
  };
  const contextPayload = {
    project_key: "impulse-demo",
    task_title: "MVP для mentor journey",
    deadline_at: "2026-10-05T18:00:00Z",
    contribution_version: 2,
    contribution_accepted: true,
    review_status: "human_confirmed",
  };
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/v1/auth/personas", (route) =>
    route.fulfill({
      json: [{ key: "mentor-elena", display_name: "Елена Наставник", roles: ["mentor"] }],
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
        person_id: "2",
        display_name: "Елена Наставник",
        active_role: "mentor",
        assigned_roles: ["mentor"],
        scopes: [],
        consent_scopes: [],
        navigation: ["Очередь ревью", "План недели", "Сообщения"],
        csrf_token: "csrf",
      },
    }),
  );
  await page.route("**/api/v1/mentor/review-queue", (route) =>
    route.fulfill({ json: [queueItem] }),
  );
  await page.route("**/api/v1/me/messaging/channels", (route) =>
    route.fulfill({ json: [channel] }),
  );
  await page.route("**/api/v1/me/messaging/channels/ch-1/messages", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/v1/me/messaging/channels/ch-1/context", (route) =>
    route.fulfill({ json: contextPayload }),
  );
  await page.route("**/api/v1/me/messaging/channels/ch-1/read", (route) =>
    route.fulfill({ json: { ...channel, unread: 0 } }),
  );

  await page.goto("/");
  await page.locator('[data-persona="mentor-elena"]').click();
  await expect(page.getByRole("heading", { name: "Алекс Речной" })).toBeVisible();
  await expect(page.getByText("Просроченные")).toBeVisible();
  await expect(page.getByText("Личный вклад · версия 2")).toBeVisible();
  await expect(page.getByText(/проект impulse-demo/)).toBeVisible();
  await page.getByRole("button", { name: "Критерии" }).click();
  await expect(page.getByText(/Рубрика «impulse-5plus-demo» · версия/)).toBeVisible();

  const workspaceScreenshot = await page.locator(".review-workbench").screenshot();
  expect(workspaceScreenshot.byteLength).toBeGreaterThan(1_000);

  await page.getByRole("link", { name: "Сообщения" }).click();
  await expect(page.locator(".chat-context h2")).toHaveText("MVP для mentor journey");
  await expect(page.locator(".chat-context")).toContainText("Проект");
  await expect(page.locator(".chat-context")).toContainText("версия 2 · принят заказчиком");
  await expect(page.locator(".chat-context")).toContainText("Оценка подтверждена человеком");

  const messengerScreenshot = await page.locator(".messenger-shell").screenshot();
  expect(messengerScreenshot.byteLength).toBeGreaterThan(1_000);
});
