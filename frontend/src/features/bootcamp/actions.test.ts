import { describe, expect, it } from "vitest";

import type { CourseAccessState } from "./actions";
import { selectCourseActions, selectRecommendationAction } from "./actions";

function state(overrides: Partial<CourseAccessState>): CourseAccessState {
  return {
    accessible: true,
    locked: false,
    learning: "not_started",
    recommendedForUser: false,
    ...overrides,
  };
}

describe("bootcamp v2 action selector", () => {
  it("maps open learning states to their single honest CTA", () => {
    expect(selectCourseActions(state({ learning: "not_started" }))).toEqual([
      { kind: "start", label: "Начать курс" },
    ]);
    expect(selectCourseActions(state({ learning: "in_progress" }))).toEqual([
      { kind: "continue", label: "Продолжить обучение" },
    ]);
    expect(selectCourseActions(state({ learning: "completed" }))).toEqual([
      { kind: "complete", label: "Завершить" },
    ]);
    expect(selectCourseActions(state({ learning: "rejected" }))).toEqual([
      { kind: "retry", label: "Повторить выполнение" },
    ]);
  });

  it("never offers a CTA for locked, reported, verified or revoked states", () => {
    for (const variant of [
      state({ accessible: false, locked: true }),
      state({ learning: "reported" }),
      state({ learning: "verified" }),
      state({ learning: "revoked" }),
    ]) {
      expect(selectCourseActions(variant)).toEqual([]);
    }
  });

  it("keeps the recommendation affordance separate and explicit", () => {
    const withRecommendation = state({ recommendedForUser: true, learning: "verified" });
    expect(selectCourseActions(withRecommendation)).toEqual([]);
    expect(selectRecommendationAction(withRecommendation)).toEqual({
      kind: "recommend",
      label: "Рекомендовать роль",
    });
    expect(selectRecommendationAction(state({ learning: "not_started" }))).toBeNull();
  });
});
