import { expect, test, type Page } from "@playwright/test";

const teamChannelId = "b6a24e2f-8a0e-4a41-9cea-5f5a2e39a10a";
const personalChannelId = "b6a24e2f-8a0e-4a41-9cea-5f5a2e39a10b";
const customerId = "c39256e2-6f56-5c58-9e73-b7b0d1a4b90c";

const teamChannel = {
  id: teamChannelId,
  kind: "task_team",
  title: "Ревью отзывов",
  status: "active",
  task_id: "20000000-0000-0000-0000-000000000002",
  role: "customer",
  muted: false,
  sender_enabled: true,
  unread: 1,
  participants: [
    { id: customerId, display_name: "Роман Воронов", role: "customer" },
    { id: "7cf6de52-be5a-4c6f-b082-84ef2fb9079c", display_name: "Алекс Речной", role: "member" },
  ],
  last_message: {
    id: "msg-1",
    author_id: "7cf6de52-be5a-4c6f-b082-84ef2fb9079c",
    author_name: "Алекс Речной",
    kind: "text",
    body: "Демо-версия готова, прошу приёмку.",
    artifact_refs: [],
    sequence: 2,
    created_at: "2026-10-16T11:20:00+00:00",
  },
  created_at: "2026-10-10T09:00:00+00:00",
};

const personalChannel = {
  id: personalChannelId,
  kind: "personal",
  title: null,
  status: "active",
  task_id: null,
  role: "member",
  muted: false,
  sender_enabled: false,
  unread: 0,
  participants: [
    { id: customerId, display_name: "Роман Воронов", role: "customer" },
    { id: "7cf6de52-be5a-4c6f-b082-84ef2fb9079c", display_name: "Алекс Речной", role: "member" },
  ],
  last_message: {
    id: "msg-2",
    author_id: "7cf6de52-be5a-4c6f-b082-84ef2fb9079c",
    author_name: "Алекс Речной",
    kind: "text",
    body: "Личное: документы выслал.",
    artifact_refs: [],
    sequence: 1,
    created_at: "2026-10-15T10:00:00+00:00",
  },
  created_at: "2026-10-14T09:00:00+00:00",
};

const contextPayload = {
  project_key: "impulse-crm",
  task_title: "Ревью отзывов",
  deadline_at: "2026-10-24T18:00:00+00:00",
  contribution_version: 1,
  contribution_accepted: true,
  review_status: "human_confirmed",
};

function mockBoot(page: Page, navigation: string[]): void {
  void page.route("**/api/v1/**", (route) => route.fulfill({ status: 404, json: {} }));
  void page.route("**/api/v1/config", (route) => route.fulfill({ json: { demo_mode: true } }));
  void page.route("**/api/v1/auth/personas", (route) =>
    route.fulfill({
      json: [
        { key: "customer-roman", display_name: "Роман Воронов", roles: ["customer"] },
      ],
    }),
  );
  void page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: {} }));
  void page.route("**/api/v1/demo-search", (route) => route.fulfill({ json: [] }));
  void page.route("**/api/v1/me/notifications", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  void page.route("**/api/v1/me/notifications/read-all", (route) =>
    route.fulfill({ json: {} }),
  );
  void page.route("**/api/v1/auth/demo-login", (route) =>
    route.fulfill({
      json: {
        person_id: customerId,
        display_name: "Роман Воронов",
        active_role: "customer",
        assigned_roles: ["customer"],
        scopes: [],
        consent_scopes: [],
        navigation,
        csrf_token: "csrf",
      },
    }),
  );
  void page.route("**/api/v1/me/messaging/channels", (route) =>
    route.fulfill({ json: [teamChannel, personalChannel] }),
  );
  void page.route(`**/api/v1/me/messaging/channels/${teamChannelId}/messages*`, (route) =>
    route.fulfill({ json: [teamChannel.last_message] }),
  );
  void page.route(`**/api/v1/me/messaging/channels/${teamChannelId}/context`, (route) =>
    route.fulfill({ json: contextPayload }),
  );
  void page.route(`**/api/v1/me/messaging/channels/${teamChannelId}/read`, (route) =>
    route.fulfill({ json: { ...teamChannel, unread: 0 } }),
  );
  void page.route(`**/api/v1/me/messaging/channels/${personalChannelId}/messages*`, (route) =>
    route.fulfill({ json: [personalChannel.last_message] }),
  );
}

test("customer journeys: контекст задачи, доменные границы и read-only чат", async ({
  page,
}) => {
  mockBoot(page, ["Сообщения"]);

  await page.goto("/");
  await page.locator('[data-persona="customer-roman"]').click();
  await expect(page.getByRole("link", { name: "Сообщения" })).toBeVisible();
  await page.getByRole("link", { name: "Сообщения" }).click();
  // SberChat waits for explicit channel selection; do not invent active history.
  await page.locator(".msg-dialog-list__row").filter({ hasText: "Ревью отзывов" }).click();

  const context = page.getByRole("complementary", { name: "Контекст диалога" });
  await expect(context.getByRole("heading", { level: 2 })).toHaveText("Ревью отзывов");
  await expect(context).toContainText("Проект");
  await expect(context).toContainText("версия 1 · принят заказчиком");
  await expect(page.getByTestId("context-disclaimer")).toContainText(
    "формальные приёмка вклада",
  );

  await expect(
    page.getByRole("button", { name: "Открыть вклад задачи" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Открыть вклад задачи" }).click();
  await expect(page).toHaveURL(/workspace\/1\?task=/);

  await page.getByRole("link", { name: "Сообщения" }).click();
  await page.locator(".msg-dialog-list__row").filter({ hasText: "Ревью отзывов" }).click();
  const chatPane = page.locator(".msg-chat");
  await expect(chatPane).toBeVisible();

  await page.getByRole("button", { name: "Скрыть контекст" }).click();
  await expect(page.getByRole("complementary", { name: "Контекст диалога" })).toHaveCount(0);

  const personalRow = page
    .locator(".msg-dialog-list__row")
    .filter({ hasText: "Личное: документы выслал." })
    .first();
  await personalRow.click();
  await expect(page.getByTestId("composer-readonly")).toContainText(
    "отозвано право писать",
  );
  await expect(page.locator('[data-testid="composer-textarea"]')).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Текущий чат", exact: true })
      .getByText("Личное: документы выслал.", { exact: true }),
  ).toBeVisible();
});
