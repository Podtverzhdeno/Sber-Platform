import { expect, test, type Page } from "@playwright/test";

import type { CatalogItem, CatalogPage, CatalogTerms } from "../src/features/task-catalog-v2/types";

type Login = { csrf_token: string };
type TrackOverview = {
  active_count: number;
  max_active: number;
  tracks: { key: string; title: string; status: "active" | "frozen" | null }[];
};

const customerStateLabels: Record<CatalogItem["customer"]["verification"], string> = {
  verified: "Проверенный заказчик",
  unverified: "Заказчик не верифицирован",
  demo: "Демо-заказчик",
};

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

  const search = page.getByLabel("Поиск", { exact: true });
  await search.fill("no-such-real-catalog-task-000000");
  await search.press("Enter");
  await expect(page.getByRole("heading", { name: "Подходящих задач не найдено" })).toBeVisible();
  await page.getByRole("button", { name: "Сбросить фильтры" }).click();
  await expect(page.locator('[role="listitem"]')).toHaveCount(expectedTitles.length);

  const planned = catalog.items.find((item) => item.stage_plan.stages.length > 0);
  expect(planned).toBeTruthy();
  if (planned === undefined) return;
  await page.goto(`${taskPath}?task=${planned.task_id}`);
  const plannedDetail = page.locator(".catalog-v2-detail");
  await expect(page.locator("#catalog-detail-title")).toHaveText(planned.title);
  await expect(plannedDetail.locator(".catalog-v2-facts")).toContainText(
    customerStateLabels[planned.customer.verification],
  );
  await expect(plannedDetail.getByText(/Запланировано ·/).first()).toBeVisible();

  await page.goto(`${taskPath}?task=${assigned?.task_id ?? ""}&catalog_view=list`);
  await expect(page.locator("#catalog-detail-title")).toHaveText(assigned?.title ?? "");
  await page.getByRole("button", { name: "Перейти в рабочую область" }).click();
  await expect(page).toHaveURL(
    new RegExp(`[?&]project=${encodeURIComponent(assigned?.assignment_id ?? "")}(?:&|$)`),
  );
  const workspaceResponse = await page.context().request.get(
    `/api/v1/me/tasks/${assigned?.task_id ?? ""}`,
  );
  expect(workspaceResponse.status()).toBe(200);
  const workspace = (await workspaceResponse.json()) as {
    checkpoints: { status: string }[];
  };
  const completed = workspace.checkpoints.filter((item) =>
    ["done", "completed", "accepted", "verified"].includes(item.status),
  ).length;
  const expectedProgress = workspace.checkpoints.length
    ? `${String(Math.round((completed / workspace.checkpoints.length) * 100))}% выполнено`
    : "Прогресс уточняется";
  await expect(page.locator(".ctw-progress h2")).toHaveText(expectedProgress);
  await expect(page.locator(".ctw-metrics")).toContainText(
    `${String(completed)} / ${String(workspace.checkpoints.length)}`,
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

  const termsResponse = await page.context().request.get(
    `/api/v1/me/task-recommendations/${candidate.task_id}/terms`,
  );
  expect(termsResponse.status(), await termsResponse.text()).toBe(200);
  const terms = (await termsResponse.json()) as CatalogTerms;
  expect(terms.acceptance_criteria.length).toBeGreaterThan(0);
  const preflight = await page.context().request.post(
    `/api/v1/me/task-recommendations/${candidate.task_id}/terms/revalidate`,
    {
      headers: { "X-CSRF-Token": csrf },
      data: { version_token: terms.version_token, terms_version: terms.terms_version },
    },
  );
  expect(preflight.status(), await preflight.text()).toBe(200);

  await openRealCatalog(page);
  expect(await page.evaluate(() => window.sessionStorage.getItem("impulse_csrf"))).toBe(csrf);
  const search = page.getByLabel("Поиск", { exact: true });
  await search.fill(candidate.title);
  await search.press("Enter");
  const card = page.locator('[role="listitem"]').filter({ hasText: candidate.title });
  await expect(card).toBeVisible();
  await expect(page.locator('[role="listitem"]')).toHaveCount(1);
  const conditionsTrigger = card.getByRole("button", { name: "Условия и отклик" });
  await conditionsTrigger.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".eyebrow")).toContainText(`версия ${String(candidate.terms_version)}`);
  await expect(dialog.getByRole("heading", { name: "Критерии приёмки" })).toBeVisible();
  for (const criterion of terms.acceptance_criteria) {
    await expect(dialog.getByText(criterion, { exact: true })).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(conditionsTrigger).toBeFocused();
  await conditionsTrigger.click();
  await expect(dialog).toBeVisible();
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
  expect(revalidateResponse.status(), await revalidateResponse.text()).toBe(200);
  const consentResponse = await consentResponsePromise;
  expect(consentResponse.status(), await consentResponse.text()).toBe(200);
  const applyResponse = await applyResponsePromise;
  expect([200, 201], await applyResponse.text()).toContain(applyResponse.status());
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

test("real seeded API separates match snapshots after a trajectory change", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);
  const catalog = await realCatalog(page);
  const candidate = catalog.items.find(
    (item) => item.match.status === "calculated" && item.match.percent !== null,
  );
  expect(candidate).toBeTruthy();
  if (candidate === undefined) return;

  await openRealCatalog(page);
  const openCandidateDetail = async () => {
    const card = page.locator('[role="listitem"]').filter({ hasText: candidate.title });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Подробнее" }).click();
    const snapshot = page.locator(".catalog-v2-match-snapshot code");
    await expect(snapshot).toBeVisible();
    return snapshot;
  };
  const initialSnapshot = await openCandidateDetail();
  await expect(initialSnapshot).toHaveText(candidate.match.source_snapshot_version);

  const tracksResponse = await page.context().request.get("/api/v1/development/tracks");
  expect(tracksResponse.status()).toBe(200);
  const overview = (await tracksResponse.json()) as TrackOverview;
  const target = overview.tracks.find((track) => track.status !== "active");
  expect(target).toBeTruthy();
  if (target === undefined) return;

  await page.getByRole("link", { name: "Моя траектория", exact: true }).click();
  const targetCard = page.locator(".track-card").filter({ hasText: target.title });
  await expect(targetCard).toBeVisible();
  if (overview.active_count >= overview.max_active) {
    await targetCard.click();
    const dialog = page.getByRole("dialog", { name: /Освободить место/ });
    await expect(dialog).toBeVisible();
    const frozen = overview.tracks.find((track) => track.status === "active");
    expect(frozen).toBeTruthy();
    if (frozen === undefined) return;
    const changeResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/me/tracks",
    );
    await dialog
      .getByRole("button", { name: `Заморозить «${frozen.title}»` })
      .click();
    expect((await changeResponsePromise).status()).toBe(200);
  } else {
    const changeResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/me/tracks",
    );
    await targetCard.click();
    expect((await changeResponsePromise).status()).toBe(200);
  }
  await expect(targetCard).toContainText("Активно");

  await page.getByRole("link", { name: "Задачи", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Задачи для вашего следующего результата" }),
  ).toBeVisible();
  const refreshedSnapshot = await openCandidateDetail();
  await expect(refreshedSnapshot).not.toHaveText(candidate.match.source_snapshot_version);

  const detailResponse = await page.context().request.get(
    `/api/v1/me/task-recommendations/${candidate.task_id}`,
  );
  expect(detailResponse.status()).toBe(200);
  const refreshed = (await detailResponse.json()) as CatalogItem;
  expect(refreshed.match.source_snapshot_version).not.toBe(candidate.match.source_snapshot_version);
  await expect(refreshedSnapshot).toHaveText(refreshed.match.source_snapshot_version);
});
