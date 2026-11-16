import { expect, test, type Page } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Мой путь", "Bootcamp", "Задачи", "События", "Рейтинг", "Аналитика"],
  csrf_token: "learning-progress-light-test",
};

async function showLearning(page: Page, theme: "light" | "dark") {
  await page.addInitScript((value: string) => {
    localStorage.setItem("impulse-theme", value);
    localStorage.setItem("impulse-visual-mode", value === "light" ? "light" : "midnight");
  }, theme);
  let loggedIn = false;
  await page.route("**/api/v1/**", route =>
    route.fulfill({ status: 404, json: { code: "NOT_MOCKED" } }));
  await page.route("**/api/v1/config", route =>
    route.fulfill({ json: { demo_mode: true, honor_board_enabled: true } }));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({
    json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }],
  }));
  await page.route(/\/api\/v1\/me(?:\?.*)?$/, route => loggedIn
    ? route.fulfill({ json: actor })
    : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => {
    loggedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/me/bootcamp/impulse-study/summary", route => route.fulfill({ json: {
    started_courses: 1, finished_courses: 1, completed_lessons: 5,
    approved_practices: 1, credited_practices: 0,
    courses: [{
      course_key: "python-base", title: "Python: основа",
      completed_units: 5, total_units: 5, finished: true,
      finished_at: "2026-11-15T10:00:00Z", certificate_id: "cert-1",
      updated_at: "2026-11-15T10:00:00Z", practice_status: null,
      practical_certificate_id: null,
    }],
  } }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/5?analyticsTab=certification", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("analytics-v3")).toHaveAttribute("data-tab", "certification");
  const panel = page.getByTestId("analytics-v3").getByTestId("learning-progress-bridge");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Python: основа")).toBeVisible();
  await expect(panel.locator(".learning-progress-bridge__practice-link")).toBeVisible();
  return panel;
}

function brightness(color: string) {
  const match = color.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!match) throw new Error("Unsupported CSS color " + color);
  const channels = match.slice(1, 4).map(Number);
  const values = channels.map(n => {
    const c = n / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

async function checkContrast(page: Page, foregroundSelector: string, surfaceSelector: string) {
  const ink = await page.locator(foregroundSelector).first()
    .evaluate(el => getComputedStyle(el).color);
  const surface = await page.locator(surfaceSelector).first()
    .evaluate(el => getComputedStyle(el).backgroundColor);
  const a = brightness(ink);
  const b = brightness(surface);
  expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
    foregroundSelector + " WCAG AA on " + surfaceSelector).toBeGreaterThanOrEqual(4.5);
}

for (const width of [320, 390, 1440]) {
  test("populated Analytics learning panel stays light and readable at " + String(width) + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    const panel = await showLearning(page, "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const rootBackground = await panel.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(brightness(rootBackground), "learning panel should be opaque white").toBeGreaterThan(0.84);
    const metricBackground = await panel.locator(".learning-progress-bridge__metrics > div").first()
      .evaluate(el => getComputedStyle(el).backgroundColor);
    expect(brightness(metricBackground), "learning metrics should be light cards").toBeGreaterThan(0.84);
    const root = ".analytics-v3 .learning-progress-bridge";
    await checkContrast(page, root + " h3", root);
    await checkContrast(page, root + " header a", root);
    await checkContrast(page, root + " .learning-progress-bridge__eyebrow", root);
    await checkContrast(page, root + " .learning-progress-bridge__metrics strong", root + " .learning-progress-bridge__metrics > div");
    await checkContrast(page, root + " .learning-progress-bridge__metrics span", root + " .learning-progress-bridge__metrics > div");
    await checkContrast(page, root + " .learning-progress-bridge__courses strong", root);
    await checkContrast(page, root + " .learning-progress-bridge__courses li span", root);
    await checkContrast(page, root + " > small", root);
    await checkContrast(page, root + " .learning-progress-bridge__practice-link", root + " .learning-progress-bridge__practice-link");
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    }
    if (width < 500) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
        .toBeLessThanOrEqual(2);
    }
  });
}

test("midnight learning panel retains original gradient and dark metric cards", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = await showLearning(page, "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const appearance = await panel.evaluate(el => ({
    background: getComputedStyle(el).backgroundImage,
    metric: (() => {
      const metric = el.querySelector(".learning-progress-bridge__metrics > div");
      if (!metric) throw new Error("Learning metric missing");
      return getComputedStyle(metric).backgroundColor;
    })(),
  }));
  expect(appearance.background).toContain("linear-gradient");
  expect(brightness(appearance.metric)).toBeLessThan(0.2);
});
