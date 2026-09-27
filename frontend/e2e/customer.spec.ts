import { expect, test } from "@playwright/test";

test("customer creates paid and unpaid drafts with participant payment preview", async ({ page }) => {
  const tasks: Record<string, unknown>[] = [];
  const created: Record<string, unknown>[] = [];
  const actor = { person_id: "00000000-0000-0000-0000-000000000005", display_name: "Роман Заказчик", active_role: "customer", assigned_roles: ["customer"], scopes: [], consent_scopes: [], navigation: ["Мои задачи", "Кандидаты", "Приёмка", "Аналитика"], csrf_token: "csrf" };
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { honor_board_enabled: false } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "customer-roman", display_name: actor.display_name, roles: ["customer"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: actor }));
  await page.route("**/api/v1/customer/tasks", (route) => route.fulfill({ json: tasks }));
  await page.route("**/api/v1/customer/projects/*/tasks", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    created.push(body);
    const task = { id: `10000000-0000-0000-0000-00000000000${String(created.length)}`, project_key: "impulse-demo", task_key: body.task_key, title: body.title, status: "draft", nominated_mentor_id: null, support_mode: null, support_assignee_id: null, places: body.places };
    tasks.push(task);
    await route.fulfill({ json: task });
  });
  await page.route("**/api/v1/customer/tasks/*/applications", (route) => route.fulfill({ json: [] }));

  await page.goto("/");
  await page.locator('[data-persona="customer-roman"]').click();
  await page.getByRole("button", { name: /Создать задачу/ }).click();
  await page.getByLabel("Название").fill("Платный R&D прототип");
  await page.getByLabel("Проблема").fill("Нужно проверить продуктовую гипотезу на данных");
  await page.getByLabel("Ожидаемый результат").fill("Воспроизводимый эксперимент и MVP");
  await page.getByLabel("Критерий приёмки").fill("Метрика качества подтверждена отчётом");
  await expect(page.getByText(/База 50000 ₽ · B 75000 ₽ · A 100000 ₽/)).toBeVisible();
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await expect.poll(() => created.length).toBe(1);

  await page.getByRole("button", { name: /Создать задачу/ }).click();
  await page.getByRole("button", { name: "Неоплачиваемая" }).click();
  await page.getByLabel("Название").fill("Исследовательская проба");
  await page.getByLabel("Проблема").fill("Нужно исследовать открытые подходы к решению");
  await page.getByLabel("Ожидаемый результат").fill("Сравнительный отчёт и рекомендации");
  await page.getByLabel("Критерий приёмки").fill("Сравнены минимум три подхода");
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await expect.poll(() => created.length).toBe(2);
  expect((created[0]?.compensation as { paid: boolean }).paid).toBe(true);
  expect((created[1]?.compensation as { paid: boolean }).paid).toBe(false);
  expect(created.every((item) => item.nominated_mentor_id === null)).toBe(true);
});
