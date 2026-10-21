export interface EngagementOverview {
  current_days: number;
  best_days: number;
  qualified_dates: string[];
  reason: string;
  today_saved: boolean;
  grace_available: boolean;
  frozen_dates: string[];
  freeze_state: "idle" | "frozen" | "break" | "out_of_stock";
}

export interface FreezeSummary {
  policy_version: number;
  granted_total: number;
  available: number;
  consumed_total: number;
}

export interface WeeklyRhythm {
  versioned: boolean;
  history_count: number;
  version: number | null;
  preset: string | null;
  active_days: number[];
  reminder_hour: number | null;
  reminder_window_hours: number | null;
  effective_from: string | null;
  week_start: string | null;
  week_end: string | null;
  target_days: number | null;
  done_days: number | null;
  hint: string | null;
}

export interface WeeklyRhythmInput {
  preset: string;
  custom_days: number[];
  reminder_hour: number;
  reminder_window_hours: number;
  effective_from: string;
}

export async function fetchEngagementOverview(): Promise<EngagementOverview> {
  const response = await fetch("/api/v1/me/engagement/overview");
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as EngagementOverview;
}

export async function fetchFreezeSummary(): Promise<FreezeSummary> {
  const response = await fetch("/api/v1/me/engagement/freeze");
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as FreezeSummary;
}

export async function fetchWeeklyRhythm(): Promise<WeeklyRhythm> {
  const response = await fetch("/api/v1/me/engagement/rhythm");
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as WeeklyRhythm;
}

export async function saveWeeklyRhythm(
  input: WeeklyRhythmInput,
): Promise<WeeklyRhythm> {
  const response = await fetch("/api/v1/me/engagement/rhythm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "",
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as WeeklyRhythm;
}

export async function useFreezeDay(): Promise<EngagementOverview> {
  const response = await fetch("/api/v1/me/engagement/freeze/use", {
    method: "POST",
    headers: { "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" },
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as EngagementOverview;
}

export const ANIMATION_STORAGE_KEY = "engagement:last-indicator-days";
