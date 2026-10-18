import { expect, test } from "@playwright/test";

const managerNavigation = ["Главная", "Инициативы", "Команда", "Аналитика", "Результаты", "Календарь команды", "База участников", "Настройки"];
const operatorNavigation = ["Главная", "Операционная очередь", "Проверки", "Задачи и проекты", "Выплаты", "Споры", "Пользователи", "События и трофеи", "Аналитика"];

const gaps = [
  { role: "manager", persona: "manager-olga", name: "Ольга Руководитель", navigation: managerNavigation, section: 0, reference: "R-MGR-01" },
  { role: "manager", persona: "manager-olga", name: "Ольга Руководитель", navigation: managerNavigation, section: 2, reference: "R-MGR-03" },
  { role: "manager", persona: "manager-olga", name: "Ольга Руководитель", navigation: managerNavigation, section: 3, reference: "R-MGR-04" },
  { role: "manager", persona: "manager-olga", name: "Ольга Руководитель", navigation: managerNavigation, section: 5, reference: "R-MGR-06" },
  { role: "manager", persona: "manager-olga", name: "Ольга Руководитель", navigation: managerNavigation, section: 6, reference: "R-MGR-07" },
  { role: "manager", persona: "manager-olga", name: "Ольга Руководитель", navigation: managerNavigation, section: 7, reference: "R-MGR-08" },
  { role: "operator", persona: "operator-pavel", name: "Павел Оператор", navigation: operatorNavigation, section: 0, reference: "R-OPS-01" },
  { role: "operator", persona: "operator-pavel", name: "Павел Оператор", navigation: operatorNavigation, section: 3, reference: "R-OPS-04" },
  { role: "operator", persona: "operator-pavel", name: "Павел Оператор", navigation: operatorNavigation, section: 4, reference: "R-OPS-05" },
  { role: "operator", persona: "operator-pavel", name: "Павел Оператор", navigation: operatorNavigation, section: 6, reference: "R-OPS-07" },
  { role: "operator", persona: "operator-pavel", name: "Павел Оператор", navigation: operatorNavigation, section: 7, reference: "R-OPS-08" },
] as const;

for (const gap of gaps) {
  test(`${gap.reference} composition and workflow`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route("**/api/v1/config", (route) => route.fulfill({ json: {} }));
    await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: gap.persona, display_name: gap.name, roles: [gap.role] }] }));
    await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
    await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: { person_id: `visual-${gap.role}`, display_name: gap.name, active_role: gap.role, assigned_roles: [gap.role], scopes: [], consent_scopes: [], navigation: gap.navigation, csrf_token: "visual-csrf" } }));
    await page.goto("/");
    await page.locator(`[data-persona="${gap.persona}"]`).click();
    if (gap.section > 0) await page.getByRole("link", { name: gap.navigation[gap.section], exact: true }).click();
    await expect(page.locator(`[data-reference="${gap.reference}"]`)).toBeVisible();
    await page.getByRole("button", { name: "Открыть рабочий список" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page).toHaveScreenshot(`${gap.reference.toLowerCase()}-desktop.png`, { animations: "disabled", fullPage: true, maxDiffPixelRatio: 0.01 });
  });
}

test("R-PAR-09 public profile detail composition", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [{ key: "participant-alex", display_name: "Алекс Речной", roles: ["participant"] }] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: { person_id: "visual-participant", display_name: "Алекс Речной", active_role: "participant", assigned_roles: ["participant"], scopes: [], consent_scopes: [], navigation: ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Мои проекты", "События", "Рейтинг", "Портфолио", "Достижения", "Аналитика", "Сообщения", "AI-Buddy", "Настройки"], csrf_token: "visual-csrf" } }));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Рейтинг", exact: true }).click();
  await page.getByRole("button", { name: "Профиль", exact: true }).first().click();
  await expect(page.getByText("Публичный профиль · подтверждённые факты")).toBeVisible();
  await expect(page).toHaveScreenshot("r-par-09-desktop.png", { animations: "disabled", fullPage: true, maxDiffPixelRatio: 0.01 });
  await page.getByRole("button", { name: "Вернуться в рейтинг" }).click();
  await expect(page.getByRole("heading", { name: "Рейтинг подтверждённого опыта" })).toBeVisible();
});
