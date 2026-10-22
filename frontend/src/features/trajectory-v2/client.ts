import type { DevelopmentOverviewView, RoleCardView } from "../participant-home-v2/client";
import { loadDevelopmentOverview, overviewQueryKey } from "../participant-home-v2/client";

export type { DevelopmentOverviewView, RoleCardView };

export { loadDevelopmentOverview, overviewQueryKey };

/**
 * Trajectory v2 consumes the same versioned development-overview snapshot as
 * home v2 (identical query key in the shared query client), so a role switch
 * that already happened before never refetches and two active trajectories
 * never swap payloads.
 */
export const OVERVIEW_QUERY_KEY = overviewQueryKey;

export const ROLE_STATE_LABELS: Record<string, string | undefined> = {
  active: "Активная",
  paused: "На паузе",
  unselected: "Не выбрана",
};

export const PRIMARY_LABEL = "Основная";

export function roleStateLabel(state: string): string {
  return ROLE_STATE_LABELS[state] ?? state;
}
