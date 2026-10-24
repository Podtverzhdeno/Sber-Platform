import { expect, test, type Page } from "@playwright/test";

import { catalogItem, catalogPage, catalogTerms, insufficientItem } from "../src/features/task-catalog-v2/fixture";
import type { CatalogItem } from "../src/features/task-catalog-v2/types";

const participant = {
  person_id: "00000000-0000-0000-0000-000000000001",
  display_name: "Синтетический участник",
  active_role: "participant",
  assigned_roles: ["participant"],
  scopes: [],
  consent_scopes: [],
  navigation: ["Мой путь", "Задачи", "Мои проекты"],
  csrf_token: "csrf-task-actions",
};

async function openCatalog(page: Page, items: CatalogItem[] = [catalogItem, insufficientItem]) {
  // All endpoints not explicitly mocked below return a deterministic 404;
  // this suite is an isolated browser contract and does not depend on a running backend.
  await page.route("**/api/v1/**", (route) => route.fulfill({ status: 404, json: { code: "NOT_MOCKED" } }));
  await page.route("**/api/v1/me/**", (route) => route.fulfill({
    status: 404, json: { code: "NOT_MOCKED" },
  }));
  await page.route("**/api/v1/config", (route) => route.fulfill({ json: {
    honor_board_enabled: false, task_catalog_v2_enabled: true, demo_mode: true,
  } }));
  await page.route("**/api/v1/auth/personas", (route) => route.fulfill({ json: [
    { key: "participant-synthetic", display_name: participant.display_name, roles: ["participant"] },
  ] }));
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => route.fulfill({ json: participant }));
  await page.route("**/api/v1/development/tracks", (route) => route.fulfill({ json: {
    active_count: 1, max_active: 2, tracks: [],
  } }));
  await page.route("**/api/v1/me/roadmaps", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/me/task-recommendations?*", (route) => route.fulfill({ json: catalogPage(items) }));
  for (const item of items) {
    await page.route(`**/api/v1/me/task-recommendations/${item.task_id}`, (route) => route.fulfill({ json: item }));
    await page.route(`**/api/v1/me/task-recommendations/${item.task_id}/terms`, (route) => route.fulfill({ json: {
      ...catalogTerms, task_id: item.task_id,
    } }));
  }
  await page.route("**/api/v1/me/task-recommendations/analytics/events", (route) => route.fulfill({
    status: 202, json: { event_id: "00000000-0000-4000-8000-000000000902", duplicate: false },
  }));
  await page.goto("/");
  await page.locator('[data-persona="participant-synthetic"]').click();
  await page.getByRole("link", { name: "Задачи" }).click();
  await expect(page.getByRole("heading", { name: "Задачи для твоего развития" })).toBeVisible();
}

test.describe("task catalog interactive controls and motion", () => {
  test.use({ viewport: { width: 1672, height: 941 } });

  test("card hover highlights it; bookmark and share work without selecting a task", async ({ page }) => {
    let bookmarkSaved: boolean | undefined;
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async () => Promise.resolve() },
      });
    });
    await openCatalog(page);
    await page.route(`**/api/v1/me/task-recommendations/${catalogItem.task_id}/bookmark`, (route) => {
      const body = route.request().postDataJSON() as { saved: boolean };
      bookmarkSaved = body.saved;
      return route.fulfill({ json: { task_id: catalogItem.task_id, saved: bookmarkSaved } });
    });
    const first = page.locator(".catalog-v2-card").first();
    await first.hover();
    await expect.poll(() => first.evaluate((node) => getComputedStyle(node).transform)).not.toBe("none");
    await expect(first.locator(".catalog-v2-card-actions")).toBeVisible();
    await first.getByRole("button", { name: "Сохранить" }).click();
    await expect.poll(() => bookmarkSaved).toBe(true);
    await expect(page.getByText("Задача сохранена.")).toBeVisible();
    await expect(page).not.toHaveURL(/task=/);

    await first.getByRole("button", { name: "Поделиться" }).click();
    await expect(page.getByText(/Ссылка на задачу скопирована/)).toBeVisible();
    await expect(page).not.toHaveURL(/task=/);
  });

  test("detail controls work, growth panel toggles and terms modal closes by Escape", async ({ page }) => {
    await openCatalog(page);
    const first = page.locator(".catalog-v2-card").first();
    await first.hover();
    await first.getByRole("button", { name: /Подробнее/ }).click();
    await expect(page).toHaveURL(new RegExp(`task=${catalogItem.task_id}`));
    await expect(page.getByRole("heading", { name: "Развитие твоих навыков" })).toBeVisible();
    await page.getByRole("button", { name: "Скрыть сравнение уровней" }).click();
    await expect(page.getByRole("button", { name: "Показать сравнение уровней" })).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "Показать сравнение уровней" }).click();
    await expect(page.getByRole("button", { name: "Скрыть сравнение уровней" })).toHaveAttribute("aria-expanded", "true");

    await page.getByRole("button", { name: "Посмотреть условия", exact: true }).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("button", { name: "Подтвердить и отправить отклик" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    await page.getByRole("button", { name: "Закрыть детали" }).click();
    await expect(page).not.toHaveURL(/task=/);
  });

  test("list view row, keyboard and controls preserve filters and selected task", async ({ page }) => {
    await openCatalog(page);
    let secondBookmarkSaved: boolean | undefined;
    await page.route(`**/api/v1/me/task-recommendations/${insufficientItem.task_id}/bookmark`, (route) => {
      const body = route.request().postDataJSON() as { saved: boolean };
      secondBookmarkSaved = body.saved;
      return route.fulfill({ json: { task_id: insufficientItem.task_id, saved: body.saved } });
    });
    await page.getByRole("button", { name: "Список" }).click();
    const table = page.getByRole("table", { name: "Список рекомендованных задач" });
    await expect(table).toBeVisible();
    await expect(page.getByRole("button", { name: "Список" })).toHaveAttribute("aria-pressed", "true");
    const rows = table.locator(".catalog-v2-table-row");
    await rows.first().focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`task=${catalogItem.task_id}`));
    await rows.first().focus();
    await page.keyboard.press("ArrowDown");
    await expect(rows.nth(1)).toBeFocused();
    await rows.nth(1).getByRole("button", { name: "Сохранено" }).click();
    await expect.poll(() => secondBookmarkSaved).toBe(false);
    await expect(page).toHaveURL(new RegExp(`task=${catalogItem.task_id}`));
    await page.getByRole("button", { name: "Карточки" }).click();
    await expect(page).toHaveURL(/catalog_view=cards/);
    await expect(page).toHaveURL(new RegExp(`task=${catalogItem.task_id}`));
  });

  test("search, saved filter and reset buttons update the server-bound URL", async ({ page }) => {
    await openCatalog(page);
    await page.getByRole("button", { name: "Все фильтры" }).click();
    const search = page.getByLabel("Поиск", { exact: true });
    await search.fill("Прототип");
    await page.getByRole("button", { name: "Найти" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("Прототип");
    const saved = page.getByRole("checkbox", { name: "Только сохранённые" });
    await saved.click();
    await expect.poll(() => new URL(page.url()).searchParams.get("saved")).toBe("true");
    await expect(saved).toBeChecked();
    await page.getByRole("button", { name: "Сбросить фильтры" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get("saved")).toBeNull();
  });

  test("read-only terms button opens modal, but blocked user cannot apply", async ({ page }) => {
    const readOnly: CatalogItem = {
      ...catalogItem,
      task_id: "00000000-0000-4000-8000-000000000103",
      title: "Задача с ограничением по условиям",
      allowed_actions: ["open_conditions", "bookmark", "share"],
      eligibility: {
        status: "ineligible",
        reason_codes: ["PREREQUISITES_NOT_MET"],
        missing_prerequisites: ["python-advanced"],
      },
    };
    let submissions = 0;
    await openCatalog(page, [readOnly]);
    await page.route("**/api/v1/me/tasks/*/applications", (route) => {
      submissions += 1;
      return route.fulfill({ status: 403, json: { code: "FORBIDDEN" } });
    });
    await page.locator(".catalog-v2-card").first().getByRole("button", { name: "Посмотреть условия" }).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/Отклик сейчас недоступен/)).toBeVisible();
    await expect(modal.getByRole("checkbox")).toBeDisabled();
    await expect(modal.getByRole("button", { name: "Подтвердить и отправить отклик" })).toBeDisabled();
    expect(submissions).toBe(0);
    await modal.getByRole("button", { name: "Закрыть условия" }).click();
    await expect(modal).toHaveCount(0);
  });

  test("reduced motion removes transitions without disabling clicks", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openCatalog(page);
    const card = page.locator(".catalog-v2-card").first();
    await card.hover();
    const motion = await card.evaluate((node) => ({
      transition: getComputedStyle(node).transitionDuration,
      transform: getComputedStyle(node).transform,
    }));
    expect(motion.transition).toBe("0s");
    expect(motion.transform).toBe("none");
    await card.getByRole("button", { name: /Подробнее/ }).click();
    await expect(page).toHaveURL(new RegExp(`task=${catalogItem.task_id}`));
  });
  test("mobile card, conditions and list actions remain reachable without horizontal overflow", async ({ page }) => {
    await openCatalog(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const card = page.locator(".catalog-v2-card").first();
    await expect(card).toBeVisible();
    const openTerms = card.getByRole("button", { name: "Условия и отклик" });
    await expect(openTerms).toBeVisible();
    await openTerms.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Закрыть условия" }).click();
    await expect(dialog).toHaveCount(0);

    await page.getByRole("button", { name: "Список" }).click();
    const rows = page.locator(".catalog-v2-table-row");
    await expect(rows).toHaveCount(2);
    await rows.first().getByRole("button", { name: "Подробнее" }).click();
    await expect(page.getByRole("heading", { name: "Этапы задачи" })).toBeVisible();
    const hasOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(hasOverflow).toBe(false);
  });

});
