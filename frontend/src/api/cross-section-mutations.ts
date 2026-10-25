/**
 * Centralized write-to-read invalidation policy.
 * All domains still own their server-side transitions and authorization.
 * Invalidation never awards points; it only asks each authorized projection
 * to read the latest committed evidence.
 */
const materialWrites = [
  "/api/v1/me/bootcamp/impulse-study/",
  "/api/v1/me/bootcamp/",
  "/api/v1/me/courses/",
  "/api/v1/me/assignments/",
  "/api/v1/me/tasks/",
  "/api/v1/me/applications/",
  "/api/v1/customer/contributions/",
  "/api/v1/mentor/reviews/",
  "/api/v1/me/events/",
  "/api/v1/me/work",
  "/api/v1/me/monthly-goal",
  "/api/v1/me/project-credentials",
  "/api/v1/ops/cases/",
  "/api/v1/customer/tasks/",
] as const;

export const participantProjectionKeys = [
  "impulse-learning-summary",
  "participant-growth-analytics",
  "participant-analytics",
  "agentic-coding-profile",
  "bootcamp-catalog",
  "bootcamp-v2-overview",
  "bootcamp-certificates",
  "certificates",
  "trajectory-roadmaps",
  "trajectory-roadmap-catalog",
  "talent-passport",
  "portfolio",
  "development-overview",
  "participant-development-overview",
  "task-recommendations",
  "rating",
  "achievements",
] as const;

export function isCrossSectionMutation(path: string, method: string): boolean {
  const verb = method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(verb)) return false;
  const pathname = path.split("?")[0] ?? path;
  return materialWrites.some(prefix => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix));
}
