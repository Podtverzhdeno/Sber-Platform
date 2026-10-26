import type { LearningCourse } from "../learning-progress";
import type { MilestoneView, RoadmapView } from "./client";
import { trajectoryStudyProgress } from "./study-progress";

/** Certified self-study closes the learning step for navigation, not independent
 * professional skill verification or an official career grade. */
export function projectLearningStages(roadmap: RoadmapView, courses: readonly LearningCourse[] | undefined, enrolled: boolean) {
  const studied = trajectoryStudyProgress(roadmap.milestones, courses, enrolled);
  const ordered = [...roadmap.milestones].sort((a,b)=>a.position-b.position);
  const completed = new Set(ordered.filter(m=>m.completed).map(m=>m.key));
  if (enrolled) for (const key of studied.studiedKeys) completed.add(key);
  const firstIncomplete = enrolled ? (ordered.find(m=>!completed.has(m.key)) ?? null) : null;
  // When the server publishes no next step, display ordinary available nodes
  // unless an actual certified course justifies progressing past a course.
  const next = roadmap.next_step !== null || studied.studiedKeys.size > 0 ? firstIncomplete : null;
  function stateOf(m: MilestoneView): "preview" | "completed" | "current" | "locked" | "available" {
    if (!enrolled) return "preview";
    if (completed.has(m.key)) return "completed";
    if (next?.key === m.key) return "current";
    if (next !== null && m.position > next.position) return "locked";
    return "available";
  }
  return { completed, next, stateOf, studied };
}

export function visitScope(actor: string | undefined, role: string, attempt: number | null, policy: number): string {
  return `impulse:trajectory:opened:v1:${encodeURIComponent(actor || "anonymous")}:${encodeURIComponent(role)}:${String(attempt ?? 0)}:${String(policy)}`;
}
export function stageWasOpened(scope: string, key: string): boolean {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(scope) ?? "[]");
    return Array.isArray(parsed) && parsed.includes(key);
  } catch { return false; }
}
export function markStageOpened(scope: string, key: string): void {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(scope) ?? "[]");
    const items = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    if (!items.includes(key)) window.localStorage.setItem(scope, JSON.stringify([...items,key]));
  } catch { /* Cosmetic acknowledgement is optional when storage is blocked. */ }
}
