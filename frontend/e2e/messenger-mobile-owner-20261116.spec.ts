import { expect, test, type Page } from "@playwright/test";
import { referenceChannels, referenceMessagesByChannel } from "./messages-reference-fixtures";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Главная", "Задачи", "Проекты", "Курсы", "Сообщения", "Команда", "База знаний", "Аналитика", "Настройки"],
  csrf_token: "messenger-mobile-qa",
};

async function openMessages(page: Page) {
  let loggedIn = false;
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({
    json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }],
  }));
  await page.route("**/api/v1/me", (route) => loggedIn
    ? route.fulfill({ json: actor })
    : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => {
    loggedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/me/notifications", (route) => route.fulfill({ json: { items: [], unread: 0 } }));
  await page.route("**/api/v1/me/engagement/**", (route) => route.fulfill({ status: 404, json: { code: "NOT_AVAILABLE" } }));
  await page.route("**/api/v1/me/messaging/channels/*/read", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2) ?? "";
    const channel = referenceChannels.find((item) => item.id === id);
    return route.fulfill({ json: channel ? { ...channel, unread: 0 } : {} });
  });
  await page.route("**/api/v1/me/messaging/contacts", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/messaging/channels", (route) => route.fulfill({ json: referenceChannels }));
  await page.route("**/api/v1/me/messaging/channels/*/messages*", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2) ?? "";
    return route.fulfill({ json: referenceMessagesByChannel[id] ?? [] });
  });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/4");
  await expect(page.getByRole("complementary", { name: "Список диалогов" })).toBeVisible();
}

async function expectNoMessengerOverflow(page: Page) {
  const overflow = await page.locator(".messenger-page").evaluate((element) => ({
    horizontal: element.scrollWidth - element.clientWidth,
    vertical: element.getBoundingClientRect().bottom - window.innerHeight,
  }));
  expect(overflow.horizontal, "messenger must not scroll horizontally").toBeLessThanOrEqual(2);
  expect(overflow.vertical, "messenger must fit the visual viewport").toBeLessThanOrEqual(2);
}

for (const width of [320, 390, 768, 959]) {
  test(`mobile messenger: list, chat, context, back at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await openMessages(page);
    await expect(page.locator(".messenger-shell")).toHaveAttribute("data-pane", "list");
    await expectNoMessengerOverflow(page);
    const search = page.getByRole("searchbox", { name: "Поиск диалогов" });
    await search.fill("Елена");
    const dialog = page.locator(".msg-dialog-list__row").filter({ hasText: "Елена Наставник" }).first();
    await expect(dialog).toBeVisible();
    await dialog.click();
    await expect(page.locator(".messenger-shell")).toHaveAttribute("data-pane", "chat");
    await expect(page.getByRole("button", { name: "К списку диалогов" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Текст сообщения" })).toBeVisible();
    await expectNoMessengerOverflow(page);
    await page.getByRole("button", { name: "Информация о чате" }).click();
    await expect(page.locator(".messenger-shell")).toHaveAttribute("data-pane", "context");
    await expect(page.getByRole("complementary", { name: "Контекст диалога" })).toBeVisible();
    await page.locator(".msg-context__close").click();
    await expect(page.locator(".messenger-shell")).toHaveAttribute("data-pane", "chat");
    await page.getByRole("button", { name: "К списку диалогов" }).click();
    await expect(page.locator(".messenger-shell")).toHaveAttribute("data-pane", "list");
    await expect(search).toHaveValue("Елена");
    await expectNoMessengerOverflow(page);
  });
}

test("320px messenger respects short viewport and light theme", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 500 });
  await openMessages(page);
  await page.locator(".msg-dialog-list__row").first().click();
  await expect(page.getByRole("textbox", { name: "Текст сообщения" })).toBeVisible();
  await expectNoMessengerOverflow(page);
  await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
  const surface = await page.locator(".messenger-shell").evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(surface).toBe("rgb(247, 249, 250)");
  await expectNoMessengerOverflow(page);
});

test("1024px keeps the split layout without a mobile Back action", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await openMessages(page);
  await page.locator(".msg-dialog-list__row").first().click();
  await expect(page.getByRole("region", { name: "Текущий чат", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "К списку диалогов" })).toHaveCount(0);
  await expectNoMessengerOverflow(page);
});
