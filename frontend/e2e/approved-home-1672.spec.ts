import { expect, test, type Page } from "@playwright/test";
import { installBootcampReferenceApi } from "./bootcamp-reference-fixtures";

/**
 * Owner-approved P0 pixel contract: 1672×941 on the ACTUAL participant route.
 * Source file is the original PNG in Impulse-UI-References-2026-11-14/
 * 00-approved-master/, SHA-256 in docs/design/references/APPROVED_MASTER.json.
 * Live numbers must come from the actor's API, not screenshot fixture values.
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
  await expect(page.getByRole("heading", { name: "Главная" })).toBeVisible();
}

function closeTo(value: number, expected: number, tolerance = 4): void {
  expect(value, `Measured ${String(value)} instead of ${String(expected)} ±${String(tolerance)}`)
    .toBeGreaterThanOrEqual(expected - tolerance);
  expect(value).toBeLessThanOrEqual(expected + tolerance);
}

test("P0 approved home: 1672×941 geometry, materials and live content", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await openApprovedHome(page);
  const toolbar = await page.locator(".topbar").boundingBox();
  const search = await page.locator(".topbar .global-search").boundingBox();
  const content = await page.locator(".impulse-pixel__content").boundingBox();
  const hero = await page.locator(".impulse-pixel__hero").boundingBox();
  const track = await page.locator(".impulse-pixel__trajectory").boundingBox();
  expect(toolbar && search && content && hero && track).toBeTruthy();
  if (!toolbar || !search || !content || !hero || !track) return;
  // Always capture before geometry assertions, so red runs remain inspectable.
  await page.screenshot({ path: "test-results/impulse-approved-home-1672.png", animations: "disabled" });
  console.log("APPROVED_HOME_GEOMETRY", JSON.stringify({ toolbar, search, content, hero, track }));

  closeTo(toolbar.x, 59, 3);
  closeTo(toolbar.height, 73, 2);
  closeTo(toolbar.width, 1530, 3);
  closeTo(search.x, 353, 4);
  closeTo(search.y, 10, 3);
  closeTo(search.width, 752, 4);
  closeTo(search.height, 52, 2);
  closeTo(content.x, 160, 4);
  closeTo(content.width, 1336, 3);
  closeTo(hero.x, 160, 4);
  closeTo(hero.y, 210, 11);
  closeTo(hero.width, 920, 3);
  closeTo(hero.height, 292, 2);
  closeTo(track.x, 1107, 4);
  closeTo(track.width, 389, 3);
  closeTo(track.height, 292, 2);
  expect(Math.abs(hero.y - track.y)).toBeLessThanOrEqual(2);

  await expect(page.locator(".impulse-pixel__hero h2")).toHaveCSS("font-size", "36px");
  await expect(page.locator(".impulse-pixel__heading h1")).toHaveCSS("font-size", "43px");
  await expect(page.locator(".impulse-pixel__primary")).toHaveCSS("min-height", "50px");
  await expect(page.locator(".page-shell--owner-pixel-home")).toHaveCSS("background-image", /impulse-approved-orbit.svg/);
  await expect(page.locator(".topbar")).toHaveCSS("backdrop-filter", /blur/);
  await expect(page.locator(".impulse-pixel__hero")).toHaveCSS("backdrop-filter", "none");

  const illustration = page.locator("img.impulse-pixel__stack");
  await expect(illustration).toBeVisible();
  expect(await illustration.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.locator(".impulse-pixel__metrics > div")).toHaveCount(3);
  await expect(page.locator(".impulse-pixel__level-progress")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Требования уровня" })).toBeVisible();
  await expect(page.locator(".participant-guide")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Меню", exact: true })).toBeHidden();

  // Snapshot recorded before assertions for red and green runs alike.
});

test("approved home uses real actions, not a flattened screenshot", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await openApprovedHome(page);
  await page.locator(".impulse-pixel__fold > button").first().click();
  await expect(page.locator(".impulse-pixel__fold").first().locator(".impulse-pixel__expanded")).toBeVisible();
  await page.locator(".impulse-pixel__fold > button").last().click();
  await expect(page.locator(".impulse-pixel__fold").last().locator(".impulse-pixel__expanded")).toBeVisible();
  await page.getByRole("button", { name: "Требования уровня" }).click();
  await expect(page).toHaveURL(/\/workspace\/1(?:[?]|$)/);
});

for (const width of [1448, 1024, 820, 570, 390, 320]) {
  test(`responsive approved home has no horizontal overflow at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openApprovedHome(page);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow at ${String(width)}px`).toBeLessThanOrEqual(2);
    await expect(page.getByRole("button", { name: "Требования уровня" })).toBeVisible();
    if (width <= 570) {
      // No covered heading, clipped search, or lost 15px under Windows scrollbar.
      const search = await page.locator(".topbar .global-search").boundingBox();
      const heading = await page.locator(".impulse-pixel__heading h1").boundingBox();
      const bar = await page.locator(".topbar").boundingBox();
      expect(search && heading && bar).toBeTruthy();
      if (search && heading && bar) {
        expect(heading.y, "Home heading must clear the mobile search").toBeGreaterThanOrEqual(search.y + search.height + 12);
        expect(search.x).toBeGreaterThanOrEqual(0);
        expect(search.x + search.width).toBeLessThanOrEqual(width + 1);
        expect(bar.width, "Mobile chrome must cover the real viewport").toBeGreaterThanOrEqual(width - 1);
      }
    }
    if (width === 390) {
      await page.screenshot({ path: "test-results/impulse-approved-home-390.png", animations: "disabled" });
    }
  });
}
