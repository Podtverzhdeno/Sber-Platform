import { expect, test, type Page } from "@playwright/test";

const channelId = "b6a24e2f-8a0e-4a41-9cea-5f5a2e39a10d";
const viewerId = "e39256e2-6f56-5c58-9e73-b7b0d1a4b902";

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
    { id: "5f2b0a8e-32c2-4f9f-9d1f-8d0c37a24e10", display_name: "Елена Наставник", role: "mentor" },
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
    body: "Проверьте сборку и напомните о дедлайне. Хочу успеть до пятницы.",
    artifact_refs: [],
    sequence: 2,
    created_at: "2026-10-16T12:30:00+00:00",
  },
  {
    id: "msg-2",
    author_id: viewerId,
    author_name: "Илья Речной",
    kind: "text",
    body: "Принял, соберу подробность по тестам сегодня.",
    artifact_refs: [],
    sequence: 3,
    created_at: "2026-10-16T12:31:00+00:00",
  },
  {
    ...channel.last_message,
  },
];



test.skip(process.platform !== "linux", "visual baselines ship for linux (CI parity)");

const messageRoutes = (page: Page): void => {
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
        navigation: ["Сообщения"],
        csrf_token: "csrf",
      },
    }),
  );
  void page.route("**/api/v1/me/messaging/channels", (route) =>
    route.fulfill({ json: [channel] }),
  );
  void page.route(`**/api/v1/me/messaging/channels/${channelId}/messages*`, (route) =>
    route.fulfill({ json: messages }),
  );
  void page.route(`**/api/v1/me/messaging/channels/${channelId}/read`, (route) =>
    route.fulfill({ json: { ...channel, unread: 0 } }),
  );
};

async function openNav(page: Page): Promise<void> {
  const menu = page.getByRole("button", { name: "Меню", exact: true });
  if (await menu.isVisible().catch(() => false)) {
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
  }
  await expect(page.getByRole("link", { name: "Сообщения" })).toBeVisible();
  await page.getByRole("link", { name: "Сообщения" }).click();
}

async function openMessenger(page: Page, selectChat = false): Promise<void> {
  await page.goto("/");
  await page.locator('[data-persona="participant-ilya"]').click();
  await expect(page.getByRole("link", { name: "Сообщения" })).toBeVisible();
  await openNav(page);
  await expect(page.locator(".messenger-shell")).toBeVisible();
  await expect(page.locator(".msg-dialog-list__row").first()).toBeVisible();
  if (selectChat) {
    await page.locator(".msg-dialog-list__row").first().click();
    await expect(page.getByRole("region", { name: "Текущий чат", exact: true })).toBeVisible();
  }
  await page.evaluate(() => document.fonts.ready);
}

test.describe("R-MSG-01 reference geometry and bubble density", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });

  test("maintains the three-pane reference composition without inflated message bubbles", async ({ page }) => {
    messageRoutes(page);
    await openMessenger(page, true);

    const shell = page.locator(".messenger-shell");
    const dialogList = page.locator(".msg-dialog-list");
    const chat = page.locator(".chat-thread");
    const context = page.locator(".msg-context");

    await expect(dialogList.getByRole("heading", { name: "Сообщения" })).toBeVisible();
    await expect(dialogList.getByRole("button", { name: "Создать диалог" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Упомянуть участника" })).toBeVisible();
    await expect(context.locator(".msg-context__profile")).toBeVisible();

    const [layoutBox, listBox, chatBox, contextBox, bubbleBox] = await Promise.all([
      shell.boundingBox(),
      dialogList.boundingBox(),
      chat.boundingBox(),
      context.boundingBox(),
      page.locator(".msg-chat__bubble").first().boundingBox(),
    ]);
    expect(layoutBox).not.toBeNull();
    expect(listBox).not.toBeNull();
    expect(chatBox).not.toBeNull();
    expect(contextBox).not.toBeNull();
    expect(bubbleBox).not.toBeNull();
    if (!layoutBox || !listBox || !chatBox || !contextBox || !bubbleBox) return;

    expect(listBox.width / layoutBox.width).toBeGreaterThan(0.22);
    expect(listBox.width / layoutBox.width).toBeLessThan(0.33);
    expect(contextBox.width / layoutBox.width).toBeGreaterThan(0.17);
    expect(contextBox.width / layoutBox.width).toBeLessThan(0.28);
    expect(Math.abs(listBox.y - chatBox.y)).toBeLessThan(3);
    expect(Math.abs(listBox.y - contextBox.y)).toBeLessThan(3);
    expect(bubbleBox.height).toBeLessThan(110);
  });
});

test.describe("R-MSG-01 visual baselines light/dark 1440x900", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });

  test("desktop light", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("impulse-theme", "light");
    });
    messageRoutes(page);
    await openMessenger(page, true);
    await expect(page.locator(".messenger-shell")).toHaveScreenshot(
      "messenger-desktop-light-1440x900.png",
    );
  });

  test("desktop dark", async ({ page }) => {
    messageRoutes(page);
    await openMessenger(page, true);
    await expect(page.locator(".messenger-shell")).toHaveScreenshot(
      "messenger-desktop-dark-1440x900.png",
    );
  });
});

test.describe("R-MSG-01 list/chat states 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

  test("mobile list light", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("impulse-theme", "light");
    });
    messageRoutes(page);
    await openMessenger(page);
    await expect(page.locator(".messenger-shell")).toHaveScreenshot(
      "messenger-mobile-list-light-390x844.png",
    );
  });

  test("mobile list dark", async ({ page }) => {
    messageRoutes(page);
    await openMessenger(page);
    await expect(page.locator(".messenger-shell")).toHaveScreenshot(
      "messenger-mobile-list-dark-390x844.png",
    );
  });

  test("mobile chat light", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("impulse-theme", "light");
    });
    messageRoutes(page);
    await openMessenger(page);
    await page.locator(".msg-dialog-list__row").click();
    await expect(page.getByRole("region", { name: "Текущий чат", exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".messenger-shell")).toHaveScreenshot(
      "messenger-mobile-chat-light-390x844.png",
    );
  });

  test("mobile chat dark", async ({ page }) => {
    messageRoutes(page);
    await openMessenger(page);
    await page.locator(".msg-dialog-list__row").click();
    await expect(page.getByRole("region", { name: "Текущий чат", exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".messenger-shell")).toHaveScreenshot(
      "messenger-mobile-chat-dark-390x844.png",
    );
  });
});
