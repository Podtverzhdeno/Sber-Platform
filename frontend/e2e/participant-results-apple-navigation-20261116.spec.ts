import { expect, test, type Page } from "@playwright/test";

type Mode = "light" | "blue" | "midnight";
const allowed = [
  "Главная", "Моя траектория", "Bootcamp", "Задачи", "Мои проекты",
  "Портфолио", "События", "Достижения", "Рейтинг", "Аналитика",
  "Сообщения", "AI-Buddy", "Настройки",
];
const destinations = [
  { label: "Портфолио", index: 5 },
  { label: "Аналитика", index: 9 },
  { label: "Достижения", index: 7 },
  { label: "Рейтинг", index: 8 },
] as const;

const portfolio = {
  person_id: "00000000-0000-4000-8000-000000000002",
  display_name: "Тест Участник", headline: "Практика и обучение",
  about: "", bio: "", location: "", public_url: null, demo_data: false,
  contributions: [], credentials: [], trophies: [], courses: [], offers: [],
  visibility: { public_profile: false, public_trophies: false, hr_profile: false },
};

async function installParticipant(page: Page, navigation: readonly string[], mode: Mode) {
  await page.addInitScript((selected: Mode) => {
    localStorage.setItem("impulse-visual-mode", selected);
    localStorage.setItem("impulse-theme", selected === "light" ? "light" : "dark");
  }, mode);
  const actor = {
    person_id: portfolio.person_id, display_name: portfolio.display_name,
    active_role: "participant", assigned_roles: ["participant"],
    scopes: [], consent_scopes: [], navigation, csrf_token: "results-apple",
  };
  let signedIn = false;
  await page.route("**/api/v1/**", route => route.fulfill({
    status: 404, json: { code: "NOT_FOUND" },
  }));
  await page.route("**/api/v1/config", route => route.fulfill({ json: { demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({
    json: [{ key: "results-participant", display_name: portfolio.display_name, roles: ["participant"] }],
  }));
  await page.route(/\/api\/v1\/me$/, route => signedIn
    ? route.fulfill({ json: actor })
    : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => {
    signedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/me/portfolio", route => route.fulfill({ json: portfolio }));
  await page.route("**/api/v1/me/talent-passport", route => route.fulfill({
    json: { skills: [], overall_level: null },
  }));
  await page.route("**/api/v1/me/project-credentials", route => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/messaging/channels", route => route.fulfill({ json: [] }));
  await page.goto("/");
  await page.locator('[data-persona="results-participant"]').click();
}

async function assertVisibleNavigation(page: Page, width: number, mode: Mode) {
  const nav = page.getByRole("navigation", { name: "Подразделы результатов" });
  const allLinks = nav.getByRole("link");
  await expect(allLinks).toHaveCount(4);
  const geometry = await nav.evaluate(element => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(geometry.scrollWidth, "No horizontal tab carousel").toBeLessThanOrEqual(geometry.width + 2);
  for (const item of destinations) {
    const link = nav.getByRole("link", { name: item.label });
    await expect(link).toHaveAttribute("href", `/workspace/${String(item.index)}`);
    await expect(link).toBeInViewport();
    const rect = await link.boundingBox();
    expect(rect, "Tab must be rendered").not.toBeNull();
    expect(rect?.height, "Apple-sized touch target").toBeGreaterThanOrEqual(44);
    expect(rect?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((rect?.x ?? 0) + (rect?.width ?? 0)).toBeLessThanOrEqual(width + 1);
  }
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "Whole Results page must not scroll horizontally").toBeLessThanOrEqual(2);
  const current = nav.getByRole("link", { name: "Портфолио" });
  const style = await current.evaluate(element => {
    const computed = getComputedStyle(element);
    return { color: computed.color, background: computed.backgroundColor };
  });
  if (mode === "light") {
    expect(style.color).toBe("rgb(25, 45, 65)");
    expect(style.background).toBe("rgb(255, 255, 255)");
  } else {
    expect(style.color).toBe("rgb(237, 244, 252)");
  }
  // Phone grid: every tab is visible on two explicit rows, not clipped.
  if (width <= 560) {
    const top = await allLinks.nth(0).boundingBox();
    const next = await allLinks.nth(1).boundingBox();
    const bottom = await allLinks.nth(2).boundingBox();
    expect(Math.abs((next?.y ?? 0) - (top?.y ?? 0))).toBeLessThanOrEqual(1);
    expect(bottom?.y ?? 0).toBeGreaterThan((top?.y ?? 0) + 40);
  }
}

for (const mode of ["light", "blue", "midnight"] as const) {
  for (const width of [320, 390, 560, 768, 1440]) {
    test(`Results navigation uses compact Apple grouping at ${String(width)}px, ${mode}`, async ({ page }) => {
      test.slow(); // Four distinct source-backed pages and browser Back.
      await page.setViewportSize({ width, height: 900 });
      await installParticipant(page, allowed, mode);
      await page.goto("/workspace/5");
      await expect(page.locator("html")).toHaveAttribute("data-theme", mode === "light" ? "light" : "dark");
      await assertVisibleNavigation(page, width, mode);
      if ((width === 320 || width === 1440) && (mode === "light" || mode === "midnight")) {
        await page.screenshot({ path: `test-results/results-apple-${mode}-${String(width)}.png` });
      }
      for (const destination of destinations.slice(1)) {
        const nav = page.getByRole("navigation", { name: "Подразделы результатов" });
        await nav.getByRole("link", { name: destination.label }).click();
        await expect(page).toHaveURL(new RegExp(`/workspace/${String(destination.index)}(?:[?]|$)`));
        await expect(page.getByRole("navigation", { name: "Подразделы результатов" })
          .getByRole("link", { name: destination.label })).toHaveAttribute("aria-current", "page");
        if (mode === "light" && destination.label === "Аналитика") {
          await expect(page.locator(".av3-alert").first())
            .toHaveCSS("background-color", "rgb(255, 247, 233)");
          await expect(page.locator(".ac-calendar-card"))
            .toHaveCSS("background-color", "rgb(255, 255, 255)");
        }
        if (mode === "light" && destination.label === "Достижения") {
          await expect(page.locator(".ach-gallery-stat").first())
            .toHaveCSS("background-color", "rgb(255, 255, 255)");
          await expect(page.locator(".ach-gallery-copy h1"))
            .toHaveCSS("color", "rgb(25, 47, 72)");
        }
        if (mode === "light" && destination.label === "Рейтинг") {
          await expect(page.locator(".ir-disclaimer[role='alert']"))
            .toHaveCSS("background-color", "rgb(255, 248, 235)");
        }
        if ((width === 320 || width === 1440) && (mode === "light" || mode === "midnight")) {
          await page.screenshot({ path: `test-results/results-apple-${mode}-${String(width)}-${String(destination.index)}.png` });
        }
      }
      await page.goBack({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/workspace\/7(?:[?]|$)/);
      const nav = page.getByRole("navigation", { name: "Подразделы результатов" });
      await nav.getByRole("link", { name: "Портфолио" }).click();
      await expect(page).toHaveURL(/\/workspace\/5(?:[?]|$)/);
    });
  }
}

test("a server-denied ranking or portfolio is never rendered as a shortcut", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await installParticipant(page, ["Главная", "Аналитика", "Достижения"], "light");
  await page.goto("/workspace/1");
  const nav = page.getByRole("navigation", { name: "Подразделы результатов" });
  await expect(nav.getByRole("link")).toHaveCount(2);
  await expect(nav.getByRole("link", { name: "Портфолио" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Рейтинг" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Аналитика" })).toHaveAttribute("aria-current", "page");
});

test("Analytics inner tabs keep original data-backed states and visible mobile controls", async ({ page }) => {
  test.slow(); // Two nested data-backed screens, with independent API states.
  await page.setViewportSize({ width: 320, height: 900 });
  await installParticipant(page, allowed, "light");
  await page.goto("/workspace/9");
  const inner = page.getByRole("navigation", { name: "Подразделы аналитики" });
  await expect(inner.getByRole("button")).toHaveCount(3);

  await inner.getByRole("button", { name: "Skill Passport" }).click();
  await expect(page.locator(".analytics-v3")).toHaveAttribute("data-tab", "passport");
  const sourceNotices = page.locator(".analytics-reference .ref-source-notices");
  await expect(sourceNotices).toHaveCSS("position", "static");
  const visibleAlerts = sourceNotices.locator(".ref-alert");
  // Depending on request timing the same source may still be loading.
  if (await visibleAlerts.count() > 0) {
    await expect(visibleAlerts.first()).toHaveCSS("background-color", "rgb(255, 247, 233)");
  }
  await expect(page.getByRole("navigation", { name: "Подразделы результатов" })
    .getByRole("link", { name: "Аналитика" })).toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: "test-results/results-apple-light-320-passport.png" });

  await inner.getByRole("button", { name: "Сертификация" }).click();
  await expect(page.locator(".analytics-v3")).toHaveAttribute("data-tab", "certification");
  await page.screenshot({ path: "test-results/results-apple-light-320-certification.png" });
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth))
    .toBeLessThanOrEqual(2);
});

test("Achievements creation keeps its native drawer reachable and dismissible", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await installParticipant(page, allowed, "light");
  await page.goto("/workspace/7");
  await page.locator(".ach-gallery-hero .ach-gallery-create").click();
  const dialog = page.getByRole("dialog", { name: "Добавить достижение" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await dialog.getByRole("navigation", { name: "Тип результата" })
    .getByRole("button", { name: "Сертификат" }).click();
  await expect(dialog.getByRole("heading", { name: "Добавить сертификат" })).toBeVisible();
  await page.screenshot({ path: "test-results/results-apple-light-320-achievement-dialog.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("reduced motion keeps Results links visible and keyboard reachable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installParticipant(page, allowed, "light");
  await page.goto("/workspace/5");
  const first = page.getByRole("navigation", { name: "Подразделы результатов" })
    .getByRole("link", { name: "Портфолио" });
  await first.focus();
  await expect(first).toBeFocused();
  const duration = await first.evaluate(element => parseFloat(getComputedStyle(element).transitionDuration));
  expect(duration, "Reduced-motion transitions should be imperceptible").toBeLessThanOrEqual(0.001);
});
