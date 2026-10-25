import { expect, test } from "@playwright/test";
import { installBootcampReferenceApi } from "./bootcamp-reference-fixtures";

test.beforeEach(async ({ page }) => {
  await installBootcampReferenceApi(page);
});

test("Bootcamp navigation, overview panels and catalog never overlap", async ({ page }) => {
  await page.setViewportSize({ width: 1596, height: 900 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Bootcamp" }).click();
  await expect(page.locator('[data-reference="BC-R01"]')).toBeVisible();

  for (const width of [1596, 1280, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await page.evaluate(() => {
      function rect(selector: string) {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) throw new Error("Missing Bootcamp element: " + selector);
        const box = element.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
      }
      return {
        tabs: rect(".bc-ref-role-switcher"),
        continue: rect(".bc-ref-continue"),
        right: rect(".bc-ref-right-panels"),
        category: rect(".bc-ref-category-tabs"),
      };
    });

    const firstPanelTop = Math.min(geometry.continue.top, geometry.right.top);
    const panelsBottom = Math.max(geometry.continue.bottom, geometry.right.bottom);
    expect(geometry.tabs.bottom, `role tabs overlap overview at ${width}px`).toBeLessThanOrEqual(firstPanelTop + 2);
    expect(geometry.category.top, `catalog overlaps overview at ${width}px`).toBeGreaterThanOrEqual(panelsBottom + 8);
    if (width >= 1121) {
      expect(Math.abs(geometry.right.top - geometry.continue.top), `columns misaligned at ${width}px`).toBeLessThanOrEqual(2);
    } else {
      expect(geometry.right.top, `stacked panels overlap at ${width}px`).toBeGreaterThanOrEqual(geometry.continue.bottom + 2);
    }
  }
});
