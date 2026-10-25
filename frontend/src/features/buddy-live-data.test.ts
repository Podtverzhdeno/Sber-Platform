import { describe, expect, it } from "vitest";
import {
  activeBuddyProjects,
  completedStudyCourses,
  countConfirmedSkills,
  normalizeNextAction,
  type BuddyJourney,
} from "./buddy-live-data";

const journey: BuddyJourney = {
  person_id: "owner",
  self_study_available: true,
  accepted_case_count: 1,
  verified_provider_course_count: 0,
  courses: [
    { course_key: "intro", title: "Введение", self_study: { finished: true, completed_units: 8, total_units: 8 }, provider_verified: false },
    { course_key: "provider", title: "Provider", self_study: null, provider_verified: true },
    { course_key: "incomplete", title: "Пока изучаю", self_study: { finished: false, completed_units: 2, total_units: 8 }, provider_verified: false },
  ],
  projects: [
    { task_id: "t1", assignment_id: "a1", title: "Настоящий проект", assignment_status: "in_progress", submitted_contribution_ids: [], accepted_contribution_ids: ["c1"] },
    { task_id: "t2", assignment_id: "a2", title: "Заявка", assignment_status: "cancelled", submitted_contribution_ids: [], accepted_contribution_ids: [] },
  ],
};

describe("AI Buddy authorized fact projections", () => {
  it("counts self-study only when an actual course finish exists", () => {
    expect(completedStudyCourses(journey).map(course => course.course_key)).toEqual(["intro"]);
    expect(journey.verified_provider_course_count).toBe(0);
  });

  it("shows actual assignments, not cancelled or applied cases", () => {
    expect(activeBuddyProjects(journey).map(item => item.task_id)).toEqual(["t1"]);
  });

  it("does not transform reported, incomplete or unassessed skills into verified ones", () => {
    expect(countConfirmedSkills({
      person_id: "owner",
      skills: [
        { key: "python", confirmed_case_count: 1, practical_level: "confirmed" },
        { key: "guess", confirmed_case_count: 0, practical_level: "confirmed" },
        { key: "unassessed", confirmed_case_count: 2, practical_level: "unassessed" },
      ],
    })).toBe(1);
  });

  it("never invents a next action when analytics is empty or absent", () => {
    expect(normalizeNextAction(undefined)).toBeNull();
    expect(normalizeNextAction({ next_action: "  ", freshness: "current" })).toBeNull();
    expect(normalizeNextAction({ next_action: "Улучшить архитектуру", freshness: "current" })).toBe("Улучшить архитектуру");
  });
});
