import { apiRequest, ApiClientError } from "../../api/client";
import type { CatalogFilters, CatalogItem, CatalogPage, CatalogTerms } from "./types";

const csrfHeaders = (): Record<string, string> => ({
  "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "",
});

export function catalogQueryKey(filters: CatalogFilters) {
  return [
    "task-catalog-v2",
    filters.q,
    filters.difficulty,
    filters.workFormat,
    filters.customer,
    filters.direction,
    filters.competency,
    filters.timeframe,
    filters.saved,
    filters.mentored,
    filters.portfolio,
    filters.available,
    filters.sort,
  ] as const;
}

export function loadCatalogPage(
  filters: CatalogFilters,
  cursor: string | null,
): Promise<CatalogPage> {
  const params = new URLSearchParams({ sort: filters.sort, page_size: "12" });
  if (filters.q) params.set("q", filters.q);
  if (filters.difficulty) params.set("difficulty", filters.difficulty);
  if (filters.workFormat) params.set("work_format", filters.workFormat);
  if (filters.customer) params.set("customer", filters.customer);
  if (filters.direction) params.set("direction", filters.direction);
  if (filters.competency) params.set("competency", filters.competency);
  if (filters.timeframe) params.set("timeframe", filters.timeframe);
  if (filters.saved) params.set("saved", "true");
  if (filters.mentored) params.set("mentored", "true");
  if (filters.portfolio) params.set("portfolio", "true");
  if (filters.available) params.set("available", "true");
  if (cursor !== null) params.set("cursor", cursor);
  return apiRequest<CatalogPage>(`/api/v1/me/task-recommendations?${params.toString()}`, {
    cache: "no-store",
  });
}

export function loadCatalogDetail(taskId: string): Promise<CatalogItem> {
  // TanStack Query owns staleness/invalidation. Bypass the legacy read cache so
  // a forced refresh can observe revoked access instead of replaying a payload.
  return apiRequest<CatalogItem>(`/api/v1/me/task-recommendations/${taskId}`, {
    cache: "no-store",
  });
}

export function loadCatalogTerms(taskId: string): Promise<CatalogTerms> {
  return apiRequest<CatalogTerms>(`/api/v1/me/task-recommendations/${taskId}/terms`, {
    cache: "no-store",
  });
}

function applicationIdempotencyKey(taskId: string, termsVersion: number): string {
  const storageKey = `impulse-apply:${taskId}:${String(termsVersion)}`;
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing !== null) return existing;
    const key = globalThis.crypto.randomUUID();
    window.sessionStorage.setItem(storageKey, key);
    return key;
  } catch {
    // Restricted storage still gets a stable, task/terms-scoped key.
    return `apply:${taskId}:${String(termsVersion)}`;
  }
}

export async function acceptCurrentTermsAndApply(
  taskId: string,
  terms: CatalogTerms,
): Promise<void> {
  await apiRequest<unknown>(`/api/v1/me/task-recommendations/${taskId}/terms/revalidate`, {
    method: "POST",
    headers: csrfHeaders(),
    body: JSON.stringify({
      version_token: terms.version_token,
      terms_version: terms.terms_version,
    }),
  });
  await apiRequest<unknown>(`/api/v1/me/tasks/${taskId}/terms-consent`, {
    method: "POST",
    headers: csrfHeaders(),
    body: JSON.stringify({ terms_version: terms.terms_version }),
  });
  await apiRequest<unknown>(`/api/v1/me/tasks/${taskId}/applications`, {
    method: "POST",
    headers: {
      ...csrfHeaders(),
      "Idempotency-Key": applicationIdempotencyKey(taskId, terms.terms_version),
    },
  });
}

export async function setCatalogBookmark(taskId: string, saved: boolean): Promise<void> {
  await apiRequest<unknown>(`/api/v1/me/task-recommendations/${taskId}/bookmark`, {
    method: "PUT",
    headers: csrfHeaders(),
    body: JSON.stringify({ saved }),
  });
}

export async function withdrawCatalogApplication(applicationId: string): Promise<void> {
  await apiRequest<unknown>(`/api/v1/me/applications/${applicationId}/withdraw`, {
    method: "POST",
    headers: csrfHeaders(),
  });
}

export function catalogErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "TERMS_CHANGED") {
      return "Условия изменились. Прочитайте актуальную версию и подтвердите её ещё раз.";
    }
    if (error.code === "TASK_FULL") return "Все места уже заняты. Обновите каталог.";
    if (error.code === "TASK_DEADLINE_PASSED") return "Срок отклика уже истёк.";
    if (error.code === "PREREQUISITES_NOT_MET") {
      return "Для отклика не хватает подтверждённых компетенций.";
    }
    if (error.code === "INVITATION_NOT_ACCEPTED") return "Сначала примите приглашение заказчика.";
    if (error.status === 403) return "Действие недоступно для текущей роли.";
    if (error.status === 404) return "Задача больше недоступна. Обновите каталог.";
  }
  return "Не удалось выполнить действие. Проверьте соединение и повторите.";
}
