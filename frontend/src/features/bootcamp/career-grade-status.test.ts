import { describe, expect, it } from "vitest";

import { careerGradeLabel } from "./career-grade-status";

describe("Bootcamp career grade source", () => {
  const ready = { pending: false, error: false };

  it("does not fabricate a professional grade while the policy is unpublished", () => {
    expect(careerGradeLabel({ state: "not_evaluable", current_grade: null }, ready))
      .toBe("Карьерный грейд: правила не опубликованы");
  });

  it("only displays an actually assigned grade", () => {
    expect(careerGradeLabel({ state: "current", current_grade: "Middle" }, ready))
      .toBe("Карьерный грейд: Middle");
    expect(careerGradeLabel({ state: "current", current_grade: null }, ready))
      .toBe("Карьерный грейд: не определён");
  });

  it("distinguishes loading, API failure and missing evidence", () => {
    expect(careerGradeLabel(undefined, { pending: true, error: false }))
      .toBe("Карьерный грейд: загружается");
    expect(careerGradeLabel(undefined, { pending: false, error: true }))
      .toBe("Карьерный грейд: данные недоступны");
    expect(careerGradeLabel(undefined, ready))
      .toBe("Карьерный грейд: данные недоступны");
  });
});
