import { expect, test } from "@playwright/test";
import { installBootcampReferenceApi } from "./bootcamp-reference-fixtures";

test.beforeEach(async ({ page }) => { await installBootcampReferenceApi(page); });

for (const viewport of [{ width: 1672, height: 941 }, { width: 390, height: 844 }]) {
  test("ten course states, real buttons, percent, certificate and hover at " + String(viewport.width), async ({ page }) => {
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
    await expect(reader).toHaveAttribute("data-view", "overview");
    await expect(reader.getByText("Программа курса", { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: "test-results/imp-01-program-" + String(viewport.width) + ".png", animations: "disabled" });

    const mainCta = reader.getByRole("button", { name: /Перейти к программе/ });
    await mainCta.hover();
    await expect.poll(() => mainCta.evaluate(element => getComputedStyle(element).filter))
      .not.toBe("none");

    await reader.getByRole("button", { name: "Почему рекомендован" }).click();
    await expect(page.getByRole("dialog", { name: "Почему рекомендован" })).toBeVisible();
    await page.screenshot({ path: "test-results/imp-02-recommendation-" + String(viewport.width) + ".png", animations: "disabled" });
    await page.getByRole("dialog", { name: "Почему рекомендован" })
      .getByRole("button", { name: /Открыть курс|Вернуться/ }).click();
    await expect(reader).toBeVisible();

    await reader.getByRole("button", { name: /Перейти к программе/ }).click();
    await expect(reader).toHaveAttribute("data-view", "program");
    await reader.locator(".imp-study__program-list button").first().click();
    for (const state of ["theory","example","practice","check"]) {
      const tab = reader.locator(".imp-study__tabs button").filter({ has: page.locator("svg") }).nth(
        ["theory","example","practice","check"].indexOf(state)
      );
      await tab.click();
      await expect(tab).toHaveAttribute("aria-current", "page");
      await page.screenshot({ path: "test-results/imp-03-" + state + "-" + String(viewport.width) + ".png", animations: "disabled" });
    }
    const check = reader.locator(".imp-study__check-grid button").first();
    await check.click();
    await expect(check).toHaveAttribute("aria-pressed", "true");
    await reader.getByRole("button", { name: "Следующий урок" }).click();
    await expect(reader.locator(".imp-study__aside-heading > span")).toHaveText("13%");
    await expect(reader.locator(".imp-study__lesson-list button").nth(1)).toHaveAttribute("aria-current", "step");
    await page.screenshot({ path: "test-results/imp-04-progress-" + String(viewport.width) + ".png", animations: "disabled" });
    for (let index = 1; index < 8; index++) {
      await reader.locator(".imp-study__navigation .imp-study__primary").click();
    }
    await expect(reader.locator(".imp-study__aside-heading > span")).toHaveText("100%");
    await expect(reader.getByRole("heading", { name: "Завершение обучения" })).toBeVisible();
    await page.screenshot({ path: "test-results/imp-05-finish-" + String(viewport.width) + ".png", animations: "disabled" });
    await reader.locator(".imp-study__finish").click();
    await expect(reader.getByRole("heading", { name: "Обучение завершено!" })).toBeVisible();
    await page.screenshot({ path: "test-results/imp-06-success-" + String(viewport.width) + ".png", animations: "disabled" });
    await reader.getByRole("button", { name: /Посмотреть два сертификата/ }).click();
    await expect(reader.getByRole("heading", { name: "Ваши сертификаты" })).toBeVisible();
    await expect(reader.getByText("Выдан автоматически")).toBeVisible();
    await expect(reader.getByText("Требуется проверка практики")).toBeVisible();
    await page.screenshot({ path: "test-results/imp-07-certificates-" + String(viewport.width) + ".png", animations: "disabled" });
    await reader.getByRole("button", { name: /Перейти к практике/ }).click();
    await reader.getByLabel("Опишите, что сделали и как проверили результат").fill(
      "Выполнил практическое задание: создал тестовый сценарий и проверил основное поведение, " +
      "обработку ошибок и негативные случаи. Добавил результаты проверки."
    );
    await reader.getByRole("button", { name: /Отправить на проверку/ }).click();
    await expect(reader.getByText(/Практическая работа получена/)).toBeVisible();
    await page.screenshot({ path: "test-results/imp-08-practice-pending-" + viewport.width + ".png", animations: "disabled" });
    const overflow = await dialog.evaluate(el => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
  });
}


test("data-security reference: theory methods, JWT example, practice requirements and checklist", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Bootcamp" }).click();
  const path = new URL(page.url()).pathname;
  await page.goto(path + "?course=demo-course-10");
  const reader = page.getByTestId("impulse-immersive-reader");
  await expect(reader).toBeVisible();
  await reader.getByRole("button", { name: /Перейти к программе/ }).click();
  await reader.locator(".imp-study__program-list button").first().click();
  await reader.locator(".imp-study__navigation .imp-study__primary").click();
  await expect(reader.locator(".imp-study__lesson-heading")).toContainText("Аутентификация и авторизация");
  await expect(reader.locator(".imp-study__method-card")).toHaveCount(4);
  await page.screenshot({ path: "test-results/reference-security-04-theory.png", animations: "disabled" });
  await reader.getByRole("button", { name: "Пример", exact: true }).click();
  await expect(reader.locator(".imp-study__walkthrough article")).toHaveCount(4);
  await expect(reader.locator(".imp-study__code")).toContainText('JWT_SECRET');
  await page.screenshot({ path: "test-results/reference-security-05-example.png", animations: "disabled" });
  await reader.getByRole("button", { name: "Практическое задание", exact: true }).click();
  await expect(reader.locator(".imp-study__practice-columns .imp-study__requirement")).toHaveCount(8);
  await page.screenshot({ path: "test-results/reference-security-06-practice.png", animations: "disabled" });
  await reader.getByRole("button", { name: "Самопроверка", exact: true }).click();
  await expect(reader.locator(".imp-study__check-grid button")).toHaveCount(3);
  await page.screenshot({ path: "test-results/reference-security-07-check.png", animations: "disabled" });
});
