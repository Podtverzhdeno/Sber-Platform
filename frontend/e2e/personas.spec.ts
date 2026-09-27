import { expect, test } from "@playwright/test";

const personas = [
  ["participant-alex", "Алекс Речной", "participant", ["Мой путь", "Bootcamp", "Задачи", "События", "Рейтинг", "Портфолио", "Аналитика"]],
  ["mentor-elena", "Елена Наставник", "mentor", ["Очередь ревью", "Назначения", "Аналитика"]],
  ["customer-roman", "Роман Заказчик", "customer", ["Мои задачи", "Кандидаты", "Приёмка", "Аналитика"]],
  ["manager-olga", "Ольга Руководитель", "manager", ["Инициативы", "Результаты", "Аналитика"]],
  ["hr-nina", "Нина HR", "hr", ["Кандидаты", "Воронка", "Аналитика"]],
  ["operator-pavel", "Павел Оператор", "operator", ["Операционная очередь", "Проверки", "Споры", "Аналитика"]],
] as const;

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/config", async (route) => {
    await route.fulfill({ json: { honor_board_enabled: false } });
  });
  await page.route("**/api/v1/auth/personas", async (route) => {
    await route.fulfill({
      json: personas.map(([key, display_name, role]) => ({
        key,
        display_name,
        roles: key === "manager-olga" ? ["manager", "customer"] : [role],
      })),
    });
  });
  await page.route("**/api/v1/me", async (route) => {
    await route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } });
  });
  await page.route("**/api/v1/auth/demo-login", async (route) => {
    const body = route.request().postDataJSON() as { persona_key: string };
    const persona = personas.find(([key]) => key === body.persona_key);
    if (!persona) {
      await route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } });
      return;
    }
    const [key, display_name, role, navigation] = persona;
    await route.fulfill({
      json: {
        person_id: "00000000-0000-0000-0000-000000000001",
        display_name,
        active_role: role,
        assigned_roles: key === "manager-olga" ? ["manager", "customer"] : [role],
        scopes: [],
        consent_scopes: [],
        navigation,
        csrf_token: "csrf-token",
      },
    });
  });
  await page.route("**/api/v1/development/tracks", async (route) => {
    await route.fulfill({
      json: {
        active_count: 1,
        max_active: 2,
        tracks: [
          {
            key: "python",
            title: "Python-разработчик",
            status: "active",
            completed_milestones: [],
          },
        ],
      },
    });
  });
  await page.route("**/api/v1/me/roadmaps", async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route("**/api/v1/mentor/review-queue", async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route("**/api/v1/customer/tasks", async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route("**/api/v1/manager/overview", async (route) => {
    await route.fulfill({ json: { initiatives: [], task_count: 0, accepted_result_count: 0, reused_result_count: 0 } });
  });
  await page.route("**/api/v1/hr/candidates", async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route("**/api/v1/hr/pipeline", async (route) => {
    await route.fulfill({ json: { counts: { invitation: 0, interview: 0, offer: 0, hire: 0 }, events: [] } });
  });
});

for (const [key, displayName, , navigation] of personas) {
  test(`persona ${key} sees only assigned navigation`, async ({ page }) => {
    await page.goto("/");
    await page.locator(`[data-persona="${key}"]`).click();

    const heading = key === "participant-alex"
      ? "Найдите своё через практику"
      : key === "mentor-elena"
        ? "Проверяйте доказательства, а не вывод AI"
        : key === "customer-roman"
          ? "Управляйте задачами от идеи до результата"
          : key === "manager-olga"
            ? "Результаты команд без лишних персональных данных"
          : key === "hr-nina"
            ? "Кандидаты и evidence-first резюме"
            : `Добро пожаловать, ${displayName.split(" ")[0]}!`;
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    const links = page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link");
    await expect(links).toHaveCount(navigation.length);
    for (const [index, label] of navigation.entries()) {
      await expect(links.nth(index)).toHaveAccessibleName(label);
    }
    await expect(page.getByText("Демо-режим · синтетические данные")).toBeVisible();
  });
}
