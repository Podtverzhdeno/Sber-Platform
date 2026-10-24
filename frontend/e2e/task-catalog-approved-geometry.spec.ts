import { expect, test, type Page } from "@playwright/test";

import { approvedGeometryPage, approvedGeometryTasks, approvedGeometryTerms } from "./task-catalog-approved-visual-fixture";

const participant = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Синтетический участник",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Мой путь", "Задачи", "Мои проекты"],
  csrf_token: "csrf-visual-fidelity",
};

test.use({ viewport: { width: 1672, height: 941 }, reducedMotion: "reduce" });

async function openReferenceVolumeCatalog(page: Page) {
  await page.addInitScript(() => { localStorage.setItem("impulse-theme", "dark"); });
  await page.route("**/api/v1/me/**", (route) => route.fulfill({ status: 404, json: { code: "NOT_MOCKED" } }));
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: {
    honor_board_enabled: false, task_catalog_v2_enabled: true, demo_mode: true,
  } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [
    { key: "participant-synthetic", display_name: participant.display_name, roles: ["participant"] },
  ] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: participant }));
  await page.route("**/api/v1/development/tracks", (route) => route.fulfill({ json: { active_count: 1, max_active: 2, tracks: [] } }));
  await page.route("**/api/v1/me/roadmaps", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/task-recommendations?*", (route) => route.fulfill({ json: approvedGeometryPage }));
  for (const task of approvedGeometryTasks) {
    await page.route(`**/api/v1/me/task-recommendations/${task.task_id}`, (route) => route.fulfill({ json: task }));
  }
  await page.route(`**/api/v1/me/task-recommendations/${approvedGeometryTasks[0].task_id}/terms`, (route) => route.fulfill({ json: approvedGeometryTerms }));
  await page.route("**/api/v1/me/task-recommendations/analytics/events", (route) => route.fulfill({ status: 202, json: { event_id: "00000000-0000-4000-8000-000000000902", duplicate: false } }));

  await page.goto("/");
  await page.locator('[data-persona="participant-synthetic"]').click();
  await page.getByRole("link", { name: "Задачи", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Задачи для твоего развития" })).toBeVisible();
  await expect(page.locator(".catalog-v2-card")).toHaveCount(10);
  await page.evaluate(() => document.fonts.ready);
}

test("approved cards composition: four KPI cards, detail at right, five planned stages and four conditional benefits", async ({ page }) => {
  await openReferenceVolumeCatalog(page);
  await expect(page.locator(".catalog-v2-kpi")).toHaveCount(4);
  await expect(page.locator(".catalog-v2-stage-track li")).toHaveCount(5);
  await expect(page.locator(".catalog-v2-benefits-section li")).toHaveCount(4);
  await expect(page.getByRole("heading", { name: "Развитие твоих навыков" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Что ты получишь" })).toBeVisible();
  await expect(page.getByText(/Это план, а не прогресс/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Итог" })).toHaveCount(0);

  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();
    const cards = rect(".catalog-v2-discovery");
    const details = rect(".catalog-v2-inspector");
    const stage = rect(".catalog-v2-stage-track");
    const firstKpi = rect(".catalog-v2-kpi");
    const lastKpi = document.querySelectorAll(".catalog-v2-kpi").item(3).getBoundingClientRect();
    return {
      left: cards?.left ?? -1,
      leftRight: cards?.right ?? -1,
      detailLeft: details?.left ?? -1,
      detailRight: details?.right ?? -1,
      stageWidth: stage?.width ?? 0,
      kpiTop: firstKpi?.top ?? -1,
      kpiLastTop: lastKpi.top,
      hasOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
  expect(geometry.leftRight).toBeLessThan(geometry.detailLeft);
  expect(geometry.detailRight).toBeLessThanOrEqual(1673);
  expect(geometry.kpiLastTop).toBeCloseTo(geometry.kpiTop, 0);
  expect(geometry.stageWidth).toBeGreaterThan(250);
  expect(geometry.hasOverflow).toBe(false);
});

test("approved list density: ten test rows remain scannable without horizontal overflow", async ({ page }) => {
  await openReferenceVolumeCatalog(page);
  await page.getByRole("button", { name: "Список" }).click();
  const rows = page.locator(".catalog-v2-table-row");
  await expect(rows).toHaveCount(10);
  const data = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll(".catalog-v2-table-row")).map((row) => row.getBoundingClientRect());
    return {
      heights: rows.map((r) => Math.round(r.height)),
      lastBottom: Math.round(rows.at(-1)?.bottom ?? 0),
      firstTop: Math.round(rows[0]?.top ?? 0),
      columnCount: document.querySelectorAll(".catalog-v2-table-head [role=columnheader]").length,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
  // Approved 1672px reference rows are ~60px high, and ten fit on screen.
  // An 110px ceiling is deliberately forgiving for truthful labels and AT sizes,
  // but rejects the former >140px task rows.
  expect(data.heights.every((height) => height <= 110), `Row heights: ${data.heights.join(", ")}`).toBe(true);
  expect(data.columnCount).toBeGreaterThanOrEqual(8);
  expect(data.overflow).toBe(false);
  await expect(page.locator(".catalog-v2-table-benefit")).toHaveCount(10);
  await expect(page.locator(".catalog-v2-table-reason")).toHaveCount(10);
});

test("approved terms modal: four top fact cards, two-column content, two actions and consent safety", async ({ page }) => {
  await openReferenceVolumeCatalog(page);
  await page.getByRole("button", { name: "Условия и отклик" }).first().click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  await expect(modal.getByRole("heading", { name: "Условия участия" })).toBeVisible();
  await expect(modal.locator(".catalog-v2-conditions-stats > div")).toHaveCount(4);
  await expect(modal.locator(".catalog-v2-terms-grid > section")).toHaveCount(6);
  const confirm = modal.getByRole("button", { name: "Подтвердить и отправить отклик" });
  await expect(confirm).toBeDisabled();
  await expect(modal.getByRole("button", { name: "Закрыть", exact: true })).toBeVisible();
  const geometry = await page.evaluate(() => {
    const dialog = document.querySelector(".catalog-v2-conditions")?.getBoundingClientRect();
    const cards = document.querySelectorAll(".catalog-v2-conditions-stats > div");
    return {
      width: dialog?.width ?? 0,
      left: dialog?.left ?? -1,
      statsTop: cards.item(0).getBoundingClientRect().top,
      statsLastTop: cards.item(3).getBoundingClientRect().top,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
  expect(geometry.statsLastTop).toBeCloseTo(geometry.statsTop, 0);
  expect(geometry.left).toBeGreaterThan(0);
  expect(geometry.width).toBeLessThan(970);
  expect(geometry.overflow).toBe(false);
  await modal.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(modal).toHaveCount(0);
});
