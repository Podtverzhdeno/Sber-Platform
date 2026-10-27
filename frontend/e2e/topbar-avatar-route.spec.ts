import { expect, test, type Page } from "@playwright/test";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Портфолио"],
  csrf_token: "csrf-avatar-geometry",
};

/** Geometry tests must not depend on the hosted demo-login session or cookie lifetime. */
async function openParticipantTrajectory(page: Page) {
  let loggedIn = false;
  await page.route("**/api/v1/config", route =>
    route.fulfill({json:{demo_mode:true,honor_board_enabled:false}}));
  await page.route("**/api/v1/auth/personas", route =>
    route.fulfill({json:[{key:"participant-alex",display_name:actor.display_name,roles:["participant"]}]}));
  await page.route("**/api/v1/me", route =>
    loggedIn
      ? route.fulfill({json:actor})
      : route.fulfill({status:401,json:{code:"AUTH_REQUIRED",message:"login"}}));
  await page.route("**/api/v1/auth/demo-login", route => {
    loggedIn = true;
    return route.fulfill({json:actor});
  });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/1?source=1");
  await expect(page.locator(".topbar")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Моя траектория" })).toBeVisible();
}

test("demo avatar never overflows its circular shell or overlaps the person's name", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await openParticipantTrajectory(page);
  await expect(page.locator(".topbar .top-persona")).toBeVisible();
  const avatar = page.locator(".topbar .mini-avatar");
  const image = avatar.locator("img.home-reference-avatar");
  const label = page.locator(".topbar .top-persona > span:last-child");
  await expect(image).toBeVisible();

  const [container, img, name] = await Promise.all([
    avatar.boundingBox(), image.boundingBox(), label.boundingBox(),
  ]);
  if (!container || !img || !name) throw new Error("Topbar avatar geometry unavailable");

  expect(img.width).toBeLessThanOrEqual(container.width + 1);
  expect(img.height).toBeLessThanOrEqual(container.height + 1);
  expect(img.x).toBeGreaterThanOrEqual(container.x - 1);
  expect(img.y).toBeGreaterThanOrEqual(container.y - 1);
  expect(img.x + img.width).toBeLessThanOrEqual(name.x + 1);
  await test.info().attach("trajectory-topbar-avatar-desktop", {
    body: await page.screenshot({ animations: "disabled" }),
    contentType: "image/png",
  });
});

test("fresh mobile trajectory does not overlap the fixed shell with its heading", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openParticipantTrajectory(page);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const focused = document.activeElement;
    if (focused instanceof HTMLElement) focused.blur();
  });
  const topbar = await page.locator(".topbar").boundingBox();
  const heading = await page.getByRole("heading", { name: "Моя траектория" }).boundingBox();
  if (!topbar || !heading) throw new Error("Missing mobile shell geometry");
  expect(heading.y).toBeGreaterThanOrEqual(topbar.y + topbar.height - 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  await test.info().attach("trajectory-fresh-mobile-firstfold", {
    body: await page.screenshot({ fullPage: true, animations: "disabled" }),
    contentType: "image/png",
  });
});
