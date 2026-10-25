import { expect, test } from "@playwright/test";
import { installBootcampReferenceApi } from "./bootcamp-reference-fixtures";

test.beforeEach(async ({ page }) => { await installBootcampReferenceApi(page); });

test("all twelve Bootcamp AI courses expose eight substantive lessons and four interactive learning tabs", async ({ page }) => {
  await page.setViewportSize({ width: 1448, height: 1086 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Bootcamp" }).click();
  const bootcampPath = new URL(page.url()).pathname;

  for (let index = 1; index <= 12; index++) {
    const key = "demo-course-" + String(index);
    await page.goto(bootcampPath + "?course=" + key);
    const dialog = page.getByRole("dialog", { name: "Информация о курсе" });
    const reader = dialog.getByTestId("impulse-immersive-reader");
    await expect(reader).toBeVisible();
    const outline = reader.locator(".imp-study__program-list button");
    await expect(outline).toHaveCount(8);
    if (index === 10) continue; // Prerequisite-locked provider course: no unauthorized lesson entry.
    await outline.first().click();
    await expect(reader.getByRole("navigation", { name: "Разделы урока" }).getByRole("button")).toHaveCount(4);
    for (const label of ["Теория", "Пример", "Практическое задание", "Самопроверка"]) {
      const button = reader.getByRole("navigation", { name: "Разделы урока" }).getByRole("button", { name: label });
      await button.click();
      await expect(button).toHaveAttribute("aria-current", "page");
    }
    await reader.getByRole("button", { name: "Показать ожидаемый результат" }).click();
    await expect(reader.getByRole("button", { name: "Скрыть ожидаемый результат" })).toBeVisible();
    await reader.getByRole("button", { name: "Следующий урок" }).click();
    await expect(reader.locator(".imp-study__lesson-heading .imp-study__eyebrow")).toContainText("Урок 2 из 8");
  }
});

test("mobile interactive reader has no horizontal overflow and reaches its lesson content", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await page.getByRole("link", { name: "Bootcamp" }).click();
  const path = new URL(page.url()).pathname;
  await page.goto(path + "?course=demo-course-3");
  const dialog = page.getByRole("dialog", { name: "Информация о курсе" });
  const reader = dialog.getByTestId("impulse-immersive-reader");
  await reader.locator(".imp-study__program-list button").first().click();
  await expect(reader.locator(".imp-study__content")).toBeVisible();
  const overflow = await dialog.evaluate(node => node.scrollWidth > node.clientWidth + 1);
  expect(overflow).toBe(false);
});
