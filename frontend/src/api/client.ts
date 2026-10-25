import type { paths } from "./schema";
import { isCrossSectionMutation } from "./cross-section-mutations";

export type ApiPaths = paths;
export type RuntimeApiPath =
  | keyof ApiPaths
  | `/api/v1/search?${string}`
  | `/api/v1/me/courses/${string}/completion`
  | `/api/v1/me/courses/${string}/detail`
  | `/api/v1/me/courses/${string}/learning-days`
  | `/api/v1/me/consents/${string}`
  | `/api/v1/me/visibility/${string}`
  | `/api/v1/me/events/${string}/claims`
  | "/api/v1/me/work"
  | "/api/v1/me/profile"
  | "/api/v1/me/talent-passport"
  | "/api/v1/me/reward-evidence"
  | "/api/v1/mentor/review-workspace"
  | "/api/v1/mentor/review-queue"
  | "/api/v1/manager/overview"
  | `/api/v1/me/agentic-coding/profile?${string}`
  | "/api/v1/me/analytics/journey"
  | "/api/v1/analytics/role"
  | "/api/v1/ops/cases"
  | `/api/v1/ops/cases/${string}/timeline`
  | `/api/v1/ops/cases/${string}/decide`
  | "/api/v1/hr/candidates"
  | "/api/v1/hr/pipeline"
  | `/api/v1/hr/candidates/${string}`
  | `/api/v1/hr/candidates/${string}/pipeline-events`
  | `/api/v1/mentor/reviews/${string}/${"propose" | "confirm" | "publish"}`
  | `/api/v1/me/notifications/${string}/read`
  | `/api/v1/me/tasks/${string}`
  | "/api/v1/me/task-recommendations"
  | "/api/v1/me/task-recommendations/analytics/events"
  | `/api/v1/me/task-recommendations?${string}`
  | `/api/v1/me/task-recommendations/${string}`
  | "/api/v1/me/messaging/contacts"
  | "/api/v1/me/messaging/channels/group"
  | `/api/v1/me/messaging/channels/${string}`
  | `/api/v1/me/messaging/channels/${string}/messages`
  | `/api/v1/me/messaging/channels/${string}/context`
  | `/api/v1/me/messaging/channels/${string}/read`
  | `/api/v1/me/messaging/channels/${string}/mute`
  | `/api/v1/me/tasks/${string}/terms-consent`
  | `/api/v1/me/tasks/${string}/applications`
  | `/api/v1/me/applications/${string}/withdraw`
  | `/api/v1/me/tasks/${string}/invitation`
  | `/api/v1/me/assignments/${string}/start`
  | `/api/v1/me/assignments/${string}/contributions`
  | `/api/v1/me/assignments/${string}/deadline-requests`
  | `/api/v1/customer/tasks/${string}/participant-preview`
  | `/api/v1/customer/tasks/${string}`
  | `/api/v1/customer/contributions/${string}/decision`
  | `/api/v1/customer/projects/${string}/tasks`
  | `/api/v1/customer/tasks/${string}/submit`
  | `/api/v1/customer/tasks/${string}/repeat`
  | `/api/v1/customer/tasks/${string}/invitations`
  | "/api/v1/customer/team-requests"
  | "/api/v1/customer/cases"
  | `/api/v1/customer/team-requests/${string}`
  | `/api/v1/customer/team-requests/${string}/matches`
  | `/api/v1/customer/team-requests/${string}/saved/${string}`
  | "/api/v1/customer/saved-candidates"
  | `/api/v1/customer/tasks/${string}/invitations/${string}/revoke`
  | `/api/v1/customer/tasks/${string}/applications`
  | `/api/v1/customer/applications/${string}/accept`
  | `/api/v1/customer/deadline-requests/${string}/decision`
  | `/api/v1/customer/tasks/${string}/deadline-requests`
  | `/api/v1/me/bootcamp/courses/${string}`
  | "/api/v1/me/bootcamp/impulse-study/summary"
  | "/api/v1/me/bootcamp/certificates"
  | `/api/v1/me/bootcamp/certificates/${string}`
  | `/api/v1/bootcamp/certificates/${string}`
  | "/api/v1/me/project-credentials"
  | `/api/v1/project-credentials/${string}`
  | `/api/v1/customer/contributions/${string}/credential`;

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(status: number, code: string, message: string, retryable = false) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

const READ_CACHE_TTL_MS = 30_000;
const VOLATILE_READ_PATHS = [
  "/api/v1/me/agentic-coding/profile",
  "/api/v1/me/messaging/",
  "/api/v1/me/notifications",
] as const;

type ReadCacheEntry = {
  expiresAt: number;
  value: unknown;
};

const readCache = new Map<string, ReadCacheEntry>();
const pendingReads = new Map<string, Promise<unknown>>();
let cacheGeneration = 0;
let activeFetch = globalThis.fetch;
/** Role and identity changes must invalidate every actor-scoped TanStack query too. */
const authScopeListeners = new Set<() => void>();
const progressMutationListeners = new Set<() => void>();

/** Subscribers refetch all visible authoritative projections after a commit. */
export function subscribeProgressMutation(listener: () => void): () => void {
  progressMutationListeners.add(listener);
  return () => { progressMutationListeners.delete(listener); };
}

function publishProgressMutation(): void {
  for (const listener of progressMutationListeners) listener();
}


export function subscribeAuthScopeChange(listener: () => void): () => void {
  authScopeListeners.add(listener);
  return () => { authScopeListeners.delete(listener); };
}

function publishAuthScopeChange(): void {
  for (const listener of authScopeListeners) listener();
}

const AUTH_SCOPE_MUTATIONS = new Set<string>([
  "/api/v1/auth/demo-login",
  "/api/v1/auth/logout",
  "/api/v1/me/active-role",
]);


export function clearApiReadCache(): void {
  cacheGeneration += 1;
  readCache.clear();
  pendingReads.clear();
}

/** Refresh only a server-rejected CSRF token, using the same authenticated
 * HttpOnly-cookie session. Never retry a general 403 or disable validation. */
let csrfRefreshInFlight: Promise<string | null> | null = null;
async function refreshSessionCsrf(): Promise<string | null> {
  if (!csrfRefreshInFlight) {
    csrfRefreshInFlight = (async () => {
      const response = await fetch("/api/v1/me", {
        credentials: "include", cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!response.ok) return null;
      const actor = (await response.json()) as { csrf_token?: unknown };
      if (typeof actor.csrf_token !== "string" || !actor.csrf_token) return null;
      sessionStorage.setItem("impulse_csrf", actor.csrf_token);
      return actor.csrf_token;
    })().finally(() => { csrfRefreshInFlight = null; });
  }
  return csrfRefreshInFlight;
}

async function decodeError(response: Response): Promise<ApiClientError> {
  const fallback = { code: "HTTP_ERROR", message: `HTTP ${String(response.status)}`, retryable: false };
  try {
    const body = (await response.json()) as Partial<typeof fallback>;
    return new ApiClientError(
      response.status,
      body.code ?? fallback.code,
      body.message ?? fallback.message,
      body.retryable ?? false,
    );
  } catch {
    return new ApiClientError(response.status, fallback.code, fallback.message, false);
  }
}

export async function apiRequest<T>(path: RuntimeApiPath, options?: RequestInit): Promise<T> {
  if (activeFetch !== globalThis.fetch) {
    activeFetch = globalThis.fetch;
    clearApiReadCache();
  }
  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");
  const method = (options?.method ?? "GET").toUpperCase();
  const volatileRead = VOLATILE_READ_PATHS.some((prefix) => path.startsWith(prefix));
  const bypassRequested =
    headers.get("Cache-Control") === "no-cache" ||
    options?.cache === "no-store" ||
    options?.cache === "reload";
  const canReuseRead = method === "GET" && !volatileRead && !bypassRequested;

  if (!canReuseRead) {
    if (method !== "GET" && method !== "HEAD") clearApiReadCache();
    let response = await fetch(path, { credentials: "include", ...options, headers });
    if (!response.ok && method !== "GET" && method !== "HEAD" && path !== "/api/v1/auth/demo-login") {
      const failure = await decodeError(response);
      if (failure.status !== 403 || failure.code !== "CSRF_INVALID") throw failure;
      const refreshed = await refreshSessionCsrf().catch(() => null);
      if (!refreshed) throw failure;
      headers.set("X-CSRF-Token", refreshed);
      response = await fetch(path, { credentials: "include", ...options, headers });
    }
    if (!response.ok) throw await decodeError(response);
    if (AUTH_SCOPE_MUTATIONS.has(path) && method !== "GET" && method !== "HEAD") publishAuthScopeChange();
    if (response.status === 204) {
      if (isCrossSectionMutation(path, method)) publishProgressMutation();
      return undefined as T;
    }
    const data = (await response.json()) as T;
    if (isCrossSectionMutation(path, method)) publishProgressMutation();
    return data;
  }

  const cacheKey = path;
  const cached = readCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;
  if (cached) readCache.delete(cacheKey);

  const pending = pendingReads.get(cacheKey);
  if (pending) return pending as Promise<T>;

  const generation = cacheGeneration;
  const request = (async () => {
    const response = await fetch(path, { credentials: "include", ...options, headers });
    if (!response.ok) throw await decodeError(response);
    if (response.status === 204) return undefined as T;
    const value = (await response.json()) as T;
    if (generation === cacheGeneration) {
      readCache.set(cacheKey, { expiresAt: Date.now() + READ_CACHE_TTL_MS, value });
    }
    return value;
  })();
  pendingReads.set(cacheKey, request);
  try {
    return await request;
  } finally {
    if (pendingReads.get(cacheKey) === request) pendingReads.delete(cacheKey);
  }
}

export function retrySafeRead(failureCount: number, error: unknown): boolean {
  return failureCount < 2 && error instanceof ApiClientError && error.retryable;
}
