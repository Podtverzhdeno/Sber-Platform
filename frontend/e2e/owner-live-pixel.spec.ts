import { expect, test, type Page } from "@playwright/test";
import { installBootcampReferenceApi } from "./bootcamp-reference-fixtures";

async function openPixelHome(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("impulse-visual-mode","blue");
    localStorage.setItem("impulse-theme","dark");
  });
  await installBootcampReferenceApi(page);
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.goto("/workspace/0");
  await expect(page.getByTestId("pixel-live-shell")).toBeVisible();
}

test("approved live dashboard at 1422px has one floating header, no Menu and dynamic source cards",async({page})=>{
  await page.setViewportSize({width:1422,height:803});
  await openPixelHome(page);
  await expect(page.getByRole("button",{name:"Impulse — открыть разделы"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Меню",exact:true})).toBeHidden();
  await expect(page.locator(".impulse-pixel__topbar")).toHaveCount(0);
  await expect(page.locator(".topbar")).toHaveCount(1);
  await expect(page.getByRole("heading",{name:"Моя траектория"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Главная"})).toBeVisible();
  const bar=await page.locator(".topbar").boundingBox();
  const hero=await page.locator(".impulse-pixel__hero").boundingBox();
  const trajectory=await page.locator(".impulse-pixel__trajectory").boundingBox();
  // Exact geometry from impulse_pixel_reference.html: .header, .main,
  // .hero-row and .glass-card (1422×803 reference viewport).
  expect(bar?.height).toBe(62);
  expect(bar?.x).toBeGreaterThanOrEqual(54);
  expect(bar?.x).toBeLessThanOrEqual(58);
  expect(bar?.width).toBeGreaterThanOrEqual(1308);
  expect(bar?.width).toBeLessThanOrEqual(1312);
  const search = await page.locator(".topbar .global-search").boundingBox();
  expect(search?.height).toBe(43);
  expect(search?.width).toBeGreaterThan(470);
  expect(search?.width).toBeLessThanOrEqual(646);
  expect(hero?.x).toBeGreaterThanOrEqual(138);
  expect(hero?.x).toBeLessThanOrEqual(150);
  expect(hero?.width).toBeGreaterThan(785);
  expect(hero?.width).toBeLessThan(800);
  expect(hero?.height).toBe(252);
  expect(trajectory?.width).toBeGreaterThan(325);
  expect(trajectory?.width).toBeLessThan(345);
  await expect(page.locator(".topbar")).toHaveCSS("backdrop-filter", /blur/);
  await expect(page.locator(".impulse-pixel__hero")).toHaveCSS("backdrop-filter", "none");
  await expect(page.getByRole("button", { name: "Мой путь" })).toHaveCSS("background-image", "none");
  await expect(page.getByRole("button", { name: "Мой путь" })).toHaveCSS("border-top-width", "0px");
});

test("reference Liquid Glass home has no duplicate requirements or unsolicited floating tips", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPixelHome(page);
  await expect(page.getByRole("button", { name: "Требования уровня" })).toBeVisible();
  await expect(page.getByText(/Обязательные курсы:.*Практика:/)).toHaveCount(0);
  await expect(page.locator(".participant-guide")).toHaveCount(0);
  // The hero uses the source's standard translucent .glass-card material;
  // Liquid Glass is reserved for the interactive toolbar and overlays.
  await expect(page.locator(".impulse-pixel__hero")).toHaveCSS("backdrop-filter", "none");
  await expect(page.locator(".topbar")).toHaveCSS("backdrop-filter", /blur/);
  await expect(page.getByRole("button", { name: "Требования уровня" })).toHaveCSS("background-image", "none");
  await expect(page.getByRole("button", { name: "Требования уровня" })).toHaveCSS("border-top-width", "0px");
  await page.waitForTimeout(2200);
  await expect(page.locator(".participant-guide")).toHaveCount(0);
  await page.getByRole("button", { name: "Требования уровня" }).click();
  await expect(page).toHaveURL(/\/workspace\/1(?:[?]|$)/);
});

test("brand replaces Menu and opens full authorized hidden navigation",async({page})=>{
  await openPixelHome(page);
  const logo=page.getByRole("button",{name:"Impulse — открыть разделы"});
  await logo.click();
  const navigation=page.getByRole("dialog",{name:"Главное меню"});
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link",{name:"Главная"})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(navigation).toBeHidden();
  await expect(page.getByRole("button",{name:"Меню",exact:true})).toBeHidden();
});

test("sun, blue moon and dark moon are exactly three persistent click states",async({page})=>{
  await openPixelHome(page);
  const theme=page.locator(".owner-theme-switch");
  await expect(theme).toHaveAttribute("aria-label",/синяя луна/);
  await theme.click();
  await expect(theme).toHaveAttribute("aria-label",/тёмная луна/);
  await expect(page.locator("html")).toHaveAttribute("data-impulse-visual-mode","midnight");
  await theme.click();
  await expect(theme).toHaveAttribute("aria-label",/солнце/);
  await expect(page.locator("html")).toHaveAttribute("data-theme","light");
  await theme.click();
  await expect(theme).toHaveAttribute("aria-label",/синяя луна/);
  await expect(page.locator("html")).toHaveAttribute("data-impulse-visual-mode","blue");
  await page.reload();
  await expect(page.locator(".owner-theme-switch")).toHaveAttribute("aria-label",/синяя луна/);
});

test("profile dropdown preserves logout/rating and mobile has no horizontal clipping",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await openPixelHome(page);
  await expect(page.getByRole("button",{name:"Impulse — открыть разделы"})).toBeVisible();
  await page.getByRole("button",{name:"Меню профиля"}).click();
  await expect(page.getByRole("menuitem",{name:"Выйти"})).toBeVisible();
  await expect(page.getByRole("menuitem",{name:"Рейтинг"})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2)).toBe(true);
});
