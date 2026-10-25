import { describe, expect, it } from "vitest";
import { isCrossSectionMutation, participantProjectionKeys } from "./cross-section-mutations";

describe("cross-section progress mutation policy", () => {
  it.each([
    "/api/v1/me/bootcamp/impulse-study/demo-course-1/lessons/0/complete",
    "/api/v1/me/bootcamp/impulse-study/demo-course-1/finish",
    "/api/v1/me/bootcamp/impulse-study/demo-course-1/practice",
    "/api/v1/me/assignments/123/contributions",
    "/api/v1/customer/contributions/123/decision",
    "/api/v1/me/events/123/claims",
    "/api/v1/mentor/reviews/123/confirm",
    "/api/v1/me/courses/course-a/completion",
    "/api/v1/me/monthly-goal",
    "/api/v1/operations/rating-seasons/season-1/standings/rebuild",
    "/api/v1/operations/score-entries/entry-1/corrections",
  ])("refreshes all projections after successful %s", path => {
    expect(isCrossSectionMutation(path, "POST")).toBe(true);
  });

  it.each([
    "/api/v1/me/messaging/channels/abc/messages",
    "/api/v1/auth/demo-login",
    "/api/v1/me/messaging/channels/abc/read",
  ])("does not reload progress for unrelated %s", path => {
    expect(isCrossSectionMutation(path, "POST")).toBe(false);
  });

  it("read-only requests never invalidate the student journey", () => {
    expect(isCrossSectionMutation("/api/v1/me/bootcamp/impulse-study/summary", "GET")).toBe(false);
    expect(isCrossSectionMutation("/api/v1/me/bootcamp/impulse-study/demo-course-1/finish", "GET")).toBe(false);
  });

  it("includes all visible projections of one accepted result", () => {
    expect(participantProjectionKeys).toEqual(expect.arrayContaining([
      "participant-growth-analytics",
      "participant-analytics",
      "impulse-learning-summary",
      "trajectory-roadmaps",
      "talent-passport",
      "portfolio",
      "bootcamp-catalog",
      "rating-seasons",
      "rating-season-leaderboard",
    ]));
  });
});
