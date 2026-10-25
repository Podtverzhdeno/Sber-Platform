/** Authoritative Impulse self-study projection, not a verified competency score. */
import { apiRequest } from "../api/client";

export type LearningCourse = {
  course_key: string;
  title: string;
  completed_units: number;
  total_units: number;
  finished: boolean;
  finished_at: string | null;
  updated_at: string;
  practice_status: string | null;
  practical_certificate_id: string | null;
};

export type LearningSummary = {
  started_courses: number;
  finished_courses: number;
  completed_lessons: number;
  approved_practices: number;
  courses: LearningCourse[];
};

export const learningSummaryQueryKey = ["impulse-learning-summary"] as const;

export function loadLearningSummary(): Promise<LearningSummary> {
  return apiRequest<LearningSummary>("/api/v1/me/bootcamp/impulse-study/summary", {
    cache: "no-store",
  });
}
