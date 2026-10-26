/** Owner-only facts for AI Buddy. The assistant can explain data, not award it.
 *
 * Self-study completion, provider verification, accepted work and published
 * ranking have different authorities and must never be inferred from each other.
 * Missing API data must stay unknown rather than becoming a fabricated zero.
 */
import { apiRequest } from "../api/client";

export type BuddyStudyCourse = {
  course_key: string;
  title: string;
  self_study: { finished: boolean; completed_units: number; total_units: number } | null;
  provider_verified: boolean;
};

export type BuddyProject = {
  assignment_id: string;
  task_id: string;
  title: string;
  assignment_status: string;
  submitted_contribution_ids: string[];
  accepted_contribution_ids: string[];
};

export type BuddyJourney = {
  person_id: string;
  self_study_available: boolean;
  courses: BuddyStudyCourse[];
  projects: BuddyProject[];
  accepted_case_count: number;
  verified_provider_course_count: number;
};

export type BuddyPassport = {
  person_id: string;
  skills: { key: string; practical_level: string; confirmed_case_count: number }[];
};

export type BuddyAnalytics = {
  next_action: string;
  freshness: string;
};

export function loadBuddyJourney(): Promise<BuddyJourney> {
  return apiRequest<BuddyJourney>("/api/v1/me/journey/snapshot", {
    cache: "no-store",
  });
}

export function loadBuddyPassport(): Promise<BuddyPassport> {
  return apiRequest<BuddyPassport>("/api/v1/me/talent-passport", { cache: "no-store" });
}

export function loadBuddyAnalytics(): Promise<BuddyAnalytics> {
  return apiRequest<BuddyAnalytics>("/api/v1/me/analytics/journey", { cache: "no-store" });
}

export function completedStudyCourses(journey: BuddyJourney): BuddyStudyCourse[] {
  return journey.courses.filter(course => course.self_study?.finished === true);
}

export function activeBuddyProjects(journey: BuddyJourney): BuddyProject[] {
  return journey.projects.filter(project => [
    "accepted", "in_progress", "submitted", "completed",
  ].includes(project.assignment_status));
}

export function countConfirmedSkills(passport: BuddyPassport): number {
  return passport.skills.filter(skill =>
    skill.confirmed_case_count > 0 && skill.practical_level === "confirmed"
  ).length;
}

export function normalizeNextAction(analytics: BuddyAnalytics | undefined): string | null {
  const value = analytics?.next_action.trim();
  return value ? value.slice(0, 240) : null;
}
