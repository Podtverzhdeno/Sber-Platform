import { expect, test, type Page } from "@playwright/test";
import { installBootcampReferenceApi } from "./bootcamp-reference-fixtures";

/** Dedicated acceptance of the new Calm home. The legacy reference-geometry
 * suite remains intact and belongs to a separate review/ownership lane. */
async function openCalmParticipantHome(page: Page): Promise<void> {
  await installBootcampReferenceApi(page);
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/0");
  await expect(page.getByTestId("calm-participant-home")).toBeVisible();
}

for (const width of [1440, 1024, 768, 390, 320]) {
  test(`calm participant home stays focused and accessible at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openCalmParticipantHome(page);

    await expect(page.getByRole("heading", { name: "Главная" })).toBeVisible();
    await expect(page.locator(".calm-home__primary")).toHaveCount(1);
    await expect(page.getByTestId("calm-impulse-level")).toContainText("L0");
    await expect(page.getByTestId("calm-verified-skills")).toContainText("0");

    const work = page.getByTestId("calm-home-work-disclosure");
    await expect(work).not.toHaveAttribute("open", "");
    await expect(page.locator(".calm-home__disclosure--tools")).not.toHaveAttribute("open", "");
    await expect(page.locator(".calm-home__focus-aside")).toHaveCount(0);

    // No horizontal clipping or unintentional lateral scroll for the home screen.
    await expect.poll(async () => page.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth
    )).toBe(true);

    await work.locator("summary").click();
    await expect(work).toHaveAttribute("open", "");
    await expect(page.getByRole("heading", { name: "Активные задачи" })).toBeVisible();
    await work.locator("summary").click();
    await expect(work).not.toHaveAttribute("open", "");
  });
}

test("calm requirements disclose published courses only on request and preserve role route", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openCalmParticipantHome(page);

  await expect(page.getByTestId("calm-home-requirements")).toHaveCount(0);
  await page.getByRole("button", { name: /Требования уровня/ }).click();
  const requirements = page.getByTestId("calm-home-requirements");
  await expect(requirements).toBeVisible();
  await expect(requirements).toContainText("Python: основа");
  await expect(requirements).toContainText("Практика");
  await requirements.getByRole("button", { name: "Пройти" }).click();

  await expect(page).toHaveURL(/\/workspace\/2\?.*course=demo-course-3/);
  await expect(page).toHaveURL(/role=python/);
});

test("calm default, legacy rollback, and earliest fallback remain reversible", async ({ page }) => {
  await openCalmParticipantHome(page);
  await page.goto("/workspace/0?home=legacy");
  await expect(page.locator(".home-v2-hero")).toBeVisible();
  await expect(page.getByTestId("calm-participant-home")).toHaveCount(0);

  await page.goto("/workspace/0?v2=0");
  await expect(page.getByRole("heading", { name: /Добро пожаловать/ })).toBeVisible();

  await page.goto("/workspace/0");
  await expect(page.getByTestId("calm-participant-home")).toBeVisible();
});
