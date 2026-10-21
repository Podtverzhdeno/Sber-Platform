import { apiRequest, type RuntimeApiPath } from "../api/client";

export type MonthlyGoalStep = {
  key: string;
  position: number;
  title: string;
  skill: string;
  mandatory: boolean;
  status: "completed" | "submitted" | "available" | "locked" | "unknown";
  ref: string;
};

export type MonthlyGoalView = {
  policy_version: number;
  generated_at: string;
  track_key: string;
  track_title: string;
  goal_title: string;
  goal_ref: string;
  period_start: string;
  period_end: string;
  days_left: number;
  timezone: string;
  plan_version: number;
  history_count: number;
  steps: MonthlyGoalStep[];
  contours: { baseline: number; current: number; projected: number; target: number };
  remaining: number;
  next_checkpoint: string | null;
  next_checkpoint_ref: string | null;
  feasibility: {
    known: boolean;
    capacity_days: number;
    required_steps: number;
    feasible: boolean;
    deficit: number;
    text: string;
  };
  partial_forecast: boolean;
  coverage: number;
  missing_mappings: string[];
  assumptions: string[];
};

type Roadmap = {
  track_key: string;
  milestones: Array<{ key: string; position: number; completed: boolean }>;
};

const monthlyGoalPath = "/api/v1/me/growth/monthly-goal" as RuntimeApiPath;

export function loadMonthlyGoal(): Promise<MonthlyGoalView | null> {
  return apiRequest<MonthlyGoalView | null>(monthlyGoalPath);
}

export async function claimRecommendedMonthlyGoal(): Promise<MonthlyGoalView> {
  const roadmaps = await apiRequest<Roadmap[]>("/api/v1/me/roadmaps");
  const roadmap = roadmaps.find((item) => item.milestones.length > 0);
  const target = roadmap
    ? [...roadmap.milestones].sort((left, right) => right.position - left.position)[0]
    : undefined;
  if (!roadmap || !target) throw new Error("Нет доступного checkpoint для месячной цели");
  return apiRequest<MonthlyGoalView>(monthlyGoalPath, {
    method: "POST",
    headers: { "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" },
    body: JSON.stringify({ track_key: roadmap.track_key, milestone_key: target.key }),
  });
}
