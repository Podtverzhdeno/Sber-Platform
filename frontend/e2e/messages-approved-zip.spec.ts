import { expect, test, type Page } from "@playwright/test";

/** Structural acceptance for the three supplied Impulse Messages PNGs.
 * 01.png = community, 02.png = empty, 03.png = personal chat.
 * This intentionally avoids duplicating the existing screenshot baselines:
 * the reference images must still receive a human visual comparison.
 */
test.skip(process.platform !== "linux", "browser CI for the reference contract runs on Linux");

function stubPreviewRoutes(page: Page): void {
  void page.route("**/api/v1/**", (route) => route.fulfill({ status: 404, json: {} }));
  void page.route("**/api/v1/config", (route) =>
    route.fulfill({ json: { demo_mode: true } }),
  );
  void page.route("**/api/v1/auth/personas", (route) =>
    route.fulfill({
      json: [{ key: "participant-ilya", display_name: "Илья Речной", roles: ["participant"] }],
    }),
  );
  void page.route("**/api/v1/me", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  void page.route("**/api/v1/demo-search", (route) =>
    route.fulfill({ json: [] }),
  );
  void page.route("**/api/v1/me/notifications", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  void page.route("**/api/v1/me/notifications/read-all", (route) =>
    route.fulfill({ json: {} }),
  );
  void page.route("**/api/v1/auth/demo-login", (route) =>
    route.fulfill({
      json: {
        person_id: "e39256e2-6f56-5c58-9e73-b7b0d1a4b902",
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
    route.fulfill({ json: [] }),
  );
}

async function openPreview(page: Page): Promise<void> {
  await page.addInitScript(() => {
    sessionStorage.removeItem("impulse.messenger.selected-channel");
    localStorage.removeItem("impulse.messenger.dialog-prefs");
  });
  stubPreviewRoutes(page);
  await page.goto("/");
  await page.locator('[data-persona="participant-ilya"]').click();
  const menu = page.getByRole("button", { name: "Меню", exact: true });
  if (await menu.isVisible().catch(() => false)) {
    await menu.click();
  }
  await page.getByRole("link", { name: "Сообщения" }).click();
  await expect(page.locator('[data-visual-reference="R-MSG-01"]')).toBeVisible();
  await expect(page.locator(".msg-dialog-list__row").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test.describe("approved Impulse Messages 01/02/03 desktop state contract", () => {
  test.use({ viewport: { width: 1448, height: 1086 }, reducedMotion: "reduce" });

  test("02.png: no selection, semantic quick actions, four context placeholders", async ({ page }) => {
    await openPreview(page);
    await expect(page.getByTestId("messenger-empty-state")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Выберите диалог или сообщество" })).toBeVisible();
    const aside = page.getByTestId("messenger-empty-context");
    await expect(aside).toBeVisible();
    await expect(aside.locator(".ref-empty-context__skeleton")).toHaveCount(4);
    await expect(page.getByRole("button", { name: /Открыть последний чат/ })).toBeEnabled();
    await expect(page.getByRole("button", { name: /Перейти в Маяки/ })).toBeEnabled();
    await expect(page.getByRole("button", { name: /Создать новый чат/ })).toBeVisible();

    const firstNine = await page.locator(".msg-dialog-list__row-title strong").allTextContents();
    expect(firstNine.slice(0, 9)).toEqual([
      "Елена Наставник", "Роман Заказчик", "Прототип рекомендателя",
      "Маяки", "AI in Dev Community", "СберКот", "Злата Вандервельд",
      "Грантовый конкурс", "Школа 21",
    ]);

    const list = await page.locator(".msg-dialog-list").boundingBox();
    const context = await aside.boundingBox();
    expect(list).not.toBeNull();
    expect(context).not.toBeNull();
    if (list && context) {
      expect(Math.abs(list.width - 370)).toBeLessThanOrEqual(16);
      expect(Math.abs(context.width - 390)).toBeLessThanOrEqual(16);
    }
  });

  test("01.png: Mayaki is first, has original lighthouse avatar and community context", async ({ page }) => {
    await openPreview(page);
    await page.getByRole("button", { name: /Перейти в Маяки/ }).click();
    await expect(page.getByRole("region", { name: "Текущий чат", exact: true })).toBeVisible();
    await expect(page.locator(".msg-chat__header")).toContainText("Маяки");
    await expect(page.locator(".msg-chat__avatar")).toHaveAttribute("data-reference-tone", "blue");
    await expect(page.locator(".msg-chat__pinned--approved")).toBeVisible();
    await expect(page.locator(".ref-context-community")).toBeVisible();
    await expect(page.locator(".ref-context-resources")).toBeVisible();

    const titles = await page.locator(".msg-dialog-list__row-title strong").allTextContents();
    expect(titles.slice(0, 6)).toEqual([
      "Маяки", "Грантовый конкурс", "Школа 21", "Елена Наставник",
      "Роман Заказчик", "Прототип рекомендателя",
    ]);
    const firstAvatar = page.locator(".msg-dialog-list__row").first().locator(".msg-dialog-list__avatar");
    await expect(firstAvatar).toHaveText("🗼");
    await expect(firstAvatar).toHaveAttribute("data-reference-tone", "blue");
  });

  test("03.png: Elena personal chat switches inspector and shows approved file list", async ({ page }) => {
    await openPreview(page);
    const elena = page.locator(".msg-dialog-list__row", { hasText: "Елена Наставник" }).first();
    await elena.click();
    await expect(page.locator(".msg-chat__header")).toContainText("Елена Наставник");
    await expect(page.locator(".msg-context__about-heading")).toHaveText("О чате");
    await expect(page.locator(".ref-context-files")).toContainText("Метрики_эксперимента.xlsx");
    await expect(page.locator(".ref-context-files")).toContainText("Итоговая_методология.pdf");
    await expect(page.locator(".msg-chat__avatar")).toHaveText("E");
  });
});

test.describe("approved Impulse Messages mobile one-pane flow", () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

  test("list opens a single chat pane without horizontal page scrolling", async ({ page }) => {
    await openPreview(page);
    await expect(page.locator(".messenger-shell")).toHaveAttribute("data-pane", "list");
    await page.locator(".msg-dialog-list__row", { hasText: "Маяки" }).first().click();
    await expect(page.locator(".messenger-shell")).toHaveAttribute("data-pane", "chat");
    await expect(page.locator(".msg-chat__header")).toContainText("Маяки");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
