import { expect, test } from "@playwright/test";

/**
 * Full-stack CJM acceptance. NO page.route mocks.
 * CI runs the real FastAPI backend against isolated PostgreSQL + seed.
 * Never point this test at production: it intentionally writes learner progress.
 */
test("course selection → eight lessons → certificate → practice → persisted analytics", async ({ page }) => {
  test.setTimeout(100_000);
  page.setDefaultTimeout(10_000);
  const browserErrors: string[] = [];
  const serverErrors: string[] = [];
  page.on("pageerror", error => { browserErrors.push(error.message); });
  page.on("response", response => {
    if (response.status() >= 500 && response.url().includes("/api/")) {
      serverErrors.push(`${String(response.status())} ${response.request().method()} ${response.url()}`);
    }
  });

  await page.goto("/");
  await expect(page.locator('[data-persona="participant-alex"]')).toBeVisible();
  await page.locator('[data-persona="participant-alex"]').click();
  await expect(page.getByRole("link", { name: "Bootcamp" })).toBeVisible();
  await expect.poll(async () => (await page.request.get("/api/v1/me")).status(), {
    message: "demo login must establish the HttpOnly session before API assertions",
    timeout: 15_000,
  }).toBe(200);
  const meResponse = await page.request.get("/api/v1/me");
  const actor = await meResponse.json() as { navigation: string[] };
  const bootcampIndex = actor.navigation.indexOf("Bootcamp");
  expect(bootcampIndex, "demo participant must be able to open Bootcamp").toBeGreaterThanOrEqual(0);
  await page.goto(`/workspace/${String(bootcampIndex)}`);

  // Select a course through the actual course catalog (not a crafted deep link).
  await page.getByRole("group", { name: "Категории курсов" })
    .getByRole("button", { name: /Все курсы/ }).click();
  const card = page.getByTestId("course-demo-course-1");
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("data-access", "available");
  await card.locator(".bc-ref-primary").click();
  await expect(page).toHaveURL(/course=demo-course-1/);
  let reader = page.getByTestId("impulse-immersive-reader");
  await expect(reader).toBeVisible();

  const before = await page.request.get("/api/v1/me/bootcamp/impulse-study/demo-course-1");
  expect(before.status()).toBe(200);
  const start = await before.json() as { completed_units: number; finished: boolean };
  expect(start.completed_units).toBe(0);
  expect(start.finished).toBe(false);

  await reader.getByRole("button", { name: /Перейти к программе/ }).click();
  await reader.locator(".imp-study__program-list button").first().click();
  for (let lesson = 0; lesson < 8; lesson++) {
    const progressResponse = page.waitForResponse(response =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/impulse-study/demo-course-1/lessons/${String(lesson)}/complete`),
    );
    await reader.locator(".imp-study__navigation .imp-study__primary").click();
    const receipt = await progressResponse;
    expect(receipt.status(), `lesson ${String(lesson + 1)} saved`).toBe(200);
  }
  await expect(reader.locator(".imp-study__aside-heading > span")).toHaveText("100%");
  await expect(reader.getByRole("heading", { name: "Завершение обучения" })).toBeVisible();
  const finishResponse = page.waitForResponse(response =>
    response.request().method() === "POST" &&
    response.url().endsWith("/impulse-study/demo-course-1/finish"),
  );
  await reader.locator(".imp-study__finish").click();
  expect((await finishResponse).status()).toBe(200);
  await expect(reader.getByRole("heading", { name: "Обучение завершено!" })).toBeVisible();
  await page.getByTestId("grade-milestone-celebration")
    .getByRole("button", { name: "Посмотреть сертификаты" }).click();
  await expect(reader.getByText("Получен автоматически")).toBeVisible();

  // A practical task is selected and submitted without reviewer approval.
  await reader.getByRole("button", { name: /Перейти к практике/ }).click();
  const chooser = reader.getByTestId("impulse-practice-picker");
  await expect(chooser.locator(".imp-study__practice-choices button")).toHaveCount(8);
  await chooser.locator(".imp-study__practice-choices button").nth(2).click();
  await expect(chooser.locator(".imp-study__practice-choices button").nth(2))
    .toHaveAttribute("aria-pressed", "true");
  const description = "Реализовал решение на Python, проверил корректный ввод, ошибки валидации, повторы и граничные случаи; подготовил тесты и воспроизводимый отчёт.";
  await reader.locator(".imp-study__submission textarea").fill(description);
  const practiceResponse = page.waitForResponse(response =>
    response.request().method() === "POST" &&
    response.url().endsWith("/impulse-study/demo-course-1/practice"),
  );
  await reader.getByRole("button", { name: /Отправить и зачесть практику/ }).click();
  const practiceReceipt = await practiceResponse;
  expect(practiceReceipt.status()).toBe(200);
  expect(await practiceReceipt.json()).toMatchObject({
    finished: true, practice_status: "pending",
    practice_task_key: "lesson:2", practical_certificate_id: null,
  });
  await expect(reader.getByText(/Практика уже учтена для траектории/)).toBeVisible();

  const summaryResponse = await page.request.get("/api/v1/me/bootcamp/impulse-study/summary");
  expect(summaryResponse.status()).toBe(200);
  const summary = await summaryResponse.json() as {
    finished_courses: number; completed_lessons: number; credited_practices: number;
    approved_practices: number;
    courses: { course_key: string; finished: boolean; certificate_id: string | null;
      practice_status: string | null; practice_task_key: string | null;
      practical_certificate_id: string | null }[];
  };
  const saved = summary.courses.find(item => item.course_key === "demo-course-1");
  expect(saved).toMatchObject({
    finished: true, practice_status: "pending", practice_task_key: "lesson:2",
    practical_certificate_id: null,
  });
  expect(saved?.certificate_id).toBeTruthy();
  expect(summary.completed_lessons).toBeGreaterThanOrEqual(8);
  expect(summary.finished_courses).toBeGreaterThanOrEqual(1);
  expect(summary.credited_practices).toBeGreaterThanOrEqual(1);
  expect(summary.approved_practices).toBe(0);

  // Real persisted state, not just an optimistic toast. Reload and compare.
  await page.reload();
  reader = page.getByTestId("impulse-immersive-reader");
  await expect(reader).toBeVisible();
  await expect(reader.getByTestId("impulse-practice-picker")
    .locator(".imp-study__practice-choices button").nth(2)).toHaveAttribute("aria-pressed", "true");
  await expect(reader.locator(".imp-study__submission textarea")).toHaveValue(description);
  await expect(reader.getByText(/Практика уже учтена для траектории/)).toBeVisible();

  // Re-submitting must update the same practice rather than awarding a second credit.
  const duplicateResponse = page.waitForResponse(response =>
    response.request().method() === "POST" &&
    response.url().endsWith("/impulse-study/demo-course-1/practice"),
  );
  await reader.getByRole("button", { name: /Обновить зачтённую практику/ }).click();
  expect((await duplicateResponse).status()).toBe(200);
  const afterDuplicate = await (await page.request.get("/api/v1/me/bootcamp/impulse-study/summary")).json() as typeof summary;
  expect(afterDuplicate.credited_practices).toBe(summary.credited_practices);
  expect(afterDuplicate.courses.find(c => c.course_key === "demo-course-1")?.certificate_id)
    .toBe(saved?.certificate_id);

  const analyticsIndex = actor.navigation.indexOf("Аналитика");
  expect(analyticsIndex, "participant analytics must be in navigation").toBeGreaterThanOrEqual(0);
  await page.goto(`/workspace/${String(analyticsIndex)}`);
  await expect(page.getByTestId("analytics-v3")).toBeVisible();
  await page.getByRole("button", { name: "Сертификация" }).click();
  await expect(page.getByTestId("analytics-study-results")).toContainText("практик учтено");
  await expect(page.getByTestId("analytics-study-results")).toContainText("курсов пройдено");

  const trajectoryIndex = actor.navigation.indexOf("Моя траектория") >= 0
    ? actor.navigation.indexOf("Моя траектория") : actor.navigation.indexOf("Мой путь");
  expect(trajectoryIndex).toBeGreaterThanOrEqual(0);
  await page.goto(`/workspace/${String(trajectoryIndex)}`);
  await expect(page.getByTestId("learning-progress-bridge").getByTestId("learn-finished"))
    .toHaveText(String(summary.finished_courses));
  expect(browserErrors, "no uncaught browser exceptions").toEqual([]);
  expect(serverErrors, "no server 5xx during CJM").toEqual([]);
});
