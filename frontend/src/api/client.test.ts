import { describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../app/query";
import { ApiClientError, apiRequest, retrySafeRead } from "./client";

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
});
