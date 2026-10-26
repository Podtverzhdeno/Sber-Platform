import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

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
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: actor }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: actor }));
  // Personal-data sources are independently authorized; fixture their empty states
  // so reference geometry is not influenced by failed API proxy retries.
  await page.route("**/api/v1/me/bootcamp/impulse-study/summary", (route) => route.fulfill({ json: {
    started_courses: 0, finished_courses: 0, completed_lessons: 0,
    approved_practices: 0, credited_practices: 0, courses: [],
  }}));
  await page.route("**/api/v1/me/competency-evidence", (route) => route.fulfill({ json: [] }));
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
    // A design screenshot is not a login test: start from a deterministic authenticated actor.
    await page.goto("/workspace/9?analyticsTab=passport");
    const root = page.getByTestId("analytics-reference");
    await expect(root).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ваш Skill Passport" })).toBeVisible();
    const geometryViolations: string[] = [];
    if (viewport.name === "desktop-1600") {
      await expect(page.locator(".sidebar")).toHaveCSS("width", "244px");
      await expect(page.locator(".topbar")).toHaveCSS("left", "244px");
    }
    for (const [view] of [
      ["passport", "Ваш Skill Passport"], ["path", "Маршрут к вашей следующей цели"], ["evidence", "Результаты, которым можно доверять"]
    ] as const) {
      if (view !== "passport") await page.goto("/workspace/9?analyticsTab=passport&view=" + view);
      await expect(root).toHaveClass(new RegExp("ref-layout-" + view));
      await expect(root.locator(view === "path" ? ".ref-path-hero" : view === "evidence" ? ".ref-v3-main" : ".ref-v1-middle")).toBeVisible();
      await expect(root.locator(".ref-radar svg")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(2);
      await page.evaluate(async () => { await document.fonts.ready; });
      const geometrySelectors: Record<string, string[]> = {
        passport: [".ref-primary-matrix", ".ref-passport", ".ref-action", ".ref-bottom-evidence", ".ref-bottom-chart"],
        path: [".ref-path-hero", ".ref-gaps", ".ref-path-matrix", ".ref-history", ".ref-practice"],
        evidence: [".ref-v3-chart", ".ref-v3-evidence", ".ref-evidence-bars", ".ref-projects", ".ref-growth"],
      };
      const geometry = await Promise.all((geometrySelectors[view] ?? []).map(async (selector) => ({
        selector, rect: await root.locator(selector).boundingBox(),
      })));
      // The shared 244px sidebar shifts and narrows the analytics canvas relative
      // to the original 205px-sidebar mockup. Preserve panel heights and row
      // alignment; the sidebar itself is checked separately.
      if (viewport.name === "desktop-1600") {
        const goldenByView: Record<string, Record<string, [number, number, number, number]>> = {
          passport: {
            ".ref-primary-matrix": [272, 307, 846, 441],
            ".ref-passport": [1132, 307, 440, 441],
            ".ref-action": [272, 773, 391, 255],
            ".ref-bottom-evidence": [677, 773, 442, 255],
            ".ref-bottom-chart": [1134, 773, 438, 255],
          },
          path: {
            ".ref-path-hero": [227, 174, 1351, 199],
            ".ref-gaps": [227, 507, 616, 379],
            ".ref-path-matrix": [857, 507, 721, 379],
            ".ref-history": [227, 900, 669, 278],
            ".ref-practice": [910, 900, 669, 278],
          },
          evidence: {
            ".ref-v3-chart": [227, 288, 669, 424],
            ".ref-v3-evidence": [910, 288, 669, 424],
            ".ref-evidence-bars": [227, 788, 455, 304],
            ".ref-projects": [696, 788, 505, 304],
            ".ref-growth": [1214, 788, 364, 304],
          },
        };
        const golden = goldenByView[view] ?? {};
        for (const { selector, rect } of geometry) {
          const expected = golden[selector];
          if (rect === null) {
            geometryViolations.push(view + " " + selector + " is missing its rectangle or reference");
            continue;
          }
          for (const [metric, actual, position] of [
            ["x", rect.x, 0], ["y", rect.y, 1],
            ["width", rect.width, 2], ["height", rect.height, 3],
          ] as const) {
            const delta = Math.abs(actual - expected[position]);
            if ((metric === "y" && delta > 20) || (metric === "height" && delta > 12)) {
              geometryViolations.push(view + " " + selector + "." + metric + ": expected " + String(expected[position]) + ", got " + String(actual) + ", delta " + String(delta));
            }
            if (metric === "x" && actual < 260) {
              geometryViolations.push(view + " " + selector + " overlaps the shared 244px sidebar");
            }
          }
        }
      }
      const headerStats = await root.locator(".ref-page-header").evaluate((el) => {
        const style = window.getComputedStyle(el);
        const rectangle = (element: Element | null): { x: number; y: number; width: number; height: number } | null => {
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        };
        return {
          header: rectangle(el),
          marginBottom: style.marginBottom,
          headerHeight: style.height,
          heading: rectangle(el.querySelector("h1")),
          paragraph: rectangle(el.querySelector("p")),
          gap: window.getComputedStyle(el.parentElement as Element).gap,
        };
      });
      const diagnostics = { viewport, view, geometry, headerStats };
      console.log("ANALYTICS_GEOMETRY", JSON.stringify(diagnostics));
      await writeFile(testInfo.outputPath("analytics-" + view + "-" + viewport.name + ".geometry.json"), JSON.stringify(diagnostics, null, 2), "utf8");
      await page.screenshot({ path: testInfo.outputPath("analytics-" + view + "-" + viewport.name + ".png"), fullPage: true, animations: "disabled" });
    }
    expect(geometryViolations, "Analytics cards must retain reference height and remain in the shared shell").toEqual([]);
    await page.goto("/workspace/9?analyticsTab=passport&view=path");
    await root.getByRole("group", { name: "Профессиональная группа" }).getByRole("button", { name: "Аналитик" }).click();
    await root.getByRole("group", { name: "Вид диаграммы" }).getByRole("button", { name: "Гистограмма" }).click();
    await expect(root.locator(".ref-skill-bars")).toBeVisible();
    await root.getByRole("group", { name: "Вид диаграммы" }).getByRole("button", { name: "Тренд" }).click();
    await expect(root.locator(".ref-trend svg")).toBeVisible();
  });
}
