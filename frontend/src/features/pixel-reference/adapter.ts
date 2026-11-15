import type { ImpulseRoleLevel } from "../impulse-role-level";
import {
  TASK_NEXT_ACTION_LABELS,
  type DevelopmentOverviewView,
  type OpenTarget,
} from "../participant-home-v2/client";
import type { PixelHomeModel } from "./ImpulsePixelReference";

export type PixelCourseProgress = { readonly complete: number; readonly total: number };

export type PixelHomeSource = {
  readonly overview: DevelopmentOverviewView;
  readonly roleLevel: ImpulseRoleLevel | null;
  readonly confirmedSkills: number | null;
  readonly courseProgress?: PixelCourseProgress | null;
  readonly buddyAvailable?: boolean;
};

/** Only source-backed course/task targets can be treated as actionable. */
export function resolvePixelPrimaryTarget(overview: DevelopmentOverviewView): {
  readonly kind: "task" | "course" | "trajectory";
  readonly key: string;
  readonly trajectoryKey?: string;
} {
  const active = overview.active_tasks.find(
    (task) => ["start", "send_work", "revise"].includes(task.next_action),
  );
  if (active) return { kind: "task", key: active.task_id };

  const next = overview.next_outcome;
  if (next && !next.stale_reason && next.target_key.trim() &&
    (next.target_kind === "task" || next.target_kind === "course")) {
    return { kind: next.target_kind, key: next.target_key, trajectoryKey: next.trajectory_key };
  }
  return { kind: "trajectory", key: "" };
}

/**
 * Real query projection for the independent visual component.
 * Do not infer grades, completion, evidence, roles or tasks from the screenshot.
 */
export function toPixelHomeModel({
  overview, roleLevel, confirmedSkills, courseProgress = null, buddyAvailable = false,
}: PixelHomeSource): PixelHomeModel {
  const active = overview.roles.find((item) => (
    item.track_key === overview.next_outcome?.trajectory_key && item.state === "active"
  )) ?? overview.roles.find((item) => item.state === "active") ?? null;

  const priority = resolvePixelPrimaryTarget(overview);
  const task = priority.kind === "task"
    ? overview.active_tasks.find((item) => item.task_id === priority.key) : null;
  const outcome = priority.kind !== "trajectory" && !task
    ? overview.next_outcome : null;

  const roleTitle = active?.title ?? null;
  const moduleTrackTitle = outcome?.trajectory_title ?? roleTitle;
  const nextTitle = task?.title ?? outcome?.target_title ?? null;
  const nextState = task
    ? TASK_NEXT_ACTION_LABELS[task.next_action] ?? task.status
    : outcome
      ? outcome.target_kind === "course" ? "Следующий курс" : "Следующий этап"
      : "Выбор следующего шага";

  const level = roleLevel?.level ?? null;
  const nextLevel = roleLevel && roleLevel.level < (roleLevel.max_level ?? 3)
    ? roleLevel.level + 1 : null;

  return {
    roleTitle,
    moduleTrackTitle,
    nextTitle,
    nextKind: priority.kind,
    nextState,
    nextActionText: task ? "Открыть задачу" :
      priority.kind === "course" ? "Продолжить обучение" :
        priority.kind === "task" ? "Перейти к практике" : "Выбрать траекторию",
    nextDescription: null,
    moduleProgress: priority.kind === "course" && courseProgress && courseProgress.total > 0
      ? courseProgress : null,
    level,
    nextLevel,
    completedCourses: roleLevel?.curriculum_state === "published" ?
      roleLevel.completed_courses : null,
    requiredCourses: roleLevel?.curriculum_state === "published" ?
      roleLevel.required_courses : null,
    activeTaskCount: overview.active_tasks.length,
    confirmedSkills,
    weekSummary: overview.weekly_focus.versioned ?
      `За неделю выполнено ${String(overview.weekly_focus.done_days)} из ${String(overview.weekly_focus.target_days)} запланированных дней.`
      : null,
    toolsSummary: buddyAvailable ? "Траектория, скилл-паспорт и AI Buddy" :
      "Траектория и скилл-паспорт",
  };
}

/** Reuses the existing canonical route selection and source trajectory. */
export function followPixelPrimaryTarget(
  overview: DevelopmentOverviewView,
  onOpenTarget: OpenTarget,
  onOpenWorkspace: (canonicalPath?: string) => void,
): void {
  const target = resolvePixelPrimaryTarget(overview);
  if (target.kind === "trajectory") {
    onOpenWorkspace("trajectory");
    return;
  }
  onOpenTarget(target.kind, target.key,
    target.kind === "course" ? target.trajectoryKey : undefined);
}
