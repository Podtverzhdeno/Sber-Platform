import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { clearCatalogAnalyticsEventIds, trackCatalogEvent } from "./analytics";
import { catalogItem } from "./fixture";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  clearCatalogAnalyticsEventIds();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("{}", { status: 202 }));
  vi.stubGlobal("fetch", fetchMock);
  sessionStorage.setItem("impulse_csrf", "analytics-test-csrf");
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function bodyOf(init: RequestInit | undefined): Record<string, unknown> {
  return JSON.parse(typeof init?.body === "string" ? init.body : "{}") as Record<string, unknown>;
}

describe("task catalog analytics", () => {
  it("deduplicates by client key and sends only the closed metadata dictionary", async () => {
    trackCatalogEvent({
      eventName: "catalog_view",
      view: "cards",
      snapshotVersion: "snapshot-1",
      algorithmVersion: "task-match-v1",
      dedupeKey: "view:snapshot-1:cards",
    });
    trackCatalogEvent({
      eventName: "catalog_view",
      view: "cards",
      snapshotVersion: "snapshot-1",
      algorithmVersion: "task-match-v1",
      dedupeKey: "view:snapshot-1:cards",
    });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const init = fetchMock.mock.calls[0]?.[1];
    const body = bodyOf(init);
    expect(body.event_name).toBe("catalog_view");
    expect(body.snapshot_version).toBe("snapshot-1");
    expect(body.algorithm_version).toBe("task-match-v1");
    expect(body).not.toHaveProperty("title");
    expect(body).not.toHaveProperty("brief");
    expect(body).not.toHaveProperty("url");
    expect(body).not.toHaveProperty("q");
    expect(body).not.toHaveProperty("person_id");
    expect(init?.headers).toMatchObject({ "X-CSRF-Token": "analytics-test-csrf" });
  });

  it("uses task and application versions without inventing content fields", async () => {
    trackCatalogEvent({ eventName: "application_result", task: catalogItem, result: "success" });
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const body = bodyOf(fetchMock.mock.calls[0]?.[1]);
    expect(body.task_id).toBe(catalogItem.task_id);
    expect(body.terms_version).toBe(catalogItem.terms_version);
    expect(body.result).toBe("success");
    expect(body.snapshot_version).toBe(catalogItem.snapshot_version);
  });

  it("swallows offline analytics failures", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    expect(() => {
      trackCatalogEvent({ eventName: "view_change", view: "list" });
    }).not.toThrow();
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
