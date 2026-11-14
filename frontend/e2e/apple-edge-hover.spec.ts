import { expect, test, type Page } from "@playwright/test";

async function openParticipant(page: Page) {
  const sections = ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Сообщения"];
  await page.addInitScript(() => { window.localStorage.setItem("impulse-theme", "light"); });
  await page.route("**/api/v1/config", route => route.fulfill({ json: { demo_mode: false } }));
  await page.route("**/api/v1/me", route => route.fulfill({
    json: {
      person_id: "00000000-0000-0000-0000-000000000001",
      display_name: "Тестовый участник",
      active_role: "participant",
      assigned_roles: ["participant"],
      scopes: [],
      consent_scopes: [],
      navigation: sections,
      csrf_token: "quiet-nav-test",
    },
  }));
  await page.route("**/api/v1/me/notifications", route => route.fulfill({ json: { items: [], unread: 0 } }));
  await page.goto("/workspace/0");
}

test("desktop edge reveals real links without moving content or creating modal scrim", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openParticipant(page);
  const edge = page.getByRole("button", { name: "Показать навигацию" });
  const aside = page.locator(".calm-sidebar");
  const content = page.locator(".workspace-content");
  await expect(edge).toBeVisible();
  await expect(aside).toBeHidden();
  const before = await content.boundingBox();
  await page.mouse.move(5, 170);
  await expect(aside).toBeVisible();
  await expect(aside).toHaveClass(/calm-sidebar--hover/);
  await expect(page.getByRole("dialog", { name: "Главное меню" })).toHaveCount(0);
  await expect(page.locator(".calm-navigation__backdrop")).not.toHaveClass(/calm-navigation__backdrop--open/);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  const during = await content.boundingBox();
  expect(during?.x).toBe(before?.x);
  expect(during?.width).toBe(before?.width);
  // Navigation still contains exactly the permitted server destinations.
  await expect(aside.locator('a[href^="/workspace/"]')).toHaveCount(5);
  await page.mouse.move(750, 500);
  await expect(aside).toBeHidden();
});

test("mobile has no pointer hotspot but explicit Menu remains accessible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openParticipant(page);
  await expect(page.getByRole("button", { name: "Показать навигацию" })).toBeHidden();
  const menu = page.getByRole("button", { name: "Меню", exact: true });
  await menu.click();
  await expect(page.getByRole("dialog", { name: "Главное меню" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(page.locator(".calm-sidebar")).toBeHidden();
});
