import { expect, test, type Page } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Главная", "События", "Сообщения"],
  csrf_token: "events-light-qa",
};
const items = [{
  key: "mayaki-demo", title: "МАЯКИ: демо",
  event_type: "Образовательная программа", organizer: "Сбер · демо",
  conditions: "Публичные условия", source_url: "https://example.test/mayaki",
  deadline_at: "2026-12-10T12:00:00Z", status: "open",
  track_keys: ["python", "product"], recommendation_reason: "Подходит для развития",
  source_checked_at: "2026-11-15T12:00:00Z", source_status: "current",
}];
async function openEvents(page: Page, theme: "light" | "dark") {
  await page.addInitScript((mode: string) => {
    localStorage.setItem("impulse-theme", mode);
    localStorage.setItem("impulse-visual-mode", mode === "light" ? "light" : "midnight");
  }, theme);
  let loggedIn = false;
  await page.route("**/api/v1/**", route => route.fulfill({ status: 404, json: { code: "UNMOCKED" } }));
  await page.route("**/api/v1/config", route => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({
    json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }],
  }));
  await page.route("**/api/v1/me", route => loggedIn
    ? route.fulfill({ json: actor })
    : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => {
    loggedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/ecosystem/events", route =>
    route.fulfill({ json: { items, next_cursor: null, has_more: false } }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("events-v2")).toBeVisible();
  await expect(page.getByTestId("event-reference-card")).toHaveCount(1);
}
const components = [
  [".ev-metrics", "metrics surface"],
  [".ev-result-tabs button", "category tab"],
  [".ev-compact-search", "search surface"],
  [".ev-compact-trigger", "filter trigger"],
  [".ev-event-card--compact", "event card"],
] as const;
function lightness(value: string) {
  const rgb = value.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!rgb) return 0;
  return (0.2126 * Number(rgb[1]) + 0.7152 * Number(rgb[2]) + 0.0722 * Number(rgb[3])) / 255;
}
function contrast(foreground: string, background: string) {
  const parse = (value: string) => {
    const m = value.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (!m) return [0, 0, 0];
    return m.slice(1, 4).map(n => {
      const v = Number(n) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
  };
  const lum = (v: number[]) => v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722;
  const [fg, bg] = [lum(parse(foreground)), lum(parse(background))];
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}
for (const width of [320, 390, 768, 1440]) {
  test("light events surfaces and controls at " + String(width) + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: width < 500 ? 760 : 900 });
    await openEvents(page, "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    for (const [selector, label] of components) {
      const color = await page.locator(".participant-events--apple " + selector).first().evaluate(el => getComputedStyle(el).backgroundColor);
      expect(lightness(color), label + " should not have a dark background: " + color).toBeGreaterThan(0.8);
    }
    const card = page.getByTestId("event-reference-card").first();
    for (const selector of [".ev-event-main h3", ".ev-event-meta", ".ev-match-title"]) {
      const colors = await card.locator(selector).first().evaluate(el => ({
        fg: getComputedStyle(el).color,
        bg: getComputedStyle(el.closest(".ev-event-card")!).backgroundColor,
      }));
      expect(contrast(colors.fg, colors.bg), selector + " must remain readable").toBeGreaterThanOrEqual(4.5);
    }
    const metrics = page.locator(".ev-metrics");
    for (const selector of ["b", "small", ".ev-average-ring strong"]) {
      const colors = await metrics.locator(selector).first().evaluate(el => ({
        fg: getComputedStyle(el).color,
        bg: getComputedStyle(el.closest(".ev-metrics")!).backgroundColor,
      }));
      expect(contrast(colors.fg, colors.bg), "metrics " + selector + " must be readable").toBeGreaterThanOrEqual(4.5);
    }
    await page.getByRole("button", { name: /Фильтры/ }).click();
    const popover = page.getByRole("region", { name: "Фильтры событий" });
    await expect(popover).toBeVisible();
    const popupBg = await popover.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(lightness(popupBg)).toBeGreaterThan(0.8);
    await page.getByRole("button", { name: "Закрыть фильтры" }).click();
    await page.getByRole("searchbox", { name: "Поиск событий" }).fill("несуществующее");
    await expect(page.getByText("События не найдены")).toBeVisible();
    await page.getByRole("searchbox", { name: "Поиск событий" }).clear();
    await expect(card).toBeVisible();
    if (width < 500) {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, "no horizontal document overflow").toBeLessThanOrEqual(2);
    }
  });
}
test("night palette remains dark and independently scoped", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 });
  await openEvents(page, "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const color = await page.locator(".ev-metrics").evaluate(el => getComputedStyle(el).backgroundColor);
  expect(lightness(color)).toBeLessThan(0.22);
});
