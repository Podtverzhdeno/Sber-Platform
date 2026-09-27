import type { paths } from "./schema";

export type ApiPaths = paths;

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

export async function apiRequest<T>(path: keyof ApiPaths, options?: RequestInit): Promise<T> {
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
