import { expect, test, type Page } from "@playwright/test";
import { installBootcampReferenceApi } from "./bootcamp-reference-fixtures";

async function openHome(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("impulse-visual-mode", "blue");
    localStorage.setItem("impulse-theme", "dark");
  });
  await installBootcampReferenceApi(page);
  await page.route("**/api/v1/search?*", (route) => route.fulfill({
    json: {
      items: [{ kind: "task", meta: "published", ref: "task-search", title: "Python: исследование" }],
    },
  }));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/0");
  await expect(page.getByTestId("pixel-live-shell")).toBeVisible();
}

for (const width of [320, 390, 820]) {
  test(`mobile search is a compact icon until focused at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openHome(page);

    const searchControl = page.locator(".topbar .global-search");
    const search = page.getByRole("searchbox", { name: "Глобальный поиск" });

    const compact = await searchControl.boundingBox();
    expect(compact).not.toBeNull();
    expect(compact?.width).toBeLessThanOrEqual(44);
    await expect(search).toHaveCSS("opacity", "0");

    await searchControl.click();
    await expect(search).toBeFocused();
    await expect(search).toHaveCSS("opacity", "1");
    const expanded = await search.boundingBox();
    const topbar = await page.locator(".topbar").boundingBox();
    expect(expanded).not.toBeNull();
    expect(topbar).not.toBeNull();
    expect(expanded?.y).toBeGreaterThanOrEqual((topbar?.y ?? 0) + (topbar?.height ?? 0));
    expect(expanded?.x).toBeGreaterThanOrEqual(8);
    expect((expanded?.x ?? 0) + (expanded?.width ?? 0)).toBeLessThanOrEqual(width - 7);

    await search.fill("Python");
    const results = page.getByRole("listbox", { name: "Результаты поиска" });
    await expect(results).toBeVisible();
    await results.getByRole("option", { name: /Python: исследование/ }).click();
    await expect.poll(() => page.url()).toContain("/workspace/3?task=task-search");
    await expect(search).toHaveCSS("opacity", "0");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("desktop retains the full visible search field", async ({ page }) => {
  await page.setViewportSize({ width: 1422, height: 803 });
  await openHome(page);
  const control = await page.locator(".topbar .global-search").boundingBox();
  expect(control?.width).toBeGreaterThan(450);
  await expect(page.getByRole("searchbox", { name: "Глобальный поиск" })).toHaveCSS("opacity", "1");
});
