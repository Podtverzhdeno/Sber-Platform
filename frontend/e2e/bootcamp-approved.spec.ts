import { expect, test } from "@playwright/test";

/**
 * Route-level invariants for the approved participant Bootcamp composition.
 * Exact source artwork is separately checked by the visual fidelity suite.
 */
const viewports = [
  { width: 1448, height: 1086 },
  { width: 1280, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 780 },
] as const;

for (const viewport of viewports) {
  test(`Bootcamp participant catalog and drawer ${String(viewport.width)}x${String(viewport.height)}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator('[data-persona="participant-alex"]').click();
    if (viewport.width < 1024) {
      await page.getByRole("button", { name: "Меню", exact: true }).click();
    }
    await page.getByRole("link", { name: "Bootcamp" }).click();

    const shell = page.locator(".bc-reference-root");
    await expect(shell.getByRole("heading", { name: "Bootcamp" })).toBeVisible();
    await expect(shell.getByRole("heading", { name: "Каталог курсов", exact: false })).toBeVisible();
    const cards = shell.locator(".bootcamp-course-card");
    await expect(cards.first()).toBeVisible();

    // Fixed standalone viewport: neither the page nor the Bootcamp container may scroll horizontally.
    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      app: (() => { const element = document.querySelector(".bc-reference-root"); return element ? element.scrollWidth > element.clientWidth + 1 : true; })(),
    }));
    expect(overflow.document).toBe(false);
    expect(overflow.app).toBe(false);

    const locked = cards.filter({ has: page.locator(".locked-explainer") });
    const available = cards.filter({ has: page.locator(".course-bottom .btn") });
    if (await locked.count() && await available.count()) {
      const first = await locked.first().boundingBox();
      const second = await available.first().boundingBox();
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      if (first && second && viewport.width >= 1024) {
        expect(Math.abs(first.width - second.width)).toBeLessThanOrEqual(1);
      }
    }

    const cardKeys = await cards.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-testid")),
    );
    const toggle = shell.getByRole("group", { name: "Вид каталога" });
    await toggle.getByRole("button", { name: "Список" }).click();
    await expect(page).toHaveURL(/view=list/);
    const list = shell.getByRole("list", { name: "Каталог Bootcamp списком" });
    await expect(list).toBeVisible();
    const listKeys = await list.locator(".course-row").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-testid")),
    );
    expect(listKeys).toEqual(cardKeys);

    await toggle.getByRole("button", { name: "Карточки" }).click();
    await expect(page).not.toHaveURL(/view=list/);
    await shell.locator(".course-bottom .btn").first().click();

    const dialog = shell.getByRole("dialog", { name: "Информация о курсе" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("tab", { name: "Навыки" }).click();
    await expect(dialog.getByRole("tabpanel")).toBeVisible();
    await dialog.getByRole("button", { name: "Почему рекомендован" }).click();
    const reason = shell.getByRole("dialog", { name: "Почему рекомендован" });
    await expect(reason).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(shell.getByRole("dialog")).toHaveCount(0);

    await shell.locator(".grade-highlight .rainbow-btn").click();
    await expect(shell.getByRole("dialog", { name: "Требования к обучению" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.screenshot({
      path: `test-results/bootcamp-approved-${String(viewport.width)}x${String(viewport.height)}.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
}
