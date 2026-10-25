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
    const whyDialog = page.getByRole("dialog", { name: "Почему рекомендован" });
    await expect(whyDialog).toBeVisible();
    // Regression: the vector X must share the center of its existing close hit target.
    const closeButton = whyDialog.getByRole("button", { name: "Закрыть" });
    const closeGlyph = closeButton.locator("svg");
    await expect(closeGlyph).toBeVisible();
    const buttonBox = await closeButton.boundingBox();
    const glyphBox = await closeGlyph.boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(glyphBox).not.toBeNull();
    if (buttonBox && glyphBox) {
      const horizontalOffset = Math.abs(buttonBox.x + buttonBox.width / 2 - glyphBox.x - glyphBox.width / 2);
      const verticalOffset = Math.abs(buttonBox.y + buttonBox.height / 2 - glyphBox.y - glyphBox.height / 2);
      expect(horizontalOffset).toBeLessThan(1);
      expect(verticalOffset).toBeLessThan(1);
    }
    await expect(whyDialog.locator(".bc-ref-why-item")).toHaveCount(4);
    if (viewport.width >= 1280) {
      const bounds = await whyDialog.boundingBox();
      expect(bounds).not.toBeNull();
      if (bounds) {
        expect(bounds.width).toBeGreaterThanOrEqual(840);
        expect(bounds.width).toBeLessThanOrEqual(900);
        expect(bounds.height).toBeGreaterThanOrEqual(570);
        expect(bounds.height).toBeLessThanOrEqual(820);
        expect(Math.abs((bounds.y + bounds.height / 2) - (viewport.height / 2))).toBeLessThan(35);
      }
    }
    await page.screenshot({ path: "test-results/imp-02-recommendation-" + String(viewport.width) + ".png", animations: "disabled" });
    await page.getByRole("dialog", { name: "Почему рекомендован" })
      .getByRole("button", { name: /Открыть курс|Вернуться/ }).click();
    await expect(reader).toBeVisible();

    await reader.getByRole("button", { name: /Перейти к программе/ }).click();
    await expect(reader).toHaveAttribute("data-view", "program");
    await reader.locator(".imp-study__program-list button").first().click();
    await expect(reader.locator(".imp-study__course-summary")).toBeVisible();
    await expect(reader.locator(".imp-study__course-summary")).toContainText("8 уроков");
    await expect(reader.locator(".imp-study__course-emblem svg")).toBeVisible();
    const frames = reader.locator("[data-learning-block]");
    await expect(frames).toHaveCount(4);
    for (const kind of ["theory", "example", "practice"] as const) {
      await expect(reader.locator('[data-learning-block="' + kind + '"] .lesson-frame__toggle')).toHaveAttribute("aria-expanded", "true");
    }
    const lockedCheck = reader.locator('[data-learning-block="check"]');
    await expect(lockedCheck.locator(".lesson-frame__toggle")).toHaveAttribute("aria-expanded", "false");
    await expect(lockedCheck.locator(".imp-study__check-grid button")).toHaveCount(0);
    await page.screenshot({ path: "test-results/imp-03-unified-lesson-" + String(viewport.width) + ".png", animations: "disabled" });
    await lockedCheck.locator(".lesson-frame__toggle").click();
    await expect(lockedCheck.locator(".imp-study__check-grid button")).toHaveCount(3);
    await page.screenshot({ path: "test-results/imp-03-selfcheck-open-" + String(viewport.width) + ".png", animations: "disabled" });
    if (viewport.width >= 1280) {
      const title = reader.locator(".imp-study__lesson-heading h2");
      await expect.poll(() => title.evaluate(node => Number.parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(32);
      const card = reader.locator(".imp-study__course-summary");
      await expect.poll(() => card.evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThanOrEqual(340);
    }
    const check = reader.locator(".imp-study__check-grid button").first();
    await check.click();
    await expect(check).toHaveAttribute("aria-pressed", "true");
    await reader.getByRole("button", { name: "Следующий урок" }).click();
    await expect(reader.locator(".imp-study__aside-heading > span")).toHaveText("13%");
    await expect(reader.locator(".imp-study__lesson-list button").nth(1)).toHaveAttribute("aria-current", "step");
    await page.screenshot({ path: "test-results/imp-04-progress-" + String(viewport.width) + ".png", animations: "disabled" });
    for (let index = 1; index < 8; index++) {
      if (index === 7) {
        const capstone = reader.locator(".imp-study__capstone");
        await expect(capstone).toBeVisible();
        await expect(capstone.locator(".imp-study__capstone-rubric article")).toHaveCount(4);
        await expect(capstone).toContainText("100 баллов");
        await page.screenshot({path:"test-results/imp-capstone-" + String(viewport.width) + ".png", animations:"disabled"});
      }
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
    await expect(reader.getByText("Получен автоматически")).toBeVisible();
    await expect(reader.getByText("Нужна практика")).toBeVisible();
    await expect(reader.locator(".imp-study__cert-preview")).toHaveCount(2);
    await expect(reader.locator(".imp-study__cert-timeline > div > div")).toHaveCount(2);
    const pdfButton = reader.getByRole("button", { name: /Распечатать \/ сохранить PDF/ });
    await expect(pdfButton).toBeEnabled();
    await pdfButton.hover();
    await expect.poll(() => pdfButton.evaluate(el => getComputedStyle(el).transform)).not.toBe("none");

    await page.screenshot({ path: "test-results/imp-07-certificates-" + String(viewport.width) + ".png", animations: "disabled" });
    const infoTabs = reader.getByRole("navigation", { name: "Разделы информации о курсе" });
    await expect(infoTabs.getByRole("button")).toHaveCount(5);
    await infoTabs.getByRole("button", { name: "Навыки" }).click();
    await expect(reader.getByRole("region", { name: "Навыки курса" }).locator("article")).toHaveCount(8);
    await infoTabs.getByRole("button", { name: "Отзывы" }).click();
    await expect(reader.getByText("Проверенных отзывов пока нет")).toBeVisible();
    await infoTabs.getByRole("button", { name: "Сертификаты" }).click();
    await expect(reader.locator(".imp-study__cert-grid .imp-study__cert-card")).toHaveCount(2);
    await reader.getByRole("button", { name: /Перейти к практике/ }).click();
    await reader.getByLabel("Опишите, что сделали и как проверили результат").fill(
      "Выполнил практическое задание: создал тестовый сценарий и проверил основное поведение, " +
      "обработку ошибок и негативные случаи. Добавил результаты проверки."
    );
    await reader.getByRole("button", { name: /Отправить на проверку/ }).click();
    await expect(reader.getByText(/Практическая работа получена/)).toBeVisible();
    await page.screenshot({ path: `test-results/imp-08-practice-pending-${String(viewport.width)}.png`, animations: "disabled" });
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
  await expect(reader).toHaveAttribute("data-course", "demo-course-10");
  const illustration = await page.request.get("/bootcamp/security-hero.svg");
  expect(illustration.ok()).toBe(true);
  expect(await illustration.text()).toContain("Защищённые серверы");
  await page.screenshot({ path: "test-results/reference-security-00-overview.png", animations: "disabled" });
  await reader.getByRole("button", { name: /Перейти к программе/ }).click();
  await reader.locator(".imp-study__program-list button").first().click();
  await reader.locator(".imp-study__navigation .imp-study__primary").click();
  await expect(reader.locator(".imp-study__lesson-heading")).toContainText("Аутентификация и авторизация");
  await expect(reader.locator(".imp-study__method-card")).toHaveCount(4);
  await page.screenshot({ path: "test-results/reference-security-04-theory.png", animations: "disabled" });
  await expect(reader.locator('[data-learning-block="example"] .lesson-frame__toggle')).toHaveAttribute("aria-expanded", "true");
  await expect(reader.locator(".imp-study__walkthrough article")).toHaveCount(4);
  await expect(reader.locator(".imp-study__code")).toContainText('JWT_SECRET');
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const copyButton = reader.getByRole("button", { name: "Копировать пример" });
  await copyButton.hover();
  await copyButton.click();
  await expect(reader.getByRole("button", { name: "Скопировано" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("JWT_SECRET");
  await page.screenshot({ path: "test-results/reference-security-05-example.png", animations: "disabled" });
  await expect(reader.locator('[data-learning-block="practice"] .lesson-frame__toggle')).toHaveAttribute("aria-expanded", "true");
  await expect(reader.locator(".imp-study__practice-columns .imp-study__requirement")).toHaveCount(8);
  await expect(reader.locator(".imp-study__compact-course")).toContainText("Безопасность данных");
  await expect(reader.getByText(/Реализуйте защищённый API на FastAPI/)).toBeVisible();
  const templateLink = reader.getByRole("link", { name: "Скачать шаблон" });
  await expect(templateLink).toHaveAttribute("download", "security-auth-fastapi-starter.py");
  const templateResponse = await page.request.get("/bootcamp/templates/security-auth-fastapi-starter.py");
  expect(templateResponse.ok()).toBe(true);
  expect(await templateResponse.text()).toContain('JWT_SECRET');
  await page.screenshot({ path: "test-results/reference-security-06-practice.png", animations: "disabled" });
  await reader.locator('[data-learning-block="check"] .lesson-frame__toggle').click();
  await expect(reader.locator(".imp-study__check-grid button")).toHaveCount(4);
  await page.screenshot({ path: "test-results/reference-security-07-check.png", animations: "disabled" });
});


test("course progress resumes from first unfinished lesson after reload", async ({ page }) => {
  await page.setViewportSize({ width: 1448, height: 1086 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Bootcamp" }).click();
  const path = new URL(page.url()).pathname;
  await page.goto(path + "?course=demo-course-10");
  let reader = page.getByTestId("impulse-immersive-reader");
  await reader.getByRole("button", { name: /Перейти к программе/ }).click();
  await reader.locator(".imp-study__program-list button").first().click();
  await reader.locator(".imp-study__navigation .imp-study__primary").click();
  await expect(reader.locator(".imp-study__aside-heading > span")).toHaveText("13%");
  await page.reload();
  reader = page.getByTestId("impulse-immersive-reader");
  await expect(reader.locator(".imp-study__lesson-list button").nth(1)).toHaveAttribute("aria-current", "step");
  await expect(reader.locator(".imp-study__aside-heading > span")).toHaveText("13%");
});


test("continue-learning card reflects server progress after a completed lesson", async ({ page }) => {
  await page.setViewportSize({ width: 1448, height: 1086 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Bootcamp" }).click();
  const route = new URL(page.url()).pathname;
  await page.goto(route + "?role=python");
  const continueCard = page.locator(".bc-ref-continue-status");
  await expect(continueCard).toBeVisible();
  await continueCard.getByRole("button", { name: "Открыть курс" }).click();
  const dialog = page.getByRole("dialog", { name: "Информация о курсе" });
  const reader = dialog.getByTestId("impulse-immersive-reader");
  await expect(reader).toBeVisible();
  await reader.getByRole("button", { name: /Перейти к программе/ }).click();
  await reader.locator(".imp-study__program-list button").first().click();
  await reader.locator(".imp-study__navigation .imp-study__primary").click();
  await expect(reader.locator(".imp-study__aside-heading > span")).toHaveText("13%");
  await dialog.getByRole("button", { name: "Закрыть" }).click();
  await expect(continueCard).toContainText("13% пройдено");
  await expect(continueCard).toContainText("1 из 8 уроков завершено");
  await continueCard.getByRole("button", { name: "Продолжить обучение" }).click();
  await expect(dialog.getByTestId("impulse-immersive-reader")).toBeVisible();
});

test("finished course appears in Analytics and Trajectory from one persisted learning source", async ({ page }) => {
  await page.setViewportSize({ width: 1448, height: 900 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/2?course=demo-course-1");
  const reader = page.getByTestId("impulse-immersive-reader");
  await expect(reader).toBeVisible();
  await reader.getByRole("button", { name: /Перейти к программе/ }).click();
  await reader.locator(".imp-study__program-list button").first().click();
  for (let lesson = 0; lesson < 8; lesson++) {
    await reader.locator(".imp-study__navigation .imp-study__primary").click();
  }
  await reader.locator(".imp-study__finish").click();
  await expect(reader.getByRole("heading", { name: "Обучение завершено!" })).toBeVisible();

  // The browser is reloaded: the counter must survive navigation rather than
  // living only in a React component or a temporary notification.
  await page.goto("/workspace/5");
  await expect(page.getByTestId("analytics-v3")).toBeVisible();
  const analytics = page.getByTestId("learning-progress-bridge");
  await expect(analytics.getByTestId("learn-finished")).toHaveText("1");
  await expect(analytics.getByTestId("learn-lessons")).toHaveText("8");
  await expect(analytics.getByTestId("learn-reviewed")).toHaveText("0");
  await expect(analytics).toContainText("OpenSpec и SDD");
  await expect(page.getByTestId("analytics-v3")).toContainText("Пройден курс Impulse: OpenSpec и SDD");

  await page.goto("/workspace/1");
  const trajectory = page.getByTestId("learning-progress-bridge");
  await expect(trajectory.getByTestId("learn-finished")).toHaveText("1");
  await expect(trajectory.getByTestId("learn-lessons")).toHaveText("8");
  await expect(trajectory.getByTestId("learn-reviewed")).toHaveText("0");
  await expect(trajectory).toContainText("Самостоятельное обучение");
});


test("Bootcamp celebrates the earned streak day and shows truthful flame at course finish", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  let qualifyingLessonSaved = false;
  await page.route("**/api/v1/me/engagement/overview", route => route.fulfill({
    json: {
      current_days: qualifyingLessonSaved ? 12 : 11,
      best_days: 12,
      qualified_dates: qualifyingLessonSaved
        ? ["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17",
          "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21",
          "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]
        : ["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17",
          "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21",
          "2026-10-22", "2026-10-23", "2026-10-24"],
      today_saved: qualifyingLessonSaved,
      grace_available: !qualifyingLessonSaved,
      frozen_dates: [],
      freeze_state: "idle",
      reason: qualifyingLessonSaved
        ? "Урок засчитан в сегодняшнюю активность."
        : "Сегодня ещё не было учебного действия.",
    },
  }));
  // Fall back to the existing course-progression fixture, then let the
  // authoritative engagement overview reflect the committed first lesson.
  await page.route("**/api/v1/me/bootcamp/impulse-study/demo-course-1/lessons/0/complete", async route => {
    qualifyingLessonSaved = true;
    await route.fallback();
  });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page.getByRole("button", { name: /Учебный стрик: 11 дней/ })).toBeVisible();
  await page.getByRole("link", { name: "Bootcamp" }).click();
  await expect(page.locator(".bc-ref-streak")).toHaveCount(0);
  const path = new URL(page.url()).pathname;
  await page.goto(path + "?course=demo-course-1");
  const reader = page.getByTestId("impulse-immersive-reader");
  await expect(reader).toBeVisible();
  await reader.getByRole("button", { name: /Перейти к программе/ }).click();
  await reader.locator(".imp-study__program-list button").first().click();
  await reader.getByRole("button", { name: "Следующий урок" }).click();
  const celebration = page.getByTestId("streak-celebration");
  await expect(celebration).toBeVisible();
  await expect(celebration).toHaveAttribute("aria-label", /12 дней подряд/);
  await expect(celebration).toContainText("СЕРИЯ ПРОДОЛЖЕНА");
  await celebration.getByRole("button", { name: "Пропустить анимацию" }).click();
  await expect(celebration).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Учебный стрик: 12 дней/ })).toBeVisible();
  for (let index = 1; index < 8; index++) {
    await reader.locator(".imp-study__navigation .imp-study__primary").click();
  }
  await reader.locator(".imp-study__finish").click();
  await expect(reader.getByRole("heading", { name: "Обучение завершено!" })).toBeVisible();
  // Same premium animation as 'Следующий этап', but with truthful course wording.
  const coursePopup = page.getByTestId("grade-milestone-celebration");
  await expect(coursePopup).toHaveAttribute("data-mode", "course-complete");
  await expect(coursePopup).toHaveAttribute("aria-label", "Курс успешно завершён");
  await expect(coursePopup).toContainText("КУРС");
  await expect(coursePopup).toContainText("ЗАВЕРШЁН!");
  await expect(coursePopup).toContainText("Все уроки пройдены · результат сохранён");
  await expect(coursePopup).not.toContainText("ГРЕЙД ПОВЫШЕН");
  await expect(celebration).toHaveCount(0);
  await coursePopup.getByRole("button", { name: "Посмотреть сертификаты" }).click();
  await expect(coursePopup).toHaveCount(0);
  await expect(reader.getByRole("heading", { name: "Ваши сертификаты" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Учебный стрик: 12 дней/ })).toBeVisible();
  await expect(page.getByTestId("streak-celebration")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: /Учебный стрик: 12 дней/ })).toBeVisible();
  await expect(page.getByTestId("streak-celebration")).toHaveCount(0);
  await expect(page.getByTestId("grade-milestone-celebration")).toHaveCount(0);
});
