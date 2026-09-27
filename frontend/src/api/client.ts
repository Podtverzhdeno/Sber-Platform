import type { paths } from "./schema";

export type ApiPaths = paths;
export type RuntimeApiPath =
  | keyof ApiPaths
  | `/api/v1/me/courses/${string}/completion`
  | `/api/v1/me/courses/${string}/learning-days`
  | `/api/v1/me/consents/${string}`
  | `/api/v1/me/events/${string}/claims`
  | "/api/v1/me/work"
  | "/api/v1/me/reward-evidence"
  | "/api/v1/mentor/review-workspace"
  | `/api/v1/mentor/reviews/${string}/${"propose" | "confirm" | "publish"}`
  | `/api/v1/me/tasks/${string}/terms-consent`
  | `/api/v1/me/tasks/${string}/applications`
  | `/api/v1/me/assignments/${string}/start`
  | `/api/v1/me/assignments/${string}/contributions`
  | `/api/v1/customer/tasks/${string}/participant-preview`
  | `/api/v1/customer/contributions/${string}/decision`
  | `/api/v1/customer/projects/${string}/tasks`
  | `/api/v1/customer/tasks/${string}/submit`
  | `/api/v1/customer/tasks/${string}/applications`
  | `/api/v1/customer/applications/${string}/accept`;

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
  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(path, { credentials: "include", ...options, headers });
  if (!response.ok) throw await decodeError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function retrySafeRead(failureCount: number, error: unknown): boolean {
  return failureCount < 2 && error instanceof ApiClientError && error.retryable;
}
