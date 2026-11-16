import { expect, test, type Page } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Главная", "События", "Сообщения"],
  csrf_token: "events-detail-qa",
};
const event = {
  key: "ai-journey",
  title: "AI Journey — учебное событие",
  event_type: "Хакатон",
  organizer: "Сбер",
  conditions: "Командная работа",
  source_url: "https://example.test/ai-journey",
  deadline_at: "2026-12-20T12:00:00Z",
  status: "open",
  track_keys: ["python", "product"],
  recommendation_reason: "Соответствует траектории",
  source_checked_at: "2026-11-15T12:00:00Z",
  source_status: "current",
};

async function openDetail(page: Page, mode: "light" | "dark") {
  await page.addInitScript((theme: string) => {
    localStorage.setItem("impulse-theme", theme);
    localStorage.setItem("impulse-visual-mode", theme === "light" ? "light" : "midnight");
  }, mode);
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
    route.fulfill({ json: { items: [event], next_cursor: null, has_more: false } }));
  await page.route("**/api/v1/ecosystem/events/ai-journey", route => route.fulfill({ json: {
    ...event,
    description: "Создайте работающий прототип вместе с экспертами",
    program: [{ day: "День 1", title: "Прототип", detail: "Собрать решение" }],
    prerequisites: ["Python"],
    venue_format: "Офлайн",
    expected_result: "Рабочий прототип",
  } }));
  await page.route("**/api/v1/ecosystem/events/ai-journey/registration", route => route.fulfill({ json: {
    event_key: event.key, confirmed_registrations: 7, participations: 3,
    counter_state: "ok", definition_text: "Подтверждённые регистрации",
  } }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("events-v2")).toBeVisible();
  await page.getByRole("button", { name: "Подробнее" }).first().click();
  const hero = page.locator(".participant-events--apple .ev-detail-modal .ev-detail-hero");
  await expect(hero).toBeVisible();
  return hero;
}

function luminance(cssColor: string) {
  const numbers = cssColor.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!numbers) throw new Error("Unrecognized computed color: " + cssColor);
  const linear = numbers.slice(1, 4).map(value => {
    const v = Number(value) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
for (const width of [320, 390, 1440]) {
  test("light event detail hero has light backdrop and readable content at " + String(width) + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: width < 500 ? 760 : 900 });
    const hero = await openDetail(page, "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const computed = await hero.evaluate(el => ({
      bg: getComputedStyle(el).backgroundColor,
      overlay: getComputedStyle(el, "::before").backgroundImage,
    }));
    expect(luminance(computed.bg), "hero surface must be light").toBeGreaterThan(0.8);
    expect(computed.overlay).toMatch(/rgba?\(245,\s*249,\s*253/);
    const banner = hero.locator("img.ev-detail-banner");
    await expect(banner).toBeAttached();
    await expect(banner).toHaveAttribute("src", /\/events\/banners\/.*\.avif/);
    for (const selector of ["h2", "p", ".ev-detail-hero-meta", ".ev-demo-stamp"]) {
      const ink = await hero.locator(selector).first().evaluate(el => getComputedStyle(el).color);
      const a = luminance(ink), b = luminance(computed.bg);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      expect(ratio, selector + " on light artwork").toBeGreaterThanOrEqual(4.5);
    }
    const bounds = await hero.boundingBox();
    expect(bounds).not.toBeNull();
    if (bounds) {
      expect(bounds.x).toBeGreaterThanOrEqual(-1);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
    }
    await page.getByRole("button", { name: "К списку событий" }).click();
    await expect(hero).toBeHidden();
  });
}
test("dark event detail retains night artwork while mode remains dark", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 });
  const hero = await openDetail(page, "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const bg = await hero.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(luminance(bg)).toBeLessThan(0.1);
});
