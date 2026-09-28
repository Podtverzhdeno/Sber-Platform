import { expect, test } from "@playwright/test";

const navigation = ["Главная", "Мой путь", "Bootcamp", "Задачи", "События", "Рейтинг", "Портфолио", "Аналитика"];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [
    { key: "participant-alex", display_name: "Алекс Речной", roles: ["participant"] },
    { key: "mentor-elena", display_name: "Елена Наставник", roles: ["mentor"] },
  ] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: {} }));
  await page.route("**/api/v1/auth/demo-login", async (route) => {
    const { persona_key } = route.request().postDataJSON() as { persona_key: string };
    const mentor = persona_key === "mentor-elena";
    await route.fulfill({ json: {
      person_id: mentor ? "2" : "1", display_name: mentor ? "Елена Наставник" : "Алекс Речной",
      active_role: mentor ? "mentor" : "participant", assigned_roles: [mentor ? "mentor" : "participant"],
      scopes: [], consent_scopes: [], navigation: mentor ? ["Главная", "Очередь ревью", "Назначения", "Аналитика"] : navigation, csrf_token: "csrf",
    } });
  });
  await page.route("**/api/v1/auth/logout", (route) => route.fulfill({ json: { ok: true } }));
});

test("logout returns persona picker and allows another role", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page.getByRole("heading", { name: "Добро пожаловать, Алекс!" })).toBeVisible();
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page.getByRole("heading", { name: "Кем вы хотите посмотреть платформу?" })).toBeVisible();
  await page.locator('[data-persona="mentor-elena"]').click();
  await expect(page.getByRole("heading", { name: "Добро пожаловать, Елена!" })).toBeVisible();
});

test("participant home actions open project, buddy and linked routes", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("button", { name: /Открыть рабочую область/ }).click();
  await expect(page.getByRole("dialog", { name: "Рабочая область проекта" })).toBeVisible();
  await page.getByRole("dialog", { name: "Рабочая область проекта" }).getByText("Закрыть", { exact: true }).click();
  await page.getByRole("button", { name: /Получить рекомендацию/ }).click();
  await expect(page.getByRole("dialog", { name: "Рекомендация AI Buddy" })).toBeVisible();
  await page.getByRole("button", { name: "Понятно" }).click();
  await expect(page.locator(".metric-histogram")).toHaveCount(4);
  await page.getByRole("button", { name: /Все действия/ }).click();
  await expect(page).toHaveURL(/\/workspace\/3$/);
});

test("rating opens selected public profile", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Рейтинг" }).click();
  await page.getByRole("button", { name: "Кирилл Меньшев" }).click();
  await expect(page.getByRole("heading", { name: "Кирилл Меньшев" })).toBeVisible();
  await expect(page.getByText("Оценка A")).toBeVisible();
  await expect(page.getByText("Победитель МАЯКИ")).toBeVisible();
  await page.getByRole("button", { name: /Вернуться в рейтинг/ }).click();
  await expect(page.getByRole("heading", { name: "Рейтинг подтверждённого опыта" })).toBeVisible();
});
