import { expect, test, type Page, type Route } from "@playwright/test";

const channelId = "b6a24e2f-8a0e-4a41-9cea-5f5a2e39a101";
const viewerId = "e39256e2-6f56-5c58-9e73-b7b0d1a4b901";

const channel = {
  id: channelId,
  kind: "task_team",
  title: "Команда MVP трекинга",
  status: "active",
  task_id: "30000000-0000-0000-0000-000000000003",
  role: "member",
  muted: false,
  sender_enabled: true,
  unread: 2,
  participants: [
    { id: viewerId, display_name: "Илья Речной", role: "member" },
    { id: "7cf6de52-be5a-4c6f-b082-84ef2fb9079c", display_name: "Алекс Речной", role: "member" },
  ],
  last_message: {
    id: "msg-2",
    author_id: "7cf6de52-be5a-4c6f-b082-84ef2fb9079c",
    author_name: "Алекс Речной",
    kind: "text",
    body: "Сборка прошла тесты, выгружаю релиз-кандидат.",
    artifact_refs: ["repository"],
    sequence: 3,
    created_at: "2026-10-16T12:40:00+00:00",
  },
  created_at: "2026-10-10T09:00:00+00:00",
};

const messages = [
  {
    id: "msg-1",
    author_id: "7cf6de52-be5a-4c6f-b082-84ef2fb9079c",
    author_name: "Алекс Речной",
    kind: "text",
    body: "Пришлите сравнение метрик до пятницы.",
    artifact_refs: [],
    sequence: 2,
    created_at: "2026-10-16T12:30:00+00:00",
  },
  {
    ...channel.last_message,
  },
];

function mockBoot(
  page: Page,
  navigation: string[],
  capture: {
    sendBodies: unknown[];
    muteBodies: unknown[];
  },
): void {
  void page.route("**/api/v1/**", (route) => route.fulfill({ status: 404, json: {} }));
  void page.route("**/api/v1/config", (route) => route.fulfill({ json: {} }));
  void page.route("**/api/v1/auth/personas", (route) =>
    route.fulfill({
      json: [
        { key: "participant-ilya", display_name: "Илья Речной", roles: ["participant"] },
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
        person_id: viewerId,
        display_name: "Илья Речной",
        active_role: "participant",
        assigned_roles: ["participant"],
        scopes: [],
        consent_scopes: [],
        navigation,
        csrf_token: "csrf",
      },
    }),
  );
  void page.route("**/api/v1/me/messaging/channels", (route) => route.fulfill({ json: [channel] }));
  void page.route(
    `**/api/v1/me/messaging/channels/${channelId}/messages*`,
    (route: Route) => {
      if (route.request().method() === "POST") {
        capture.sendBodies.push(route.request().postDataJSON());
        return route.fulfill({ json: { ...channel.last_message, sequence: 4 } });
      }
      return route.fulfill({ json: messages });
    },
  );
  void page.route(`**/api/v1/me/messaging/channels/${channelId}/read`, (route) =>
    route.fulfill({ json: { ...channel, unread: 0 } }),
  );
  void page.route(`**/api/v1/me/messaging/channels/${channelId}/mute`, (route) => {
    capture.muteBodies.push(route.request().postDataJSON());
    return route.fulfill({ json: { ...channel, muted: true } });
  });
}

test("participant journeys: диалог, отправка, вложение, заглушить чат", async ({ page }) => {
  const sendBodies: unknown[] = [];
  const muteBodies: unknown[] = [];
  mockBoot(page, ["Сообщения"], { sendBodies, muteBodies });

  await page.goto("/");
  await page.locator('[data-persona="participant-ilya"]').click();
  await expect(page.getByRole("link", { name: "Сообщения" })).toBeVisible();
  await page.getByRole("link", { name: "Сообщения" }).click();

  const list = page.getByRole("complementary", { name: "Список диалогов" });
  await expect(list.locator(".msg-dialog-list__row")).toHaveCount(1);
  await expect(list).toContainText("Команда MVP трекинга");
  await expect(list.locator(".msg-dialog-list__unread")).toHaveText(/2/);

  const row = page.locator(".msg-dialog-list__row");
  await row.click();
  await expect(page.getByRole("region", { name: "Текущий чат", exact: true })).toBeVisible();
  await expect(page.getByText("Пришлите сравнение метрик до пятницы.")).toBeVisible();
  await expect(page.locator(".msg-chat__artifact-ref").first()).toContainText("repository");

  const composer = page.locator(".msg-composer");
  await expect(composer).toBeVisible();
  await composer.locator('[data-testid="composer-textarea"]').fill("Готово к демо");
  await composer.locator('[data-testid="composer-send"]').click();
  await expect
    .poll(() => sendBodies.length, { timeout: 5_000 })
    .toBe(1);
  expect(sendBodies[0]).toMatchObject({
    body: "Готово к демо",
    artifact_refs: [],
  });
  await expect(
    page.locator('[data-testid="composer-textarea"]'),
  ).toHaveValue("");

  await page
    .locator(".msg-chat__header-action--mute")
    .click();
  await expect.poll(() => muteBodies.length, { timeout: 5_000 }).toBe(1);
  expect(muteBodies[0]).toMatchObject({ muted: true });
});
