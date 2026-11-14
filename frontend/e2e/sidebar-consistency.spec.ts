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
  await page.addInitScript(() => localStorage.setItem("impulse-theme", "light"));
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

/** Compare navigation identity, never a transient expanded group state. */
async function sidebarSignature(page: Page) {
  return page.locator(".calm-sidebar").evaluate(sidebar => ({
    brand: sidebar.querySelector(".calm-sidebar__brand")?.textContent,
    sections: Array.from(sidebar.querySelectorAll(".calm-sidebar__home,.calm-sidebar__link"), link => ({
      label: link.textContent?.trim(),
      href: link.getAttribute("href"),
    })),
    groups: Array.from(sidebar.querySelectorAll(".calm-sidebar__group"), button =>
      button.textContent?.trim()),
    promotion: sidebar.querySelector(".sidebar-message"),
  }));
}

async function openNamedGroup(page: Page, label: string): Promise<void> {
  const group = page.locator(".calm-sidebar").getByRole("button", { name: label, exact: true });
  if (await group.getAttribute("aria-expanded") !== "true") await group.click();
  await expect(group).toHaveAttribute("aria-expanded", "true");
}

const sectionGroups: Readonly<Record<string, string>> = {
  "Аналитика": "Результаты",
  "Сообщения": "Сообщество",
};

for (const width of [960, 1024, 1448, 1672]) {
  test(`all permitted sections remain stable at ${String(width)}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 941 });
    await installReferenceSession(page);
    await page.goto("/workspace/0");
    const sidebar = page.getByRole("complementary", { name: "Боковая панель" });
    await expect(sidebar).toBeVisible();
    const expectedWidth = width <= 900 ? 210 : width <= 1200 ? 228 : 244;
    await expect(sidebar).toHaveCSS("width", `${String(expectedWidth)}px`);
    await expect(page.locator(".topbar")).toHaveCSS("left", `${String(expectedWidth)}px`);
    const initial = await sidebarSignature(page);
    expect(initial.sections).toHaveLength(13);
    expect(initial.sections.map(s => s.href)).toEqual(actor.navigation.map((_, i) => `/workspace/${String(i)}`));
    expect(initial.brand).toContain("Impulse");
    expect(initial.promotion).toBeNull();

    for (const [section, routeIndex] of [["Аналитика", 9], ["Сообщения", 10], ["Главная", 0]] as const) {
      if (sectionGroups[section]) await openNamedGroup(page, sectionGroups[section]);
      await sidebar.getByRole("link", { name: section, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/workspace/${String(routeIndex)}(?:[?]|$)`));
      await expect(sidebar.getByRole("link", { name: section, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(sidebar).toHaveCSS("width", `${String(expectedWidth)}px`);
      await expect(page.locator(".topbar")).toHaveCSS("left", `${String(expectedWidth)}px`);
      expect(await sidebarSignature(page)).toEqual(initial);
      const position = await sidebar.boundingBox();
      expect(position?.x).toBe(0);
      expect(position?.y).toBe(0);
      await page.screenshot({
        path: testInfo.outputPath(`sidebar-${section}-${String(width)}.png`),
        animations: "disabled",
      });
    }
    await openNamedGroup(page, "Результаты");
    const analytics = sidebar.getByRole("link", { name: "Аналитика", exact: true });
    await analytics.hover();
    await expect(sidebar).toHaveCSS("width", `${String(expectedWidth)}px`);
  });
}

test("390px drawer hides behind menu, traps Escape and preserves original routes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installReferenceSession(page);
  await page.goto("/workspace/0");
  const menu = page.getByRole("button", { name: "Меню", exact: true });
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  const sidebar = page.locator(".calm-sidebar");
  await expect(sidebar).not.toBeInViewport();
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("dialog", { name: "Главное меню" })).toBeInViewport();
  await expect(sidebar).toHaveCSS("width", "300px");
  const initial = await sidebarSignature(page);
  expect(initial.sections).toHaveLength(13);

  for (const [section, routeIndex] of [["Аналитика", 9], ["Сообщения", 10], ["Главная", 0]] as const) {
    if (sectionGroups[section]) await openNamedGroup(page, sectionGroups[section]);
    await sidebar.getByRole("link", { name: section, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/workspace/${String(routeIndex)}(?:[?]|$)`));
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(await sidebarSignature(page)).toEqual(initial);
    await menu.click();
    await expect(page.getByRole("dialog", { name: "Главное меню" })).toBeInViewport();
    await expect(sidebar.getByRole("link", { name: section, exact: true })).toHaveAttribute("aria-current", "page");
  }
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();
});
