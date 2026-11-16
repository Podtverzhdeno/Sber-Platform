import { expect, test, type Page } from "@playwright/test";

const participantId = "ea5738ef-196d-4bfa-a58d-04488a219951";
const navigation = ["Главная", "Задачи", "Мои проекты", "Bootcamp", "Моя траектория", "Аналитика", "Портфолио", "Сообщения"];

async function openHelp(page: Page, mode: "blue" | "light" | "midnight") {
  await page.addInitScript((visualMode) => {
    localStorage.setItem("impulse-visual-mode", visualMode);
    localStorage.setItem("impulse-theme", visualMode === "light" ? "light" : "dark");
  }, mode);
  await page.route("**/api/v1/**", (route) => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: { demo_mode: false } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [
    { key: "participant-guide", display_name: "Участник", roles: ["participant"] },
  ] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: {} }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: {
    person_id: participantId, display_name: "Участник", active_role: "participant",
    assigned_roles: ["participant"], scopes: [], consent_scopes: [], navigation, csrf_token: "csrf",
  } }));
  await page.goto("/");
  await page.locator('[data-persona="participant-guide"]').click();
  await page.getByRole("button", { name: "Меню профиля" }).click();
  await page.getByRole("menuitem", { name: "Помощь" }).click();
  await expect(page.getByRole("dialog", { name: "Центр помощи" })).toBeVisible();
}

for (const { width, mode } of [
  { width: 320, mode: "blue" as const },
  { width: 390, mode: "light" as const },
  { width: 570, mode: "midnight" as const },
  { width: 768, mode: "blue" as const },
  { width: 1440, mode: "light" as const },
]) {
  test(`help center keeps categories reachable without clipping at ${String(width)}px (${mode})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openHelp(page, mode);
    const dialog = page.getByRole("dialog", { name: "Центр помощи" });
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(width + 1);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    const picker = dialog.getByRole("combobox", { name: "Раздел помощи" });
    if (width <= 600) {
      await expect(picker).toBeVisible();
      await expect(dialog.locator(".pg-help-sidebar")).toBeHidden();
      const chooser = await picker.boundingBox();
      expect(chooser?.height).toBeGreaterThanOrEqual(44);
      expect(chooser?.x).toBeGreaterThanOrEqual(0);
      expect((chooser?.x ?? 0) + (chooser?.width ?? 0)).toBeLessThanOrEqual(width + 1);
      const close = await dialog.getByRole("button", { name: "Закрыть центр помощи" }).boundingBox();
      expect(close?.width).toBeGreaterThanOrEqual(44);
      expect(close?.height).toBeGreaterThanOrEqual(44);
      await picker.selectOption("all");
      await expect(dialog.getByRole("heading", { name: "Найди нужную инструкцию" })).toBeVisible();
      await picker.selectOption("related");
      await expect(dialog.getByRole("heading", { name: "Помощь: Главная" })).toBeVisible();
      await expect(dialog.getByRole("textbox", { name: "Поиск по инструкциям" })).toHaveCSS("font-size", "16px");
    } else {
      await expect(picker).toBeHidden();
      await expect(dialog.locator(".pg-help-sidebar")).toBeVisible();
      await expect(dialog.getByRole("button", { name: /Все инструкции/ })).toBeVisible();
    }
    await dialog.getByRole("button", { name: "Закрыть центр помощи" }).click();
    await expect(dialog).toHaveCount(0);
  });
}
