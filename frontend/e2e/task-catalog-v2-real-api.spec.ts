import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";

import type { CatalogItem, CatalogPage, CatalogTerms } from "../src/features/task-catalog-v2/types";

type Login = { csrf_token: string };
type ApiSession = { api: APIRequestContext; csrf: string };
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

async function apiLogin(personaKey: string): Promise<ApiSession> {
  const baseURL = test.info().project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright baseURL is required");
  const api = await request.newContext({ baseURL });
  const response = await api.post("/api/v1/auth/demo-login", {
    data: { persona_key: personaKey },
  });
  expect(response.status(), await response.text()).toBe(200);
  const body = (await response.json()) as Login;
  return { api, csrf: body.csrf_token };
}

async function applicationIds(session: ApiSession, taskId: string): Promise<string[]> {
  const response = await session.api.get(`/api/v1/customer/tasks/${taskId}/applications`);
  expect(response.status(), await response.text()).toBe(200);
  const body = (await response.json()) as { id: string }[];
  return body.map((item) => item.id).sort();
}

async function reviseTerms(
  session: ApiSession,
  taskId: string,
  deadlineAt: string,
  version: number,
): Promise<void> {
  const response = await session.api.post(`/api/v1/customer/tasks/${taskId}/terms`, {
    headers: { "X-CSRF-Token": session.csrf },
    data: {
      deadline_at: deadlineAt,
      deliverable: `Проверяемый результат · условия v${String(version)}`,
      acceptance_criteria: [`Результат проверен по условиям v${String(version)}`],
    },
  });
  expect(response.status(), await response.text()).toBe(200);
  const body = (await response.json()) as { version: number };
  expect(body.version).toBe(version);
}

async function evidenceSnapshot(page: Page): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  for (const path of [
    "/api/v1/me/talent-passport",
    "/api/v1/me/reward-evidence",
    "/api/v1/me/bootcamp/certificates",
    "/api/v1/me/project-credentials",
    "/api/v1/me/portfolio",
  ]) {
    const response = await page.context().request.get(path);
    expect(response.status(), `${path}: ${await response.text()}`).toBe(200);
    result[path] = (await response.json()) as unknown;
  }
  return result;
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
    page.getByRole("heading", { name: "Задачи для твоего развития" }),
  ).toBeVisible();
}

test("real seeded API preserves card/list order and opens the canonical assigned workspace", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);
  const catalog = await realCatalog(page);
  const assigned = catalog.items.find(
    (item) =>
      item.title === "Прототип рекомендательной системы для научных статей" &&
      item.application_state === "assigned" &&
      item.assignment_id !== null,
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
  await expect(rows.locator(".catalog-v2-table-task-text > strong")).toHaveText(expectedTitles);
  await page.getByRole("button", { name: "Карточки", exact: true }).click();
  await expect(page.locator('[role="listitem"] h2')).toHaveText(expectedTitles);

  await page.getByRole("button", { name: "Все фильтры" }).click();
  const search = page.getByLabel("Поиск", { exact: true });
  await search.fill("no-such-real-catalog-task-000000");
  await search.press("Enter");
  await expect(page.getByRole("heading", { name: "Подходящих задач не найдено" })).toBeVisible();
  await page.locator(".catalog-v2-empty").getByRole("button", { name: "Сбросить фильтры" }).click();
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
  expect(workspace.checkpoints).toHaveLength(5);
  expect(completed).toBe(2);
  const expectedProgress = workspace.checkpoints.length
    ? `${String(Math.round((completed / workspace.checkpoints.length) * 100))}% выполнено`
    : "Прогресс уточняется";
  expect(expectedProgress).toBe("40% выполнено");
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
      item.title === "Прогнозирование нагрузки контактного центра" &&
      item.application_state === "none" &&
      item.allowed_actions.includes("apply"),
  );
  expect(candidate).toBeTruthy();
  if (candidate === undefined) return;
  const evidenceBefore = await evidenceSnapshot(page);

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
  await page.getByRole("button", { name: "Все фильтры" }).click();
  const search = page.getByLabel("Поиск", { exact: true });
  await search.fill(candidate.title);
  await search.press("Enter");
  const card = page.locator('[role="listitem"]').filter({ hasText: candidate.title });
  await expect(card).toBeVisible();
  await expect(page.locator('[role="listitem"]')).toHaveCount(1);
  await card.getByRole("button", { name: "Подробнее" }).click();
  await expect(page.locator("#catalog-detail-title")).toHaveText(candidate.title);
  await card.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(card.getByRole("button", { name: "Сохранено", exact: true })).toBeVisible();
  const conditionsTrigger = card.getByRole("button", { name: "Условия и отклик" });
  await conditionsTrigger.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".catalog-v2-conditions-header p")).toContainText(`версия условий ${String(candidate.terms_version)}`);
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
  expect(await evidenceSnapshot(page)).toEqual(evidenceBefore);
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
    // Matching factors and calculation provenance are now two nested disclosures.
    await page.locator(".catalog-v2-reasons-disclosure > summary").click();
    const provenance = page.locator(".catalog-v2-provenance");
    await provenance.locator("summary").click();
    const snapshot = provenance.locator(".catalog-v2-match-snapshot code");
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
    page.getByRole("heading", { name: "Задачи для твоего развития" }),
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

test("real server requires fresh consent after v3 to v4 terms drift", async ({ page }) => {
  test.setTimeout(90_000);
  const customer = await apiLogin("customer-roman");
  try {
    await login(page);
    const catalog = await realCatalog(page);
    const candidate = catalog.items.find(
      (item) => item.title === "MVP чат-ассистента для внутренних знаний",
    );
    expect(candidate).toBeTruthy();
    if (candidate === undefined) return;

    const beforeIds = await applicationIds(customer, candidate.task_id);
    const customerDetailResponse = await customer.api.get(
      `/api/v1/customer/tasks/${candidate.task_id}`,
    );
    expect(customerDetailResponse.status(), await customerDetailResponse.text()).toBe(200);
    const customerDetail = (await customerDetailResponse.json()) as {
      terms: { deadline_at: string };
    };
    await reviseTerms(customer, candidate.task_id, customerDetail.terms.deadline_at, 2);
    await reviseTerms(customer, candidate.task_id, customerDetail.terms.deadline_at, 3);

    await openRealCatalog(page);
    await page.getByRole("button", { name: "Все фильтры" }).click();
    const search = page.getByLabel("Поиск", { exact: true });
    await search.fill(candidate.title);
    await search.press("Enter");
    const card = page.locator('[role="listitem"]').filter({ hasText: candidate.title });
    await expect(page.locator('[role="listitem"]')).toHaveCount(1);
    await card.getByRole("button", { name: "Условия и отклик" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator(".catalog-v2-conditions-header p")).toContainText("версия условий 3");
    await dialog.getByRole("checkbox").check();

    await reviseTerms(customer, candidate.task_id, customerDetail.terms.deadline_at, 4);
    await dialog.getByRole("button", { name: "Подтвердить и отправить отклик" }).click();
    await expect(dialog.locator(".catalog-v2-terms-changed")).toContainText(
      "Версия 3 больше не действует",
    );
    await expect(dialog.locator(".catalog-v2-conditions-header p")).toContainText("версия условий 4");
    await expect(dialog.getByRole("checkbox")).not.toBeChecked();
    expect(await applicationIds(customer, candidate.task_id)).toEqual(beforeIds);

    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Подтвердить и отправить отклик" }).click();
    await expect(page.getByText(/Отклик отправлен заказчику/)).toBeVisible();
    expect(await applicationIds(customer, candidate.task_id)).toHaveLength(beforeIds.length + 1);
  } finally {
    await customer.api.dispose();
  }
});

test("real server rejects an expired application and refreshes to an honest empty state", async ({ page }) => {
  test.setTimeout(90_000);
  const customer = await apiLogin("customer-roman");
  try {
    const { csrf_token: csrf } = await login(page);
    const catalog = await realCatalog(page);
    const candidate = catalog.items.find(
      (item) => item.title === "Исследование методов сжатия спутниковых изображений",
    );
    expect(candidate).toBeTruthy();
    if (candidate === undefined) return;
    const beforeIds = await applicationIds(customer, candidate.task_id);

    await openRealCatalog(page);
    await page.getByRole("button", { name: "Все фильтры" }).click();
    const search = page.getByLabel("Поиск", { exact: true });
    await search.fill(candidate.title);
    await search.press("Enter");
    const card = page.locator('[role="listitem"]').filter({ hasText: candidate.title });
    await expect(page.locator('[role="listitem"]')).toHaveCount(1);
    await card.getByRole("button", { name: "Условия и отклик" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("checkbox").check();

    const expiredAt = new Date(Date.now() - 60_000).toISOString();
    await reviseTerms(customer, candidate.task_id, expiredAt, 2);
    const directApply = await page.context().request.post(
      `/api/v1/me/tasks/${candidate.task_id}/applications`,
      {
        headers: { "X-CSRF-Token": csrf, "Idempotency-Key": `expired-${String(Date.now())}` },
      },
    );
    expect(directApply.status(), await directApply.text()).toBe(409);
    expect(((await directApply.json()) as { code: string }).code).toBe("TASK_DEADLINE_PASSED");

    await dialog.getByRole("button", { name: "Подтвердить и отправить отклик" }).click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Задача больше недоступна. Обновите каталог.",
    );
    expect(await applicationIds(customer, candidate.task_id)).toEqual(beforeIds);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Подходящих задач не найдено" })).toBeVisible();
    const detail = await page.context().request.get(
      `/api/v1/me/task-recommendations/${candidate.task_id}`,
    );
    expect(detail.status()).toBe(404);
  } finally {
    await customer.api.dispose();
  }
});

test("real server exposes qualitative growth, unverified customer and hard eligibility limits", async ({ page }) => {
  test.setTimeout(90_000);
  const { csrf_token: csrf } = await login(page);
  const catalog = await realCatalog(page);
  const candidate = catalog.items.find(
    (item) => item.title === "Анализ факторов удержания пользователей",
  );
  expect(candidate).toBeTruthy();
  if (candidate === undefined) return;
  expect(candidate.customer.verification).toBe("unverified");
  expect(candidate.eligibility.status).toBe("ineligible");
  expect(candidate.eligibility.missing_prerequisites).toContain(
    "catalog-quality-unmet-prerequisite",
  );
  expect(candidate.allowed_actions).not.toContain("apply");
  expect(candidate.allowed_actions).not.toContain("open_conditions");
  expect(candidate.benefits.every((benefit) => benefit.benefit_type !== "portfolio")).toBe(true);
  expect(candidate.skill_impact.length).toBeGreaterThan(0);
  for (const impact of candidate.skill_impact) {
    expect(impact.status).toBe("qualitative");
    expect(impact.current_level).toBeNull();
    expect(impact.projected_level).toBeNull();
    expect(impact.verification_required).toBe(true);
  }

  await openRealCatalog(page);
  await page.getByRole("button", { name: "Все фильтры" }).click();
  const search = page.getByLabel("Поиск", { exact: true });
  await search.fill(candidate.title);
  await search.press("Enter");
  const card = page.locator('[role="listitem"]').filter({ hasText: candidate.title });
  await expect(page.locator('[role="listitem"]')).toHaveCount(1);
  await expect(card).toContainText("Заказчик не верифицирован");
  await expect(card).not.toContainText("Проверенный заказчик");
  await expect(card).toContainText("catalog-quality-unmet-prerequisite");
  await expect(card.getByRole("button", { name: "Условия и отклик" })).toHaveCount(0);
  await card.getByRole("button", { name: "Подробнее" }).click();

  const detail = page.locator(".catalog-v2-detail");
  await expect(detail).toContainText("Заказчик не верифицирован");
  await expect(detail).not.toContainText("Проверенный заказчик");
  await expect(detail).not.toContainText("Возможность использовать результат в портфолио");
  const growth = detail.locator(".catalog-v2-growth-list");
  await expect(growth).toContainText("Нет подтверждённого уровня");
  await expect(growth).toContainText("Без числового прогноза");
  await expect(growth).not.toContainText("0%");

  const directApply = await page.context().request.post(
    `/api/v1/me/tasks/${candidate.task_id}/applications`,
    {
      headers: { "X-CSRF-Token": csrf, "Idempotency-Key": `prerequisite-${String(Date.now())}` },
    },
  );
  expect(directApply.status(), await directApply.text()).toBe(409);
  expect(((await directApply.json()) as { code: string }).code).toBe("PREREQUISITES_NOT_MET");
});

test("real server keeps equal-score ordering stable across requests, cards and list", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);
  const path =
    "/api/v1/me/task-recommendations?sort=match-default&page_size=50&competency=data-analysis";
  const firstResponse = await page.context().request.get(path);
  expect(firstResponse.status(), await firstResponse.text()).toBe(200);
  const first = (await firstResponse.json()) as CatalogPage;
  expect(first.items).toHaveLength(2);
  expect(first.items.map((item) => item.title).sort()).toEqual(
    [
      "Модель оценки энергоэффективности зданий",
      "Поиск дублей обращений пользователей",
    ].sort(),
  );
  expect(first.items[0]?.match.status).toBe("calculated");
  expect(first.items[0]?.match.percent).not.toBeNull();
  expect(first.items[0]?.match.percent).toBe(first.items[1]?.match.percent);
  const expected = [...first.items].sort((left, right) => {
    const byDeadline = (left.deadline_at ?? "").localeCompare(right.deadline_at ?? "");
    return byDeadline || left.task_id.localeCompare(right.task_id);
  });
  const expectedIds = expected.map((item) => item.task_id);
  expect(first.items.map((item) => item.task_id)).toEqual(expectedIds);

  const repeatResponse = await page.context().request.get(path);
  expect(repeatResponse.status()).toBe(200);
  const repeat = (await repeatResponse.json()) as CatalogPage;
  expect(repeat.items.map((item) => item.task_id)).toEqual(expectedIds);

  await openRealCatalog(page);
  const taskPath = new URL(page.url()).pathname;
  await page.goto(`${taskPath}?competency=data-analysis`);
  const expectedTitles = expected.map((item) => item.title);
  await expect(page.locator('[role="listitem"]')).toHaveCount(2);
  await expect(page.locator('[role="listitem"] h2')).toHaveText(expectedTitles);
  await page.getByRole("button", { name: "Список", exact: true }).click();
  const rows = page.locator(".catalog-v2-table-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.locator(".catalog-v2-table-task-text > strong")).toHaveText(expectedTitles);
  await page.getByRole("button", { name: "Карточки", exact: true }).click();
  await expect(page.locator('[role="listitem"] h2')).toHaveText(expectedTitles);
});

test("real server preserves canonical state during the v2 flag rollback rehearsal", async ({ page }) => {
  test.setTimeout(90_000);
  const { csrf_token: csrf } = await login(page);
  const catalog = await realCatalog(page);
  const candidate = catalog.items.find(
    (item) =>
      item.title === "Детекция аномалий в сетевом трафике" &&
      item.application_state === "none" &&
      item.allowed_actions.includes("apply"),
  );
  expect(candidate).toBeTruthy();
  if (candidate === undefined) return;

  const termsResponse = await page.context().request.get(
    `/api/v1/me/task-recommendations/${candidate.task_id}/terms`,
  );
  expect(termsResponse.status(), await termsResponse.text()).toBe(200);
  const terms = (await termsResponse.json()) as CatalogTerms;
  const consent = await page.context().request.post(
    `/api/v1/me/tasks/${candidate.task_id}/terms-consent`,
    {
      headers: { "X-CSRF-Token": csrf },
      data: { terms_version: terms.terms_version },
    },
  );
  expect(consent.status(), await consent.text()).toBe(200);
  const apply = await page.context().request.post(
    `/api/v1/me/tasks/${candidate.task_id}/applications`,
    {
      headers: { "X-CSRF-Token": csrf, "Idempotency-Key": `rollback-${String(Date.now())}` },
    },
  );
  expect([200, 201], await apply.text()).toContain(apply.status());
  const application = (await apply.json()) as { id: string };

  type CanonicalState = {
    acceptedTermsVersion: number | null;
    termsVersion: number;
    applicationIds: string[];
  };
  const readCanonicalState = async (): Promise<CanonicalState> => {
    const response = await page.context().request.get(`/api/v1/me/tasks/${candidate.task_id}`);
    expect(response.status(), await response.text()).toBe(200);
    const body = (await response.json()) as {
      accepted_terms_version: number | null;
      terms: { version: number };
      applications: { id: string }[];
    };
    return {
      acceptedTermsVersion: body.accepted_terms_version,
      termsVersion: body.terms.version,
      applicationIds: body.applications.map((item) => item.id).sort(),
    };
  };
  const beforeRollback = await readCanonicalState();
  expect(beforeRollback.acceptedTermsVersion).toBe(terms.terms_version);
  expect(beforeRollback.applicationIds).toContain(application.id);

  const configResponse = await page.context().request.get("/api/v1/config");
  expect(configResponse.status(), await configResponse.text()).toBe(200);
  const config = (await configResponse.json()) as Record<string, unknown>;
  // Only the public browser flag is substituted. Catalog, work and identity
  // calls continue to use the real seeded backend and canonical stored state.
  await page.route("**/api/v1/config", (route) =>
    route.fulfill({ json: { ...config, task_catalog_v2_enabled: false } }),
  );
  await page.goto("/");
  await page.getByRole("link", { name: "Задачи", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Задачи для вашего развития", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Задачи для твоего развития" }),
  ).toHaveCount(0);
  await expect(page.locator(".participant-work--catalog")).toContainText(candidate.title);

  const marketplaceResponse = await page.context().request.get("/api/v1/marketplace/tasks");
  expect(marketplaceResponse.status(), await marketplaceResponse.text()).toBe(200);
  const marketplace = (await marketplaceResponse.json()) as {
    task: { id: string };
    terms: { version: number };
    accepted_terms_version: number | null;
  }[];
  const legacyProjection = marketplace.find((item) => item.task.id === candidate.task_id);
  expect(legacyProjection?.accepted_terms_version).toBe(beforeRollback.acceptedTermsVersion);
  expect(legacyProjection?.terms.version).toBe(beforeRollback.termsVersion);
  expect(await readCanonicalState()).toEqual(beforeRollback);
});
