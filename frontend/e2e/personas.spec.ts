import { expect, test } from "@playwright/test";

const personas = [
  ["participant-alex", "Алекс Речной", "participant", ["Главная", "Мой путь", "Bootcamp", "Задачи", "События", "Рейтинг", "Портфолио", "Аналитика"]],
  ["mentor-elena", "Елена Наставник", "mentor", ["Главная", "Очередь ревью", "Назначения", "Аналитика"]],
  ["customer-roman", "Роман Заказчик", "customer", ["Главная", "Мои задачи", "Кандидаты", "Приёмка", "Аналитика"]],
  ["manager-olga", "Ольга Руководитель", "manager", ["Главная", "Инициативы", "Результаты", "Аналитика"]],
  ["hr-nina", "Нина HR", "hr", ["Главная", "Кандидаты", "Воронка", "Аналитика"]],
  ["operator-pavel", "Павел Оператор", "operator", ["Главная", "Операционная очередь", "Проверки", "Споры", "Аналитика"]],
] as const;

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/config", async (route) => {
    await route.fulfill({ json: { honor_board_enabled: false } });
  });
  await page.route("**/api/v1/auth/personas", async (route) => {
    await route.fulfill({
      json: [...personas.map(([key, display_name, role]) => ({
        key,
        display_name,
        roles: key === "manager-olga" ? ["manager", "customer"] : [role],
      })), { key: "participant-second", display_name: "Второй участник", roles: ["participant"] }],
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
  await page.route("**/api/v1/ops/cases", async (route) => {
    await route.fulfill({ json: [] });
  });
});

test("picker shows one persona per role and disables secondary demo roles", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".persona-card")).toHaveCount(6);
  await expect(page.locator('[data-persona="participant-second"]')).toHaveCount(0);
  await expect(page.locator('[data-persona="participant-alex"]')).toBeEnabled();
  await expect(page.locator('[data-persona="customer-roman"]')).toBeEnabled();
  for (const key of ["mentor-elena", "manager-olga", "hr-nina", "operator-pavel"]) {
    await expect(page.locator(`[data-persona="${key}"]`)).toBeDisabled();
  }
});

for (const [key, , , navigation] of personas.filter(([personaKey]) => personaKey === "participant-alex" || personaKey === "customer-roman")) {
  test(`persona ${key} sees only assigned navigation`, async ({ page }) => {
    await page.goto("/");
    await page.locator(`[data-persona="${key}"]`).click();

    await expect(page.getByRole("heading", { name: new RegExp(`Добро пожаловать, ${key === "participant-alex" ? "Алекс" : key === "mentor-elena" ? "Елена" : key === "customer-roman" ? "Роман" : key === "manager-olga" ? "Ольга" : key === "hr-nina" ? "Нина" : "Павел"}`) })).toBeVisible();
    const links = page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link");
    await expect(links).toHaveCount(navigation.length);
    for (const [index, label] of navigation.entries()) {
      await expect(links.nth(index)).toHaveAccessibleName(label);
    }
    for (const [index, label] of navigation.entries()) {
      await links.nth(index).click();
      await expect(page).toHaveURL(new RegExp(`/workspace/${String(index)}$`));
      await expect(page.getByRole("link", { name: label })).toHaveClass(/active/);
    }
  });
}
