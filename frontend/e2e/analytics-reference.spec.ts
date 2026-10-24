import { expect, test } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной", active_role: "participant", assigned_roles: ["participant"],
  scopes: [], consent_scopes: [],
  navigation: ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Мои проекты", "События", "Рейтинг", "Портфолио", "Достижения", "Аналитика", "Сообщения", "AI-Buddy", "Настройки"],
  csrf_token: "csrf",
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { honor_board_enabled: true } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "participant-alex", display_name: "Алекс Речной", roles: ["participant"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: actor }));
  await page.route("**/api/v1/me/agentic-coding/profile**", async (route) => {
    const role = new URL(route.request().url()).searchParams.get("role_key") ?? "developer";
    const target = role === "analyst" ? [3, null, 3, 2, 2, 2] : role === "qa" ? [3, 2, 2, 2, 2, 2] : [3, 4, 3, 2, 3, 2];
    const keys = ["prompting", "prompt_engineering", "context_management", "tools_mcp", "creating_skills", "agents_team"];
    await route.fulfill({ json: {
      role_key: role, role_title: role, profile_scope: "impulse_learning", scale_key: "agentic_coding_1_4",
      framework_version: "agentic-coding-source-map-2026-10-23",
      as_of: "2026-10-24T12:00:00Z", certification_state: "not_connected", certification_reason: "no issuer",
      known_evidence_count: 7, data_origin: "source_map",
      skills: keys.map((key, index) => ({ key, title: key, target_level: target[index], current_level: [3, 4, 2, 2, 2, 1][index], evidence_count: index < 3 ? 2 : 1, data_state: "verified", unresolved_methodology: false })),
    }});
  });
  await page.route("**/api/v1/me/growth/snapshot", (route) => route.fulfill({ json: {
    snapshot_id: "analytics-e2e", generated_at: "2026-10-24T12:00:00Z", actor_timezone: "Europe/Moscow",
    freshness: { known: true, latest_observed_at: "2026-10-20T12:00:00Z" },
    events: ["2026-03-16", "2026-04-18", "2026-05-20", "2026-06-12", "2026-07-11", "2026-09-14", "2026-10-20"].map((date, i) => ({
      occurred_at: date + "T12:00:00Z", kind: "verified_action", title: ["Вызов Tools / MCP", "Курс «Агентная разработка»", "Использование контекста", "Проверка задачи агентом", "Создание Skills", "Командная работа", "Проектный результат"][i],
      source_kind: "GigaCode", source_ref: "evidence-" + String(i + 1),
    })), trajectories: [],
  }}));
  await page.route("**/api/v1/me/analytics/journey", (route) => route.fulfill({ json: {
    stages: [{ key: "verified_experience", title: "Опыт подтверждён", count: 3, status: "completed" }],
    successful: false, next_action: "Продолжить", generated_at: "2026-10-24T12:00:00Z",
  }}));
});

for (const viewport of [{ name: "desktop-1600", width: 1600, height: 1080 }, { name: "mobile-390", width: 390, height: 844 }] as const) {
  test("analytics canonical reference variants " + viewport.name, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await page.locator('[data-persona="participant-alex"]').click();
    if (viewport.width < 700) await page.getByRole("button", { name: "Меню", exact: true }).click();
    await page.getByRole("link", { name: "Аналитика", exact: true }).click();
    const root = page.getByTestId("analytics-reference");
    await expect(root).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ваш Skill Passport" })).toBeVisible();
    for (const [view, title] of [
      ["passport", "Ваш Skill Passport"], ["path", "Маршрут к вашей следующей цели"], ["evidence", "Результаты, которым можно доверять"]
    ] as const) {
      if (view !== "passport") await root.getByRole("button", { name: view === "path" ? "Мой маршрут" : "Результаты", exact: true }).click();
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
      await expect(root.locator(".ref-radar svg")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(2);
      await page.evaluate(async () => { await document.fonts.ready; });
      await page.screenshot({ path: testInfo.outputPath("analytics-" + view + "-" + viewport.name + ".png"), fullPage: true, animations: "disabled" });
    }
    await root.getByRole("button", { name: "Мой маршрут" }).click();
    await root.getByRole("group", { name: "Профессиональная группа" }).getByRole("button", { name: "Аналитик" }).click();
    await root.getByRole("group", { name: "Вид диаграммы" }).getByRole("button", { name: "Гистограмма" }).click();
    await expect(root.locator(".ref-skill-bars")).toBeVisible();
    await root.getByRole("group", { name: "Вид диаграммы" }).getByRole("button", { name: "Тренд" }).click();
    await expect(root.getByText(/Нет достаточной истории цифровых следов/)).toBeVisible();
  });
}
