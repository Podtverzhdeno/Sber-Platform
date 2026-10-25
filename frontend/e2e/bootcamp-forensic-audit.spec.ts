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


for (const viewport of [{ width: 1448, height: 1086 }, { width: 390, height: 844 }]) {
  test(`visual audit of immersive lesson reading at ${String(viewport.width)}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator('[data-persona="participant-alex"]').click();
    if (viewport.width < 1024) {
      await page.getByRole("button", { name: "Меню", exact: true }).click();
    }
    await page.getByRole("link", { name: "Bootcamp" }).click();
    const path = new URL(page.url()).pathname;
    await page.goto(`${path}?course=demo-course-2`);
    const dialog = page.getByRole("dialog", { name: "Информация о курсе" });
    await expect(dialog).toBeVisible();
    const launch = dialog.getByRole("button", { name: /Открыть уроки и практику/ });
    await expect(launch).toBeVisible();
    const background = await launch.evaluate(element => getComputedStyle(element).backgroundImage);
    expect(background).toContain("linear-gradient");
    await launch.hover();
    await expect.poll(() => launch.evaluate(element => getComputedStyle(element).transform))
      .not.toBe("none");
    await launch.click();
    const lesson = dialog.locator(".bc-learning__body");
    await expect(lesson).toBeVisible();
    // The CTA must actually reveal learning material, not leave it below the fold.
    await expect.poll(() => lesson.evaluate(element => element.getBoundingClientRect().top))
      .toBeLessThan(180);
    if (viewport.width < 800) {
      // Mobile should reveal real learning material, not only an eight-item plan.
      await expect.poll(() => dialog.locator(".bc-learning__lesson")
        .evaluate(element => element.getBoundingClientRect().top)).toBeLessThan(500);
    }
    await expect(dialog.getByRole("navigation", { name: "Шаги обучения" }).getByRole("button")).toHaveCount(8);
    const dimensions = await dialog.evaluate(element => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height,
        overflows: element.scrollWidth > element.clientWidth + 1 };
    });
    expect(dimensions).toEqual({
      x: 0, y: 0, width: viewport.width, height: viewport.height, overflows: false,
    });
    await dialog.screenshot({
      path: `test-results/forensic-lesson-${String(viewport.width)}-top.png`,
      animations: "disabled",
    });

    const next = dialog.getByRole("button", { name: "Следующий урок" });
    await next.scrollIntoViewIfNeeded();
    await expect(next).toBeEnabled();
    const nextBox = await next.boundingBox();
    expect(nextBox).not.toBeNull();
    if (nextBox) {
      expect(nextBox.x).toBeGreaterThanOrEqual(0);
      expect(nextBox.x + nextBox.width).toBeLessThanOrEqual(viewport.width + 1);
    }
    await dialog.screenshot({
      path: `test-results/forensic-lesson-${String(viewport.width)}-controls.png`,
      animations: "disabled",
    });
    await next.click();
    await expect(dialog.getByText(/Урок 2 из 8/)).toBeVisible();
  });
}
