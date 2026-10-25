import { expect, test } from "@playwright/test";
import { installBootcampReferenceApi } from "./bootcamp-reference-fixtures";

test.beforeEach(async ({ page }) => { await installBootcampReferenceApi(page); });

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`next and previous lesson return to the new lesson's beginning at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator('[data-persona="participant-alex"]').click();
    if (viewport.width < 1024) await page.getByRole("button", { name: "Меню", exact: true }).click();
    await page.getByRole("link", { name: "Bootcamp" }).click();
    const path = new URL(page.url()).pathname;
    await page.goto(path + "?course=demo-course-1");

    const dialog = page.getByRole("dialog", { name: "Информация о курсе" });
    const reader = dialog.getByTestId("impulse-immersive-reader");
    await reader.getByRole("button", { name: /Перейти к программе/ }).click();
    await reader.locator(".imp-study__program-list button").first().click();

    const verifyLessonTop = async () => {
      await expect.poll(async () => dialog.evaluate((node) => {
        const main = node.querySelector(".imp-study__main");
        const header = node.querySelector(":scope > header");
        if (!main || !header) return 9999;
        return Math.abs(main.getBoundingClientRect().top - header.getBoundingClientRect().bottom - 12);
      })).toBeLessThan(20);
    };

    await dialog.evaluate((node) => { node.scrollTop = node.scrollHeight; });
    await reader.getByRole("button", { name: "Следующий урок" }).click();
    await expect(reader.locator(".imp-study__lesson-list button").nth(1)).toHaveAttribute("aria-current", "step");
    await verifyLessonTop();

    await dialog.evaluate((node) => { node.scrollTop = node.scrollHeight; });
    await reader.getByRole("button", { name: "Предыдущий урок" }).click();
    await expect(reader.locator(".imp-study__lesson-list button").first()).toHaveAttribute("aria-current", "step");
    await verifyLessonTop();
  });
}
