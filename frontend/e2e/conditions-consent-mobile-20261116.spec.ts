import { expect, test, type Page } from "@playwright/test";
import { catalogItem, catalogPage, catalogTerms } from "../src/features/task-catalog-v2/fixture";

const participant = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Синтетический участник",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Мой путь", "Задачи", "Мои проекты"],
  csrf_token: "mobile-consent-qa",
};

async function openTerms(page: Page, theme: "light" | "dark") {
  await page.addInitScript((selected: string) => {
    localStorage.setItem("impulse-theme", selected);
    localStorage.setItem("impulse-visual-mode", selected === "light" ? "light" : "midnight");
  }, theme);
  await page.route("**/api/v1/me/**", route =>
    route.fulfill({ status: 404, json: { code: "NOT_MOCKED" } }));
  await page.route("**/api/v1/config", route =>
    route.fulfill({ json: { task_catalog_v2_enabled: true, demo_mode: true } }));
  await page.route("**/api/v1/auth/personas", route =>
    route.fulfill({ json: [{ key: "participant-synthetic", display_name: participant.display_name, roles: ["participant"] }] }));
  await page.route("**/api/v1/me", route =>
    route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => route.fulfill({ json: participant }));
  await page.route("**/api/v1/me/task-recommendations?*", route =>
    route.fulfill({ json: catalogPage([catalogItem]) }));
  await page.route(`**/api/v1/me/task-recommendations/${catalogItem.task_id}`, route =>
    route.fulfill({ json: catalogItem }));
  await page.route(`**/api/v1/me/task-recommendations/${catalogItem.task_id}/terms`, route =>
    route.fulfill({ json: catalogTerms }));
  await page.route("**/api/v1/me/task-recommendations/analytics/events", route =>
    route.fulfill({ status: 202, json: { event_id: "00000000-0000-0000-0000-000000000902", duplicate: false } }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-persona="participant-synthetic"]').click();
  await page.getByRole("button", { name: "Impulse — открыть разделы" }).click();
  const navigation = page.getByRole("dialog", { name: "Главное меню" });
  const practice = navigation.getByRole("button", { name: "Практика", exact: true });
  if (await practice.getAttribute("aria-expanded") !== "true") await practice.click();
  await navigation.getByRole("link", { name: "Задачи", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Задачи для твоего развития" })).toBeVisible();
  await page.getByRole("button", { name: "Карточки" }).click();
  const card = page.locator(".catalog-v2-card").first();
  await card.hover();
  await card.getByRole("button", { name: "Условия и отклик" }).click();
  const dialog = page.getByRole("dialog", { name: "Условия участия" });
  await expect(dialog.getByRole("checkbox")).toBeVisible();
  return dialog;
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 390, 768]) {
    test(`task consent copy aligns with checkbox at ${String(width)}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 760 });
      const dialog = await openTerms(page, theme);
      const label = dialog.locator(".catalog-v2-consent > label");
      const checkbox = label.getByRole("checkbox");
      const text = label.locator(".catalog-v2-consent-copy");

      await label.scrollIntoViewIfNeeded();
      await expect(label).toBeVisible();
      await expect(text).toContainText("подтверждаю их перед откликом");
      const box = await checkbox.boundingBox();
      const copy = await text.boundingBox();
      const hit = await label.boundingBox();
      expect(box).not.toBeNull();
      expect(copy).not.toBeNull();
      expect(hit).not.toBeNull();
      if (!box || !copy || !hit) return;

      // Text and native control must share one center even when text wraps.
      expect(Math.abs(box.y + box.height / 2 - (copy.y + copy.height / 2))).toBeLessThanOrEqual(2);
      expect(copy.x).toBeGreaterThanOrEqual(box.x + box.width + 8);
      expect(hit.height).toBeGreaterThanOrEqual(43);
      expect(hit.x).toBeGreaterThanOrEqual(0);
      expect(hit.x + hit.width).toBeLessThanOrEqual(width + 1);

      const submit = dialog.getByRole("button", { name: "Подтвердить и отправить отклик" });
      await expect(submit).toBeDisabled();
      await label.click();
      await expect(checkbox).toBeChecked();
      await expect(submit).toBeEnabled();
      await label.click();
      await expect(checkbox).not.toBeChecked();
      await expect(submit).toBeDisabled();
      expect(await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    });
  }
}
