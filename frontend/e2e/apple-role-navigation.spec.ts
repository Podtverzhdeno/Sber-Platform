import { expect, test, type Page } from "@playwright/test";

type ImpulseRole = "participant" | "mentor" | "customer" | "manager" | "hr" | "operator";

const roleSections: Record<ImpulseRole, readonly string[]> = {
  participant: ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Мои проекты", "События", "Рейтинг", "Портфолио", "Достижения", "Аналитика", "Сообщения", "AI-Buddy", "Настройки"],
  mentor: ["Главная", "Проверка вкладов", "Мои проекты", "Участники", "Сообщения", "Аналитика", "AI-помощник", "План недели"],
  customer: ["Главная", "Мои задачи", "Кандидаты", "Приёмка", "Аналитика", "Сообщения"],
  manager: ["Главная", "Инициативы", "Команда", "Аналитика", "Результаты", "Календарь команды", "База участников", "Настройки"],
  hr: ["Главная", "Кандидаты", "Воронка", "Аналитика", "Сообщения"],
  operator: ["Главная", "Операционная очередь", "Проверки", "Задачи и проекты", "Выплаты", "Споры", "Пользователи", "События и трофеи", "Аналитика"],
};

const demoCustomerSections = ["Главная", "Мои задачи", "Создать задачу", "Заявки", "Аналитика", "AI-помощник", "База участников", "Сообщения", "Настройки"];

async function referenceRole(page: Page, role: ImpulseRole, sections: readonly string[], demoMode = false) {
  await page.addInitScript(() => { localStorage.setItem("impulse-theme", "light"); });
  await page.route("**/api/v1/config", route => route.fulfill({ json: { demo_mode: demoMode, honor_board_enabled: true } }));
  await page.route("**/api/v1/me", route => route.fulfill({
    json: {
      person_id: "00000000-0000-0000-0000-000000000001",
      display_name: "Тестовый участник",
      active_role: role,
      assigned_roles: [role],
      scopes: [],
      consent_scopes: [],
      navigation: sections,
      csrf_token: "role-navigation-e2e",
    },
  }));
  await page.route("**/api/v1/me/notifications", route => route.fulfill({ json: { items: [], unread: 0 } }));
  await page.route("**/api/v1/me/messaging/channels", route => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/messaging/contacts", route => route.fulfill({ json: [] }));
}

for (const [role, sections] of Object.entries(roleSections) as [ImpulseRole, readonly string[]][]) {
  test(`authorized role ${role}: all route indexes and grouped menu stay reachable`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await referenceRole(page, role, sections);
    await page.goto("/workspace/0");

    const trigger = page.getByRole("button", { name: "Меню", exact: true });
    await expect(trigger).toBeVisible();
    await trigger.click();
    const panel = page.getByRole("dialog", { name: "Главное меню" });
    await expect(panel).toBeVisible();

    // Even collapsed sections must stay in the DOM and retain exact server-approved indexes.
    const links = await panel.locator("nav a[href^='/workspace/']").evaluateAll(elements =>
      elements.map(element => ({
        text: element.textContent?.trim() ?? "",
        href: element.getAttribute("href"),
      })),
    );
    expect(links).toHaveLength(sections.length);
    expect(links.map(link => link.href)).toEqual(sections.map((_, index) => `/workspace/${String(index)}`));
    expect(links.map(link => link.text)).toEqual(sections);

    // Use the real disclosure instead of clicking a hidden item. This verifies
    // menu open → group expand → authorized route → menu close.
    const firstGroup = panel.locator(".calm-sidebar__group").first();
    if (await firstGroup.getAttribute("aria-expanded") !== "true") await firstGroup.click();
    await expect(panel.locator('a[href="/workspace/1"]')).toBeVisible();
    await panel.locator('a[href="/workspace/1"]').click();
    await expect(page).toHaveURL(/\/workspace\/1(?:\?.*)?$/);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".calm-sidebar")).toBeHidden();

    await trigger.click();
    await expect(panel.locator('a[href="/workspace/1"]')).toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(page.locator(".calm-sidebar")).toBeHidden();
  });
}

test("demo customer retains all nine distinct destinations on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await referenceRole(page, "customer", demoCustomerSections, true);
  await page.goto("/workspace/0");
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Главное меню" });
  await expect(panel).toBeVisible();
  const links = await panel.locator("nav a[href^='/workspace/']").evaluateAll(elements =>
    elements.map(element => ({ text: element.textContent?.trim(), href: element.getAttribute("href") })),
  );
  expect(links.map(link => link.text)).toEqual(demoCustomerSections);
  expect(links.map(link => link.href)).toEqual(demoCustomerSections.map((_, i) => `/workspace/${String(i)}`));
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Меню", exact: true })).toBeFocused();
});
