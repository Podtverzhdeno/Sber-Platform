import { expect, test } from "@playwright/test";
import { installBootcampReferenceApi } from "./bootcamp-reference-fixtures";

test.beforeEach(async ({ page }) => { await installBootcampReferenceApi(page); });

/**
 * Forensic, read-only screenshot capture of all five BC-R01..BC-R05 screens
 * at 1448×1086. Captures against the actual app rendered in CI fixtures.
 * No golden approval and no production side effects.
 */
test("forensic Bootcamp five screens at 1448x1086", async ({ page }) => {
  await page.setViewportSize({ width: 1448, height: 1086 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Bootcamp" }).click();
  await expect(page.locator('[data-reference="BC-R01"]')).toBeVisible();
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await page.screenshot({ path: "test-results/forensic-bc-r01-cards.png", animations: "disabled" });

  const view = page.getByRole("group", { name: "Вид каталога" });
  await view.getByRole("button", { name: "Список" }).click();
  await expect(page.getByRole("list", { name: "Каталог Bootcamp списком" })).toBeVisible();
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await page.screenshot({ path: "test-results/forensic-bc-r02-list.png", animations: "disabled" });

  await view.getByRole("button", { name: "Карточки" }).click();
  const agentCourse = page.getByTestId("course-demo-course-2");
  await expect(agentCourse).toBeVisible();
  await agentCourse.getByRole("button", { name: /Открыть курс|Посмотреть курс/ }).click();
  await expect(page.getByRole("dialog", { name: "Информация о курсе" })).toBeVisible();
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await page.screenshot({ path: "test-results/forensic-bc-r03-course.png", animations: "disabled" });
  await page.getByRole("dialog", { name: "Информация о курсе" }).getByRole("button", { name: "Закрыть" }).click();

  await agentCourse.getByRole("button", { name: /Почему рекомендован/ }).click();
  await expect(page.getByRole("dialog", { name: "Почему рекомендован" })).toBeVisible();
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await page.screenshot({ path: "test-results/forensic-bc-r04-why.png", animations: "disabled" });
  await page.getByRole("dialog", { name: "Почему рекомендован" }).getByRole("button", { name: "Закрыть" }).click();

  await page.getByRole("button", { name: /Посмотреть курсы/ }).click();
  await expect(page.getByRole("dialog", { name: "Требования к обучению" })).toBeVisible();
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await page.screenshot({ path: "test-results/forensic-bc-r05-requirements.png", animations: "disabled" });
});
