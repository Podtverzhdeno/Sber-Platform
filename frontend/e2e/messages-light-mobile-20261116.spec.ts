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
  csrf_token: "messages-theme-mobile",
};

async function openMessages(page: Page, choice: "light" | "dark") {
  await page.addInitScript((theme) => { localStorage.setItem("impulse-theme", theme); }, choice);
  let signedIn = false;
  await page.route("**/api/v1/config", route => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({
    json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }],
  }));
  await page.route("**/api/v1/me", route => signedIn
    ? route.fulfill({ json: actor })
    : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => {
    signedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/me/notifications", route =>
    route.fulfill({ json: { items: [], unread: 0 } }));
  await page.route("**/api/v1/me/messaging/contacts", route =>
    route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/messaging/channels", route =>
    route.fulfill({ json: referenceChannels }));
  await page.route("**/api/v1/me/messaging/channels/*/messages*", route => {
    const segments = new URL(route.request().url()).pathname.split("/");
    const channelId = segments.at(-2) ?? "";
    return route.fulfill({ json: referenceMessagesByChannel[channelId] ?? [] });
  });
  await page.route("**/api/v1/me/messaging/channels/*/read", route => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2);
    const channel = referenceChannels.find(item => item.id === id);
    return route.fulfill({ json: { ...channel, unread: 0 } });
  });
  await page.route("**/api/v1/me/engagement/**", route => route.fulfill({ status: 404, json: { code: "RESOURCE_NOT_FOUND" } }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/4", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".sberchat-reference .msg-dialog-list")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", choice);
}

test("light Messages has white surfaces and legible text at 390 and 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMessages(page, "light");
  const dialogPane = page.locator(".sberchat-reference .msg-dialog-list");
  await expect(dialogPane).toHaveCSS("background-color", "rgb(255, 255, 255)");
  const dialogTitle = page.locator(".msg-dialog-list__row-title strong").first();
  await expect(dialogTitle).toHaveCSS("color", "rgb(23, 40, 59)");
  await page.locator(".msg-dialog-list__row").first().click();
  await expect(page.locator(".chat-thread")).toBeVisible();
  await expect(page.locator(".msg-composer__input-shell")).toHaveCSS("background-color", "rgb(246, 248, 252)");
  await expect(page.locator(".msg-chat__bubble-body").first()).toHaveCSS("color", "rgb(23, 40, 59)");
  await page.getByRole("button", { name: "Информация о чате" }).click();
  await expect(page.getByRole("complementary", { name: "Контекст диалога" })).toBeVisible();

  await page.setViewportSize({ width: 320, height: 740 });
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  )).toBeLessThanOrEqual(1);
  await expect(page.getByRole("complementary", { name: "Контекст диалога" })).toBeVisible();
  await page.getByRole("button", { name: "К чату" }).click();
  await expect(page.locator(".chat-thread")).toBeVisible();
  await page.getByRole("button", { name: /К списку диалогов/ }).click();
  await expect(dialogPane).toBeVisible();
});

test("dark Messages preserves separate dark surfaces at mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMessages(page, "dark");
  const dialogPane = page.locator(".sberchat-reference .msg-dialog-list");
  const background = await dialogPane.evaluate(element => getComputedStyle(element).backgroundColor);
  expect(background).not.toBe("rgb(255, 255, 255)");
  await page.locator(".msg-dialog-list__row").first().click();
  await expect(page.locator(".msg-composer__textarea")).toBeVisible();
});
