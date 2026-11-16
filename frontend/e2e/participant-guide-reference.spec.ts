import { expect, test, type Page } from "@playwright/test";

const participantId = "ea5738ef-196d-4bfa-a58d-04488a219951";
const navigation = ["Главная", "Задачи", "Мои проекты", "Bootcamp", "Моя траектория", "Аналитика", "Портфолио", "Сообщения"];
const actor = {
  person_id: participantId,
  display_name: "Участник",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation,
  csrf_token: "csrf",
};

async function mockParticipant(page: Page): Promise<void> {
  let loggedIn = false;
  await page.route("**/api/v1/**", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/v1/config", route => route.fulfill({ json: { demo_mode: false } }));
  await page.route("**/api/v1/auth/personas", route => route.fulfill({
    json: [{ key: "participant-guide", display_name: actor.display_name, roles: ["participant"] }],
  }));
  await page.route(/\/api\/v1\/me(?:\?.*)?$/, route => loggedIn
    ? route.fulfill({ json: actor })
    : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => {
    loggedIn = true;
    return route.fulfill({ json: actor });
  });
}

async function signIn(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-persona="participant-guide"]').click();
  // Do not race the asynchronous demo login with navigation or assertions.
  await expect(page).toHaveURL(/\/workspace\/0(?:[?#]|$)/);
  await expect(page.getByRole("button", { name: "Меню профиля" })).toBeVisible();
}

async function openHelpFromProfile(page: Page) {
  await page.getByRole("button", { name: "Меню профиля" }).click();
  await page.getByRole("menuitem", { name: "Помощь" }).click();
  const library = page.getByRole("dialog", { name: "Центр помощи" });
  await expect(library).toBeVisible();
  return library;
}

test("reference onboarding is optional: profile help opens a guided tour and real task route", async ({ page }) => {
  await mockParticipant(page);
  await signIn(page);
  // Apple-minimal shell deliberately has no unsolicited welcome or floating button.
  await expect(page.locator(".pg-welcome")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Как здесь всё устроено?" })).toHaveCount(0);

  const library = await openHelpFromProfile(page);
  await library.getByRole("button", { name: /Показать подсказки на странице/ }).click();
  const coachmark = page.locator(".pg-coachmark");
  await expect(coachmark).toBeVisible();
  await expect(coachmark.getByRole("heading", { name: "Здесь начинается твой путь" })).toBeVisible();
  await coachmark.getByRole("button", { name: /Далее/ }).click();
  await expect(coachmark.getByRole("heading", { name: "Найди интересную задачу" })).toBeVisible();
  await coachmark.getByRole("button", { name: /Далее/ }).click();
  await expect(coachmark.getByRole("heading", { name: "Сохраняй результаты" })).toBeVisible();
  await coachmark.getByRole("button", { name: /Готово/ }).click();
  const complete = page.getByRole("dialog", { name: "Ты готов к старту!" });
  await expect(complete).toBeVisible();
  await complete.getByRole("button", { name: /К интересным задачам/ }).click();
  await expect(page).toHaveURL(/\/workspace\/1(?:[?#]|$)/);
});

test("profile help is dismissible and fits a 375px mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockParticipant(page);
  await signIn(page);
  const library = await openHelpFromProfile(page);
  const rect = await library.boundingBox();
  expect(rect).not.toBeNull();
  expect(rect?.x ?? -1).toBeGreaterThanOrEqual(-1);
  expect((rect?.x ?? 0) + (rect?.width ?? 0)).toBeLessThanOrEqual(376);
  expect(rect?.y ?? -1).toBeGreaterThanOrEqual(-1);
  expect((rect?.y ?? 0) + (rect?.height ?? 0)).toBeLessThanOrEqual(813);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
    .toBeLessThanOrEqual(2);
  await page.keyboard.press("Escape");
  await expect(library).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Меню профиля" })).toBeVisible();
});

test("participant can search help instructions without a mandatory tour", async ({ page }) => {
  await mockParticipant(page);
  await signIn(page);
  const library = await openHelpFromProfile(page);
  const search = library.getByRole("textbox", { name: "Поиск по инструкциям" });
  await search.fill("Skill Passport");
  await expect(library.getByRole("button", { name: /Что такое Skill Passport/ })).toBeVisible();
  await library.getByRole("button", { name: /Что такое Skill Passport/ }).click();
  await expect(library.getByRole("heading", { name: "Что такое Skill Passport?" })).toBeVisible();
  await expect(library.getByText("Зачем это нужно")).toBeVisible();
  await library.getByRole("button", { name: "Закрыть центр помощи" }).click();
  await expect(library).toHaveCount(0);
});
