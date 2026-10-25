import { expect, test } from "@playwright/test";
import { installBootcampReferenceApi } from "./bootcamp-reference-fixtures";

/**
 * Capture all five production-React reference states against deterministic
 * API fixtures. These are audit artifacts, NOT proof of pixel equality.
 * Images land in test-results/, uploaded by the existing CI workflow.
 *
 * The ZIP's source PNGs are a separate baseline and must be compared at the
 * same viewport and scale factor before claiming BC-R01..BC-R05 fidelity.
 */
const sizes = [
  { width: 1448, height: 1086 },
  { width: 1280, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 780 },
] as const;

for (const viewport of sizes) {
  test(`BC-R01..R05 screenshot capture ${String(viewport.width)}x${String(viewport.height)}`, async ({ page }) => {
    await installBootcampReferenceApi(page);
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator('[data-persona="participant-alex"]').click();
    if (viewport.width < 1024) {
      await page.getByRole("button", { name: "Меню", exact: true }).click();
    }
    await page.getByRole("link", { name: "Bootcamp" }).click();

    const prefix = `test-results/bootcamp-reference/${String(viewport.width)}x${String(viewport.height)}`;
    const shell = page.locator(".bc-reference");
    await expect(shell).toBeVisible();
    await expect(shell.locator(".bc-ref-course-card").first()).toBeVisible();
    await page.screenshot({ path: `${prefix}_BC-R01_cards.png`, fullPage: true, animations: "disabled" });

    const view = shell.getByRole("group", { name: "Вид каталога" });
    await view.getByRole("button", { name: "Список" }).click();
    const list = page.locator('[data-reference="BC-R02"]');
    await expect(list.locator(".bc-ref-course-row").first()).toBeVisible();
    await page.screenshot({ path: `${prefix}_BC-R02_list.png`, fullPage: true, animations: "disabled" });
    await view.getByRole("button", { name: "Карточки" }).click();

    const firstAvailable = shell.locator('.bc-ref-course-card[data-access="available"]').first();
    await expect(firstAvailable).toBeVisible();
    await firstAvailable.getByRole("button", { name: /Открыть курс|Посмотреть курс/ }).click();
    const course = page.getByRole("dialog", { name: "Информация о курсе" });
    await expect(course).toBeVisible();
    await page.screenshot({ path: `${prefix}_BC-R03_course.png`, fullPage: false, animations: "disabled" });

    await course.getByRole("button", { name: "Почему рекомендован" }).click();
    const why = page.getByRole("dialog", { name: "Почему рекомендован" });
    await expect(why.locator(".bc-ref-why-item").first()).toBeVisible();
    await page.screenshot({ path: `${prefix}_BC-R04_why.png`, fullPage: false, animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.locator(".bc-ref-grade-button").click();
    const required = page.getByRole("dialog", { name: "Требования к обучению" });
    await expect(required.locator(".bc-ref-required-hero")).toBeVisible();
    await page.screenshot({ path: `${prefix}_BC-R05_required.png`, fullPage: false, animations: "disabled" });

    const clipped = await required.evaluate(node => node.scrollWidth > node.clientWidth + 1);
    expect(clipped, "Required-course drawer must not clip its width").toBe(false);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}
