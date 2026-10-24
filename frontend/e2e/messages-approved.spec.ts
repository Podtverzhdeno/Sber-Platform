import { expect, test, type Page } from "@playwright/test";

/**
 * Visual review candidates generated from the actual React UI for comparison
 * with user-approved Impulse_Messages ZIP:
 *   02.png = empty state, 03.png = Elena, 01.png = Mayaki.
 * Deliberately not golden assertions until screenshots are owner-reviewed.
 * Screenshots go to test-results/ for the existing CI artifact uploader.
 */
const viewerId = "e39256e2-6f56-5c58-9e73-b7b0d1a4b902";

async function openApprovedPreview(page: Page): Promise<void> {
  await page.route("**/api/v1/**", (route) => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/v1/config", (route) =>
    route.fulfill({ json: { demo_mode: true, honor_board_enabled: false } }),
  );
  await page.route("**/api/v1/auth/personas", (route) =>
    route.fulfill({
      json: [{ key: "participant-alex", display_name: "Алекс Речной", roles: ["participant"] }],
    }),
  );
  await page.route("**/api/v1/me", (route) =>
    route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }),
  );
  await page.route("**/api/v1/auth/demo-login", (route) =>
    route.fulfill({
      json: {
        person_id: viewerId,
        display_name: "Алекс Речной",
        active_role: "participant",
        assigned_roles: ["participant"],
        scopes: [],
        consent_scopes: [],
        // The source screenshots include the full participant navigation.
        // These mocked items are UI-only; access to real APIs is not broadened.
        navigation: ["Главная", "Задачи", "Мои проекты", "Bootcamp", "Сообщения", "Команда", "База знаний", "Аналитика", "Настройки"],
        csrf_token: "csrf",
      },
    }),
  );
  await page.route("**/api/v1/me/messaging/channels", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/notifications", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/v1/demo-search", (route) => route.fulfill({ json: [] }));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  const menu = page.getByRole("button", { name: "Меню", exact: true });
  if (await menu.isVisible().catch(() => false)) await menu.click();
  // Navigating directly avoids a stale sidebar node during asynchronous demo-login
  // hydration; the separate navigation tests still exercise sidebar interactions.
  await page.goto("/workspace/4");
  if ((page.viewportSize()?.width ?? 1440) >= 960) {
    await expect(page.getByTestId("messenger-empty-state")).toBeVisible();
  } else {
    await expect(page.locator(".msg-dialog-list")).toBeVisible();
  }
  await expect(page.locator(".msg-dialog-list__row").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const screenshotCandidate = async (page: Page, file: string): Promise<void> => {
  await page.locator(".messenger-shell").screenshot({
    path: `test-results/${file}`,
    animations: "disabled",
  });
};

test.describe("user-approved messaging visual scenarios", () => {
  // Match the supplied 01.png / 02.png 1448×1086 references exactly.
  test.use({ viewport: { width: 1448, height: 1086 }, reducedMotion: "reduce" });

  test("02.png: empty chat + actions + placeholder context", async ({ page }) => {
    await openApprovedPreview(page);
    await expect(page.getByRole("heading", { name: "Выберите диалог или сообщество" })).toBeVisible();
    await expect(page.getByText("Здесь появится контекст диалога")).toBeVisible();
    await expect(page.getByRole("button", { name: /Перейти в Маяки/ })).toBeEnabled();
    await expect(page.locator(".messenger-shell")).toHaveAttribute("data-pane", "desktop");
    // Grounded reference geometry in 02.png at 1448×1086: 367px dialog list,
    // 341px context inspector, 65px shared top shell and 237px first row.
    const [dialogBox, inspectorBox, rowBox] = await Promise.all([
      page.locator(".msg-dialog-list").boundingBox(),
      page.getByTestId("messenger-empty-context").boundingBox(),
      page.locator(".msg-dialog-list__row").first().boundingBox(),
    ]);
    expect(dialogBox).not.toBeNull();
    expect(inspectorBox).not.toBeNull();
    expect(rowBox).not.toBeNull();
    if (dialogBox && inspectorBox && rowBox) {
      expect(Math.abs(dialogBox.width - 367)).toBeLessThanOrEqual(3);
      expect(Math.abs(inspectorBox.width - 341)).toBeLessThanOrEqual(3);
      expect(Math.abs(dialogBox.y - 65)).toBeLessThanOrEqual(8);
      expect(Math.abs(rowBox.y - 237)).toBeLessThanOrEqual(14);
      expect(rowBox.height).toBeLessThanOrEqual(74);
    }
    await screenshotCandidate(page, "messages-02-empty-approved.png");
    await page.screenshot({ path: "test-results/messages-02-full-page-1448x1086.png", animations: "disabled" });
  });

  test("03.png: direct messages + peer context + attachments", async ({ page }) => {
    await openApprovedPreview(page);
    await page.locator(".msg-dialog-list__row").filter({ hasText: "Елена Наставник" }).first().click();
    await expect(page.locator(".msg-chat__bubble")).toHaveCount(5);
    await expect(page.locator(".msg-context__description")).toBeVisible();
    await expect(page.locator(".ref-context-files li")).toHaveCount(3);
    await expect(page.locator(".ref-context-files")).toContainText("248 КБ · 20 окт, 09:28");
    await expect(page.locator(".ref-context-files .ref-context-file-badge").first()).toHaveText("xlsx");
    await expect(page.getByText(/сообщения здесь не сохраняются/)).toBeVisible();
    await page.setViewportSize({ width: 1672, height: 941 });
    await page.evaluate(() => document.fonts.ready);
    const [dialogBox, inspectorBox] = await Promise.all([
      page.locator(".msg-dialog-list").boundingBox(),
      page.locator(".msg-context").boundingBox(),
    ]);
    expect(dialogBox).not.toBeNull();
    expect(inspectorBox).not.toBeNull();
    if (dialogBox && inspectorBox) {
      expect(Math.abs(dialogBox.width - 395)).toBeLessThanOrEqual(4);
      expect(Math.abs(inspectorBox.width - 357)).toBeLessThanOrEqual(4);
    }
    await screenshotCandidate(page, "messages-03-elena-approved.png");
    await page.screenshot({ path: "test-results/messages-03-full-page-1672x941.png", animations: "disabled" });
  });

  test("01.png: Mayaki community posts + pinned + moderators", async ({ page }) => {
    const interceptedWrites: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/messaging/") && request.method() !== "GET") {
        interceptedWrites.push(request.url());
      }
    });
    await openApprovedPreview(page);
    await page.locator(".msg-dialog-list__row").filter({ hasText: "Маяки" }).first().click();
    await expect(page.getByText("Закреплённое сообщение")).toBeVisible();
    await expect(page.getByText("Администраторы и модераторы")).toBeVisible();
    await expect(page.locator(".msg-chat__reference-media")).toBeVisible();
    await expect(page.locator(".ref-context-files li")).toHaveCount(3);
    await expect(page.locator(".ref-context-files")).toContainText("2.4 МБ · 20 окт, 09:24");
    await expect(page.locator(".ref-context-files .ref-context-file-badge").first()).toHaveText("pdf");
    await expect(page.locator(".msg-composer__reference-row button")).toBeDisabled();
    await screenshotCandidate(page, "messages-01-mayaki-approved.png");
    await page.screenshot({ path: "test-results/messages-01-full-page-1448x1086.png", animations: "disabled" });
    expect(interceptedWrites).toHaveLength(0);
  });
});

test.describe("user-approved messaging mobile parity", () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

  test("single-pane list opens synthetic community safely", async ({ page }) => {
    await openApprovedPreview(page);
    await expect(page.locator(".msg-dialog-list")).toBeVisible();
    await page.locator(".msg-dialog-list__row").filter({ hasText: "Маяки" }).first().click();
    await expect(page.getByRole("region", { name: "Текущий чат", exact: true })).toBeVisible();
    await expect(page.locator(".msg-composer__reference-row button")).toBeDisabled();
    await screenshotCandidate(page, "messages-01-mayaki-mobile.png");
  });
});
