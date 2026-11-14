import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end proof that the shared visual layer is really mounted for every
 * server-authorized role. Does not mock UI widgets or replace backend routes.
 */
type WorkspaceRole = "participant" | "customer" | "mentor" | "manager" | "hr" | "operator";

const roles: Record<WorkspaceRole, readonly string[]> = {
  participant: ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Мои проекты", "События", "Аналитика", "Сообщения"],
  customer: ["Главная", "Мои задачи", "Создать задачу", "Заявки", "Аналитика", "Сообщения"],
  mentor: ["Главная", "Проверка вкладов", "Мои проекты", "Участники", "Аналитика", "Сообщения"],
  manager: ["Главная", "Инициативы", "Команда", "Аналитика", "Результаты"],
  hr: ["Главная", "Кандидаты", "Воронка", "Аналитика", "Сообщения"],
  operator: ["Главная", "Операционная очередь", "Проверки", "Задачи и проекты", "Выплаты", "Аналитика"],
};

async function mountRole(page: Page, role: WorkspaceRole, theme: "light" | "dark") {
  await page.addInitScript((chosenTheme) => {
    localStorage.setItem("impulse-theme", chosenTheme);
  }, theme);
  await page.route("**/api/v1/config", (route) =>
    route.fulfill({ json: { demo_mode: false, honor_board_enabled: true } }),
  );
  await page.route("**/api/v1/me", (route) =>
    route.fulfill({
      json: {
        person_id: "00000000-0000-0000-0000-000000000001",
        display_name: "Тестовый пользователь",
        active_role: role,
        assigned_roles: [role],
        scopes: [],
        consent_scopes: [],
        navigation: roles[role],
        csrf_token: "liquid-style-contract",
      },
    }),
  );
  await page.route("**/api/v1/me/notifications", (route) =>
    route.fulfill({ json: { items: [], unread: 0 } }),
  );
  await page.goto("/workspace/0");
}

for (const role of Object.keys(roles) as WorkspaceRole[]) {
  test(`liquid redesign ${role}: renders authorized workspace without replacing route links`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mountRole(page, role, "light");

    const shell = page.locator(".page-shell--apple-overlay");
    const workspace = shell.locator(`.workspace--apple[data-workspace-role="${role}"]`);
    await expect(workspace).toBeVisible();
    const background = await shell.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--liquid-surface").trim(),
    );
    expect(background).toBe("#fff");

    const menu = page.getByRole("button", { name: "Меню", exact: true });
    await expect(menu).toBeVisible();
    await menu.click();
    const navigation = page.getByRole("dialog", { name: "Главное меню" });
    await expect(navigation).toBeVisible();
    await expect(navigation.locator('a[href^="/workspace/"]')).toHaveCount(roles[role].length);
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
  });
}

test("liquid dark theme respects preference while preserving the existing chart and content slots", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mountRole(page, "manager", "dark");
  const shell = page.locator(".page-shell--apple-overlay");
  await expect(shell).toBeVisible();
  const [surface, accent] = await shell.evaluate((element) => {
    const css = getComputedStyle(element);
    return [
      css.getPropertyValue("--liquid-surface").trim(),
      css.getPropertyValue("--liquid-primary").trim(),
    ];
  });
  expect(surface).toBe("#192235");
  expect(accent).toBe("#338bff");
  await expect(page.locator(".workspace-content")).toBeVisible();
});

test("liquid mobile workspace retains explicit navigation and no accidental hover overlay", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mountRole(page, "participant", "light");
  await expect(page.getByRole("button", { name: "Показать навигацию" })).toBeHidden();
  const trigger = page.getByRole("button", { name: "Меню", exact: true });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Главное меню" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".calm-sidebar")).toBeHidden();
});
