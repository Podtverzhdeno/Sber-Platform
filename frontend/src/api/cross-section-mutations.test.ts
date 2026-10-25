import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, clearApiReadCache, subscribeProgressMutation, type RuntimeApiPath } from "./client";
import { isCrossSectionMutation, participantProjectionKeys } from "./cross-section-mutations";

afterEach(() => {
  clearApiReadCache();
  vi.restoreAllMocks();
});

describe("cross-section progress mutation policy", () => {
  it.each([
    "/api/v1/me/bootcamp/impulse-study/demo-course-1/lessons/0/complete",
    "/api/v1/me/bootcamp/impulse-study/demo-course-1/finish",
    "/api/v1/me/bootcamp/impulse-study/demo-course-1/practice",
    "/api/v1/me/courses/course-a/completion",
    "/api/v1/me/bootcamp/certificates/course-a",
    "/api/v1/me/tracks",
    "/api/v1/me/engagement/qualify",
    "/api/v1/me/engagement/freeze/use",
    "/api/v1/me/engagement/rhythm",
    "/api/v1/me/growth/monthly-goal",
    "/api/v1/me/assignments/123/contributions",
    "/api/v1/me/assignments/123/checkpoints/xyz/submit",
    "/api/v1/me/tasks/123/applications",
    "/api/v1/customer/applications/123/accept",
    "/api/v1/customer/contributions/123/decision",
    "/api/v1/customer/tasks/123/submit",
    "/api/v1/customer/projects/proj-1/tasks",
    "/api/v1/me/events/123/claims",
    "/api/v1/me/profile",
    "/api/v1/me/consents/portfolio",
    "/api/v1/me/visibility/profile",
    "/api/v1/mentor/reviews/123/confirm",
    "/api/v1/me/project-credentials",
    "/api/v1/operations/tasks/123/moderate",
    "/api/v1/operations/rating-seasons/season-1/standings/rebuild",
    "/api/v1/operations/score-entries/entry-1/corrections",
  ])("refreshes linked projections after successful %s", path => {
    expect(isCrossSectionMutation(path, "POST")).toBe(true);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("supports %s when a covered business route mutates", method => {
    expect(isCrossSectionMutation("/api/v1/me/bootcamp/impulse-study/a/finish", method)).toBe(true);
  });

  it.each([
    "/api/v1/me/messaging/channels/abc/messages",
    "/api/v1/auth/demo-login",
    "/api/v1/me/messaging/channels/abc/read",
    "/api/v1/me/workforce",
    "/api/v1/me/tracks-extra",
    "/api/v1/customer/tasks-extra",
    "/api/v1/me/courses-malformed",
  ])("does not refresh unrelated %s", path => {
    expect(isCrossSectionMutation(path, "POST")).toBe(false);
  });

  it("does not refresh for GET or HEAD, even for a covered endpoint", () => {
    expect(isCrossSectionMutation("/api/v1/me/bootcamp/impulse-study/summary", "GET")).toBe(false);
    expect(isCrossSectionMutation("/api/v1/me/bootcamp/impulse-study/a/finish", "HEAD")).toBe(false);
  });

  it("matches the pathname but not query strings or fragments", () => {
    expect(isCrossSectionMutation("/api/v1/me/bootcamp/impulse-study/a/finish?track=python#result", "POST")).toBe(true);
    expect(isCrossSectionMutation("/api/v1/me/tracks?version=1", "PATCH")).toBe(true);
    expect(isCrossSectionMutation("/api/v1/me/workforce?task=/api/v1/me/work", "POST")).toBe(false);
  });

  it("includes every observed cross-section UI query prefix", () => {
    expect(participantProjectionKeys).toEqual(expect.arrayContaining([
      "development-overview",
      "engagement-overview",
      "engagement-rhythm",
      "participant-growth-analytics",
      "participant-analytics",
      "impulse-learning-summary",
      "bootcamp-catalog",
      "bootcamp-v2-overview",
      "bootcamp-v2-detail",
      "trajectory-roadmaps",
      "trajectory-roadmap",
      "trajectory-roadmap-catalog",
      "trajectory-map",
      "trajectory-map-detail",
      "growth-snapshot",
      "talent-passport",
      "project-credentials",
      "portfolio",
      "my-work",
      "workspace-task-detail",
      "customer-tasks",
      "customer-activity-events",
      "task-catalog-v2",
      "event-claims",
      "bootcamp-certificates",
      "rating-seasons",
      "rating-season-leaderboard",
      "me",
    ]));
    expect(new Set(participantProjectionKeys).size).toBe(participantProjectionKeys.length);
  });

  it("notifies exactly once on successful persisted course completion", async () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeProgressMutation(onChange);
    try {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ finished: true, course_key: "a" }), { status: 200 }),
      );
      await apiRequest<{ finished: boolean }>(
        "/api/v1/me/bootcamp/impulse-study/a/finish" as RuntimeApiPath,
        { method: "POST", body: "{}" },
      );
      expect(onChange).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it("does not signal completion when the server rejects the write", async () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeProgressMutation(onChange);
    try {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "FORBIDDEN", message: "Not allowed" }), { status: 403 }),
      );
      await expect(apiRequest(
        "/api/v1/me/bootcamp/impulse-study/a/finish" as RuntimeApiPath,
        { method: "POST", body: "{}" },
      )).rejects.toThrow();
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });
});
