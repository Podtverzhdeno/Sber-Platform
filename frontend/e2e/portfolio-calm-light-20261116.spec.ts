import { expect, test, type Page } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Синтетический участник",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [], consent_scopes: [],
  navigation: ["Мой путь", "Bootcamp", "Задачи", "События", "Рейтинг", "Портфолио", "Аналитика", "Настройки"],
  csrf_token: "portfolio-theme-qa",
};
async function setup(page: Page, mode: "light" | "blue" | "midnight") {
  await page.addInitScript((value: string) => {
    localStorage.setItem("impulse-visual-mode", value);
    localStorage.setItem("impulse-theme", value === "light" ? "light" : "dark");
  }, mode);
  let signedIn = false;
  await page.route("**/api/v1/config", route => route.fulfill({ json: { demo_mode: true, honor_board_enabled: false } }));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({ json: [{
    key: "portfolio-synthetic", display_name: actor.display_name, roles: ["participant"],
  }] }));
  await page.route("**/api/v1/me", route => signedIn
    ? route.fulfill({ json: actor })
    : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => {
    signedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/me/portfolio", route => route.fulfill({ json: {
    person_id: actor.person_id, display_name: actor.display_name, demo_data: false,
    visibility: { hr_profile: false, public_profile: false, public_trophies: false },
    contributions: [{
      contribution_id: "10000000-0000-0000-0000-000000000001",
      project_title: "Тестовый проект", personal_summary: "Принятый проверенный результат",
      artifact_keys: ["report"], grade: "A", review_reason: "Принято",
      verification_status: "verified",
    }],
    credentials: [], courses: [], trophies: [], offers: [],
  } }));
  await page.route("**/api/v1/me/talent-passport", route => route.fulfill({ json: {
    verified_courses: [], cases: [],
    skills: [{ key: "python", practical_level: "подтверждено", confirmed_case_count: 1 }],
  } }));
  await page.route("**/api/v1/me/project-credentials", route => route.fulfill({ json: [] }));
  await page.goto("/");
  await page.locator('[data-persona="portfolio-synthetic"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-impulse-visual-mode", mode);
  await page.goto("/workspace/5");
  await expect(page.getByTestId("portfolio-v2")).toBeVisible();
}

for (const mode of ["light", "blue", "midnight"] as const) {
  for (const width of [320, 390, 1440]) {
    test("Portfolio appearance " + mode + " at " + String(width) + "px", async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await setup(page, mode);
      const root = page.getByTestId("portfolio-v2");
      const display = await root.evaluate((node) => {
        const surface = (selector: string) => {
          const element = node.querySelector<HTMLElement>(selector);
          if (!element) throw new Error("Missing surface: " + selector);
          const style = getComputedStyle(element);
          const bounds = element.getBoundingClientRect();
          return { bg: style.backgroundColor, image: style.backgroundImage, color: style.color,
            left: bounds.left, right: bounds.right };
        };
        return {
          hero: surface(".p2-hero"), metric: surface(".p2-metric"),
          panel: surface(".p2-panel"), project: surface(".p2-project"),
          tabs: surface(".p2-tabs"), label: surface(".p2-project-top h3"),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      if (mode === "light") {
        expect(display.hero.bg).toBe("rgb(255, 255, 255)");
        expect(display.metric.bg).toBe("rgb(255, 255, 255)");
        expect(display.panel.bg).toBe("rgb(255, 255, 255)");
        expect(display.project.bg).toBe("rgb(255, 255, 255)");
        expect(display.tabs.bg).toBe("rgb(255, 255, 255)");
        expect(display.label.color).toBe("rgb(37, 66, 87)");
      } else {
        expect(display.panel.bg).not.toBe("rgb(255, 255, 255)");
      }
      expect(display.overflow).toBeLessThanOrEqual(2);
      expect(display.panel.left).toBeGreaterThanOrEqual(-1);
      expect(display.panel.right).toBeLessThanOrEqual(width + 1);
      await root.getByRole("tab", { name: "Skill Passport" }).click();
      await expect(root.getByRole("region", { name: "Подтверждающие кейсы" })).toBeVisible();
      await root.getByRole("tab", { name: "Обзор" }).click();
      await root.locator(".p2-trust-list button").first().click();
      const modal = page.getByRole("dialog", { name: "Подтверждённый проект" });
      await expect(modal).toBeVisible();
      if (mode === "light") {
        expect(await modal.evaluate(node => getComputedStyle(node).backgroundColor)).toBe("rgb(255, 255, 255)");
      }
      await modal.getByRole("button", { name: "Закрыть" }).click();
      await expect(modal).toHaveCount(0);
    });
  }
}
