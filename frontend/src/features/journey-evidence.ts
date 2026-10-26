/** Authorized joined evidence from the participant journey API.
 *
 * We use an existing invalidation family (development-overview), so every
 * successful course, task or recognition mutation revalidates this projection.
 * Course keys are matched exactly: never infer a relation from the title.
 */
import { apiRequest } from "../api/client";

export const journeyEvidenceQueryKey = ["development-overview", "journey-evidence"] as const;

export type RoadmapEvidenceLink = {
  track_key: string;
  policy_version: number;
  milestone_key: string;
  milestone_completed: boolean;
};

export type JourneyCourseEvidence = {
  course_key: string;
  provider_status: string | null;
  provider_verified: boolean;
  self_study: { finished: boolean } | null;
  roadmap_links: RoadmapEvidenceLink[];
};

export type JourneyEvidenceSnapshot = {
  person_id: string;
  self_study_available: boolean;
  courses: JourneyCourseEvidence[];
};

export function loadJourneyEvidence(): Promise<JourneyEvidenceSnapshot> {
  return apiRequest<JourneyEvidenceSnapshot>(
    "/api/v1/me/journey/snapshot",
    { cache: "no-store" },
  );
}

export type LinkedCourseStatus =
  | "milestone_verified"
  | "provider_verified"
  | "learning_finished"
  | "in_progress";

export function linkedCourseStatus(
  snapshot: JourneyEvidenceSnapshot | undefined,
  courseKey: string,
): LinkedCourseStatus | null {
  if (!snapshot) return null;
  const course = snapshot.courses.find(item => item.course_key === courseKey);
  if (!course || course.roadmap_links.length === 0) return null;
  if (course.roadmap_links.some(link => link.milestone_completed)) return "milestone_verified";
  if (course.provider_verified) return "provider_verified";
  if (course.self_study?.finished) return "learning_finished";
  return "in_progress";
}

export function linkedCourseLabel(status: LinkedCourseStatus): string {
  switch (status) {
    case "milestone_verified":
      return "Связанный этап траектории подтверждён";
    case "provider_verified":
      return "Курс подтверждён, завершение этапа ещё не зафиксировано";
    case "learning_finished":
      return "Обучение завершено, этап траектории ожидает подтверждения";
    case "in_progress":
      return "Связанный этап траектории ещё не завершён";
  }
}
