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
