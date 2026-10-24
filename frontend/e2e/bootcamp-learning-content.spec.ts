import { expect, test } from "@playwright/test";

test("all twelve Bootcamp courses open four real lessons with working navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1448, height: 1086 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Bootcamp" }).click();
  const bootcampPath = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { name: /Bootcamp/ })).toBeVisible();

  for (let index = 1; index <= 12; index++) {
    const key = `demo-course-${String(index)}`;
    await page.goto(`${bootcampPath}?course=${encodeURIComponent(key)}`);
    const drawer = page.getByRole("dialog", { name: "Информация о курсе" });
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: /Открыть уроки и практику/ }).click();
    await expect(drawer.locator(`.bc-learning[data-course-key="${key}"]`)).toBeVisible();
    const outline = drawer.getByRole("navigation", { name: "Шаги обучения" });
    await expect(outline.getByRole("button")).toHaveCount(4);
    await drawer.getByRole("button", { name: "Следующий урок" }).click();
    await expect(drawer.getByText("Урок 2 из 4")).toBeVisible();
    await drawer.getByRole("button", { name: "Показать ожидаемый результат" }).click();
    await expect(drawer.getByRole("button", { name: "Скрыть ожидаемый результат" })).toBeVisible();
    await expect(drawer.getByText(/не начисляют XP/)).toBeVisible();
  }
});

test("Bootcamp mobile lesson reader fits the viewport and keeps navigation operable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await page.getByRole("link", { name: "Bootcamp" }).click();
  const bootcampPath = new URL(page.url()).pathname;
  await page.goto(`${bootcampPath}?course=demo-course-3`);
  const drawer = page.getByRole("dialog", { name: "Информация о курсе" });
  await drawer.getByRole("button", { name: /Открыть уроки и практику/ }).click();
  await expect(drawer.getByRole("heading", { name: "Типы и выражения" })).toBeVisible();
  await drawer.getByRole("button", { name: "Следующий урок" }).click();
  await expect(drawer.getByRole("heading", { name: "Условия и циклы" })).toBeVisible();
  const reader = drawer.locator(".bc-learning");
  const overflow = await reader.evaluate(element => element.scrollWidth > element.clientWidth + 1);
  expect(overflow).toBe(false);
  await test.info().attach("bootcamp-course-python-mobile-lesson2", {
    body: await page.screenshot({ animations: "disabled" }),
    contentType: "image/png",
  });
});
