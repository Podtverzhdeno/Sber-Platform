import { expect, test, type Page } from "@playwright/test";
import { installBootcampReferenceApi } from "./bootcamp-reference-fixtures";

type VisualMode = "blue" | "midnight" | "light";

async function openOwnerHome(page: Page, mode: VisualMode): Promise<void> {
  await page.addInitScript((selected: VisualMode) => {
    localStorage.setItem("impulse-visual-mode", selected);
    localStorage.setItem("impulse-theme", selected === "light" ? "light" : "dark");
  }, mode);
  await installBootcampReferenceApi(page);
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/0");
  await expect(page.getByTestId("pixel-live-shell")).toBeVisible();
}

for (const mode of ["blue", "midnight", "light"] as const) {
  test(`owner Home buttons use a consistent action hierarchy: ${mode}`, async ({ page }) => {
    await page.setViewportSize({ width: 1672, height: 941 });
    await openOwnerHome(page, mode);

    const primary = page.locator(".impulse-pixel__primary");
    const journey = page.locator(".impulse-pixel__journey-link");
    const trajectory = page.locator(".impulse-pixel__trajectory-more");
    const requirements = page.getByRole("button", { name: "Требования уровня" });

    await expect(primary).toBeVisible();
    await expect(primary).toHaveCSS("min-height", "50px");
    await expect(primary).toHaveCSS("border-radius", "15px");
    await expect(primary).toHaveCSS("background-image", /linear-gradient/);
    await expect(primary).toHaveCSS("cursor", "pointer");

    for (const control of [journey, trajectory, requirements]) {
      await expect(control).toBeVisible();
      await expect(control).toHaveCSS("border-radius", "12px");
      await expect(control).toHaveCSS("min-height", "36px");
      await expect(control).toHaveCSS("background-image", /linear-gradient/);
    }

    await expect(page.getByRole("button", { name: "Меню", exact: true })).toBeHidden();
  });
}

for (const width of [390, 320]) {
  test(`owner Home buttons remain usable without overflow at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openOwnerHome(page, "blue");

    await expect(page.locator(".impulse-pixel__primary")).toBeVisible();
    await expect(page.locator(".impulse-pixel__journey-link")).toBeVisible();
    await expect(page.getByRole("button", { name: "Требования уровня" })).toBeVisible();

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);

    await page.getByRole("button", { name: "Требования уровня" }).click();
    await expect(page).toHaveURL(/\/workspace\/1(?:[?]|$)/);
  });
}

test("owner Home buttons honor reduced motion and keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openOwnerHome(page, "midnight");

  const primary = page.locator(".impulse-pixel__primary");
  // Chromium uses 10 microseconds instead of literal 0s under reduced-motion.
  // This is effectively disabled motion; avoid a browser-version string assertion.
  const duration = await primary.evaluate((element) => {
    const first = getComputedStyle(element).transitionDuration.split(",")[0] ?? "0s";
    return Number.parseFloat(first);
  });
  expect(duration).toBeLessThanOrEqual(0.0001);
  await page.keyboard.press("Tab");
  await primary.focus();
  await expect(primary).toHaveCSS("outline-style", "solid");
  await expect(primary).toHaveCSS("outline-width", "3px");
});

test("owner Home secondary action retains authorized navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openOwnerHome(page, "light");
  await page.locator(".impulse-pixel__journey-link").click();
  await expect(page).toHaveURL(/\/workspace\/1(?:[?]|$)/);
});
