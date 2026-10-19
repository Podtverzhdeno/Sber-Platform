import { ApiClientError } from "../../api/client";

/**
 * Typed HTTP boundary for the project platform catalog (openspec 22.20).
 * Same contract as the global `apiRequest`; kept local until the OpenAPI
 * snapshot integration lane adds the platform paths to `RuntimeApiPath`.
 */

const CSRF_STORAGE_KEY = "impulse_csrf";

export function csrfHeaders(): HeadersInit {
  return { "X-CSRF-Token": sessionStorage.getItem(CSRF_STORAGE_KEY) ?? "" };
}

interface ErrorBody {
  code?: string;
  message?: string;
  retryable?: boolean;
}

async function decodeError(response: Response): Promise<ApiClientError> {
  const fallback: ErrorBody = {
    code: "HTTP_ERROR",
    message: `HTTP ${String(response.status)}`,
    retryable: false,
  };
  try {
    const body = (await response.json()) as ErrorBody;
    return new ApiClientError(
      response.status,
      body.code ?? fallback.code ?? "HTTP_ERROR",
      body.message ?? fallback.message ?? "HTTP error",
      body.retryable ?? false,
    );
  } catch {
    return new ApiClientError(
      response.status,
      fallback.code ?? "HTTP_ERROR",
      fallback.message ?? "HTTP error",
      false,
    );
  }
}

export async function platformRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers,
  });
  if (!response.ok) throw await decodeError(response);
  return (await response.json()) as T;
}

const TOKENISH_QUERY_KEYS = new Set([
  "access_token",
  "refresh_token",
  "token",
  "secret",
  "credential",
  "authorization",
]);

/**
 * Guard for external provider links rendered in the UI: https, no embedded
 * credentials in the URL (query fragment or userinfo part).
 */
export function safeExternalUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    for (const key of Array.from(parsed.searchParams.keys()).map((item) =>
      item.toLowerCase(),
    )) {
      if (TOKENISH_QUERY_KEYS.has(key)) return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
