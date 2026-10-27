import { expect, test } from "@playwright/test";
import { bootcampCatalogFixture, installBootcampReferenceApi } from "./bootcamp-reference-fixtures";

test.beforeEach(async ({ page }) => { await installBootcampReferenceApi(page); });

/**
 * BC-R01..BC-R05 responsive, interaction and navigation invariants.
 * These are NOT golden PNG comparisons; visual equality needs the original
 * archived five design references in the Playwright snapshot directory.
 */
const viewports = [
  { width: 1448, height: 1086 },
  { width: 1280, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 780 },
] as const;

for (const viewport of viewports) {
  test(`Bootcamp approved layout, filters and dialog at ${String(viewport.width)}x${String(viewport.height)}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator('[data-persona="participant-alex"]').click();
    if (viewport.width < 1024) {
      await page.getByRole("button", { name: "Меню", exact: true }).click();
    }
    await page.getByRole("link", { name: "Bootcamp" }).click();

    const shell = page.locator(".bc-reference");
    await expect(shell.getByRole("heading", { name: "Bootcamp", exact: true })).toBeVisible();
    await expect(shell.getByRole("heading", { name: "Каталог курсов", exact: true })).toHaveCount(1);
    const cards = shell.locator(".bc-ref-course-card");
    await expect(cards.first()).toBeVisible();

    const noPageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    );
    expect(noPageOverflow, "Bootcamp must not horizontally overflow the page").toBe(true);

    const locked = shell.locator('.bc-ref-course-card[data-access="prerequisite_not_met"]');
    const open = shell.locator('.bc-ref-course-card[data-access="available"]');
    if (await locked.count() > 0 && await open.count() > 0) {
      const first = await locked.first().boundingBox();
      const second = await open.first().boundingBox();
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      if (first !== null && second !== null) {
        expect(Math.abs(first.width - second.width), "locked cards keep the catalog grid width").toBeLessThanOrEqual(1);
      }
    }

    const keysInCards = await cards.evaluateAll((nodes) =>
      nodes.map((element) => element.getAttribute("data-testid")),
    );
    const toggle = shell.getByRole("group", { name: "Вид каталога" });
    await toggle.getByRole("button", { name: "Список" }).click();
    await expect(page).toHaveURL(/view=list/);
    await expect(shell.getByRole("list", { name: "Каталог Bootcamp списком" })).toBeVisible();
    const keysInList = await shell.locator(".bc-ref-course-row").evaluateAll((nodes) =>
      nodes.map((element) => element.getAttribute("data-testid")),
    );
    expect(keysInList).toEqual(keysInCards);
    await toggle.getByRole("button", { name: "Карточки" }).click();
    await expect(page).not.toHaveURL(/view=list/);

    await shell.locator(".bc-ref-course-card[data-access=\"available\"]").first().getByRole("button", { name: /Открыть курс|Посмотреть курс/ }).click();
    const details = page.getByRole("dialog", { name: "Информация о курсе" });
    await expect(details).toBeVisible();
    await expect(details.getByTestId("impulse-immersive-reader")).toBeVisible();
    await details.getByRole("button", { name: "Перейти к программе" }).click();
    await expect(details.getByText("Программа курса", { exact: true }).first()).toBeVisible();
    await details.getByRole("button", { name: "Почему рекомендован" }).click();
    const reason = page.getByRole("dialog", { name: "Почему рекомендован" });
    await expect(reason).toBeVisible();
    await expect(reason.getByRole("button", { name: "Закрыть" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).not.toHaveURL(/course=/);

    await page.screenshot({
      path: `test-results/bootcamp-approved-${String(viewport.width)}x${String(viewport.height)}.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
}


test("Bootcamp cards respond to hover and keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 1448, height: 1086 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Bootcamp" }).click();

  const card = page.locator('[data-reference="BC-R01"] .bc-ref-course-card[data-access="available"]').first();
  await expect(card).toBeVisible();
  const before = await card.evaluate((node) => ({
    border: getComputedStyle(node).borderTopColor,
    shadow: getComputedStyle(node).boxShadow,
  }));
  await card.hover();
  await expect.poll(() => card.evaluate((node) => getComputedStyle(node).borderTopColor))
    .not.toBe(before.border);
  await expect.poll(() => card.evaluate((node) => getComputedStyle(node).boxShadow))
    .not.toBe(before.shadow);

  await card.getByRole("button", { name: /Открыть курс|Посмотреть курс/ }).focus();
  await expect(card.getByRole("button", { name: /Открыть курс|Посмотреть курс/ })).toBeFocused();
  await card.getByRole("button", { name: /Открыть курс|Посмотреть курс/ }).click();
  await expect(page.getByRole("dialog", { name: "Информация о курсе" })).toBeVisible();
});


test("Bootcamp reference grid column count and card minimum heights", async ({ page }) => {
  await page.setViewportSize({ width: 1448, height: 1086 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Bootcamp" }).click();
  const grid = page.locator('[data-reference="BC-R01"] .bc-ref-course-grid');
  await expect(grid).toBeVisible();
  const columns = await grid.evaluate((node) =>
    getComputedStyle(node).gridTemplateColumns.split(" ").filter(Boolean).length
  );
  expect(columns).toBe(4);
  const available = grid.locator('.bc-ref-course-card[data-access="available"]').first();
  await expect(available).toBeVisible();
  const height = await available.evaluate((node) => parseFloat(getComputedStyle(node).minHeight));
  expect(height).toBeGreaterThanOrEqual(280);
  expect(height).toBeLessThanOrEqual(300);
});


test("course reader fills viewport and lesson navigation never clips", async ({ page }) => {
  await page.setViewportSize({ width: 1448, height: 1086 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Bootcamp" }).click();
  await page.getByTestId("course-demo-course-2").getByRole("button", { name: /Открыть курс|Посмотреть курс/ }).click();
  const dialog = page.getByRole("dialog", { name: "Информация о курсе" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("impulse-immersive-reader")).toBeVisible();
  await dialog.getByRole("button", { name: /Перейти к программе/ }).click();
  await dialog.locator(".imp-study__program-list button").first().click();
  await expect(dialog.locator(".imp-study__grid")).toBeVisible();
  const geometry = await dialog.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
  });
  expect(geometry.x).toBe(0);
  expect(geometry.y).toBe(0);
  expect(geometry.width).toBe(1448);
  expect(geometry.height).toBe(1086);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  const next = dialog.getByRole("button", { name: /Следующий урок/ });
  await expect(next).toBeVisible();
  const buttonBounds = await next.boundingBox();
  expect(buttonBounds).not.toBeNull();
  if (buttonBounds) {
    expect(buttonBounds.x).toBeGreaterThanOrEqual(0);
    expect(buttonBounds.x + buttonBounds.width).toBeLessThanOrEqual(1449);
  }
  await next.click();
  await expect(dialog.locator(".imp-study__lesson-heading .imp-study__eyebrow")).toContainText("Урок 2 из");
  await dialog.getByRole("button", { name: "Закрыть" }).click();
  await expect(dialog).toHaveCount(0);
});


test("mobile fullscreen reader keeps lesson controls usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await page.getByRole("link", { name: "Bootcamp" }).click();
  await page.getByTestId("course-demo-course-2").getByRole("button", { name: /Открыть курс|Посмотреть курс/ }).click();
  const dialog = page.getByRole("dialog", { name: "Информация о курсе" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /Перейти к программе/ }).click();
  await dialog.locator(".imp-study__program-list button").first().click();
  await expect(dialog.locator(".imp-study__grid")).toBeVisible();
  const dimensions = await dialog.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  expect(dimensions.x).toBe(0);
  expect(dimensions.y).toBe(0);
  expect(dimensions.width).toBe(390);
  expect(dimensions.height).toBe(844);
  const next = dialog.getByRole("button", { name: "Следующий урок" });
  await next.scrollIntoViewIfNeeded();
  await expect(next).toBeEnabled();
  const bounds = await next.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds) {
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(391);
  }
  await next.click();
  await expect(dialog.locator(".imp-study__lesson-heading .imp-study__eyebrow")).toContainText("Урок 2 из");
  await dialog.getByRole("button", { name: "Закрыть" }).click();
  await expect(dialog).toHaveCount(0);
});


test("Bootcamp role choice and direction are independent; reset clears hidden constraints", async ({ page }) => {
  await page.setViewportSize({ width: 1448, height: 1086 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Bootcamp" }).click();

  const shell = page.locator(".bc-reference");
  const categories = shell.getByRole("group", { name: "Категории курсов" });
  const direction = shell.locator(".bc-ref-controls .bc-ref-select select").first();
  const search = shell.getByRole("searchbox", { name: "Поиск по курсам" });

  await categories.getByRole("button", { name: /Все курсы/ }).click();
  await expect(categories.getByRole("button", { name: /Все курсы/ })).toHaveAttribute("aria-pressed", "true");
  // The deterministic fixture contains 12 published courses; wait for the
  // async category change before comparing filtered/unfiltered totals.
  await expect(shell.locator(".bc-ref-course-card")).toHaveCount(12);
  const allCount = await shell.locator(".bc-ref-course-card").count();
  expect(allCount).toBeGreaterThan(0);

  const directionOptions = await direction.locator("option").count();
  if (directionOptions > 1) {
    await direction.selectOption({ index: 1 });
    const filteredCount = await shell.locator(".bc-ref-course-card").count();
    expect(filteredCount).toBeLessThanOrEqual(allCount);
    await direction.selectOption("all");
    await expect(direction).toHaveValue("all");
    await expect(shell.locator(".bc-ref-course-card")).toHaveCount(allCount);
  }

  const roles = shell.getByRole("group", { name: "Направление обучения" }).getByRole("button");
  if (await roles.count() > 1) {
    await roles.nth(1).click();
    await expect(roles.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(direction).toHaveValue("all");
    await categories.getByRole("button", { name: /Все курсы/ }).click();
    await expect(shell.locator(".bc-ref-course-card")).toHaveCount(allCount);
  }

  await search.fill("a-course-that-does-not-exist-2026");
  await expect(shell.locator(".bc-ref-empty")).toBeVisible();
  await shell.getByRole("button", { name: "Сбросить фильтры" }).click();
  await expect(search).toHaveValue("");
  await expect(direction).toHaveValue("all");
  await expect(shell.locator(".bc-ref-course-card").first()).toBeVisible();
});

test("Bootcamp desktop reference hero has correct stagger, overlay, and grid density", async ({ page }) => {
  await page.setViewportSize({ width: 1448, height: 1086 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Bootcamp" }).click();
  const shell = page.locator(".bc-reference");
  const tabs = await shell.locator(".bc-ref-role-tabs").boundingBox();
  const hero = await shell.locator(".bc-ref-hero-grid").boundingBox();
  const summary = await shell.locator(".bc-ref-role-summary").boundingBox();
  const categories = await shell.locator(".bc-ref-category-tabs").boundingBox();
  const cards = shell.locator(".bc-ref-course-card");
  expect(tabs).not.toBeNull();
  expect(hero).not.toBeNull();
  expect(summary).not.toBeNull();
  expect(categories).not.toBeNull();
  if (tabs && hero && summary && categories) {
    // Current reference: the right role summary aligns with the left learning card;
    // the catalog starts after the shared hero row, without overlapping it.
    expect(Math.abs(hero.y - (tabs.y + tabs.height + 15))).toBeLessThanOrEqual(3);
    expect(Math.abs(summary.y - hero.y)).toBeLessThanOrEqual(3);
    expect(Math.abs(categories.y - (hero.y + hero.height + 18))).toBeLessThanOrEqual(4);
  }
  const standard = cards.filter({ has: page.locator(".bc-ref-chip--available") }).first();
  await expect(standard).toBeVisible();
  expect(await standard.evaluate(node => parseFloat(getComputedStyle(node).minHeight))).toBe(296);
});


test("Bootcamp required-course popup follows reference and never invents progress", async ({ page }) => {
  await page.setViewportSize({ width: 1448, height: 1086 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Bootcamp" }).click();
  const shell = page.locator(".bc-reference");

  await shell.getByRole("button", { name: "Посмотреть учебные и практические требования" }).click();
  const dialog = page.getByRole("dialog", { name: "Требования к обучению" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".bc-ref-required-hero")).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Что нужно завершить" })).toBeVisible();
  await expect(dialog.locator(".bc-ref-required-progress")).toHaveCount(0);

  const requirements = dialog.locator(".bc-ref-required-list > li");
  if (await requirements.count() > 0) {
    await requirements.first().getByRole("button", { name: /Открыть|Условия/ }).click();
    await expect(page.getByRole("dialog", { name: "Информация о курсе" })).toBeVisible();
  } else {
    await dialog.getByRole("button", { name: /Вернуться в каталог/ }).click();
    await expect(dialog).toHaveCount(0);
  }
});

test("Bootcamp recommendation popup opens real course details", async ({ page }) => {
  await page.setViewportSize({ width: 1448, height: 1086 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Bootcamp" }).click();
  const shell = page.locator(".bc-reference");
  const reason = shell.locator(".bc-ref-reason").first();
  await expect(reason).toBeVisible();
  await reason.click();
  const dialog = page.getByRole("dialog", { name: "Почему рекомендован" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".bc-ref-why-item")).toHaveCount(4);
  await dialog.getByRole("button", { name: "Вернуться к курсу" }).click();
  await expect(page.getByRole("dialog", { name: "Информация о курсе" })).toBeVisible();
});


test("Bootcamp role catalog starts as 4+1 cards and expands without losing filters", async ({ page }) => {
  await page.setViewportSize({ width: 1448, height: 1086 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Bootcamp" }).click();
  const shell = page.locator(".bc-reference");
  const cards = shell.locator(".bc-ref-course-card");
  await expect(cards.first()).toBeVisible();
  const initial = await cards.count();
  expect(initial).toBeGreaterThan(0);
  expect(initial).toBeLessThanOrEqual(5);

  const more = shell.getByRole("button", { name: /Показать ещё.*курсов для роли/ });
  if (await more.count()) {
    await more.click();
    expect(await cards.count()).toBeGreaterThan(initial);
  }
  await shell.getByRole("group", { name: "Вид каталога" })
    .getByRole("button", { name: "Список" }).click();
  await expect(shell.getByRole("list", { name: "Каталог Bootcamp списком" })).toBeVisible();
  await shell.getByRole("group", { name: "Вид каталога" })
    .getByRole("button", { name: "Карточки" }).click();
  await expect(cards.first()).toBeVisible();
});


test("all seven AI trajectory roles remain reachable through horizontal controls", async ({ page }) => {
  await installBootcampReferenceApi(page);
  await page.setViewportSize({ width: 1448, height: 1086 });
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Bootcamp" }).click();
  const tabs = page.getByRole("group", { name: "Направление обучения" });
  await expect(tabs.getByRole("button", { name: "AI Architect", exact: true })).toHaveAttribute("aria-pressed", "true");
  const next = page.getByRole("button", { name: "Следующие AI-роли" });
  await expect(next).toBeVisible();
  await next.click();
  await expect.poll(() => tabs.evaluate(element => element.scrollLeft)).toBeGreaterThan(100);
  const product = tabs.getByRole("button", { name: "AI Product Engineer", exact: true });
  await product.scrollIntoViewIfNeeded();
  await product.click();
  await expect(product).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Моя роль: AI Product Engineer" })).toBeVisible();
  await expect(page.getByTestId("course-demo-course-6")).toBeVisible();
});


test("Bootcamp primary actions share a baseline with or without recommendation links", async ({ page }) => {
  await page.route("**/api/v1/me/bootcamp/catalog", route => route.fulfill({
    json: bootcampCatalogFixture.map(card => card.key === "demo-course-8"
      ? { ...card, relevant: false }
      : card),
  }));
  await page.goto("/");
  await page.locator('[data-persona="participant-alex"]').click();
  await page.getByRole("link", { name: "Bootcamp" }).click();
  // Non-recommended cards are deliberately hidden in the default personalized tab.
  // Select the full catalog to verify both CTA variants in the same row.
  await page.getByRole("group", { name: "Категории курсов" }).getByRole("button", { name: /Все курсы/ }).click();
  // The direction filter is independent of the catalog category. Without
  // selecting "all", the non-recommended fixture card belongs to another
  // direction and is never rendered, making the mixed-row assertion invalid.
  await page.locator(".bc-ref-controls .bc-ref-select select").first().selectOption("all");
  await expect(page.locator(".bc-ref-course-card")).toHaveCount(bootcampCatalogFixture.length);
  await expect(page.locator('[data-testid="course-demo-course-8"] .bc-ref-reason')).toHaveCount(0);
  await expect(page.locator('.bc-ref-course-card .bc-ref-reason').first()).toBeVisible();
  for (const width of [1448, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    const cards = await page.locator(".bc-ref-course-card").evaluateAll(elements =>
      elements.map(element => {
        const card = element.getBoundingClientRect();
        const cta = element.querySelector(".bc-ref-card-bottom .bc-ref-primary")?.getBoundingClientRect();
        return {
          row: Math.round(card.top),
          top: cta?.top ?? -1,
          hasReason: Boolean(element.querySelector(".bc-ref-reason")),
        };
      }),
    );
    const rows = new Map<number, typeof cards>();
    for (const card of cards) rows.set(card.row, [...(rows.get(card.row) ?? []), card]);
    let mixedRowChecked = false;
    for (const row of rows.values()) {
      if (row.length < 2) continue;
      const tops = row.map(card => card.top);
      expect(Math.max(...tops) - Math.min(...tops), `misaligned CTAs at ${String(width)}px`).toBeLessThanOrEqual(2);
      if (row.some(card => card.hasReason) && row.some(card => !card.hasReason)) mixedRowChecked = true;
    }
    expect(mixedRowChecked, `fixture needs recommended and ordinary courses at ${String(width)}px`).toBe(true);
  }
});
