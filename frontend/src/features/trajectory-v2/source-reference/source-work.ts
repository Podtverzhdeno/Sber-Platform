import type { components } from "../../../api/schema";
import type { MilestoneView } from "../client";
import type { VerifiedStageTask } from "./source-layout";

export type ParticipantWorkItem = components["schemas"]["WorkItemView"];

/**
 * Strict reconciliation: a roadmap task target_key must equal the real
 * authenticated WorkItem.task.task_key. No substring, title or skill joins:
 * those can silently attribute another person's work to this milestone.
 *
 * The work read API provides one assigned task per task key. It does NOT
 * authorize making up three sub-tasks just to populate the original mock.
 */
export function verifiedTasksForStage(
  milestone: MilestoneView | null,
  work: readonly ParticipantWorkItem[] | null | undefined,
): VerifiedStageTask[] | undefined {
  if (milestone === null || milestone.target_kind !== "task" || work === null || work === undefined) return undefined;
  const matches = work.filter(item => item.task.task_key === milestone.target_key);
  // A published target can have multiple assignments; do not merge the wrong
  // individual's results. Work endpoint itself is scoped to this actor.
  return matches.map(item => {
    const latest = item.contributions.reduce<(typeof item.contributions)[number] | null>(
      (max, next) => max === null || next.version > max.version ? next : max,
      null,
    );
    const accepted = latest !== null && item.decisions.some(
      d => d.contribution_id === latest.id &&
        d.contribution_version === latest.version &&
        d.decision === "accepted",
    );
    return {
      id: item.assignment.id,
      title: item.task.title,
      kind: "Практическая задача",
      status: accepted ? "completed" as const : "current" as const,
      evidenceLabel: accepted ? "Принято заказчиком" : "Результат не подтверждён",
      xp: null,
      completedAt: null,
    };
  });
}
