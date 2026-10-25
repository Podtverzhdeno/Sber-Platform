import { expect, test, type Page } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  csrf_token: "csrf",
  navigation: [
    "Главная", "Моя траектория", "Bootcamp", "Задачи", "Мои проекты",
    "События", "Рейтинг", "Портфолио", "Достижения", "Аналитика", "Сообщения",
    "AI-Buddy", "Настройки",
  ],
};

async function setup(page: Page, empty = false) {
  await page.route("**/api/v1/config", route => route.fulfill({ json: { honor_board_enabled: false } }));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({
    json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }],
  }));
  await page.route("**/api/v1/me", route => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => route.fulfill({ json: actor }));
  await page.route("**/api/v1/me/portfolio", route => route.fulfill({
    json: {
      contributions: empty ? [] : [
        { contribution_id: "project-one", project_title: "Рекомендательная система",
          personal_summary: "Создал прототип ранжирования и продемонстрировал результат",
          artifact_keys: ["repository", "demo-video"], grade: "A",
          review_reason: "Проверен личный вклад", verification_status: "verified" },
      ],
      courses: empty ? [] : [
        { key: "python-data", title: "Python для анализа данных", status: "verified" },
      ],
      credentials: [], trophies: empty ? [] : [
        { title: "Победитель МАЯКИ", organizer: "Сбер",
          source_url: "https://developers.sber.ru/", trophy_type: "Победа" },
      ],
      demo_data: true,
    },
  }));
  await page.route("**/api/v1/me/event-claims", route => route.fulfill({
    json: empty ? [] : [{
      id: "claim-one", event_key: "ai-journey",
      claim_type: "participation", status: "awaiting_verification",
      evidence_state: "provisional", verification_explanation: "Ожидаем проверку",
      trophy_created: false,
    }],
  }));
  await page.route("**/api/v1/ecosystem/events", route => route.fulfill({
    json: { items: [{ key: "ai-journey", title: "AI Journey 2026", organizer: "Сбер" }],
      next_cursor: null, has_more: false },
  }));
}

test("achievements v2: live stats, filtering, evidence detail, keyboard and add actions", async ({ page }) => {
  await setup(page);
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Достижения" }).click();
  const screen = page.getByTestId("achievements-v2");
  await expect(screen).toBeVisible();
  await expect(screen.getByRole("heading", { name: /Твои результаты/ })).toBeVisible();
  await expect(screen.getByTestId("achievement-card")).toHaveCount(4);
  await expect(screen.getByText("Топ 8%")).toHaveCount(0);
  await expect(screen.locator(".ach-gallery-stat").nth(0).locator("strong")).toHaveText("4");
  await expect(screen.locator(".ach-gallery-stat").nth(1).locator("strong")).toHaveText("1");
  await expect(screen.locator(".ach-gallery-stat").nth(2).locator("strong")).toHaveText("1");
  await page.screenshot({ path: "test-results/achievements-v2/desktop.png", animations: "disabled", fullPage: true });

  await screen.getByRole("button", { name: /^Проекты/ }).click();
  await expect(screen.getByTestId("achievement-card")).toHaveCount(1);
  await screen.getByRole("button", { name: /^Все/ }).click();
  await screen.getByRole("searchbox", { name: "Поиск по достижениям" }).fill("Journey");
  await expect(screen.getByTestId("achievement-card")).toHaveCount(1);
  await screen.getByRole("button", { name: /AI Journey 2026/ }).click();
  await expect(page.getByTestId("achievement-detail")).toBeVisible();
  await expect(page.getByTestId("achievement-detail").locator(".ach-gallery-intro")).toContainText("Ожидаем проверку");
  const drawer = page.getByTestId("achievement-detail");
  const drawerBox = await drawer.boundingBox();
  const viewport = page.viewportSize();
  if (!drawerBox || !viewport) throw new Error("Detail drawer geometry unavailable");
  expect(drawerBox.x + drawerBox.width).toBeGreaterThanOrEqual(viewport.width - 2);
  expect(drawerBox.width).toBeLessThanOrEqual(550);
  await drawer.getByRole("tab", { name: "Материалы" }).click();
  await expect(drawer.getByRole("heading", { name: "Подтверждающие материалы" })).toBeVisible();
  await drawer.getByRole("tab", { name: "Описание" }).click();
  await page.screenshot({ path:"test-results/achievements-v2/detail.png", animations:"disabled", fullPage:false });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("achievement-detail")).toHaveCount(0);
  await expect(page).not.toHaveURL(/achievement=/);

  await screen.locator(".ach-gallery-hero").getByRole("button", { name: /Добавить достижение/ }).click();
  await expect(page.getByTestId("achievements-add-dialog")).toBeVisible();
  await page.screenshot({ path:"test-results/achievements-v2/add.png", animations:"disabled", fullPage:false });
  await page.getByTestId("achievements-add-dialog").getByRole("button", { name: /Событие/ }).click();
  await page.getByTestId("achievements-add-dialog").getByRole("button", { name: /Продолжить/ }).click();
  await expect(page).toHaveURL(/\/workspace\/5/);
});

test("achievements v2: empty state, no fabricated metrics, and mobile layout", async ({ page }) => {
  await setup(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("button", { name: /Меню/ }).click();
  await page.getByRole("link", { name: "Достижения" }).click();
  const screen = page.getByTestId("achievements-v2");
  await expect(screen.getByTestId("achievements-empty")).toBeVisible();
  await expect(screen.getByTestId("achievement-card")).toHaveCount(0);
  await expect(screen.locator(".ach-gallery-stat").nth(0).locator("strong")).toHaveText("0");
  const width = await screen.evaluate(element => element.getBoundingClientRect().width);
  const scrollWidth = await screen.evaluate(element => element.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(width + 2);
  await page.screenshot({ path: "test-results/achievements-v2/mobile.png", animations: "disabled", fullPage: true });
  await screen.getByTestId("achievements-empty").getByRole("button", { name: /Добавить достижение/ }).click();
  await expect(page.getByTestId("achievements-add-dialog")).toBeVisible();
  await page.getByTestId("achievements-add-dialog").getByRole("button", { name: "Закрыть" }).click();
  await expect(page.getByTestId("achievements-add-dialog")).toHaveCount(0);
});
