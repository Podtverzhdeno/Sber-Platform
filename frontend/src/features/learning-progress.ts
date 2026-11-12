/** Authoritative Impulse self-study projection, not a verified competency score. */
import type { QueryClient } from "@tanstack/react-query";
import { apiRequest } from "../api/client";

export type LearningCourse = {
  course_key: string;
  title: string;
  completed_units: number;
  total_units: number;
  finished: boolean;
  finished_at: string | null;
  certificate_id: string | null;
  updated_at: string;
  practice_status: string | null;
  practice_submitted_at?: string | null;
  practical_certificate_id: string | null;
};

export type LearningSummary = {
  started_courses: number;
  finished_courses: number;
  completed_lessons: number;
  approved_practices: number;
  credited_practices: number;
  courses: LearningCourse[];
};

export const learningSummaryQueryKey = ["impulse-learning-summary"] as const;

export function loadLearningSummary(): Promise<LearningSummary> {
  return apiRequest<LearningSummary>("/api/v1/me/bootcamp/impulse-study/summary", {
    cache: "no-store",
  });
}

/**
 * Shared invalidation contract for any server-confirmed study mutation.
 * Self-study and provider-verified completions remain separate, but every
 * screen reading the self-study projection must refresh on mutation.
 */
export function invalidateLearningProjections(
  client: QueryClient,
  scope: "lesson" | "all" = "all",
): void {
  // Per-lesson updates already commit the local course state and only need
  // the shared aggregate. Full completion/practice still refresh all reads.
  if (scope === "lesson") {
    void client.invalidateQueries({ queryKey: learningSummaryQueryKey });
    return;
  }
  const prefixes = [
    learningSummaryQueryKey,
    ["bootcamp-catalog"],
    ["bootcamp-v2-overview"],
    ["impulse-role-level"],
    ["participant-growth-analytics"],
    ["participant-analytics"],
    ["participant-competency-evidence"],
    ["bootcamp-certificates"],
    ["certificates"],
    ["trajectory-roadmaps"],
    ["trajectory-roadmap-catalog"],
    ["development-overview"],
    ["engagement-overview"],
    ["engagement-rhythm"],
    ["streak"],
    ["course-detail"],
    ["portfolio"],
  ] as const;
  for (const queryKey of prefixes) {
    void client.invalidateQueries({ queryKey });
  }
}
