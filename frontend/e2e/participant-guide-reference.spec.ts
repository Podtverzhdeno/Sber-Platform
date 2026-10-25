import { expect, test, type Page } from "@playwright/test";

const participantId = "ea5738ef-196d-4bfa-a58d-04488a219951";
const navigation = ["Главная", "Задачи", "Мои проекты", "Bootcamp", "Моя траектория", "Аналитика", "Портфолио", "Сообщения"];

function mockParticipant(page: Page): void {
  void page.route("**/api/v1/**", (route) => route.fulfill({ status: 404, json: {} }));
  void page.route("**/api/v1/config", (route) => route.fulfill({ json: { demo_mode: false } }));
  void page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [
    { key: "participant-guide", display_name: "Участник", roles: ["participant"] },
  ] }));
  void page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: {} }));
  void page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: {
    person_id: participantId, display_name: "Участник", active_role: "participant",
    assigned_roles: ["participant"], scopes: [], consent_scopes: [], navigation, csrf_token: "csrf",
  } }));
}
test("reference onboarding: welcome, highlighted navigation, completion and real action", async ({ page }) => {
  mockParticipant(page);
  await page.goto("/");
  await page.locator('[data-persona="participant-guide"]').click();
  const welcome = page.getByRole("dialog", { name: /Добро пожаловать/ });
  await expect(welcome).toBeVisible({ timeout: 9000 });
  await expect(welcome.locator(".pg-welcome-benefits > div")).toHaveCount(4);
  await page.screenshot({ path: "test-results/participant-welcome-reference.png" });
  await welcome.getByRole("button", { name: /Далее/ }).click();
  await expect(page.getByRole("heading", { name: "Найди интересную задачу" })).toBeVisible();
  const spotlight = page.locator(".pg-highlight");
  await expect(spotlight).toBeVisible();
  const spot = await spotlight.boundingBox();
  const nav = await page.getByRole("link", { name: "Задачи", exact: true }).boundingBox();
  expect(spot).not.toBeNull();
  expect(nav).not.toBeNull();
  expect(Math.abs((spot?.x ?? 0) - (nav?.x ?? 0))).toBeLessThanOrEqual(5);
  await page.screenshot({ path: "test-results/participant-coachmark-reference.png" });
  await page.locator(".pg-coachmark").getByRole("button", { name: /Далее/ }).click();
  await page.locator(".pg-coachmark").getByRole("button", { name: /Готово/ }).click();
  const complete = page.getByRole("dialog", { name: "Ты готов к старту!" });
  await expect(complete).toBeVisible();
  await complete.getByRole("button", { name: /К интересным задачам/ }).click();
  await expect(page).toHaveURL(/\/workspace\/1/);
});

test("manual contextual help can be dismissed, stays within a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  mockParticipant(page);
  await page.addInitScript((id) => {
    localStorage.setItem(`impulse:guide:welcome:v2:${id}`, "1");
    localStorage.setItem(`impulse:guide:v1:${id}`, JSON.stringify({ seen: [], lastAutoAt: 0, autoDisabled: true }));
  }, participantId);
  await page.goto("/");
  await page.locator('[data-persona="participant-guide"]').click();
  await expect(page.locator(".pg-welcome")).toHaveCount(0);
  await page.getByRole("button", { name: "Как здесь всё устроено?" }).click();
  const panel = page.locator(".pg-coachmark");
  await expect(panel).toBeVisible();
  const rect = await panel.boundingBox();
  expect(rect).not.toBeNull();
  expect(rect?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((rect?.x ?? 0) + (rect?.width ?? 0)).toBeLessThanOrEqual(375);
  expect((rect?.y ?? 0) + (rect?.height ?? 0)).toBeLessThanOrEqual(812);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Как здесь всё устроено?" })).toBeVisible();
});
