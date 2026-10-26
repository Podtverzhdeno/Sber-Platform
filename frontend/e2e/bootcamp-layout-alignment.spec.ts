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
    expect(geometry.tabs.bottom, `role tabs overlap overview at ${String(width)}px`).toBeLessThanOrEqual(firstPanelTop + 2);
    expect(geometry.category.top, `catalog overlaps overview at ${String(width)}px`).toBeGreaterThanOrEqual(panelsBottom + 8);
    if (width >= 1121) {
      expect(Math.abs(geometry.right.top - geometry.continue.top), `columns misaligned at ${String(width)}px`).toBeLessThanOrEqual(2);
      expect(Math.abs(geometry.right.bottom - geometry.continue.bottom), `learning card must align with both right panels at ${String(width)}px`).toBeLessThanOrEqual(2);
      const coursePanel = page.locator(".bc-ref-continue-course");
      const progressPanel = page.locator(".bc-ref-continue-status");
      const [courseBox, progressBox] = await Promise.all([coursePanel.boundingBox(), progressPanel.boundingBox()]);
      expect(courseBox).not.toBeNull();
      expect(progressBox).not.toBeNull();
      if (courseBox && progressBox) {
        expect(Math.abs(courseBox.y + courseBox.height - progressBox.y - progressBox.height)).toBeLessThanOrEqual(2);
        expect(courseBox.y + courseBox.height).toBeLessThanOrEqual(geometry.continue.bottom - 8);
      }
    } else {
      expect(geometry.right.top, `stacked panels overlap at ${String(width)}px`).toBeGreaterThanOrEqual(geometry.continue.bottom + 2);
    }
  }
});
