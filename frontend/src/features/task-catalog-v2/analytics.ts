import type { CatalogItem, CatalogLayout } from "./types";

export type CatalogApplicationResult = "success" | "error" | "terms_changed" | "offline";
export type CatalogAnalyticsEventName =
  | "catalog_view"
  | "task_select"
  | "conditions_open"
  | "application_result"
  | "growth_expand"
  | "view_change";

type CatalogAnalyticsInput = {
  eventName: CatalogAnalyticsEventName;
  task?: CatalogItem;
  view?: CatalogLayout;
  result?: CatalogApplicationResult;
  algorithmVersion?: string | null;
  snapshotVersion?: string | null;
  dedupeKey?: string;
};

// A retry reuses the event id. The map is deliberately session/memory scoped:
// no identifiers or event payloads are written to localStorage or cookies.
const eventIds = new Map<string, string>();
const pendingKeys = new Set<string>();
const completedKeys = new Set<string>();

function newEventId(): string | null {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    // Analytics is optional and must never block the manual catalog journey.
    return null;
  }
}

export function trackCatalogEvent(input: CatalogAnalyticsInput): void {
  const dedupeKey = input.dedupeKey ?? newEventId();
  if (dedupeKey === null) return;
  if (input.dedupeKey !== undefined) {
    if (pendingKeys.has(dedupeKey) || completedKeys.has(dedupeKey)) return;
    pendingKeys.add(dedupeKey);
  }
  let eventId = eventIds.get(dedupeKey);
  if (eventId === undefined) {
    const createdEventId = newEventId();
    if (createdEventId === null) {
      pendingKeys.delete(dedupeKey);
      return;
    }
    eventId = createdEventId;
    eventIds.set(dedupeKey, eventId);
  }
  const body = {
    event_id: eventId,
    event_name: input.eventName,
    task_id: input.task?.task_id ?? null,
    view: input.view ?? null,
    result: input.result ?? null,
    algorithm_version: input.task?.match.algorithm_version ?? input.algorithmVersion ?? null,
    snapshot_version: input.task?.snapshot_version ?? input.snapshotVersion ?? null,
    terms_version: input.task?.terms_version ?? null,
  };
  void (async () => {
    try {
      const response = await fetch("/api/v1/me/task-recommendations/analytics/events", {
        method: "POST",
        credentials: "include",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "",
        },
        body: JSON.stringify(body),
      });
      if (response.ok && input.dedupeKey !== undefined) completedKeys.add(dedupeKey);
      // Deliberately no console/error reporting: event payloads stay out of logs.
    } catch {
      // Offline analytics is best effort and never changes catalog/application state.
    } finally {
      pendingKeys.delete(dedupeKey);
    }
  })();
}

export function clearCatalogAnalyticsEventIds(): void {
  eventIds.clear();
  pendingKeys.clear();
  completedKeys.clear();
}
