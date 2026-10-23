import { apiRequest } from "../../api/client";
import type { components } from "../../api/schema";
import type {
  DevelopmentOverviewView,
  RoleCardView,
} from "../participant-home-v2/client";
import {
  loadDevelopmentOverview,
  overviewQueryKey,
} from "../participant-home-v2/client";

export type { DevelopmentOverviewView, RoleCardView };

export { loadDevelopmentOverview, overviewQueryKey };

export type RoadmapView = components["schemas"]["RoadmapView"];
export type MilestoneView =
  components["schemas"]["impulse__api__v1__development__MilestoneView"];

export const ROADMAPS_PATH = "/api/v1/me/roadmaps";
export const roadmapsQueryKey = ["trajectory-roadmaps"] as const;

export function loadRoadmaps(): Promise<RoadmapView[]> {
  return apiRequest<RoadmapView[]>(ROADMAPS_PATH);
}

/* Cache key per track keeps a warm, role-scoped copy so switching between
 * trajectories stays cache-backed and stages never cross roles. */
export function roadmapQueryKeyFor(trackKey: string): readonly [string, string] {
  return ["trajectory-roadmap", trackKey] as const;
}

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

export const MILESTONE_STATE_LABELS: Record<string, string> = {
  completed: "Пройден",
  current: "Сейчас",
  available: "Доступен",
  locked: "Закрыт",
};

export function roleStateLabel(state: string): string {
  return ROLE_STATE_LABELS[state] ?? state;
}

export function milestoneState(
  milestone: MilestoneView,
  nextStep: MilestoneView | null,
): "completed" | "current" | "available" | "locked" {
  if (milestone.completed) return "completed";
  if (nextStep !== null && milestone.key === nextStep.key) return "current";
  if (nextStep !== null && milestone.position > nextStep.position) return "locked";
  return "available";
}
