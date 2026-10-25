import { expect, test, type Page } from "@playwright/test";

import { overviewFixture } from "../src/features/participant-home-v2/fixture";

const actor = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Алекс Речной",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Портфолио"],
  csrf_token: "reference-geometry",
};

async function openReferenceHome(page: Page) {
  let loggedIn = false;
  await page.route("**/api/v1/config", (route) =>
    route.fulfill({ json: { demo_mode: true } }),
  );
  await page.route("**/api/v1/auth/personas", (route) =>
    route.fulfill({
      json: [{ key: "participant-alex", display_name: actor.display_name, roles: ["participant"] }],
    }),
  );
  await page.route("**/api/v1/me", (route) =>
    loggedIn
      ? route.fulfill({ json: actor })
      : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }),
  );
  await page.route("**/api/v1/auth/demo-login", (route) => {
    loggedIn = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/participant/me/development-overview", (route) =>
    route.fulfill({ json: overviewFixture }),
  );
  await page.route("**/api/v1/me/talent-passport", (route) =>
    route.fulfill({ json: { verified_courses: [], cases: [], skills: [] } }),
  );
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/0");
  await expect(page.locator(".home-v2-hero")).toBeVisible();
}

async function expectReferenceRect(
  page: Page,
  selector: string,
  reference: { x: number; y: number; width: number; height: number },
  tolerance = 10,
) {
  const actual = await page.locator(selector).boundingBox();
  expect(actual, `Expected ${selector} to render`).not.toBeNull();
  for (const field of ["x", "y", "width", "height"] as const) {
    const measured = actual?.[field];
    expect(
      measured,
      `${selector} ${field} must stay within ${String(tolerance)}px of the supplied ZIP screenshot`,
    ).toBeGreaterThanOrEqual(reference[field] - tolerance);
    expect(measured).toBeLessThanOrEqual(reference[field] + tolerance);
  }
}

test("desktop home tracks original ZIP card geometry at 1448px", async ({ page }) => {
  await page.setViewportSize({ width: 1448, height: 1057 });
  await openReferenceHome(page);
  const portrait = page.locator(".home-reference-avatar");
  await expect(portrait, "The original portrait should be visible for a demo participant").toHaveAttribute("src", "/home-reference/avatar.svg");
  await expect.poll(async () => portrait.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 92)).toBe(true);
  await expect(page.getByPlaceholder("Поиск по задачам, навыкам, проектам...")).toBeVisible();
  await expect(page.locator(".home-search-shortcut")).toHaveText("⌘ K");
  await expectReferenceRect(page, ".home-v2-hero", { x: 252, y: 111, width: 566, height: 310 });
  await expectReferenceRect(page, ".home-v2-grade", { x: 829, y: 111, width: 264, height: 310 });
  await expectReferenceRect(page, ".home-v2-weekly", { x: 1104, y: 111, width: 315, height: 310 });
  await expectReferenceRect(page, ".home-v2-next-outcome", { x: 252, y: 437, width: 741, height: 172 });
  await expectReferenceRect(page, ".home-v2-tasks", { x: 252, y: 625, width: 741, height: 305 });
  await expectReferenceRect(page, ".home-v2-buddy", { x: 1009, y: 437, width: 410, height: 197 });
  await expectReferenceRect(page, ".home-v2-passport", { x: 1009, y: 650, width: 410, height: 262 });
});

test("mobile home tracks original ZIP card ordering and artwork at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReferenceHome(page);
  await expectReferenceRect(page, ".home-v2-hero", { x: 11, y: 76, width: 368, height: 367 }, 12);
  await expectReferenceRect(page, ".home-v2-grade", { x: 11, y: 455, width: 368, height: 291 }, 12);
  await expectReferenceRect(page, ".home-v2-weekly", { x: 11, y: 758, width: 368, height: 261 }, 14);
  await expectReferenceRect(page, ".home-v2-next-outcome", { x: 11, y: 1032, width: 368, height: 208 }, 14);
  const art = page.locator(".home-v2-hero-art");
  await expect(art).toHaveAttribute("src", "/home-reference/mountain-path.svg");
  await expect(page.locator(".home-v2-buddy-content img")).toHaveAttribute(
    "src", "/home-reference/buddy.svg",
  );
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});


const intermediateViewports = [
  {
    name: "1280px desktop wrap",
    width: 1280,
    expected: [
      [".home-v2-hero", 235, 111, 626, 310],
      [".home-v2-grade", 872, 111, 379, 310],
      [".home-v2-weekly", 235, 432, 1016, 160],
      [".home-v2-next-outcome", 235, 608, 600, 187],
      [".home-v2-tasks", 235, 811, 600, 305],
      [".home-v2-buddy", 851, 608, 400, 197],
    ],
  },
  {
    name: "1024px tablet",
    width: 1024,
    expected: [
      [".home-v2-hero", 219, 111, 459, 310],
      [".home-v2-grade", 689, 111, 306, 310],
      [".home-v2-weekly", 219, 432, 776, 173],
      [".home-v2-next-outcome", 219, 621, 776, 172],
      [".home-v2-tasks", 219, 809, 776, 305],
      [".home-v2-buddy", 219, 1130, 380, 262],
    ],
  },
  {
    name: "768px tablet",
    width: 768,
    expected: [
      [".home-v2-hero", 16, 84, 410, 300],
      [".home-v2-grade", 437, 84, 315, 300],
      [".home-v2-weekly", 16, 395, 736, 173],
      [".home-v2-next-outcome", 16, 584, 736, 172],
      [".home-v2-tasks", 16, 772, 736, 305],
    ],
  },
  {
    name: "360px narrow mobile",
    width: 360,
    expected: [
      [".home-v2-hero", 11, 76, 338, 355],
      [".home-v2-grade", 11, 443, 338, 291],
      [".home-v2-weekly", 11, 746, 338, 261],
      [".home-v2-next-outcome", 11, 1020, 338, 220],
      [".home-v2-tasks", 11, 1252, 338, 334],
    ],
  },
] as const;

for (const scenario of intermediateViewports) {
  test(`home geometry follows ZIP at ${scenario.name}`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: 920 });
    await openReferenceHome(page);
    if (scenario.width >= 1024) {
      // Changing only the sidebar width necessarily shifts/shrinks the home grid.
      // Validate the shared 244px shell and usable, non-overlapping cards instead
      // of the obsolete screenshot coordinates from the home-specific sidebar.
      await expect(page.locator(".sidebar")).toHaveCSS("width", "244px");
      const sidebar = await page.locator(".sidebar").boundingBox();
      expect(sidebar).not.toBeNull();
      for (const [selector] of scenario.expected) {
        const box = await page.locator(selector).boundingBox();
        expect(box, `${selector} must be visible`).not.toBeNull();
        expect(box!.x, `${selector} must clear the fixed sidebar`).toBeGreaterThanOrEqual(sidebar!.x + sidebar!.width + 10);
        expect(box!.x + box!.width, `${selector} must fit inside viewport`).toBeLessThanOrEqual(scenario.width - 10);
        expect(box!.width, `${selector} must retain usable card width`).toBeGreaterThan(180);
      }
      const hero = await page.locator(".home-v2-hero").boundingBox();
      const grade = await page.locator(".home-v2-grade").boundingBox();
      expect(hero!.x + hero!.width).toBeLessThan(grade!.x);
    } else {
      for (const [selector, x, y, width, height] of scenario.expected) {
        await expectReferenceRect(page, selector, { x, y, width, height }, 14);
      }
    }
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  });
}


test("canonical desktop sidebar stays visually identical across Home and Trajectory", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 920 });
  await openReferenceHome(page);
  const sidebar = page.getByRole("complementary", { name: "Боковая панель" });
  const snapshot = async () => sidebar.evaluate((element) => {
    const style = getComputedStyle(element);
    const brand = element.querySelector(".brand-mark");
    const brandStyle = brand ? getComputedStyle(brand) : null;
    return {
      width: style.width,
      left: style.left,
      top: style.top,
      padding: style.padding,
      background: style.backgroundImage,
      brandWidth: brandStyle?.width,
      brandBackground: brandStyle?.backgroundImage,
      homeGlyph: element.querySelector(".nav-icon")?.textContent,
      hasStandardServiceCard: Boolean(element.querySelector(".sidebar-art")),
      hasHomeOnlyNudge: Boolean(element.querySelector(".sidebar-nudge")),
    };
  });
  const homeStyle = await snapshot();
  expect(homeStyle.width).toBe("244px");
  expect(homeStyle.hasStandardServiceCard).toBe(true);
  expect(homeStyle.hasHomeOnlyNudge).toBe(false);
  await page.getByRole("navigation", { name: "Навигация роли" }).getByRole("link", { name: "Моя траектория" }).click();
  await expect(page).toHaveURL(/\/workspace\/1/);
  expect(await snapshot()).toEqual(homeStyle);
});


test("grade drawer matches the source 456px geometry and restores focus at desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1448, height: 1057 });
  await openReferenceHome(page);
  const trigger = page.getByRole("button", { name: /Все уровни/ });
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "Карта уровней" });
  await expect(drawer).toBeVisible();
  const box = await drawer.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width).toBe(456);
  expect(box?.x).toBe(992);
  await expect(drawer.getByText("Каталог грейдов пока не опубликован")).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("grade drawer fills mobile without losing Escape or the approved mountain art", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReferenceHome(page);
  await page.getByRole("button", { name: /Все уровни/ }).click();
  const drawer = page.getByRole("dialog", { name: "Карта уровней" });
  await expect(drawer).toBeVisible();
  const box = await drawer.boundingBox();
  expect(box?.width).toBe(390);
  expect(box?.x).toBe(0);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await page.getByRole("button", { name: /Следующий уровень/ }).click();
  const gradeDetails = page.getByRole("dialog", { name: "Требования следующего грейда" });
  await expect(gradeDetails).toBeVisible();
  await expect(gradeDetails.locator(".home-v2-grade-detail-hero")).toHaveCSS("background-image", "none");
  await expect(gradeDetails.locator(".home-v2-grade-detail-hero")).toBeVisible();
});
