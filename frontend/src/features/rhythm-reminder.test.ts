import { describe, expect, it } from "vitest";
import type { WeeklyRhythm } from "./engagement-client";
import { rhythmReminderDueDate } from "./rhythm-reminder";

const planned: WeeklyRhythm = {
  versioned: true, history_count: 1, version: 1, preset: "custom",
  active_days: [1, 4], reminder_hour: 18, reminder_window_hours: 3,
  effective_from: "2026-10-19", week_start: "2026-10-19",
  week_end: "2026-10-25", target_days: 2, done_days: 0,
  hint: null, scheduled_from: null, scheduled_preset: null,
};

describe("rhythm reminders", () => {
  it("reminds only on a selected day after the chosen hour", () => {
    expect(rhythmReminderDueDate(planned, [], new Date(2026, 9, 22, 17, 59))).toBeNull();
    expect(rhythmReminderDueDate(planned, [], new Date(2026, 9, 22, 18, 15))).toBe("2026-10-22");
    expect(rhythmReminderDueDate(planned, [], new Date(2026, 9, 23, 18, 30))).toBeNull();
    expect(rhythmReminderDueDate(planned, ["2026-10-22"], new Date(2026, 9, 22, 19))).toBeNull();
    expect(rhythmReminderDueDate(planned, [], new Date(2026, 9, 22, 21, 0))).toBeNull();
  });

  it("never sends a reminder before the agreement starts", () => {
    const future = { ...planned, effective_from: "2026-10-29" };
    expect(rhythmReminderDueDate(future, [], new Date(2026, 9, 22, 19))).toBeNull();
  });

  it("supports reminder windows crossing midnight", () => {
    const late = { ...planned, active_days: [4], reminder_hour: 23, reminder_window_hours: 3 };
    expect(rhythmReminderDueDate(late, [], new Date(2026, 9, 23, 0, 30))).toBe("2026-10-22");
    expect(rhythmReminderDueDate(late, [], new Date(2026, 9, 23, 2, 0))).toBeNull();
  });
});
