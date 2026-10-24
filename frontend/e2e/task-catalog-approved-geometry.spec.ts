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
  // Every branded source mark in approved 01/03 must be the original SVG
  // from Impulse_Tasks_UI (1); it is shown only with an explicit demo label.
  const sourceMarks = [
    "sber", "t-bank", "astra", "yandex", "red-mad-robot",
    "gazprom-neft", "sber", "vk", "positive-technologies", "tinkoff",
  ];
  const logos = page.locator(".catalog-v2-card .catalog-v2-brand-logo");
  await expect(logos).toHaveCount(sourceMarks.length);
  for (const [index, name] of sourceMarks.entries()) {
    await expect(logos.nth(index)).toHaveAttribute("src", `/task-catalog/brands/${name}.svg`);
  }
  await expect.poll(async () => logos.evaluateAll((imgs) => imgs.every((item) => {
    const image = item as HTMLImageElement;
    return image.complete && image.naturalWidth === 64 && image.naturalHeight === 64;
  }))).toBe(true);
  await expect(page.locator(".catalog-v2-card").first()).toContainText("Демо-заказчик");

  if (process.env.CAPTURE_APPROVED_TASKS === "1") await page.screenshot({ path: "test-results/approved-geometry-cards.png", fullPage: true, animations: "disabled" });
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
  // The approved 1672×941 preview includes all five stages and lower actions
  // without requiring the participant to scroll through repetitive forecast copy.
  const firstFold = await page.evaluate(() => {
    const stage = document.querySelector(".catalog-v2-stage-section")?.getBoundingClientRect();
    const footer = document.querySelector(".catalog-v2-detail-footer")?.getBoundingClientRect();
    const mentor = document.querySelector(".catalog-v2-detail-footer .catalog-v2-support-section")?.getBoundingClientRect();
    return {
      stageTop: stage?.top ?? Infinity,
      stageBottom: stage?.bottom ?? Infinity,
      footerTop: footer?.top ?? -1,
      footerBottom: footer?.bottom ?? Infinity,
      mentorTop: mentor?.top ?? -1,
      mentorBottom: mentor?.bottom ?? Infinity,
    };
  });
  console.info("[catalog-approved-first-fold]", firstFold);
  expect(firstFold.stageTop).toBeLessThan(880);
  expect(firstFold.footerBottom).toBeLessThanOrEqual(941);
  expect(firstFold.stageBottom).toBeLessThanOrEqual(firstFold.footerTop + 1);
  expect(firstFold.mentorTop).toBeGreaterThanOrEqual(firstFold.footerTop);
  expect(firstFold.mentorBottom).toBeLessThanOrEqual(firstFold.footerBottom + 1);

  const firstCard = page.locator(".catalog-v2-card").first();
  const actions = firstCard.locator(".catalog-v2-card-actions");
  await expect(actions).toHaveCSS("opacity", "0");
  await firstCard.hover();
  await expect(actions).toHaveCSS("opacity", "1");
  await page.locator(".catalog-v2-heading h1").click();
  await firstCard.focus();
  await expect(actions).toHaveCSS("opacity", "1");
});

test("approved list density: ten test rows remain scannable without horizontal overflow", async ({ page }) => {
  await openReferenceVolumeCatalog(page);
  await page.getByRole("button", { name: "Список" }).click();
  const rows = page.locator(".catalog-v2-table-row");
  await expect(rows).toHaveCount(10);
  if (process.env.CAPTURE_APPROVED_TASKS === "1") await page.screenshot({ path: "test-results/approved-geometry-list.png", fullPage: true, animations: "disabled" });
  const data = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll(".catalog-v2-table-row")).map((row) => row.getBoundingClientRect());
    return {
      heights: rows.map((r) => Math.round(r.height)),
      lastBottom: Math.round(rows.at(-1)?.bottom ?? 0),
      firstTop: Math.round(rows[0]?.top ?? 0),
      columnCount: document.querySelectorAll(".catalog-v2-table-head [role=columnheader]").length,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      inspect: Array.from(document.querySelectorAll<HTMLElement>(".catalog-v2-table-row")).slice(0, 2).map((row) => ({
        height: row.getBoundingClientRect().height,
        minHeight: getComputedStyle(row).minHeight,
        padding: getComputedStyle(row).padding,
        tallest: Array.from(row.querySelectorAll<HTMLElement>('[role="cell"]')).map((cell) => ({label: cell.dataset.label ?? cell.className, height: cell.getBoundingClientRect().height})).sort((a,b) => b.height-a.height).slice(0,3),
      })),
    };
  });
  console.info("[tasks-list-dimensions]", JSON.stringify(data));
  // Approved 1672px reference rows are ~60px high, and ten fit on screen.
  // A 64px ceiling follows the approved 60px row rhythm with a little room for real text,
  // without cutting off full text in the selected detail panel.
  expect(data.heights.every((height) => height <= 64), `Row heights: ${data.heights.join(", ")}`).toBe(true);
  expect(data.lastBottom, "All ten approved list rows must fit into the 1672×941 first viewport").toBeLessThanOrEqual(941);
  expect(data.columnCount).toBeGreaterThanOrEqual(8);
  expect(data.overflow).toBe(false);
  await expect(page.locator(".catalog-v2-table-match .catalog-v2-match-ring")).toHaveCount(10);
  const matchLayout = await page.locator(".catalog-v2-table-row").evaluateAll((rowNodes) =>
    rowNodes.map((node) => {
      const ring = node.querySelector(".catalog-v2-match-ring")?.getBoundingClientRect();
      const deadline = node.querySelector(".catalog-v2-table-deadline")?.getBoundingClientRect();
      const label = node.querySelector(".catalog-v2-match-visual--ring-only > .catalog-v2-match")?.getBoundingClientRect();
      return {
        noCollision: ring !== undefined && deadline !== undefined && ring.right <= deadline.left + 1,
        accessibleMatchHiddenVisually: label !== undefined && label.width <= 1 && label.height <= 1,
      };
    }),
  );
  expect(matchLayout.every((row) => row.noCollision && row.accessibleMatchHiddenVisually)).toBe(true);
  await expect(page.locator(".catalog-v2-table-benefit")).toHaveCount(10);
  await expect(page.locator(".catalog-v2-table-reason")).toHaveCount(10);
});

test("approved intermediate desktop list preserves two-column readability without page overflow", async ({ page }) => {
  await openReferenceVolumeCatalog(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "Список" }).click();
  await expect(page.locator(".catalog-v2-table-row")).toHaveCount(10);
  await expect(page.locator(".catalog-v2-table-row .catalog-v2-brand-logo")).toHaveCount(10);

  const shape = await page.evaluate(() => {
    const head = document.querySelector(".catalog-v2-table-head");
    const row = document.querySelector(".catalog-v2-table-row");
    return {
      headerHidden: head !== null && getComputedStyle(head).display === "none",
      columns: row !== null ? getComputedStyle(row).gridTemplateColumns.split(" ").length : 0,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  expect(shape.headerHidden).toBe(true);
  expect(shape.columns).toBe(2);
  expect(shape.horizontalOverflow).toBe(false);
  await expect(page.locator(".catalog-v2-table-actions").first().getByRole("button", { name: "Подробнее" })).toBeVisible();
});

test("mobile benefits wrap customer conditions without horizontal overflow", async ({ page }) => {
  await openReferenceVolumeCatalog(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const benefit = page.locator(".catalog-v2-benefits-section > ul > li").last();
  await expect(benefit).toBeVisible();
  const geometry = await benefit.evaluate((node) => {
    const description = node.querySelector("p");
    const box = node.getBoundingClientRect();
    if (description === null) return { wraps: false, withinCard: false, overflow: true };
    const paragraph = description.getBoundingClientRect();
    return {
      wraps: getComputedStyle(description).whiteSpace === "normal",
      withinCard: paragraph.right <= box.right + 1 && paragraph.left >= box.left,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  expect(geometry.wraps).toBe(true);
  expect(geometry.withinCard).toBe(true);
  expect(geometry.overflow).toBe(false);

  await page.locator(".catalog-v2-help summary").click();
  const helpPanel = page.locator(".catalog-v2-help > p");
  await expect(helpPanel).toBeVisible();
  const helpRect = await helpPanel.boundingBox();
  expect(helpRect).not.toBeNull();
  if (helpRect === null) return;
  expect(helpRect.x).toBeGreaterThanOrEqual(0);
  expect(helpRect.x + helpRect.width).toBeLessThanOrEqual(390);
});

test("benefit cards and full conditions remain inside the detail at screenshot desktop and tablet widths", async ({ page }) => {
  await openReferenceVolumeCatalog(page);

  for (const viewport of [
    { width: 1538, height: 960 },
    { width: 1280, height: 800 },
    { width: 1100, height: 844 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator(".catalog-v2-benefits-section > ul > li")).toHaveCount(4);
    await page.evaluate(() => document.fonts.ready);

    const geometry = await page.evaluate(() => {
      const detail = document.querySelector<HTMLElement>(".catalog-v2-detail");
      const section = document.querySelector<HTMLElement>(".catalog-v2-benefits-section");
      const list = section?.querySelector<HTMLElement>("ul");
      const boxes = Array.from(section?.querySelectorAll<HTMLElement>(":scope > ul > li") ?? []);
      const within = (inner: DOMRect, outer: DOMRect) =>
        inner.left >= outer.left - 1 && inner.right <= outer.right + 1;
      if (!detail || !section || !list || boxes.length !== 4) return {
        valid: false,
        faults: ["Missing benefit cards or detail"],
        pageOverflow: true,
      };
      const faults: string[] = [];
      if (!within(section.getBoundingClientRect(), detail.getBoundingClientRect())) faults.push("benefit section extends beyond detail");
      if (!within(list.getBoundingClientRect(), section.getBoundingClientRect())) faults.push("benefit list extends beyond section");
      for (const [index, box] of boxes.entries()) {
        const card = box.getBoundingClientRect();
        if (!within(card, list.getBoundingClientRect())) faults.push(`card ${index} outside list`);
        if (box.scrollWidth > box.clientWidth + 1) faults.push(`card ${index} scrolls horizontally`);
        const content = box.querySelector<HTMLElement>(":scope > div:not(.catalog-v2-benefit-icon)");
        if (!content || !within(content.getBoundingClientRect(), card)) faults.push(`content ${index} outside card`);
        if (content && content.scrollWidth > content.clientWidth + 1) faults.push(`content ${index} overflows`);
        for (const text of box.querySelectorAll<HTMLElement>("strong, p, small")) {
          if (getComputedStyle(text).whiteSpace !== "normal") faults.push(`card ${index} has nowrap text`);
          if (!within(text.getBoundingClientRect(), card)) faults.push(`card ${index} text extends beyond border`);
          if (text.scrollWidth > text.clientWidth + 1) faults.push(`card ${index} text overflows`);
        }
      }
      return {
        valid: faults.length === 0,
        faults,
        pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    expect(geometry.faults, `Benefit overflow at ${viewport.width}x${viewport.height}`).toEqual([]);
    expect(geometry.pageOverflow, `Page overflow at ${viewport.width}x${viewport.height}`).toBe(false);
    if (viewport.width === 1538 && process.env.CAPTURE_APPROVED_TASKS === "1") {
      await page.screenshot({ path: "test-results/benefits-fixed-1538x960.png", animations: "disabled", fullPage: false });
    }
  }
});

test("approved terms modal: four top fact cards, two-column content, two actions and consent safety", async ({ page }) => {
  await openReferenceVolumeCatalog(page);
  const sourceCard = page.locator(".catalog-v2-card").first();
  await sourceCard.hover();
  await expect(sourceCard.locator(".catalog-v2-card-actions")).toHaveCSS("opacity", "1");
  await sourceCard.getByRole("button", { name: "Условия и отклик" }).click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  if (process.env.CAPTURE_APPROVED_TASKS === "1") await page.screenshot({ path: "test-results/approved-geometry-conditions.png", fullPage: false, animations: "disabled" });
  await expect(modal.getByRole("heading", { name: "Условия участия" })).toBeVisible();
  await expect(modal.locator(".catalog-v2-conditions-avatar .catalog-v2-brand-logo")).toHaveAttribute("src", "/task-catalog/brands/sber.svg");

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
  // Approved reference #02 at 1672px is ~657px wide, centered in the
  // viewport. Preserve this geometry without truncating real legal terms.
  expect(geometry.width).toBeGreaterThanOrEqual(630);
  expect(geometry.width).toBeLessThanOrEqual(690);
  expect(Math.abs(geometry.left - (1672 - geometry.width) / 2)).toBeLessThanOrEqual(8);
  expect(geometry.overflow).toBe(false);
  await modal.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(modal).toHaveCount(0);
});
