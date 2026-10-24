import { expect, test } from "@playwright/test";

/** Screenshot evidence for all five 2026-10-22 reference screens. */
const captures = [
  { width: 1448, height: 1086 },
  { width: 1280, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 780 },
];

for (const viewport of captures) {
  test(`Bootcamp reference fidelity ${String(viewport.width)}x${String(viewport.height)}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator('[data-persona="participant-alex"]').click();
    if (viewport.width < 1024) await page.getByRole("button", { name: "Меню", exact: true }).click();
    await page.getByRole("link", { name: "Bootcamp" }).click();

    const shell = page.locator(".bc-reference-root");
    await expect(shell).toBeVisible();
    await expect(shell.locator(".course-card").first()).toBeVisible();
    await page.screenshot({ path: `test-results/bc-ref-${String(viewport.width)}-cards.png`, animations: "disabled" });

    await shell.locator(".view-toggle").getByRole("button", { name: "Список" }).click();
    await expect(shell.locator(".course-row").first()).toBeVisible();
    await page.screenshot({ path: `test-results/bc-ref-${String(viewport.width)}-list.png`, animations: "disabled" });

    await shell.locator(".view-toggle").getByRole("button", { name: "Карточки" }).click();
    await shell.locator(".course-card .course-bottom .btn").first().click();
    await expect(shell.getByRole("dialog", { name: "Информация о курсе" })).toBeVisible();
    await page.screenshot({ path: `test-results/bc-ref-${String(viewport.width)}-course.png`, animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(shell.getByRole("dialog")).toHaveCount(0);

    await shell.locator(".course-card .course-bottom .text-link").first().click();
    await expect(shell.getByRole("dialog", { name: "Почему рекомендован" })).toBeVisible();
    await page.screenshot({ path: `test-results/bc-ref-${String(viewport.width)}-why.png`, animations: "disabled" });
    await page.keyboard.press("Escape");

    await shell.locator(".grade-highlight .rainbow-btn").click();
    await expect(shell.getByRole("dialog", { name: "Требования к обучению" })).toBeVisible();
    await page.screenshot({ path: `test-results/bc-ref-${String(viewport.width)}-required.png`, animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(shell.getByRole("dialog")).toHaveCount(0);

    // The original invariant still matters on real API data.
    await expect(shell.locator(".course-card").first()).toBeVisible();
    const dimensions = await shell.locator(".course-card").evaluateAll((nodes) =>
      nodes.slice(0, 4).map((node) => node.getBoundingClientRect().width)
    );
    if (dimensions.length >= 2 && viewport.width >= 1024) {
      expect(Math.max(...dimensions) - Math.min(...dimensions)).toBeLessThanOrEqual(1);
    }
  });
}
