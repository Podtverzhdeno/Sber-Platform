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

async function openCatalog(page: Page, items: CatalogItem[] = [catalogItem, insufficientItem], initialView: "cards" | "default" = "cards") {
  let demoAuthenticated = false;
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
  await page.route("**/api/v1/me", (route) => route.fulfill(demoAuthenticated
    ? { json: participant }
    : { status: 401, json: { code: "AUTH_REQUIRED" } }));
  await page.route("**/api/v1/auth/demo-login", (route) => {
    demoAuthenticated = true;
    return route.fulfill({ json: participant });
  });
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
  if (initialView === "cards") await page.getByRole("button", { name: "Карточки" }).click();
}

test.describe("task catalog interactive controls and motion", () => {
  test.use({ viewport: { width: 1672, height: 941 } });

  test("Tasks defaults to list but honors an explicit cards selection", async ({ page }) => {
    await openCatalog(page, [catalogItem, insufficientItem], "default");
    await expect(page.getByRole("button", { name: "Список" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("table", { name: "Список рекомендованных задач" })).toBeVisible();
    await page.getByRole("button", { name: "Карточки" }).click();
    await expect(page.getByRole("button", { name: "Карточки" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".catalog-v2-card")).toHaveCount(2);
    await page.reload();
    await expect(page.getByRole("button", { name: "Карточки" })).toHaveAttribute("aria-pressed", "true");
  });


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
    await page.getByRole("button", { name: "Скрыть подробности" }).click();
    await expect(page.getByRole("button", { name: "Показать подробности" })).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "Показать подробности" }).click();
    await expect(page.getByRole("button", { name: "Скрыть подробности" })).toHaveAttribute("aria-expanded", "true");

    await page.getByRole("button", { name: "Посмотреть условия", exact: true }).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("button", { name: "Подтвердить и отправить отклик" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    await page.getByRole("button", { name: "Закрыть детали" }).click();
    await expect(page).not.toHaveURL(/task=/);
  });

  test("task detail displays real accepted skill evidence and truthful unknown levels", async ({ page }) => {
    const baseImpact = catalogItem.skill_impact[0];
    if (!baseImpact) throw new Error("Fixture must have a primary skill impact");
    const item: CatalogItem = {
      ...catalogItem,
      competency_tags: ["python", "recommender-systems"],
      skill_impact: [
        { ...baseImpact, accepted_evidence_count: 2, last_evidence_submitted_at: "2026-10-20T12:00:00Z" },
        {
          ...baseImpact,
          skill_id: "recommender-systems", title: "Рекомендательные системы",
          accepted_evidence_count: 0, last_evidence_submitted_at: null,
        },
      ],
    };
    await openCatalog(page, [item]);
    const first = page.locator(".catalog-v2-card").first();
    await first.hover();
    await first.getByRole("button", { name: /Подробнее/ }).click();
    const stats = page.getByRole("region", { name: "Статистика навыков задачи" });
    await expect(stats).toBeVisible();
    await expect(stats.locator(".catalog-skill-stats__overview")).toContainText("1 из 2");
    await expect(stats.locator(".catalog-skill-stats__overview")).toContainText("50%");
    await expect(stats.getByText("Принято личных работ")).toHaveCount(2);
    await expect(stats.getByText("Не оценивался")).toHaveCount(2);
    await expect(stats.getByText("Пока неизвестно")).toHaveCount(2);
    await expect(stats.getByText("Есть принятые работы")).toBeVisible();
    await expect(stats.getByText("Работ пока нет")).toBeVisible();
    await expect(stats.getByText("Без числового прогноза")).toHaveCount(0);
    await page.screenshot({path: "test-results/task-skill-evidence-statistics.png", animations: "disabled", fullPage: true});
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
    const menu = rows.nth(1).locator(".catalog-v2-table-menu");
    await menu.locator("summary").click();
    await expect(menu).toHaveAttribute("open", "");
    await menu.getByRole("button", { name: "Сохранено" }).click();
    await expect.poll(() => secondBookmarkSaved).toBe(false);
    await expect(page).toHaveURL(new RegExp(`task=${catalogItem.task_id}`));
    await page.getByRole("button", { name: "Карточки" }).click();
    await expect(page).toHaveURL(/catalog_view=cards/);
    await expect(page).toHaveURL(new RegExp(`task=${catalogItem.task_id}`));
  });

  test("compact list actions are accessible without activating the underlying row", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async () => Promise.resolve() },
      });
    });
    await openCatalog(page);
    await page.getByRole("button", { name: "Список" }).click();
    const first = page.locator(".catalog-v2-table-row").first();
    await expect(first.getByRole("button", { name: "Подробнее" })).toBeVisible();
    const disclosure = first.locator(".catalog-v2-table-menu");
    const trigger = disclosure.locator("summary");
    await expect(trigger).toHaveAttribute("aria-label", /Действия с задачей/);
    await trigger.click();
    await expect(disclosure).toHaveAttribute("open", "");
    await expect(page).not.toHaveURL(/task=/);
    await disclosure.getByRole("button", { name: "Поделиться" }).click();
    await expect(page.getByText(/Ссылка на задачу скопирована/)).toBeVisible();
    await expect(page).not.toHaveURL(/task=/);
    await disclosure.getByRole("button", { name: "Условия и отклик" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).not.toHaveURL(/task=/);
    await first.getByRole("button", { name: "Подробнее" }).click();
    await expect(page).toHaveURL(new RegExp(`task=${catalogItem.task_id}`));
  });

  test("source-style competency labels are readable but filters still use exact API keys", async ({ page }) => {
    await openCatalog(page);
    const first = page.locator(".catalog-v2-card").first();
    await expect(first.locator(".catalog-v2-tags")).toContainText("Python");
    await expect(first.locator(".catalog-v2-tags")).toContainText("Рекомендательные системы");
    await page.getByRole("button", { name: "Список" }).click();
    const directions = page.locator(".catalog-v2-table-row").first().locator(".catalog-v2-table-directions");
    await expect(directions).toContainText("ML / AI");
    await expect(directions).toContainText("Python");
    await page.getByRole("button", { name: "Все фильтры" }).click();
    await page.getByLabel("Навык", { exact: true }).fill("python");
    await expect.poll(() => new URL(page.url()).searchParams.get("competency")).toBe("python");
    await expect(page.locator(".catalog-v2-table-row")).toHaveCount(2);
  });

  test("search, saved filter and reset buttons update the server-bound URL", async ({ page }) => {
    await openCatalog(page);
    await page.getByRole("button", { name: "Все фильтры" }).click();
    const search = page.getByLabel("Поиск", { exact: true });
    await search.fill("Прототип");
    await page.getByRole("button", { name: "Найти" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("Прототип");
    await expect(page.locator(".catalog-v2-all-tasks")).toHaveText("Все задачи");
    await expect(page.locator(".catalog-v2-all-tasks")).toHaveAttribute("aria-pressed", "false");
    const saved = page.getByRole("checkbox", { name: "Только сохранённые" });
    await saved.click();
    await expect.poll(() => new URL(page.url()).searchParams.get("saved")).toBe("true");
    await expect(saved).toBeChecked();
    await page.getByRole("button", { name: "Сбросить фильтры" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get("saved")).toBeNull();
    await expect(page.locator(".catalog-v2-all-tasks")).toHaveText("Все задачи (2)");
    await expect(page.locator(".catalog-v2-all-tasks")).toHaveAttribute("aria-pressed", "true");
  });

  test("all catalog filters and sorting send the correct API query without losing view state", async ({ page }) => {
    const queries: URLSearchParams[] = [];
    await openCatalog(page);
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/v1/me/task-recommendations") {
        queries.push(new URL(request.url()).searchParams);
      }
    });
    // Display names aid discovery; API parameters must remain canonical keys.
    await expect(page.locator('#catalog-v2-direction-options option[value="ml"]')).toHaveAttribute("label", "ML / AI");
    await expect(page.locator('#catalog-v2-competency-options option[value="python"]')).toHaveAttribute("label", "Python");
    await page.getByRole("button", { name: "Все фильтры" }).click();
    const ensureParam = async (key: string, value: string) => {
      await expect.poll(() => new URL(page.url()).searchParams.get(key)).toBe(value);
      await expect.poll(() => queries.some((query) => query.get(key) === value)).toBe(true);
    };
    await page.getByLabel("Направление", { exact: true }).fill("ml");
    await ensureParam("direction", "ml");
    await page.getByLabel("Навык", { exact: true }).fill("python");
    await ensureParam("competency", "python");
    await page.getByLabel("Заказчик", { exact: true }).fill("R&D");
    await ensureParam("customer", "R&D");
    await page.getByLabel("Сложность", { exact: true }).selectOption("intermediate");
    await ensureParam("difficulty", "intermediate");
    await page.getByLabel("Формат", { exact: true }).selectOption("remote");
    await ensureParam("work_format", "remote");
    await page.getByLabel("Срок", { exact: true }).selectOption("30d");
    await ensureParam("timeframe", "30d");
    await page.getByRole("checkbox", { name: "С ментором" }).click();
    await ensureParam("mentored", "true");
    await expect(page.getByRole("checkbox", { name: "С ментором" })).toBeChecked();
    await page.getByRole("checkbox", { name: "Для портфолио" }).click();
    await ensureParam("portfolio", "true");
    await expect(page.getByRole("checkbox", { name: "Для портфолио" })).toBeChecked();
    await page.getByRole("checkbox", { name: "Открыт отклик" }).click();
    await ensureParam("available", "true");
    await expect(page.getByRole("checkbox", { name: "Открыт отклик" })).toBeChecked();
    await page.getByLabel("Сортировка", { exact: true }).selectOption("deadline");
    await ensureParam("sort", "deadline");

    await page.getByRole("button", { name: "Список" }).click();
    await expect(page).toHaveURL(/catalog_view=list/);
    await ensureParam("direction", "ml");
    await page.getByRole("button", { name: /Сбросить фильтр Навык/ }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("competency")).toBeNull();
    await ensureParam("direction", "ml");
    await page.getByRole("button", { name: /Все задачи/ }).click();
    for (const key of ["direction", "competency", "customer", "difficulty", "work_format", "timeframe", "mentored", "portfolio", "available", "sort"]) {
      await expect.poll(() => new URL(page.url()).searchParams.get(key)).toBeNull();
    }
    await expect(page).toHaveURL(/catalog_view=list/);
    await expect(page.locator(".catalog-v2-table-row")).toHaveCount(2);
  });

  test("API filter response controls visible results and empty state can be reset", async ({ page }) => {
    await openCatalog(page);
    await page.route("**/api/v1/me/task-recommendations?*", (route) => {
      const search = new URL(route.request().url()).searchParams.get("q");
      const filtered = search === "No matching task" ? [] : [catalogItem, insufficientItem];
      return route.fulfill({ json: catalogPage(filtered) });
    });
    await page.getByRole("button", { name: "Все фильтры" }).click();
    await page.getByLabel("Заказчик", { exact: true }).fill("unknown-company");
    await page.getByLabel("Сортировка", { exact: true }).selectOption("deadline");
    await page.getByLabel("Поиск", { exact: true }).fill("No matching task");
    await page.getByRole("button", { name: "Найти" }).click();
    await expect(page.getByRole("heading", { name: "Подходящих задач не найдено" })).toBeVisible();
    await page.locator(".catalog-v2-empty").getByRole("button", { name: "Сбросить фильтры" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.has("customer")).toBe(false);
    await expect.poll(() => new URL(page.url()).searchParams.has("sort")).toBe(false);
    await expect(page.locator('[role="listitem"]')).toHaveCount(2);
  });

  test("filter state survives reload and remains identical between cards and list", async ({ page }) => {
    await openCatalog(page);
    await page.getByRole("button", { name: "Все фильтры" }).click();
    await page.getByLabel("Направление", { exact: true }).fill("ml");
    await page.getByLabel("Навык", { exact: true }).fill("Python");
    await page.getByLabel("Сложность", { exact: true }).selectOption("intermediate");
    await page.getByRole("button", { name: "Список" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("competency")).toBe("Python");
    await page.reload();
    await expect(page).toHaveURL(/\/workspace\/1\?/);
    await expect(page.getByRole("button", { name: "Список" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Все фильтры" }).click();
    await expect(page.getByLabel("Навык", { exact: true })).toHaveValue("Python");
    await expect(page.getByLabel("Направление", { exact: true })).toHaveValue("ml");
    await expect(page.getByLabel("Сложность", { exact: true })).toHaveValue("intermediate");
    await page.getByRole("button", { name: "Карточки" }).click();
    await expect(page).toHaveURL(/catalog_view=cards/);
    await expect.poll(() => new URL(page.url()).searchParams.get("competency")).toBe("Python");
  });

  test("terms dialog traps keyboard focus at both ends and returns focus on Escape", async ({ page }) => {
    await openCatalog(page);
    const card = page.locator(".catalog-v2-card").first();
    const open = card.getByRole("button", { name: "Условия и отклик" });
    await card.hover();
    await expect(card.locator(".catalog-v2-card-actions")).toHaveCSS("opacity", "1");
    await open.click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    const first = modal.getByRole("button", { name: "Закрыть условия" });
    const last = modal.getByRole("button", { name: "Закрыть", exact: true });
    await expect(last).toBeVisible();
    await first.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(last).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(first).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    await expect(open).toBeFocused();
  });

  test("mobile advanced product filters remain tappable and never overflow", async ({ page }) => {
    await openCatalog(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Все фильтры" }).click();
    for (const [name, param] of [
      ["С ментором", "mentored"],
      ["Для портфолио", "portfolio"],
      ["Открыт отклик", "available"],
    ] as const) {
      const toggle = page.getByRole("checkbox", { name });
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect.poll(() => new URL(page.url()).searchParams.get(param)).toBe("true");
      await expect(toggle).toBeChecked();
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.getByRole("button", { name: "Список" }).click();
    await expect(page).toHaveURL(/catalog_view=list/);
    await expect.poll(() => new URL(page.url()).searchParams.get("portfolio")).toBe("true");
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
    await expect(page.getByRole("heading", { name: "Работа над задачей" })).toBeVisible();
    const hasOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(hasOverflow).toBe(false);
  });

});
