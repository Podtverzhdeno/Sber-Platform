import { expect, test, type Page } from "@playwright/test";

import type { CatalogItem, CatalogPage } from "../src/features/task-catalog-v2/types";

type Login = { csrf_token: string };

async function login(page: Page): Promise<Login> {
  const response = await page.context().request.post("/api/v1/auth/demo-login", {
    data: { persona_key: "participant-alex" },
  });
  expect(response.status()).toBe(200);
  const login = (await response.json()) as Login;
  await page.addInitScript((csrfToken) => {
    window.sessionStorage.setItem("impulse_csrf", csrfToken);
  }, login.csrf_token);
  return login;
}

async function realCatalog(page: Page): Promise<CatalogPage> {
  const response = await page.context().request.get(
    "/api/v1/me/task-recommendations?sort=match-default&page_size=50",
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as CatalogPage;
  expect(body.items.length).toBeGreaterThanOrEqual(8);
  expect(body.total_found).toBe(body.items.length);
  return body;
}

async function openRealCatalog(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("link", { name: "Задачи", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Задачи для вашего следующего результата" }),
  ).toBeVisible();
}

test("real seeded API preserves card/list order and opens the canonical assigned workspace", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);
  const catalog = await realCatalog(page);
  const assigned = catalog.items.find(
    (item) => item.application_state === "assigned" && item.assignment_id !== null,
  );
  expect(assigned).toBeTruthy();

  const configResponse = await page.context().request.get("/api/v1/config");
  expect(configResponse.status()).toBe(200);
  const config = (await configResponse.json()) as Record<string, unknown>;
  for (const flag of [
    "ai_buddy_enabled",
    "ai_mentor_draft_enabled",
    "ai_operator_triage_enabled",
    "ai_customer_brief_enabled",
  ]) {
    expect(config[flag]).toBe(false);
  }

  await openRealCatalog(page);
  const taskPath = new URL(page.url()).pathname;
  const expectedTitles = catalog.items.map((item) => item.title);
  await expect(page.locator('[role="listitem"]')).toHaveCount(expectedTitles.length);
  await expect(page.locator('[role="listitem"] h2')).toHaveText(expectedTitles);

  await page.getByRole("button", { name: "Список", exact: true }).click();
  const rows = page.locator(".catalog-v2-table-row");
  await expect(rows).toHaveCount(expectedTitles.length);
  await expect(rows.locator(".catalog-v2-table-task > strong")).toHaveText(expectedTitles);
  await page.getByRole("button", { name: "Карточки", exact: true }).click();
  await expect(page.locator('[role="listitem"] h2')).toHaveText(expectedTitles);

  await page.goto(`${taskPath}?task=${assigned?.task_id ?? ""}&catalog_view=list`);
  await expect(page.locator("#catalog-detail-title")).toHaveText(assigned?.title ?? "");
  await page.getByRole("button", { name: "Перейти в рабочую область" }).click();
  await expect(page).toHaveURL(
    new RegExp(`[?&]project=${encodeURIComponent(assigned?.assignment_id ?? "")}(?:&|$)`),
  );

  const foreign = await page.context().request.get(
    "/api/v1/me/task-recommendations/00000000-0000-4000-8000-00000000ff44",
  );
  expect(foreign.status()).toBe(404);
  const foreignBody = await foreign.text();
  expect(foreignBody).not.toContain("brief");
  expect(foreignBody).not.toContain("customer");
});

test("real seeded API submits one application and replays its idempotency key", async ({ page }) => {
  test.setTimeout(90_000);
  const { csrf_token: csrf } = await login(page);
  const catalog = await realCatalog(page);
  const candidate = catalog.items.find(
    (item): item is CatalogItem =>
      item.application_state === "none" && item.allowed_actions.includes("apply"),
  );
  expect(candidate).toBeTruthy();
  if (candidate === undefined) return;

  await openRealCatalog(page);
  const search = page.getByLabel("Поиск", { exact: true });
  await search.fill(candidate.title);
  await search.press("Enter");
  const card = page.locator('[role="listitem"]').filter({ hasText: candidate.title });
  await expect(card).toBeVisible();
  await expect(page.locator('[role="listitem"]')).toHaveCount(1);
  await card.getByRole("button", { name: "Условия и отклик" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".eyebrow")).toContainText(`версия ${String(candidate.terms_version)}`);
  await dialog.getByRole("checkbox").check();
  const revalidateResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        `/api/v1/me/task-recommendations/${candidate.task_id}/terms/revalidate`,
  );
  const consentResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === `/api/v1/me/tasks/${candidate.task_id}/terms-consent`,
  );
  const applyResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === `/api/v1/me/tasks/${candidate.task_id}/applications`,
  );
  await dialog.getByRole("button", { name: "Подтвердить и отправить отклик" }).click();
  const revalidateResponse = await revalidateResponsePromise;
  expect(revalidateResponse.status()).toBe(200);
  const consentResponse = await consentResponsePromise;
  expect(consentResponse.status()).toBe(200);
  const applyResponse = await applyResponsePromise;
  expect([200, 201]).toContain(applyResponse.status());
  const firstApplication = (await applyResponse.json()) as { id: string };
  const idempotencyKey = applyResponse.request().headers()["idempotency-key"];
  expect(idempotencyKey).toBeTruthy();
  await expect(page.getByText(/Отклик отправлен заказчику/)).toBeVisible();

  const replay = await page.context().request.post(
    `/api/v1/me/tasks/${candidate.task_id}/applications`,
    {
      headers: { "X-CSRF-Token": csrf, "Idempotency-Key": idempotencyKey },
    },
  );
  expect([200, 201]).toContain(replay.status());
  const replayedApplication = (await replay.json()) as { id: string };
  expect(replayedApplication.id).toBe(firstApplication.id);

  const detail = await page.context().request.get(
    `/api/v1/me/task-recommendations/${candidate.task_id}`,
  );
  expect(detail.status()).toBe(200);
  const projected = (await detail.json()) as CatalogItem;
  expect(projected.application_id).toBe(firstApplication.id);
  expect(["submitted", "under_review"]).toContain(projected.application_state);
  expect(projected.assignment_id).toBeNull();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator('[role="listitem"]').filter({ hasText: candidate.title })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
});
