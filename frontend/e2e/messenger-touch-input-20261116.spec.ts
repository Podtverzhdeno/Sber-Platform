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
  csrf_token: "touch-keyboard-regression",
};

type SentMessage = { body: string; artifact_refs: string[] };

async function openMessageComposer(page: Page): Promise<SentMessage[]> {
  // Test the composer, not the demo login flow: begin with authorized session fixture.
  let signedIn = true;
  const sent: SentMessage[] = [];
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({
    json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }],
  }));
  await page.route("**/api/v1/me", (route) => signedIn
    ? route.fulfill({ json: actor })
    : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => {
    signedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/me/notifications", (route) => route.fulfill({ json: { items: [], unread: 0 } }));
  await page.route("**/api/v1/me/engagement/**", (route) => route.fulfill({ status: 404, json: { code: "NOT_AVAILABLE" } }));
  await page.route("**/api/v1/me/messaging/contacts", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/messaging/channels", (route) => route.fulfill({ json: referenceChannels }));
  await page.route("**/api/v1/me/messaging/channels/*/read", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2) ?? "";
    const channel = referenceChannels.find((item) => item.id === id);
    return route.fulfill({ json: channel ? { ...channel, unread: 0 } : {} });
  });
  await page.route("**/api/v1/me/messaging/channels/*/messages*", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2) ?? "";
    if (route.request().method() === "POST") {
      const request = route.request().postDataJSON() as SentMessage;
      sent.push(request);
      return route.fulfill({ json: {
        id: "00000000-0000-4000-8000-000000099999",
        author_id: actor.person_id,
        author_name: actor.display_name,
        kind: "text",
        body: request.body,
        artifact_refs: request.artifact_refs,
        sequence: 99,
        created_at: "2026-11-16T08:00:00Z",
      } });
    }
    return route.fulfill({ json: referenceMessagesByChannel[id] ?? [] });
  });

  await page.goto("/workspace/4", { waitUntil: "domcontentloaded" });
  // Vite's cold transform can exceed 30s under concurrent frontend builds on Windows.
  await expect(page.locator(".msg-dialog-list__row").first()).toBeVisible({ timeout: 45_000 });
  await page.locator(".msg-dialog-list__row").first().click();
  await expect(page.getByRole("textbox", { name: "Текст сообщения" })).toBeVisible();
  return sent;
}

test.describe("touch messenger keyboard", () => {
  test.describe.configure({ timeout: 90_000 });
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });

  test("touch Enter inserts newline; send button submits once", async ({ page }) => {
    const sent = await openMessageComposer(page);
    expect(await page.evaluate(() => window.matchMedia("(pointer: coarse)").matches)).toBe(true);
    const textarea = page.getByRole("textbox", { name: "Текст сообщения" });
    await expect(textarea).toHaveAttribute("enterkeyhint", "enter");
    await textarea.fill("Сообщение с телефона");
    await textarea.press("Enter");
    await expect(textarea).toHaveValue("Сообщение с телефона\n");
    expect(sent).toHaveLength(0);
    await page.getByRole("button", { name: "Отправить", exact: true }).click();
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]).toEqual({ body: "Сообщение с телефона", artifact_refs: [] });
  });

  test("at 320px Control+Enter sends deliberately without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const sent = await openMessageComposer(page);
    const textarea = page.getByRole("textbox", { name: "Текст сообщения" });
    await textarea.fill("Действие с клавиатуры");
    await textarea.press("Control+Enter");
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]?.body).toBe("Действие с клавиатуры");
    const geometry = await page.locator(".messenger-page").evaluate((el) => ({
      horizontal: el.scrollWidth - el.clientWidth,
      composerBottom: el.querySelector(".msg-composer")?.getBoundingClientRect().bottom,
      viewportBottom: window.innerHeight,
    }));
    expect(geometry.horizontal).toBeLessThanOrEqual(2);
    expect(geometry.composerBottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(geometry.viewportBottom + 2);
  });
});

test.describe("desktop messenger keyboard", () => {
  test.use({ hasTouch: false, isMobile: false, viewport: { width: 1280, height: 850 } });

  test("desktop Enter still sends", async ({ page }) => {
    const sent = await openMessageComposer(page);
    expect(await page.evaluate(() => window.matchMedia("(pointer: coarse)").matches)).toBe(false);
    const textarea = page.getByRole("textbox", { name: "Текст сообщения" });
    await textarea.fill("Текст с компьютера");
    await textarea.press("Enter");
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]?.body).toBe("Текст с компьютера");
  });
});
