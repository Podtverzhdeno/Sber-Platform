import { expect, test, type Page } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: [
    "Главная", "Моя траектория", "Bootcamp", "Задачи", "Мои проекты",
    "События", "Рейтинг", "Портфолио", "Достижения", "Аналитика",
    "Сообщения", "AI-Buddy", "Настройки",
  ],
  csrf_token: "analytics-passport-light-e2e",
};

const profile = {
  role_key: "developer",
  role_title: "Разработчик",
  profile_scope: "impulse_learning",
  scale_key: "agentic_coding_1_4",
  framework_version: "agentic-coding-source-map-2026-10-23",
  as_of: "2026-11-16T10:00:00Z",
  certification_state: "not_connected",
  certification_reason: "issuer not connected",
  known_evidence_count: 10,
  data_origin: "source_map",
  skills: [
    "prompting", "prompt_engineering", "context_management",
    "tools_mcp", "creating_skills", "agents_team",
  ].map((key, index) => ({
    key,
    title: key,
    target_level: [3, 4, 3, 2, 3, 2][index],
    current_level: [2, 3, 2, 2, 1, 2][index],
    evidence_count: 2,
    data_state: "verified",
    unresolved_methodology: false,
  })),
};

async function openPassport(page: Page, mode: "light" | "midnight" | "blue") {
  await page.addInitScript((value: string) => {
    localStorage.setItem("impulse-theme", value === "light" ? "light" : "dark");
    localStorage.setItem("impulse-visual-mode", value);
  }, mode);
  await page.route("**/api/v1/config", route => route.fulfill({
    json: { demo_mode: true, honor_board_enabled: true },
  }));
  await page.route(/\/api\/v1\/me(?:\?.*)?$/, route => route.fulfill({ json: actor }));
  await page.route("**/api/v1/me/agentic-coding/profile**", route =>
    route.fulfill({ json: profile }));
  await page.route("**/api/v1/me/growth/snapshot", route => route.fulfill({ json: {
    snapshot_id: "passport-surface-qa",
    generated_at: "2026-11-16T10:00:00Z",
    actor_timezone: "Europe/Moscow",
    freshness: { known: true, latest_observed_at: "2026-11-16T10:00:00Z" },
    events: [{
      occurred_at: "2026-11-15T12:00:00Z", kind: "completed_task",
      title: "Подтверждённый проект", source_kind: "project",
      source_ref: "accepted-qa-case",
    }],
  } }));
  await page.route("**/api/v1/me/analytics/journey", route =>
    route.fulfill({ json: {
      stages: [{ key: "verified_experience", title: "Подтверждено", count: 1, status: "completed" }],
      successful: true, next_action: "Продолжить",
      generated_at: "2026-11-16T10:00:00Z",
    } }));
  await page.route("**/api/v1/me/bootcamp/certificates", route =>
    route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/bootcamp/impulse-study/summary", route =>
    route.fulfill({ json: {
      started_courses: 1, finished_courses: 1, completed_lessons: 8,
      approved_practices: 0, credited_practices: 0, courses: [],
    } }));
  await page.goto("/workspace/9?analyticsTab=passport", { waitUntil: "domcontentloaded" });
  const analytics = page.getByTestId("analytics-v3");
  await expect(analytics).toHaveAttribute("data-tab", "passport");
  const passport = analytics.getByTestId("analytics-reference");
  await expect(passport).toBeVisible();
  await expect(passport.locator(".ref-passport")).toBeVisible();
  await expect(passport.locator(".ref-radar svg")).toBeVisible();
  return passport;
}

function luminosity(value: string): number {
  const parts = value.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!parts) throw new Error("Unsupported computed color: " + value);
  const channels = parts.slice(1, 4).map(Number).map(n => {
    const s = n / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

async function checkTextContrast(page: Page, foreground: string, surface: string) {
  const ink = await page.locator(foreground).first()
    .evaluate(node => getComputedStyle(node).color);
  const bg = await page.locator(surface).first()
    .evaluate(node => getComputedStyle(node).backgroundColor);
  const a = luminosity(ink), b = luminosity(bg);
  expect((Math.max(a, b) + .05) / (Math.min(a, b) + .05),
    foreground + " contrast on " + surface).toBeGreaterThanOrEqual(4.5);
}

async function checkSvgContrast(page: Page, selector: string, property: "fill" | "stroke", minimum: number) {
  const paint = await page.locator(selector).first()
    .evaluate((node, key) => getComputedStyle(node).getPropertyValue(key), property);
  const onWhite = luminosity("rgb(255, 255, 255)");
  const dataInk = luminosity(paint);
  const contrast = (Math.max(dataInk, onWhite) + .05) / (Math.min(dataInk, onWhite) + .05);
  expect(contrast, selector + " " + property + " on white (" + paint + ")")
    .toBeGreaterThanOrEqual(minimum);
}

async function checkMeterTargetContrast(page: Page, selector: string) {
  const swatches = await page.locator(selector).first().evaluate(track => {
    const marker = track.querySelector("i");
    if (!marker) throw new Error("Target marker missing from skill meter");
    return {
      marker: getComputedStyle(marker).backgroundColor,
      track: getComputedStyle(track).backgroundColor,
    };
  });
  const a = luminosity(swatches.marker), b = luminosity(swatches.track);
  const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  expect(ratio, selector + " target tick " + swatches.marker + " on track " + swatches.track)
    .toBeGreaterThanOrEqual(3);
}

for (const width of [320, 390, 1440]) {
  test("light Skill Passport nested surfaces at " + String(width) + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    const passport = await openPassport(page, "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const surfaces = [
      ".ref-primary-matrix", ".ref-passport", ".ref-kpi",
      ".ref-matrix-list", ".ref-personal-facts", ".ref-action",
    ];
    for (const selector of surfaces) {
      const node = passport.locator(selector).first();
      await expect(node, selector).toBeVisible();
      const color = await node.evaluate(el => getComputedStyle(el).backgroundColor);
      expect(luminosity(color), selector + " must be a light opaque card")
        .toBeGreaterThanOrEqual(0.83);
    }

    const root = ".analytics-v3 .analytics-reference";
    await checkTextContrast(page, root + " .ref-kpi > span", root + " .ref-kpi");
    await checkTextContrast(page, root + " .ref-kpi > b", root + " .ref-kpi");
    await checkTextContrast(page, root + " .ref-passport h2", root + " .ref-passport");
    await checkTextContrast(page, root + " .ref-big-value", root + " .ref-passport");
    await checkTextContrast(page, root + " .ref-passport-info b", root + " .ref-passport");
    await checkTextContrast(page, root + " .ref-matrix-list h3", root + " .ref-matrix-list");
    await checkTextContrast(page, root + " .ref-skill-row", root + " .ref-matrix-list");
    await checkTextContrast(page, root + " .ref-personal-facts small", root + " .ref-personal-facts");
    await checkTextContrast(page, root + " .ref-primary-cta", root + " .ref-primary-cta");

    const chartLabel = await passport.locator(".ref-radar-skill > text").first()
      .evaluate(el => getComputedStyle(el).fill);
    expect(luminosity(chartLabel), "Radar label should be dark on white").toBeLessThan(0.18);
    await checkSvgContrast(page, root + ' .ref-radar svg line[stroke="#2ce8b5"]', "stroke", 3);
    await checkSvgContrast(page, root + ' .ref-radar svg line[stroke="#ffae2b"]', "stroke", 3);
    await checkSvgContrast(page, root + ' .ref-radar-skill circle[fill="#31eaba"]', "fill", 3);
    await checkSvgContrast(page, root + ' .ref-radar-skill circle[fill="#ffb844"]', "fill", 3);
    for (const selector of [
      ".ref-legend .ref-dot:not(.amber):not(.activity)",
      ".ref-legend .ref-dot.amber",
      ".ref-legend .ref-dot.activity",
    ]) {
      const paint = await passport.locator(selector).evaluate(el =>
        getComputedStyle(el).backgroundColor);
      const contrast = (1.05) / (luminosity(paint) + .05);
      expect(contrast, selector + " symbol on white").toBeGreaterThanOrEqual(3);
    }

    const viewport = await passport.boundingBox();
    expect(viewport).not.toBeNull();
    if (viewport) {
      expect(viewport.x).toBeGreaterThanOrEqual(-1);
      expect(viewport.x + viewport.width).toBeLessThanOrEqual(width + 1);
    }
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth))
      .toBeLessThanOrEqual(2);

    await checkMeterTargetContrast(page, root + " .ref-matrix-list .ref-skill-row .ref-meter");
    const roleGroup = passport.getByRole("group", { name: "Профессиональная группа" });
    const chartGroup = passport.getByRole("group", { name: "Вид диаграммы" });
    await expect(roleGroup).toBeVisible();
    await expect(chartGroup).toBeVisible();
    const touchHeights = await roleGroup.locator("button").evaluateAll(buttons =>
      buttons.map(button => button.getBoundingClientRect().height));
    expect(Math.min(...touchHeights)).toBeGreaterThanOrEqual(44);
    await chartGroup.getByRole("button", { name: "Гистограмма" }).click();
    await expect(passport.locator(".ref-skill-bars"))
      .toBeVisible();
    await checkMeterTargetContrast(page, root + " .ref-skill-bars .ref-meter");
    await chartGroup.getByRole("button", { name: "Тренд" }).click();
    await expect(passport.locator(".ref-trend svg")).toBeVisible();
    await checkSvgContrast(page, root + ' .ref-trend polyline[stroke="#28e9cc"]', "stroke", 3);
    await checkSvgContrast(page, root + ' .ref-trend circle[fill="#28e9cc"]', "fill", 3);
    await checkSvgContrast(page, root + ' .ref-trend text[fill="#8caabe"]', "fill", 4.5);
  });
}

for (const mode of ["midnight", "blue"] as const) {
  test(mode + " nested passport retains dark source appearance", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const passport = await openPassport(page, mode);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const appearance = await passport.locator(".ref-passport").evaluate(node => ({
      image: getComputedStyle(node).backgroundImage,
      bg: getComputedStyle(node).backgroundColor,
    }));
    expect(appearance.image).toContain("gradient");
    expect(appearance.bg).not.toBe("rgb(255, 255, 255)");
    const kpi = await passport.locator(".ref-kpi").first()
      .evaluate(node => getComputedStyle(node).backgroundImage);
    expect(kpi).toContain("gradient");
  });
}
