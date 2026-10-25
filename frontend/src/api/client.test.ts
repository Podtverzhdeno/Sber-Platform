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

  it("recovers a stale CSRF header from the current cookie session and retries the protected write exactly once", async () => {
    sessionStorage.setItem("impulse_csrf", "stale");
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({code:"CSRF_INVALID",message:"Проверка запроса не пройдена."}),{status:403}))
      .mockResolvedValueOnce(new Response(JSON.stringify({csrf_token:"new-session-token"}),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({id:"sent"}),{status:200}));
    await expect(apiRequest<{id:string}>("/api/v1/me/messaging/channels/test-id/messages",{
      method:"POST",headers:{"X-CSRF-Token":"stale"},body:JSON.stringify({body:"Привет"}),
    })).resolves.toEqual({id:"sent"});
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/me");
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get("X-CSRF-Token")).toBe("new-session-token");
    expect(sessionStorage.getItem("impulse_csrf")).toBe("new-session-token");
  });

  it("never retries unrelated 403 authorization failures or weakens forbidden actions", async () => {
    const fetchMock=vi.spyOn(globalThis,"fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({code:"MESSAGING_READ_ONLY",message:"Доступ запрещён"}),{status:403}));
    await expect(apiRequest("/api/v1/me/messaging/channels/test-id/messages",{
      method:"POST",headers:{"X-CSRF-Token":"current"},body:"{}",
    })).rejects.toMatchObject({status:403,code:"MESSAGING_READ_ONLY"});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not replay a rejected write when session recovery returns no usable CSRF", async () => {
    const fetchMock=vi.spyOn(globalThis,"fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({code:"CSRF_INVALID"}),{status:403}))
      .mockResolvedValueOnce(new Response(null,{status:401}));
    await expect(apiRequest("/api/v1/me/messaging/channels/test-id/messages",{
      method:"POST",headers:{"X-CSRF-Token":"stale"},body:"{}",
    })).rejects.toMatchObject({status:403,code:"CSRF_INVALID"});
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
  it("evicts actor-scoped TanStack queries after a successful role change but keeps public config", async () => {
    const client = createQueryClient();
    client.setQueryData(["search", "restricted"], { items: ["private-result"] });
    client.setQueryData(["participant-growth-analytics"], { snapshot_id: "role-A" });
    client.setQueryData(["public-config"], { demo_mode: true });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ active_role: "mentor" }), { status: 200 }));

    await apiRequest("/api/v1/me/active-role", { method: "POST" });

    expect(client.getQueryData(["search", "restricted"])).toBeUndefined();
    expect(client.getQueryData(["participant-growth-analytics"])).toBeUndefined();
    expect(client.getQueryData(["public-config"])).toEqual({ demo_mode: true });
    client.clear();
  });

  it("does not remove actor-scoped queries when a role switch is rejected", async () => {
    const client = createQueryClient();
    client.setQueryData(["search", "restricted"], { items: ["still-current-role"] });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ code: "FORBIDDEN", message: "Нет доступа" }), { status: 403 }));

    await expect(apiRequest("/api/v1/me/active-role", { method: "POST" })).rejects.toMatchObject({ status: 403 });
    expect(client.getQueryData(["search", "restricted"])).toEqual({ items: ["still-current-role"] });
    client.clear();
  });

  it("does not reuse Agentic Coding evidence when a verification is revoked", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ skills: [{ current_level: 3 }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ skills: [{ current_level: null }] }), { status: 200 }));
    const path = "/api/v1/me/agentic-coding/profile?role_key=developer" as const;
    await expect(apiRequest<{ skills: Array<{ current_level: number | null }> }>(path))
      .resolves.toEqual({ skills: [{ current_level: 3 }] });
    await expect(apiRequest<{ skills: Array<{ current_level: number | null }> }>(path))
      .resolves.toEqual({ skills: [{ current_level: null }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
