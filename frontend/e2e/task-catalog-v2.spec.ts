import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { catalogItem, catalogPage, catalogTerms, insufficientItem } from "../src/features/task-catalog-v2/fixture";

const participant = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Синтетический участник",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Мой путь", "Задачи", "Мои проекты"],
  csrf_token: "csrf-catalog-e2e",
};

async function openCatalog(
  page: Page,
  items = [catalogItem, insufficientItem],
): Promise<void> {
  await page.route("**/api/v1/me/**", (route) => route.fulfill({ status: 404, json: { code: "NOT_MOCKED", message: "Не относится к browser contract" } }));
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: {
    honor_board_enabled: false,
    task_catalog_v2_enabled: true,
    demo_mode: true,
  } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [
    { key: "participant-synthetic", display_name: participant.display_name, roles: ["participant"] },
  ] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: participant }));
  await page.route("**/api/v1/development/tracks", (route) => route.fulfill({ json: { active_count: 1, max_active: 2, tracks: [] } }));
  await page.route("**/api/v1/me/roadmaps", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/task-recommendations?*", (route) => route.fulfill({ json: catalogPage(items) }));
  await page.route(`**/api/v1/me/task-recommendations/${catalogItem.task_id}`, (route) => route.fulfill({ json: catalogItem }));
  await page.route(`**/api/v1/me/task-recommendations/${insufficientItem.task_id}`, (route) => route.fulfill({ json: insufficientItem }));
  await page.route(`**/api/v1/me/task-recommendations/${catalogItem.task_id}/terms`, (route) => route.fulfill({ json: catalogTerms }));
  await page.route(`**/api/v1/me/task-recommendations/${catalogItem.task_id}/terms/revalidate`, (route) => route.fulfill({ json: { terms_version: catalogTerms.terms_version } }));
  await page.route("**/api/v1/me/task-recommendations/analytics/events", (route) => route.fulfill({ status: 202, json: { event_id: "00000000-0000-0000-0000-000000000902", duplicate: false } }));
  await page.route(`**/api/v1/me/tasks/${catalogItem.task_id}/terms-consent`, (route) => route.fulfill({ json: {} }));
  await page.route(`**/api/v1/me/tasks/${catalogItem.task_id}/applications`, (route) => route.fulfill({ json: { id: "00000000-0000-0000-0000-000000000704", status: "applied" } }));
  await page.route(`**/api/v1/me/task-recommendations/${catalogItem.task_id}/bookmark`, (route) => route.fulfill({ json: { task_id: catalogItem.task_id, saved: true } }));
  await page.goto("/");
  await page.locator('[data-persona="participant-synthetic"]').click();
  await page.getByRole("link", { name: "Задачи" }).click();
  await expect(page.getByRole("heading", { name: "Задачи для вашего следующего результата" })).toBeVisible();
}

test("catalog filters, view parity and one idempotent apply", async ({ page }) => {
  let applyCalls = 0;
  const analyticsBodies: Array<Record<string, unknown>> = [];
  page.on("request", (request) => {
    if (request.url().includes("/task-recommendations/analytics/events")) {
      analyticsBodies.push(request.postDataJSON() as Record<string, unknown>);
    }
  });
  await openCatalog(page);
  await page.route(`**/api/v1/me/tasks/${catalogItem.task_id}/applications`, async (route) => {
    applyCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    await route.fulfill({ json: { id: "00000000-0000-0000-0000-000000000704", status: "applied" } });
  });

  // Advanced controls are deliberately hidden until requested in both desktop and mobile.
  const advanced = page.locator(".catalog-v2-filter-expander");
  await expect(advanced).toHaveAccessibleName("Все фильтры");
  await expect(advanced).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByLabel("Навык", { exact: true })).toBeHidden();
  await advanced.click();
  await expect(advanced).toHaveAttribute("aria-expanded", "true");
  await page.getByLabel("Навык", { exact: true }).fill("python");
  await expect(page.getByRole("button", { name: /Сбросить фильтр Навык/ })).toBeVisible();
  await page.getByRole("button", { name: "Список" }).click();
  await expect(page.getByRole("table", { name: "Список рекомендованных задач" })).toBeVisible();
  await page.getByRole("button", { name: "Отклик" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").check();
  const submit = dialog.getByRole("button", { name: "Подтвердить и отправить отклик" });
  await submit.click();
  await expect(page.getByText(/Отклик отправлен заказчику/)).toBeVisible();
  expect(applyCalls).toBe(1);
  expect(analyticsBodies.length).toBeGreaterThanOrEqual(4);
  for (const body of analyticsBodies) {
    expect(body).not.toHaveProperty("title");
    expect(body).not.toHaveProperty("brief");
    expect(body).not.toHaveProperty("url");
    expect(body).not.toHaveProperty("q");
    expect(body).not.toHaveProperty("person_id");
  }
  expect(analyticsBodies.map((body) => body.event_name)).toEqual(
    expect.arrayContaining(["catalog_view", "view_change", "conditions_open", "application_result"]),
  );
});

test("stale terms require a new version and fresh consent", async ({ page }) => {
  let termsReads = 0;
  await openCatalog(page);
  await page.route(`**/api/v1/me/task-recommendations/${catalogItem.task_id}/terms`, (route) => {
    termsReads += 1;
    return route.fulfill({ json: termsReads === 1 ? catalogTerms : { ...catalogTerms, terms_version: 4, version_token: '"terms-marker-4"' } });
  });
  await page.route(`**/api/v1/me/task-recommendations/${catalogItem.task_id}/terms/revalidate`, (route) => route.fulfill({ status: 409, json: { code: "TERMS_CHANGED", message: "Условия изменились" } }));

  await page.getByRole("button", { name: "Условия и отклик" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Подтвердить и отправить отклик" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Условия изменились");
  await expect(dialog.getByRole("checkbox", { name: /версии 4/ })).not.toBeChecked();
  await expect(dialog.getByRole("status")).toContainText("Версия 3");
});

test("catalog and conditions pass automated accessibility checks", async ({ page }) => {
  await openCatalog(page);
  const catalogResult = await new AxeBuilder({ page }).analyze();
  expect(catalogResult.violations).toEqual([]);
  await page.getByRole("button", { name: "Условия и отклик" }).first().click();
  const conditionsResult = await new AxeBuilder({ page }).analyze();
  expect(conditionsResult.violations).toEqual([]);
});

test("light theme keeps catalog contrast accessible", async ({ page }) => {
  await openCatalog(page);
  await page.getByRole("button", { name: /Тёмная тема включена/ }).click();
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});

test("conditions footer remains reachable at text zoom and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openCatalog(page);
  await page.getByRole("button", { name: "Условия и отклик" }).first().click();
  const dialog = page.getByRole("dialog");
  for (const zoom of ["200%", "400%"]) {
    await page.evaluate((value) => { document.documentElement.style.fontSize = value; }, zoom);
    const submit = dialog.getByRole("button", { name: "Подтвердить и отправить отклик" });
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeVisible();
  }
  const transition = await dialog.getByRole("button", { name: "Закрыть условия" }).evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(transition).toBe("0s");
});

test("120-task catalog keeps detail lazy and warm by id and snapshot", async ({ page }) => {
  const manyItems = [
    catalogItem,
    ...Array.from({ length: 119 }, (_, index) => ({
      ...catalogItem,
      task_id: `00000000-0000-4000-8000-${String(index + 200).padStart(12, "0")}`,
      title: `Синтетическая задача ${String(index + 2)}`,
    })),
  ];
  const detailRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith(`/task-recommendations/${catalogItem.task_id}`)) {
      detailRequests.push(request.url());
    }
  });
  const coldStarted = Date.now();
  await openCatalog(page, manyItems);
  const coldMs = Date.now() - coldStarted;
  await expect(page.locator('[role="listitem"]')).toHaveCount(120);

  await page.getByRole("button", { name: "Подробнее" }).first().click();
  await expect(page.getByRole("heading", { name: "Почему подходит" })).toBeVisible();
  await page.getByRole("button", { name: "Закрыть детали" }).click();
  const warmStarted = Date.now();
  await page.getByRole("button", { name: "Подробнее" }).first().click();
  await expect(page.getByRole("heading", { name: "Почему подходит" })).toBeVisible();
  const warmMs = Date.now() - warmStarted;

  expect(detailRequests).toHaveLength(1);
  const evidence = { tasks: manyItems.length, coldMs, warmMs, detailRequests: detailRequests.length };
  console.log(`[catalog-performance] ${JSON.stringify(evidence)}`);
  await test.info().attach("catalog-performance.json", {
    body: JSON.stringify(evidence),
    contentType: "application/json",
  });
});

test("foreign deep link is safe and mobile list has no page overflow", async ({ page }) => {
  await openCatalog(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/me/task-recommendations/00000000-0000-0000-0000-000000000999", (route) => route.fulfill({ status: 404, json: { code: "RESOURCE_NOT_FOUND", message: "Задача недоступна или не существует." } }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: participant }));
  await page.goto("/workspace/1?task=00000000-0000-0000-0000-000000000999&catalog_view=list");
  await expect(page.getByText("Задачи для вашего следующего результата")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Раздел недоступен" })).toBeVisible();
  await expect(page.getByText("private-brief-not-for-catalog")).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});

test("mobile collapses secondary filters and reveals opened task detail", async ({ page }) => {
  await openCatalog(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const expander = page.getByRole("button", { name: "Все фильтры" });
  await expect(expander).toBeVisible();
  await expect(expander).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByLabel("Навык", { exact: true })).toBeHidden();
  await expander.click();
  await expect(page.getByLabel("Навык", { exact: true })).toBeVisible();
  await page.getByLabel("Навык", { exact: true }).fill("python");
  await expect(page.getByRole("button", { name: /Сбросить фильтр Навык/ })).toBeVisible();
  await page.getByRole("button", { name: "Скрыть фильтры" }).click();
  await expect(page.getByLabel("Навык", { exact: true })).toBeHidden();

  await page.getByRole("button", { name: "Подробнее" }).first().click();
  await expect(page.getByRole("heading", { name: "Этапы задачи" })).toBeVisible();
  await expect(page.getByText(/Это план, а не прогресс/)).toBeVisible();
  await expect.poll(() =>
    page.locator(".catalog-v2-inspector").evaluate((node) => node.getBoundingClientRect().top),
  ).toBeLessThan(844);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});
