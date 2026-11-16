import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type Mode = "light" | "blue" | "midnight";
const allSections = ["Главная", "События", "Сообщения"];
const exampleEvent = {
  key: "community-ui-event", title: "Продуктовый хакатон",
  event_type: "Хакатон", organizer: "Сбер",
  conditions: "Работа в командах", source_url: "https://example.test/event",
  deadline_at: null, starts_at: null, status: "open",
  track_keys: ["python", "product"],
  recommendation_reason: "Соответствует траектории",
  source_checked_at: "2026-10-20T08:00:00Z", source_status: "current",
};

async function login(
  page: Page, mode: Mode, navigation: string[] = allSections,
): Promise<void> {
  await page.addInitScript((visualMode: Mode) => {
    localStorage.setItem("impulse-visual-mode", visualMode);
    localStorage.setItem("impulse-theme", visualMode === "light" ? "light" : "dark");
  }, mode);
  const actor = {
    person_id: "00000000-0000-4000-8000-000000000002",
    display_name: "Участник тестирования",
    active_role: "participant",
    assigned_roles: ["participant"],
    navigation, scopes: [], consent_scopes: [],
    csrf_token: "community-discovery-qa",
  };
  let loggedIn = false;
  await page.route("**/api/v1/**", route =>
    route.fulfill({ status: 404, json: { code: "NOT_MOCKED" } }));
  await page.route("**/api/v1/config", route =>
    route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", route =>
    route.fulfill({ json: [{
      key: "community-tester", display_name: actor.display_name, roles: ["participant"],
    }] }));
  await page.route("**/api/v1/me", route => loggedIn
    ? route.fulfill({ json: actor })
    : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => {
    loggedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/ecosystem/events", route =>
    route.fulfill({ json: { items: [exampleEvent], next_cursor: null, has_more: false } }));
  await page.route("**/api/v1/me/messaging/channels", route =>
    route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/messaging/contacts", route =>
    route.fulfill({ json: [] }));
  await page.goto("/");
  await page.locator('[data-persona="community-tester"]').click();
}

async function noOverflow(page: Page): Promise<void> {
  const horizontal = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontal, "No document-level horizontal scrolling").toBeLessThanOrEqual(2);
}

for (const mode of ["light", "blue", "midnight"] as const) {
  for (const width of [320, 390, 560, 820, 1440]) {
    test(`Community category discovery works at ${String(width)}px in ${mode}`, async ({ page }) => {
      test.slow();
      await page.setViewportSize({ width, height: 900 });
      await login(page, mode);
      await page.goto("/workspace/1");

      const destinations = page.getByRole("navigation", { name: "Подразделы сообщества" });
      await expect(destinations.getByRole("link")).toHaveCount(2);
      const eventsLink = destinations.getByRole("link", { name: "События" });
      await expect(eventsLink).toHaveAttribute("aria-current", "page");
      await expect(eventsLink).toHaveAttribute("href", "/workspace/1");
      const messagesLink = destinations.getByRole("link", { name: "Сообщения" });
      await expect(messagesLink).toHaveAttribute("href", "/workspace/2");

      for (const link of [eventsLink, messagesLink]) {
        const rect = await link.boundingBox();
        expect(rect).not.toBeNull();
        expect(rect?.height, ">=44px accessible target").toBeGreaterThanOrEqual(44);
        expect(rect?.x ?? -1).toBeGreaterThanOrEqual(0);
        expect((rect?.x ?? 0) + (rect?.width ?? 0)).toBeLessThanOrEqual(width + 2);
        expect(await link.locator("svg").getAttribute("aria-hidden")).toBe("true");
      }

      const categories = page.getByRole("navigation", { name: "Категории событий" });
      const buttons = categories.getByRole("button");
      await expect(buttons).toHaveCount(4);
      const geom = await categories.evaluate((node) => ({
        client: node.clientWidth, scroll: node.scrollWidth,
      }));
      expect(geom.scroll, "All event categories must be visible without a scroll rail")
        .toBeLessThanOrEqual(geom.client + 2);

      for (const button of await buttons.all()) {
        const rect = await button.boundingBox();
        expect(rect).not.toBeNull();
        expect(rect?.height).toBeGreaterThanOrEqual(44);
        expect(rect?.x ?? -1).toBeGreaterThanOrEqual(0);
        expect((rect?.x ?? 0) + (rect?.width ?? 0)).toBeLessThanOrEqual(width + 2);
      }
      if (width <= 650) {
        const a = await buttons.nth(0).boundingBox();
        const b = await buttons.nth(1).boundingBox();
        const c = await buttons.nth(2).boundingBox();
        expect(Math.abs((a?.y ?? 0) - (b?.y ?? 0))).toBeLessThanOrEqual(2);
        expect(c?.y ?? 0).toBeGreaterThan((a?.y ?? 0) + 43);
      }

      const search = page.getByRole("searchbox", { name: "Поиск событий" });
      await expect(search).toBeVisible();
      const searchWrapper = await page.locator(".ev-compact-search").boundingBox();
      expect(searchWrapper?.height).toBeGreaterThanOrEqual(44);

      const filter = page.locator(".ev-compact-trigger");
      await expect(filter).toHaveAttribute("aria-expanded", "false");
      await filter.click();
      await expect(filter).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator(".ev-v3-popover")).toBeVisible();
      const popover = await page.locator(".ev-v3-popover").boundingBox();
      expect(popover?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect((popover?.x ?? 0) + (popover?.width ?? 0)).toBeLessThanOrEqual(width + 2);
      await page.keyboard.press("Escape");
      await expect(filter).toHaveAttribute("aria-expanded", "false");

      await categories.getByRole("button", { name: "От Сбера" }).click();
      await expect(categories.getByRole("button", { name: "От Сбера" }))
        .toHaveAttribute("aria-pressed", "true");
      await categories.getByRole("button", { name: /Для вас/ }).click();
      await expect(categories.getByRole("button", { name: /Для вас/ }))
        .toHaveAttribute("aria-pressed", "true");
      await search.fill("нет такого мероприятия");
      await expect(page.getByRole("heading", { name: "События не найдены" })).toBeVisible();
      await search.clear();
      await expect(page.getByTestId("event-reference-card")).toHaveCount(1);
      await noOverflow(page);

      if ((width === 320 || width === 1440) && (mode === "light" || mode === "midnight")) {
        await page.screenshot({
          path: `test-results/community-apple-${mode}-${String(width)}.png`,
          animations: "disabled",
        });
      }
    });
  }
}

for (const width of [320, 390, 820]) {
  test(`Community Events to Messages and Back preserves authorized routes at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await login(page, "light");
    await page.goto("/workspace/1");
    const nav = page.getByRole("navigation", { name: "Подразделы сообщества" });
    await nav.getByRole("link", { name: "Сообщения" }).click();
    await expect(page).toHaveURL(/\/workspace\/2$/);
    const compact = page.getByTestId("community-navigation");
    await expect(compact).toHaveClass(/community-navigation--compact/);
    const links = compact.getByRole("navigation", { name: "Подразделы сообщества" });
    await expect(links.getByRole("link", { name: "Сообщения" })).toHaveAttribute("aria-current", "page");
    await expect(links.getByRole("link", { name: "События" })).toHaveAttribute("href", "/workspace/1");
    await links.getByRole("link", { name: "События" }).click();
    await expect(page).toHaveURL(/\/workspace\/1$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/workspace\/2$/);
    await expect(page.getByRole("navigation", { name: "Подразделы сообщества" })
      .getByRole("link", { name: "Сообщения" })).toHaveAttribute("aria-current", "page");
    await noOverflow(page);
  });
}

test("denied Messages link is never inferred from a numeric route", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await login(page, "light", ["Главная", "События"]);
  await page.goto("/workspace/1");
  const nav = page.getByRole("navigation", { name: "Подразделы сообщества" });
  await expect(nav.getByRole("link")).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "События" })).toHaveAttribute("href", "/workspace/1");
  await expect(nav.getByRole("link", { name: "Сообщения" })).toHaveCount(0);
});

test("Community navigation has no critical axe violations", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "light");
  await page.goto("/workspace/1");
  await expect(page.getByTestId("community-navigation")).toBeVisible();
  const report = await new AxeBuilder({ page }).include(".community-navigation").analyze();
  expect(report.violations).toEqual([]);
});
