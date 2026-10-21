import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../app/query";
import { ApiClientError, apiRequest, clearApiReadCache, retrySafeRead } from "./client";

afterEach(() => {
  clearApiReadCache();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("typed API client policy", () => {
  it("retries only retryable safe reads and never after the second failure", () => {
    const retryable = new ApiClientError(503, "TEMPORARY", "Попробуйте позже", true);
    expect(retrySafeRead(0, retryable)).toBe(true);
    expect(retrySafeRead(1, retryable)).toBe(true);
    expect(retrySafeRead(2, retryable)).toBe(false);
    expect(retrySafeRead(0, new ApiClientError(400, "INVALID", "Ошибка", false))).toBe(false);
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });

  it("maps the stable backend error envelope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ code: "TEMPORARY", message: "Позже", retryable: true }), { status: 503 }));
    await expect(apiRequest("/api/v1/me")).rejects.toMatchObject({ status: 503, code: "TEMPORARY", retryable: true });
  });

  it("coalesces concurrent reads and reuses the real response during section switches", async () => {
    let resolveResponse: ((value: Response) => void) | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise<Response>((resolve) => { resolveResponse = resolve; }),
    );

    const first = apiRequest<{ value: number }>("/api/v1/me");
    const second = apiRequest<{ value: number }>("/api/v1/me");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveResponse?.(new Response(JSON.stringify({ value: 7 }), { status: 200 }));
    await expect(Promise.all([first, second])).resolves.toEqual([{ value: 7 }, { value: 7 }]);
    await expect(apiRequest<{ value: number }>("/api/v1/me")).resolves.toEqual({ value: 7 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("invalidates cached reads when real data is changed", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 2 }), { status: 200 }));

    await expect(apiRequest<{ value: number }>("/api/v1/me")).resolves.toEqual({ value: 1 });
    await apiRequest("/api/v1/me/theme", { method: "PUT", body: JSON.stringify({ theme: "dark" }) });
    await expect(apiRequest<{ value: number }>("/api/v1/me")).resolves.toEqual({ value: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not let a read started before a mutation repopulate stale cache", async () => {
    let resolveOldRead: ((value: Response) => void) | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveOldRead = resolve; }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 2 }), { status: 200 }));

    const oldRead = apiRequest<{ value: number }>("/api/v1/me");
    await apiRequest("/api/v1/me/theme", { method: "PUT", body: JSON.stringify({ theme: "dark" }) });
    resolveOldRead?.(new Response(JSON.stringify({ value: 1 }), { status: 200 }));
    await expect(oldRead).resolves.toEqual({ value: 1 });

    await expect(apiRequest<{ value: number }>("/api/v1/me")).resolves.toEqual({ value: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not cache failed reads", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "TEMPORARY", message: "Позже", retryable: true }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 2 }), { status: 200 }));

    await expect(apiRequest("/api/v1/me")).rejects.toMatchObject({ status: 503 });
    await expect(apiRequest<{ value: number }>("/api/v1/me")).resolves.toEqual({ value: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("bypasses a warm cache when a caller explicitly requests fresh data", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 2 }), { status: 200 }));

    await apiRequest("/api/v1/me");
    await expect(apiRequest<{ value: number }>("/api/v1/me", {
      headers: { "Cache-Control": "no-cache" },
    })).resolves.toEqual({ value: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never reuses realtime notification reads", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ unread: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ unread: 2 }), { status: 200 }));

    await apiRequest("/api/v1/me/notifications");
    await expect(apiRequest<{ unread: number }>("/api/v1/me/notifications")).resolves.toEqual({ unread: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("expires the short-lived API cache", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 2 }), { status: 200 }));

    await expect(apiRequest<{ value: number }>("/api/v1/me")).resolves.toEqual({ value: 1 });
    vi.advanceTimersByTime(30_001);
    await expect(apiRequest<{ value: number }>("/api/v1/me")).resolves.toEqual({ value: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps query data warm long enough for ordinary back-and-forth navigation", () => {
    const options = createQueryClient().getDefaultOptions().queries;
    expect(options?.staleTime).toBe(60_000);
    expect(options?.gcTime).toBe(10 * 60_000);
  });
});
