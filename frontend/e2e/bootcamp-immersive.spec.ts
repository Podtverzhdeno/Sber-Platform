import { expect, test } from "@playwright/test";
import { installBootcampReferenceApi } from "./bootcamp-reference-fixtures";

test.beforeEach(async ({ page }) => { await installBootcampReferenceApi(page); });

for (const viewport of [{ width: 1672, height: 941 }, { width: 390, height: 844 }]) {
  test("ten course states, real buttons, percent, certificate and hover at " + viewport.width, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator('[data-persona="participant-alex"]').click();
    if (viewport.width < 1024) await page.getByRole("button", { name: "Меню", exact: true }).click();
    await page.getByRole("link", { name: "Bootcamp" }).click();
    const bootcampPath = new URL(page.url()).pathname;
    await page.goto(bootcampPath + "?course=demo-course-1");
    const dialog = page.getByRole("dialog", { name: "Информация о курсе" });
    const reader = dialog.getByTestId("impulse-immersive-reader");
    await expect(reader).toBeVisible();
    await expect(reader.getByRole("heading", { name: "Программа курса" })).toBeVisible();
    await page.screenshot({ path: "test-results/imp-01-program-" + viewport.width + ".png", animations: "disabled" });

    const mainCta = reader.getByRole("button", { name: /Перейти к программе/ });
    await mainCta.hover();
    await expect.poll(() => mainCta.evaluate(element => getComputedStyle(element).filter))
      .not.toBe("none");

    await reader.getByRole("button", { name: "Почему рекомендован" }).click();
    await expect(page.getByRole("dialog", { name: "Почему рекомендован" })).toBeVisible();
    await page.screenshot({ path: "test-results/imp-02-recommendation-" + viewport.width + ".png", animations: "disabled" });
    await page.getByRole("dialog", { name: "Почему рекомендован" })
      .getByRole("button", { name: /Открыть курс|Вернуться/ }).click();
    await expect(reader).toBeVisible();

    await reader.locator(".imp-study__program-list button").first().click();
    for (const state of ["theory","example","practice","check"]) {
      const tab = reader.locator(".imp-study__tabs button").filter({ has: page.locator("svg") }).nth(
        ["theory","example","practice","check"].indexOf(state)
      );
      await tab.click();
      await expect(tab).toHaveAttribute("aria-current", "page");
      await page.screenshot({ path: "test-results/imp-03-" + state + "-" + viewport.width + ".png", animations: "disabled" });
    }
    const check = reader.locator(".imp-study__check-grid button").first();
    await check.click();
    await expect(check).toHaveAttribute("aria-pressed", "true");
    await reader.getByRole("button", { name: "Следующий урок" }).click();
    await expect(reader.getByText("13%", { exact: true }).first()).toBeVisible();
    await expect(reader.locator(".imp-study__lesson-list button").nth(1)).toHaveAttribute("aria-current", "step");
    await page.screenshot({ path: "test-results/imp-04-progress-" + viewport.width + ".png", animations: "disabled" });
    for (let index = 1; index < 8; index++) {
      await reader.getByRole("button", { name: index === 7 ? "Завершить обучение" : "Следующий урок" }).last().click();
    }
    await expect(reader.getByText("100%", { exact: true }).first()).toBeVisible();
    await expect(reader.getByRole("heading", { name: "Завершение обучения" })).toBeVisible();
    await page.screenshot({ path: "test-results/imp-05-finish-" + viewport.width + ".png", animations: "disabled" });
    await reader.locator(".imp-study__finish").click();
    await expect(reader.getByRole("heading", { name: "Обучение завершено!" })).toBeVisible();
    await page.screenshot({ path: "test-results/imp-06-success-" + viewport.width + ".png", animations: "disabled" });
    await reader.getByRole("button", { name: /Посмотреть два сертификата/ }).click();
    await expect(reader.getByRole("heading", { name: "Ваши сертификаты" })).toBeVisible();
    await expect(reader.getByText("Выдан автоматически")).toBeVisible();
    await expect(reader.getByText("Требуется проверка практики")).toBeVisible();
    await page.screenshot({ path: "test-results/imp-07-certificates-" + viewport.width + ".png", animations: "disabled" });
    const overflow = await dialog.evaluate(el => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
  });
}
