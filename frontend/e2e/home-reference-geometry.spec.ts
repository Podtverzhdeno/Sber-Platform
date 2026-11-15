import { expect, test, type Page } from "@playwright/test";

import { installBootcampReferenceApi } from "./bootcamp-reference-fixtures";

/**
 * 2026-11-15 reference migration.
 *
 * The superseded ZIP/card layout and its .home-v2-* coordinates no longer
 * represent the approved main route. The first fold is now the source-backed
 * Impulse Pixel HTML reference, mounted by OwnerPixelHome. Do not accidentally
 * make the old page primary again to satisfy an obsolete screenshot test.
 */
async function openApprovedHome(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("impulse-visual-mode", "blue");
    localStorage.setItem("impulse-theme", "dark");
  });
  await installBootcampReferenceApi(page);
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/0");
  await expect(page.getByTestId("pixel-live-shell")).toBeVisible();
}

async function noHorizontalScroll(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2))
    .toBe(true);
}

test("approved desktop home replaces the obsolete ZIP grid at 1448px", async ({ page }) => {
  await page.setViewportSize({ width: 1448, height: 1057 });
  await openApprovedHome(page);

  const brand = page.getByRole("button", { name: "Impulse — открыть разделы" });
  await expect(brand).toBeVisible();
  await expect(page.locator(".topbar")).toHaveCount(1);
  await expect(page.locator(".home-v2-hero")).toHaveCount(0);
  await expect(page.getByPlaceholder("Поиск по задачам, навыкам, проектам...")).toBeVisible();
  await expect(page.locator(".home-search-shortcut")).toHaveText("⌘ K");

  const toolbar = await page.locator(".topbar").boundingBox();
  expect(toolbar?.height).toBe(62);
  expect(toolbar?.width).toBeGreaterThan(1300);

  const hero = await page.locator(".impulse-pixel__hero").boundingBox();
  const trajectory = await page.locator(".impulse-pixel__trajectory").boundingBox();
  expect(hero).not.toBeNull();
  expect(trajectory).not.toBeNull();
  if (!hero || !trajectory) throw new Error("Approved main cards must render");
  expect(hero.width).toBeGreaterThan(trajectory.width * 2);
  expect(Math.abs(hero.y - trajectory.y)).toBeLessThanOrEqual(2);
  expect(hero.height).toBe(252);
  await expect(page.locator(".impulse-pixel__glass").first()).toHaveCSS("backdrop-filter", "none");
  await noHorizontalScroll(page);
});

test("approved mobile home stacks real course and trajectory at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApprovedHome(page);
  const hero = await page.locator(".impulse-pixel__hero").boundingBox();
  const trajectory = await page.locator(".impulse-pixel__trajectory").boundingBox();
  expect(hero).not.toBeNull();
  expect(trajectory).not.toBeNull();
  if (!hero || !trajectory) throw new Error("Mobile main cards must render");
  expect(trajectory.y).toBeGreaterThan(hero.y + hero.height);
  await expect(page.getByRole("button", { name: "Меню", exact: true })).toBeHidden();
  await expect(page.locator(".participant-guide")).toHaveCount(0);
  await noHorizontalScroll(page);
});

for (const width of [1280, 1024, 768, 560, 320]) {
  test(`source-backed first fold never overflows at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openApprovedHome(page);
    await expect(page.getByRole("heading", { name: "Моя траектория" })).toBeVisible();
    await expect(page.locator(".impulse-pixel__hero")).toBeVisible();
    await expect(page.getByRole("button", { name: "Требования уровня" })).toBeVisible();
    await noHorizontalScroll(page);
  });
}

test("nonduplicated requirements navigate to the actual authorized trajectory", async ({ page }) => {
  await openApprovedHome(page);
  await expect(page.getByText(/Обязательные курсы:.*Практика:/)).toHaveCount(0);
  await page.getByRole("button", { name: "Требования уровня" }).click();
  await expect(page).toHaveURL(/\/workspace\/1(?:[?]|$)/);
});

test("source geometry is independent of numeric course and practice examples", async ({ page }) => {
  await openApprovedHome(page);
  await expect(page.locator(".impulse-pixel__metrics > div")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Мой путь" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Мой путь" })).toHaveCSS("background-image", "none");
  await expect(page.locator(".impulse-pixel__hero")).toHaveCSS("backdrop-filter", "none");
  await expect(page.locator(".topbar")).toHaveCSS("backdrop-filter", /blur/);
});
