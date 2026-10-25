import type { WeeklyRhythm } from "./engagement-client";

const dateKey = (date: Date): string => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");

/**
 * Client-side reminder fallback for an open browser tab.
 * Returns the scheduled date that is due (including windows crossing midnight).
 * It never awards an engagement day or claims a server push was sent.
 */
export function rhythmReminderDueDate(
  rhythm: WeeklyRhythm | null,
  qualifiedDates: readonly string[],
  now: Date,
): string | null {
  if (!rhythm?.versioned ||
      !rhythm.effective_from ||
      rhythm.reminder_hour === null ||
      rhythm.reminder_window_hours === null) return null;
  for (const offset of [0, -1]) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const key = dateKey(date);
    const isoDay = ((date.getDay() + 6) % 7) + 1;
    if (!rhythm.active_days.includes(isoDay) ||
        key < rhythm.effective_from ||
        qualifiedDates.includes(key)) continue;
    const due = new Date(date.getFullYear(), date.getMonth(), date.getDate(), rhythm.reminder_hour);
    const until = new Date(due.getTime() + rhythm.reminder_window_hours * 60 * 60 * 1000);
    if (now >= due && now < until) return key;
  }
  return null;
}
