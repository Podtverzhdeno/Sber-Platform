export interface EngagementOverview {
  current_days: number;
  best_days: number;
  qualified_dates: string[];
  reason: string;
  today_saved: boolean;
  grace_available: boolean;
}

export async function fetchEngagementOverview(): Promise<EngagementOverview> {
  const response = await fetch("/api/v1/me/engagement/overview");
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as EngagementOverview;
}

export const ANIMATION_STORAGE_KEY = "engagement:last-indicator-days";
