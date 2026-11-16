import { expect, test, type Page } from "@playwright/test";
import { catalogItem, catalogPage } from "../src/features/task-catalog-v2/fixture";

const navigation = [
  "Главная", "Моя траектория", "Bootcamp", "Задачи", "Мои проекты",
  "Портфолио", "События", "Аналитика", "Настройки",
];

async function signIn(page: Page, allowed: string[] = navigation) {
  const actor = {
    person_id: "00000000-0000-4000-8000-000000000002",
    display_name: "Синтетический участник",
    active_role: "participant",
    assigned_roles: ["participant"],
    scopes: [],
    consent_scopes: [],
    navigation: allowed,
    csrf_token: "practice-tabs-test",
  };
  let authenticated = false;
  await page.route("**/api/v1/**", route =>
    route.fulfill({ status: 404, json: { code: "NOT_MOCKED" } }));
  await page.route("**/api/v1/config", route =>
    route.fulfill({ json: { demo_mode: true, task_catalog_v2_enabled: true } }));
  await page.route("**/api/v1/auth/personas", route =>
    route.fulfill({ json: [{ key: "practice-participant", display_name: actor.display_name, roles: ["participant"] }] }));
  await page.route(/\/api\/v1\/me(?:\?.*)?$/, route => authenticated
    ? route.fulfill({ json: actor })
    : route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", route => {
    authenticated = true;
    return route.fulfill({ json: actor });
  });
  await page.route("**/api/v1/me/task-recommendations?*", route =>
    route.fulfill({ json: catalogPage([catalogItem]) }));
  await page.route("**/api/v1/me/work", route => route.fulfill({ json: [] }));
  await page.goto("/");
  await page.locator('[data-persona="practice-participant"]').click();
}

test("Practice tabs preserve catalog, active projects, Back and mobile geometry", async ({ page }) => {
  await signIn(page);
  await page.goto("/workspace/3");
  const nav = page.getByRole("navigation", { name: "Подразделы практики" });
  await expect(nav.getByRole("link")).toHaveCount(3);
  await expect(nav.getByRole("link", { name: "Задачи" })).toHaveAttribute("aria-current", "page");

  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(nav).toBeVisible();
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `No document overflow at ${String(width)}px`).toBeLessThanOrEqual(2);
    const bounds = await page.getByTestId("practice-navigation").boundingBox();
    if (bounds === null) throw Error("Practice navigation did not render");
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 2);
  }

  await nav.getByRole("link", { name: "В работе" }).click();
  await expect(page).toHaveURL(/\/workspace\/4\?filter=active/);
  const projectTabs = page.getByRole("navigation", { name: "Подразделы практики" });
  await expect(projectTabs.getByRole("link", { name: "В работе" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("group", { name: "Статус проектов" })).toBeVisible();
  await projectTabs.getByRole("link", { name: "Мои проекты" }).click();
  await expect(page).toHaveURL(/\/workspace\/4$/);
  await expect(projectTabs.getByRole("link", { name: "Мои проекты" })).toHaveAttribute("aria-current", "page");
  await projectTabs.getByRole("link", { name: "Задачи" }).click();
  await expect(page).toHaveURL(/\/workspace\/3$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/workspace\/4$/);
});

test("Practice tabs never fabricate inaccessible projects", async ({ page }) => {
  await signIn(page, ["Главная", "Задачи"]);
  await page.goto("/workspace/1");
  const nav = page.getByRole("navigation", { name: "Подразделы практики" });
  await expect(nav.getByRole("link")).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Задачи" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Мои проекты" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "В работе" })).toHaveCount(0);
});

test("empty Projects opens the actual authorized task catalog instead of hardcoded /workspace/3", async ({ page }) => {
  await signIn(page, ["Главная", "Мои проекты", "Задачи"]);
  await page.goto("/workspace/1");
  await expect(page.getByRole("heading", { name: "Пока нет принятых проектов" })).toBeVisible();
  await page.getByRole("button", { name: "Перейти к задачам" }).click();
  await expect(page).toHaveURL(/\/workspace\/2$/);
  const nav = page.getByRole("navigation", { name: "Подразделы практики" });
  await expect(nav.getByRole("link", { name: "Задачи" })).toHaveAttribute("aria-current", "page");
});

test("empty Projects hides task CTA when catalog is not authorized", async ({ page }) => {
  await signIn(page, ["Главная", "Мои проекты"]);
  await page.goto("/workspace/1");
  await expect(page.getByRole("heading", { name: "Пока нет принятых проектов" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Перейти к задачам" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Подразделы практики" }).getByRole("link")).toHaveCount(2);
});


test("Practice navigation remains usable during catalog API outage", async ({ page }) => {
  await signIn(page);
  await page.route("**/api/v1/me/task-recommendations?*", route =>
    route.fulfill({ status: 503, json: { code: "CATALOG_UNAVAILABLE" } }));
  await page.goto("/workspace/3");
  const nav = page.getByRole("navigation", { name: "Подразделы практики" });
  await expect(nav.getByRole("link", { name: "Мои проекты" })).toBeVisible();
  await nav.getByRole("link", { name: "Мои проекты" }).click();
  await expect(page).toHaveURL(/\/workspace\/4$/);
});

test("Practice navigation remains usable during project API outage", async ({ page }) => {
  await signIn(page);
  await page.route("**/api/v1/me/work", route =>
    route.fulfill({ status: 503, json: { code: "WORK_UNAVAILABLE" } }));
  await page.goto("/workspace/4");
  const nav = page.getByRole("navigation", { name: "Подразделы практики" });
  await expect(nav.getByRole("link", { name: "Задачи" })).toBeVisible();
  await nav.getByRole("link", { name: "Задачи" }).click();
  await expect(page).toHaveURL(/\/workspace\/3$/);
});
