/** Timezone-aware, auditable projection of recorded activity; no inferred session durations. */
export type ActivityEvent = {
  occurred_at: string;
  kind: string;
  title: string;
  source_kind: string;
  source_ref: string;
};

export type ActivityFeed = {
  generated_at: string;
  actor_timezone?: string;
  freshness: { known: boolean; latest_observed_at: string | null };
  events?: ActivityEvent[];
};


export type Day = { key: string; timestamp: number; count: number; events: ActivityEvent[]; future: boolean };
const DAY = 86_400_000;
function utcKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/** Assign timestamps to calendar days in the server-provided actor timezone. */
function localDateKey(timestamp: number, timeZone: string): string | null {
  if (!Number.isFinite(timestamp)) return null;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    });
    const parts = formatter.formatToParts(new Date(timestamp));
    const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
    const dateKey = part("year") + "-" + part("month") + "-" + part("day");
    return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : null;
  } catch {
    return null;
  }
}


export function buildActivityDays(snapshot: ActivityFeed | undefined, weeks: number, now = new Date()): Day[] {
  const length = Math.max(1, Math.min(52, Math.trunc(weeks) || 12)) * 7;
  const timeZone = snapshot?.actor_timezone || "UTC";
  const todayKey = localDateKey(now.getTime(), timeZone) ?? utcKey(now.getTime());
  const todayTimestamp = Date.parse(todayKey + "T00:00:00Z");
  const dayOfWeek = new Date(todayTimestamp).getUTCDay();
  const monday = todayTimestamp - ((dayOfWeek + 6) % 7) * DAY;
  const first = monday - (length - 7) * DAY;
  const eventsByDate = new Map<string, ActivityEvent[]>();
  const seen = new Set<string>();

  for (const event of snapshot?.events ?? []) {
    if (!event.source_kind || !event.source_ref || !event.title) continue;
    const timestamp = Date.parse(event.occurred_at);
    const key = localDateKey(timestamp, timeZone);
    if (!key) continue;
    const fingerprint = [event.source_kind, event.source_ref, event.kind, event.occurred_at].join("|");
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    const list = eventsByDate.get(key) ?? [];
    list.push(event);
    eventsByDate.set(key, list);
  }

  return Array.from({ length }, (_, index) => {
    const timestamp = first + index * DAY;
    const key = utcKey(timestamp);
    const events = (eventsByDate.get(key) ?? []).sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    return { key, timestamp, count: events.length, events, future: timestamp > todayTimestamp };
  });
}

