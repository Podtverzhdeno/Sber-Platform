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

// The user's SDD: navigation is overlay-only at EVERY screen width.
for (const width of [960, 1024, 1448, 1672]) {
  test(`full-width work area and hidden drawer at ${String(width)}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 941 });
    await installReferenceSession(page);
    await page.goto("/workspace/0");

    const trigger = page.getByRole("button", { name: "Меню", exact: true });
    const sidebar = page.locator(".calm-sidebar");
    const content = page.locator(".workspace--apple .workspace-content");
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(sidebar).toBeHidden();
    await expect(page.locator(".topbar")).toHaveCSS("left", "0px");
    await expect(page.locator(".workspace--apple")).toHaveCSS("display", "block");
    const workRect = await content.boundingBox();
    expect(workRect).not.toBeNull();
    expect(workRect?.x).toBe(0);
    expect(workRect?.width ?? 0).toBeGreaterThanOrEqual(width - 35);

    await trigger.click();
    const menu = page.getByRole("dialog", { name: "Главное меню" });
    await expect(menu).toBeVisible();
    await expect(menu).toHaveCSS("width", "320px");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".calm-navigation__backdrop--open")).toHaveCSS("opacity", "1");
    const initial = await sidebarSignature(page);
    expect(initial.sections).toHaveLength(13);
    expect(initial.sections.map(item => item.href)).toEqual(
      actor.navigation.map((_, index) => `/workspace/${String(index)}`),
    );
    expect(initial.promotion).toBeNull();

    for (const [section, routeIndex] of [["Аналитика", 9], ["Сообщения", 10], ["Главная", 0]] as const) {
      if (sectionGroups[section]) await openNamedGroup(page, sectionGroups[section]);
      await menu.getByRole("link", { name: section, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/workspace/${String(routeIndex)}(?:[?]|$)`));
      await expect(sidebar).toBeHidden();
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(await sidebarSignature(page)).toEqual(initial);
      await trigger.click();
      await expect(menu).toBeVisible();
      await expect(menu.getByRole("link", { name: section, exact: true })).toHaveAttribute("aria-current", "page");
      await page.screenshot({
        path: testInfo.outputPath(`overlay-${section}-${String(width)}.png`),
        animations: "disabled",
      });
    }
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}

for (const width of [320, 390, 768]) {
  test(`drawer is accessible on a ${String(width)}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await installReferenceSession(page);
    await page.goto("/workspace/0");
    const trigger = page.getByRole("button", { name: "Меню", exact: true });
    const sidebar = page.locator(".calm-sidebar");
    await expect(trigger).toBeVisible();
    await expect(sidebar).toBeHidden();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Главное меню" });
    await expect(dialog).toBeVisible();
    await expect(sidebar).toHaveCSS("width", width === 320 ? "292px" : "320px");
    await expect(dialog.getByRole("button", { name: "Закрыть меню" })).toBeFocused();
    await openNamedGroup(page, "Результаты");
    await dialog.getByRole("link", { name: "Аналитика" }).click();
    await expect(page).toHaveURL(/\/workspace\/9(?:[?]|$)/);
    await expect(sidebar).toBeHidden();
    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Аналитика" })).toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    const backdrop = page.locator(".calm-navigation__backdrop--open");
    await expect(backdrop).toBeVisible();
    await backdrop.click({ position: { x: width - 12, y: 320 } });
    await expect(sidebar).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    );
    expect(horizontalOverflow).toBe(false);
  });
}

test("dark theme retains translucent menu without making the body unusable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installReferenceSession(page);
  await page.goto("/workspace/0");
  await page.getByRole("combobox", { name: "Тема оформления" }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const trigger = page.getByRole("button", { name: "Меню" });
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "Главное меню" });
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS("backdrop-filter", /blur/);
  await expect(page.locator(".workspace-content")).toHaveCSS("width", /[0-9]+px/);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});
