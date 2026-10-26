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

/** Persistent study-only role. Does not change the primary career track. */
export function setOptionalTrajectory(trackKey: string, enabled: boolean): Promise<unknown> {
  return apiRequest("/api/v1/me/tracks/optional", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ track_key: trackKey, enabled }),
  });
}

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

const TRAJECTORY_PIN_STORAGE_KEY = "trajectory-v2-pinned";

/**
 * Pin is explicitly a local preference: the backend owns no pin surface yet,
 * so the badge wording keeps that boundary honest.
 */
export function readPinnedTrack(): string | null {
  try {
    return window.localStorage.getItem(TRAJECTORY_PIN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writePinnedTrack(trackKey: string | null): void {
  try {
    if (trackKey === null) {
      window.localStorage.removeItem(TRAJECTORY_PIN_STORAGE_KEY);
    } else {
      window.localStorage.setItem(TRAJECTORY_PIN_STORAGE_KEY, trackKey);
    }
  } catch {
    return; // storage unavailable; pin stays runtime-only
  }
}

export async function copyText(text: string): Promise<boolean> {
  if (!("clipboard" in navigator)) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export type RoleCompareMetric = { label: string; values: [string, string] };

/** Shared metric definitions so role comparison cannot drift between pairs. */
export function compareMetrics(
  roadmaps: RoadmapView[],
  trackA: string,
  trackB: string,
): RoleCompareMetric[] {
  const metricFor = (trackKey: string): string[] => {
    const roadmap = roadmaps.find((item) => item.track_key === trackKey) ?? null;
    const stages = roadmap?.milestones ?? [];
    const taskCount = stages.reduce((sum, m) => sum + (m.target_kind === "task" ? 1 : 0), 0);
    const courseCount = stages.reduce((sum, m) => sum + (m.target_kind === "course" ? 1 : 0), 0);
    const completedCount = stages.reduce((sum, m) => sum + (m.completed ? 1 : 0), 0);
    return [
      String(stages.length),
      `${String(completedCount)} из ${String(stages.length)}`,
      roadmap === null
        ? "снимок дорожной карты недоступен"
        : (roadmap.next_step?.title ?? "следующий шаг не задан сервером"),
      roadmap === null
        ? "нет данных"
        : `задач ${String(taskCount)}, курсов ${String(courseCount)}`,
    ];
  };
  const left = metricFor(trackA);
  const right = metricFor(trackB);
  return [
    { label: "Этапов в каталоге", values: [left[0] ?? "", right[0] ?? ""] },
    { label: "Пройдено этапов", values: [left[1] ?? "", right[1] ?? ""] },
    { label: "Следующий шаг", values: [left[2] ?? "", right[2] ?? ""] },
    { label: "Цели этапов", values: [left[3] ?? "", right[3] ?? ""] },
  ];
}
