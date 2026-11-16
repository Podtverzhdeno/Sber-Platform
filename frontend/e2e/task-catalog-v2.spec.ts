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
  await page.getByRole("button", { name: "Impulse — открыть разделы" }).click();
  const drawer = page.getByRole("dialog", { name: "Главное меню" });
  await expect(drawer).toBeVisible();
  const practice = drawer.getByRole("button", { name: "Практика", exact: true });
  if (await practice.getAttribute("aria-expanded") !== "true") await practice.click();
  await drawer.getByRole("link", { name: "Задачи", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Задачи для твоего развития" })).toBeVisible();
  await page.getByRole("button", { name: "Карточки" }).click();
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

  // Desktop reference exposes primary filters immediately; disclosure opens search and saved filters.
  const advanced = page.locator(".catalog-v2-filter-expander");
  await expect(advanced).toHaveAccessibleName("Все фильтры");
  await expect(advanced).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByLabel("Навык", { exact: true })).toBeHidden();
  await advanced.click();
  await expect(advanced).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByLabel("Навык", { exact: true })).toBeVisible();
  await page.getByLabel("Навык", { exact: true }).fill("python");
  await expect(page.getByRole("button", { name: /Сбросить фильтр Навык/ })).toBeVisible();
  await page.getByRole("button", { name: "Список" }).click();
  await expect(page.getByRole("table", { name: "Список рекомендованных задач" })).toBeVisible();
  await page.getByLabel(`Действия с задачей: ${catalogItem.title}`).click();
  await page.getByRole("group", { name: `Действия: ${catalogItem.title}` }).getByRole("button", { name: "Условия и отклик" }).click();
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
  await page.addInitScript(() => { window.localStorage.setItem("impulse-theme", "light"); });
  await openCatalog(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});

// Regression for the light-theme evidence cards reported on 16 November.
// Compare actual computed surfaces and text contrast, not just CSS tokens.
for (const mode of ["light", "blue", "midnight"] as const) {
  for (const width of [320, 390, 1440]) {
    test(`skill evidence cards honor ${mode} theme at ${String(width)}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((visualMode) => {
        localStorage.setItem("impulse-visual-mode", visualMode);
        localStorage.setItem("impulse-theme", visualMode === "light" ? "light" : "dark");
      }, mode);
      await openCatalog(page);
      await expect(page.locator("html")).toHaveAttribute("data-theme", mode === "light" ? "light" : "dark");

      const area = page.locator(".catalog-skill-stats");
      await expect(area.locator(".catalog-skill-stats__list > li")).toHaveCount(1);
      const appearance = await area.evaluate((root) => {
        const pick = (selector: string) => {
          const node = root.querySelector<HTMLElement>(selector);
          if (!node) throw new Error(`Missing evidence element ${selector}`);
          const style = getComputedStyle(node);
          const background = style.backgroundColor.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
          const foreground = style.color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
          return { background, foreground, bounds: node.getBoundingClientRect(), fontSize: Number.parseFloat(style.fontSize) };
        };
        const overview = pick(".catalog-skill-stats__overview > div");
        const card = pick(".catalog-skill-stats__list > li");
        const fact = pick(".catalog-skill-stats__facts > div");
        const label = pick(".catalog-skill-stats__facts small");
        const note = pick(".catalog-skill-stats__list > li p");
        const tag = pick(".catalog-skill-stats__tag");
        const average = (rgb: number[]) => rgb.reduce((sum, channel) => sum + channel, 0) / 3;
        const luminance = (rgb: number[]) => rgb.map(channel => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
        const contrast = (one: number[], two: number[]) => {
          const a = luminance(one), b = luminance(two);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        };
        return {
          overviewBrightness: average(overview.background),
          cardBrightness: average(card.background),
          factBrightness: average(fact.background),
          noteContrast: contrast(note.foreground, card.background),
          labelContrast: contrast(label.foreground, fact.background),
          tagContrast: contrast(tag.foreground, card.background),
          noteFontSize: note.fontSize,
          labelFontSize: label.fontSize,
          cardRight: card.bounds.right,
          cardLeft: card.bounds.left,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      if (mode === "light") {
        expect(appearance.overviewBrightness).toBeGreaterThan(225);
        expect(appearance.cardBrightness).toBeGreaterThan(240);
        expect(appearance.factBrightness).toBeGreaterThan(230);
      } else {
        expect(appearance.overviewBrightness).toBeLessThan(80);
        expect(appearance.cardBrightness).toBeLessThan(80);
        expect(appearance.factBrightness).toBeLessThan(80);
      }
      expect(appearance.noteContrast).toBeGreaterThanOrEqual(4.5);
      expect(appearance.labelContrast).toBeGreaterThanOrEqual(4.5);
      expect(appearance.tagContrast).toBeGreaterThanOrEqual(4.5);
      expect(appearance.noteFontSize).toBeGreaterThanOrEqual(11);
      expect(appearance.labelFontSize).toBeGreaterThanOrEqual(11);
      expect(appearance.cardLeft).toBeGreaterThanOrEqual(-1);
      expect(appearance.cardRight).toBeLessThanOrEqual(width + 1);
      expect(appearance.overflow).toBeLessThanOrEqual(2);
    });
  }
}

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
  await expect(page.getByText("Задачи для твоего развития")).toBeVisible();
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
  const planned = page.locator(".catalog-v2-detail .catalog-v2-workflow-extra");
  await expect(planned.locator("summary")).toContainText(`План выполнения (${String(catalogItem.stage_plan.stages.length)})`);
  await planned.locator("summary").click();
  await expect(planned.locator("li")).toHaveCount(catalogItem.stage_plan.stages.length);
  await expect(planned).toContainText("Это план, а не прогресс выполнения");
  await expect.poll(() =>
    page.locator(".catalog-v2-inspector").evaluate((node) => node.getBoundingClientRect().top),
  ).toBeLessThan(844);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});


/* task workflow tabs preserve roving keyboard focus and readable touch targets. */
for (const mode of ["light", "blue", "midnight"] as const) {
  for (const width of [320, 390, 1440]) {
    test(`task workflow tabs remain accessible in ${mode} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value: string) => {
        localStorage.setItem("impulse-visual-mode", value);
        localStorage.setItem("impulse-theme", value === "light" ? "light" : "dark");
      }, mode);
      await openCatalog(page);
      await page.getByRole("button", { name: "Подробнее" }).first().click();
      const detail = page.locator(".catalog-v2-detail");
      await expect(detail).toBeVisible();
      const tablist = detail.getByRole("tablist", { name: "Разделы задачи" });
      await expect(tablist.getByRole("tab")).toHaveCount(4);
      const overview = tablist.getByRole("tab", { name: "О задаче" });
      const criteria = tablist.getByRole("tab", { name: "Критерии" });
      const result = tablist.getByRole("tab", { name: "Результат" });

      await expect(overview).toHaveAttribute("aria-selected", "true");
      await expect(overview).toHaveAttribute("tabindex", "0");
      await overview.focus();
      await page.keyboard.press("ArrowRight");
      await expect(criteria).toHaveAttribute("aria-selected", "true");
      await expect(criteria).toHaveAttribute("tabindex", "0");
      await expect(criteria).toBeFocused();
      await expect(page.getByRole("tabpanel", { name: "Критерии" })).toBeVisible();
      await expect(overview).toHaveAttribute("tabindex", "-1");

      await page.keyboard.press("End");
      await expect(result).toBeFocused();
      await expect(result).toHaveAttribute("aria-selected", "true");
      await page.keyboard.press("Home");
      await expect(overview).toBeFocused();
      await page.keyboard.press("ArrowLeft");
      await expect(result).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(overview).toBeFocused();

      const metrics = await detail.evaluate((node) => {
        const tabs = Array.from(node.querySelectorAll<HTMLButtonElement>('.catalog-v2-workflow-tabs [role="tab"]'));
        const buttons = Array.from(node.querySelectorAll<HTMLButtonElement>(".catalog-v2-workflow-action"));
        const disclosure = node.querySelector<HTMLElement>(".catalog-v2-workflow-extra summary");
        return {
          tabHeights: tabs.map((tab) => tab.getBoundingClientRect().height),
          actionHeights: buttons.map((button) => button.getBoundingClientRect().height),
          disclosureHeight: disclosure?.getBoundingClientRect().height ?? 44,
          pageWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
        };
      });
      expect(Math.min(...metrics.tabHeights)).toBeGreaterThanOrEqual(44);
      expect(metrics.actionHeights.every((height) => height >= 44)).toBe(true);
      expect(metrics.disclosureHeight).toBeGreaterThanOrEqual(44);
      expect(metrics.pageWidth - metrics.viewportWidth).toBeLessThanOrEqual(2);

      if (mode === "light") {
        await expect(overview).toHaveCSS("background-color", "rgb(234, 243, 255)");
        await expect(detail.locator(".catalog-v2-workflow-panel")).toHaveCSS("background-color", "rgb(255, 255, 255)");
      }
    });
  }
}
