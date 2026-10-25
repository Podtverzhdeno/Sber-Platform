import { expect, test } from "@playwright/test";

/**
 * BC-R01..BC-R05 responsive, interaction and navigation invariants.
 * These are NOT golden PNG comparisons; visual equality needs the original
 * archived five design references in the Playwright snapshot directory.
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
  test(`Bootcamp approved layout, filters and dialog at ${String(viewport.width)}x${String(viewport.height)}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator('[data-persona="participant-alex"]').click();
    if (viewport.width < 1024) {
      await page.getByRole("button", { name: "Меню", exact: true }).click();
    }
    await page.getByRole("link", { name: "Bootcamp" }).click();

    const shell = page.locator('[data-reference="BC-R01"]');
    await expect(shell.getByRole("heading", { name: /Bootcamp.*Развитие навыков/ })).toBeVisible();
    await expect(shell.getByRole("heading", { name: "Каталог курсов", exact: false })).toBeVisible();
    const cards = shell.locator(".bootcamp-course-card");
    await expect(cards.first()).toBeVisible();

    const noPageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    );
    expect(noPageOverflow, "Bootcamp must not horizontally overflow the page").toBe(true);

    const locked = shell.locator('.bootcamp-course-card[data-access="prerequisite_not_met"]');
    const open = shell.locator('.bootcamp-course-card[data-access="available"]');
    if (await locked.count() > 0 && await open.count() > 0) {
      const first = await locked.first().boundingBox();
      const second = await open.first().boundingBox();
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      if (first !== null && second !== null) {
        expect(Math.abs(first.width - second.width), "locked cards keep the catalog grid width").toBeLessThanOrEqual(1);
      }
    }

    const keysInCards = await cards.evaluateAll((nodes) =>
      nodes.map((element) => element.getAttribute("data-testid")),
    );
    const toggle = shell.getByRole("group", { name: "Вид каталога" });
    await toggle.getByRole("button", { name: "Список" }).click();
    await expect(page).toHaveURL(/view=list/);
    await expect(shell.getByRole("list", { name: "Каталог Bootcamp списком" })).toBeVisible();
    const keysInList = await shell.locator(".bootcamp-course-row").evaluateAll((nodes) =>
      nodes.map((element) => element.getAttribute("data-testid")),
    );
    expect(keysInList).toEqual(keysInCards);
    await toggle.getByRole("button", { name: "Карточки" }).click();
    await expect(page).not.toHaveURL(/view=list/);

    await shell.locator(".bc-open-actions").first().getByRole("button", { name: "Подробнее →" }).click();
    const details = page.getByRole("dialog", { name: "Информация о курсе" });
    await expect(details).toBeVisible();
    await details.getByRole("tab", { name: "Навыки" }).click();
    await expect(details.getByRole("tabpanel")).toBeVisible();
    await details.getByRole("button", { name: "Почему рекомендован" }).click();
    const reason = page.getByRole("dialog", { name: "Почему рекомендован" });
    await expect(reason).toBeVisible();
    await expect(reason.getByRole("button", { name: "Закрыть" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).not.toHaveURL(/course=/);

    await page.screenshot({
      path: `test-results/bootcamp-approved-${String(viewport.width)}x${String(viewport.height)}.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
}


test("Bootcamp cards respond to hover and keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 1448, height: 1086 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Bootcamp" }).click();

  const card = page.locator('[data-reference="BC-R01"] .bootcamp-course-card[data-access="available"]').first();
  await expect(card).toBeVisible();
  const before = await card.evaluate((node) => ({
    border: getComputedStyle(node).borderTopColor,
    shadow: getComputedStyle(node).boxShadow,
  }));
  await card.hover();
  await expect.poll(() => card.evaluate((node) => getComputedStyle(node).borderTopColor))
    .not.toBe(before.border);
  await expect.poll(() => card.evaluate((node) => getComputedStyle(node).boxShadow))
    .not.toBe(before.shadow);

  await card.getByRole("button", { name: "Подробнее →" }).focus();
  await expect(card.getByRole("button", { name: "Подробнее →" })).toBeFocused();
  await card.getByRole("button", { name: "Подробнее →" }).click();
  await expect(page.getByRole("dialog", { name: "Информация о курсе" })).toBeVisible();
});
