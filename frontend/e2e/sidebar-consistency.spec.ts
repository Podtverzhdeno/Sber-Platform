import { expect, test, type Page } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: [
    "Главная", "Моя траектория", "Bootcamp", "Задачи", "Мои проекты",
    "События", "Рейтинг", "Портфолио", "Достижения", "Аналитика",
    "Сообщения", "AI-Buddy", "Настройки",
  ],
  csrf_token: "sidebar-consistency",
};

async function installReferenceSession(page: Page): Promise<void> {
  await page.route("**/api/v1/config", route =>
    route.fulfill({ json: { demo_mode: true, honor_board_enabled: true } }));
  await page.route("**/api/v1/me", route => route.fulfill({ json: actor }));
  await page.route("**/api/v1/me/notifications", route =>
    route.fulfill({ json: { items: [], unread: 0 } }));
  await page.route("**/api/v1/me/messaging/channels", route =>
    route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/messaging/contacts", route =>
    route.fulfill({ json: [] }));
}

async function sidebarSignature(page: Page) {
  return page.locator(".sidebar").evaluate(sidebar => ({
    brand: sidebar.querySelector(".sidebar-brand")?.innerHTML,
    links: Array.from(sidebar.querySelectorAll("nav a"), link => ({
      label: link.textContent?.trim(),
      icon: link.querySelector(".nav-icon")?.innerHTML,
    })),
    promotion: sidebar.querySelector(".sidebar-message")?.innerHTML,
  }));
}

for (const width of [1024, 1448, 1672]) {
  test(`shared sidebar stays identical at ${String(width)}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 941 });
    await installReferenceSession(page);
    await page.goto("/workspace/0");
    const sidebar = page.getByRole("complementary", { name: "Боковая панель" });
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveCSS("width", "244px");
    await expect(page.locator(".topbar")).toHaveCSS("left", "244px");
    const initial = await sidebarSignature(page);
    expect(initial.links.length).toBe(13);
    expect(initial.brand).toContain("Impulse");
    expect(initial.promotion).toContain("Развиваем технологии вместе");

    for (const [section, path] of [["Аналитика", "9"], ["Сообщения", "10"], ["Главная", "0"]] as const) {
      await sidebar.getByRole("link", { name: section, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/workspace/${path}(?:[?]|$)`));
      await expect(sidebar.getByRole("link", { name: section, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(sidebar).toHaveCSS("width", "244px");
      await expect(page.locator(".topbar")).toHaveCSS("left", "244px");
      expect(await sidebarSignature(page)).toEqual(initial);
      const first = await sidebar.boundingBox();
      expect(first?.x).toBe(0);
      expect(first?.y).toBe(0);
      await page.screenshot({
        path: testInfo.outputPath(`sidebar-${section}-${String(width)}.png`),
        animations: "disabled",
      });
    }
    // Hover styling remains visible and must not alter the shared geometry.
    const analytics = sidebar.getByRole("link", { name: "Аналитика", exact: true });
    await analytics.hover();
    await expect(sidebar).toHaveCSS("width", "244px");
    await expect(page.getByRole("button", { name: "Свернуть навигацию" })).toHaveCount(0);
  });
}

for (const width of [390, 960]) {
  test(`mobile sidebar opens and closes consistently at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await installReferenceSession(page);
    await page.goto("/workspace/0");
    const sidebar = page.getByRole("complementary", { name: "Боковая панель" });
    const menu = page.getByRole("button", { name: /Меню/ });
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(sidebar).toBeInViewport();
    await expect(sidebar).toHaveCSS("width", "244px");
    const first = await sidebarSignature(page);
    for (const section of ["Аналитика", "Сообщения", "Главная"]) {
      await sidebar.getByRole("link", { name: section, exact: true }).click();
      await expect(sidebar.getByRole("link", { name: section, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await menu.click();
      await expect(sidebar).toBeInViewport();
      expect(await sidebarSignature(page)).toEqual(first);
    }
  });
}
