import { expect, test } from "@playwright/test";

const personas = [
  ["participant-alex", "Алекс Речной", "participant", ["Мой путь", "Bootcamp", "Задачи", "События", "Рейтинг", "Аналитика"]],
  ["mentor-elena", "Елена Наставник", "mentor", ["Очередь ревью", "Назначения", "Аналитика"]],
  ["customer-roman", "Роман Заказчик", "customer", ["Мои задачи", "Кандидаты", "Приёмка", "Аналитика"]],
  ["manager-olga", "Ольга Руководитель", "manager", ["Инициативы", "Результаты", "Аналитика"]],
  ["hr-nina", "Нина HR", "hr", ["Кандидаты", "Воронка", "Аналитика"]],
  ["operator-pavel", "Павел Оператор", "operator", ["Операционная очередь", "Проверки", "Споры", "Аналитика"]],
] as const;

test.beforeEach(async ({ page }) => {
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
});

for (const [key, displayName, , navigation] of personas) {
  test(`persona ${key} sees only assigned navigation`, async ({ page }) => {
    await page.goto("/");
    await page.locator(`[data-persona="${key}"]`).click();

    await expect(page.getByRole("heading", { name: `Здравствуйте, ${displayName}` })).toBeVisible();
    const links = page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link");
    await expect(links).toHaveCount(navigation.length);
    await expect(links).toHaveText([...navigation]);
    await expect(page.getByText("Демо-режим · синтетические данные")).toBeVisible();
  });
}
