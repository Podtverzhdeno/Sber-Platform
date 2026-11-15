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
  await page.addInitScript(() => { localStorage.setItem("impulse-theme", "light"); });
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
      label: link.textContent.trim(),
      href: link.getAttribute("href"),
    })),
    groups: Array.from(sidebar.querySelectorAll(".calm-sidebar__group"), button =>
      button.textContent.trim()),
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

    const trigger = page.getByRole("button", { name: "Impulse — открыть разделы", exact: true });
    const sidebar = page.locator(".calm-sidebar");
    const content = page.locator(".workspace--apple .workspace-content");
    await expect(trigger).toBeVisible();
    await expect(page.locator(".calm-navigation__mobile-trigger")).toBeHidden();
    await expect(page.locator(".calm-navigation__mobile-trigger")).toHaveAttribute("aria-expanded", "false");
    await expect(sidebar).toBeHidden();
    const floatingHeader = await page.locator(".topbar").boundingBox();
    expect(floatingHeader?.height).toBe(62);
    expect(floatingHeader?.x).toBeGreaterThanOrEqual(20);
    await expect(page.locator(".workspace--apple")).toHaveCSS("display", "block");
    const workRect = await content.boundingBox();
    expect(workRect).not.toBeNull();
    expect(workRect?.x).toBe(0);
    expect(workRect?.width ?? 0).toBeGreaterThanOrEqual(width - 35);

    await trigger.click();
    const menu = page.getByRole("dialog", { name: "Главное меню" });
    await expect(menu).toBeVisible();
    await expect(menu).toHaveCSS("width", "320px");
    await expect(page.locator(".calm-navigation__mobile-trigger")).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".calm-navigation__backdrop--open")).toHaveCSS("opacity", "1");
    const initial = await sidebarSignature(page);
    expect(initial.sections).toHaveLength(13);
    // Grouped navigation can reorder sections while preserving every authorized route.
    expect(initial.sections.map(item => item.href).sort()).toEqual(
      actor.navigation.map((_, index) => `/workspace/${String(index)}`).sort(),
    );
    expect(initial.promotion).toBeNull();

    for (const [section, routeIndex] of [["Аналитика", 9], ["Сообщения", 10], ["Главная", 0]] as const) {
      if (sectionGroups[section]) await openNamedGroup(page, sectionGroups[section]);
      await menu.getByRole("link", { name: section, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/workspace/${String(routeIndex)}(?:[?]|$)`));
      await expect(sidebar).toBeHidden();
      await expect(page.locator(".calm-navigation__mobile-trigger")).toHaveAttribute("aria-expanded", "false");
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
    const trigger = page.getByRole("button", { name: "Impulse — открыть разделы", exact: true });
    const sidebar = page.locator(".calm-sidebar");
    await expect(trigger).toBeVisible();
    await expect(page.locator(".calm-navigation__mobile-trigger")).toBeHidden();
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
    // Use the actually clickable strip outside the drawer, not width - 12.
    // On Chrome mobile emulation the last 15px can be the scrollbar, which
    // Playwright reports as <html> intercepting pointer events.
    const hit = await page.evaluate(() => {
      const clientRight = document.documentElement.clientWidth;
      const drawer = document.querySelector(".calm-sidebar")?.getBoundingClientRect();
      if (!drawer) return { x: 0, hitBackdrop: false, gap: 0 };
      const gap = clientRight - drawer.right;
      const x = drawer.right + Math.min(6, gap / 2);
      const target = document.elementFromPoint(x, 320);
      return {
        x,
        gap,
        hitBackdrop: target?.classList.contains("calm-navigation__backdrop--open") ?? false,
      };
    });
    expect(hit.gap).toBeGreaterThan(4);
    expect(hit.hitBackdrop).toBe(true);
    await page.mouse.click(hit.x, 320);
    await expect(sidebar).toBeHidden();
    await expect(page.locator(".calm-navigation__mobile-trigger")).toHaveAttribute("aria-expanded", "false");
    const overflowReport = await page.evaluate(() => {
      const viewport = document.documentElement.clientWidth;
      return {
        viewport,
        scrollWidth: document.documentElement.scrollWidth,
        offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
          .filter(element => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.right > viewport + 2 &&
              style.display !== "none" && style.visibility !== "hidden" &&
              style.position !== "fixed";
          })
          .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)
          .slice(0, 12)
          .map(element => ({
            tag: element.tagName,
            className: typeof element.className === "string" ? element.className.slice(0, 110) : "",
            right: Math.round(element.getBoundingClientRect().right),
            width: Math.round(element.getBoundingClientRect().width),
            scrollWidth: element.scrollWidth,
          })),
      };
    });
    console.log("OWNER_MOBILE_OVERFLOW_DIAGNOSTIC", JSON.stringify(overflowReport));
    expect(overflowReport.scrollWidth, JSON.stringify(overflowReport)).toBeLessThanOrEqual(overflowReport.viewport + 2);
  });
}

test("dark theme retains translucent menu without making the body unusable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installReferenceSession(page);
  await page.goto("/workspace/0");
  await page.getByRole("button", { name: /Тема: солнце/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const trigger = page.getByRole("button", { name: "Impulse — открыть разделы", exact: true });
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "Главное меню" });
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS("backdrop-filter", /blur/);
  await expect(page.locator(".workspace-content")).toHaveCSS("width", /[0-9]+px/);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("reduced motion makes menu instant without entrance animations", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installReferenceSession(page);
  await page.goto("/workspace/0");
  const trigger = page.getByRole("button", { name: "Impulse — открыть разделы", exact: true });
  const panel = page.locator(".calm-sidebar");
  await expect(panel).toBeHidden();
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Главное меню" })).toBeVisible();
  await expect(panel).toHaveCSS("transition-duration", "0s");
  await expect(panel.locator(".calm-sidebar__header")).toHaveCSS("animation-name", "none");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("forced colors retains an opaque readable navigation pane", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.emulateMedia({ forcedColors: "active" });
  await installReferenceSession(page);
  await page.goto("/workspace/0");
  await page.getByRole("button", { name: "Impulse — открыть разделы", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Главное меню" });
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS("backdrop-filter", "none");
  await expect(panel).toHaveCSS("box-shadow", "none");
  await expect(panel).toHaveCSS("border-top-style", "solid");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});
