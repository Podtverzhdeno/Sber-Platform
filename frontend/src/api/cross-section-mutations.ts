/**
 * Read-after-write consistency contract (XS-101 / XS-102).
 *
 * Domain services persist facts and authorize transitions; this module only
 * invalidates client read-models after successful requests. In particular:
 * self-study "finished" does NOT award verified skills, career grades or rating.
 *
 * Prefixes are route-segment aware to avoid accidental invalidation of
 * unrelated commands (e.g. /me/workforce is not /me/work).
 */
const progressWritePaths = [
  // Learning: lessons, practice, completion, certificates.
  "/api/v1/me/bootcamp",
  "/api/v1/me/courses",
  // Career development, self-reported and verified evidence.
  "/api/v1/me/tracks",
  "/api/v1/me/engagement/qualify",
  "/api/v1/me/engagement/freeze",
  "/api/v1/me/engagement/rhythm",
  "/api/v1/me/growth/monthly-goal",
  "/api/v1/me/monthly-goal",
  // Participant applications, assignments, project submissions and work.
  "/api/v1/me/tasks",
  "/api/v1/me/applications",
  "/api/v1/me/assignments",
  "/api/v1/me/work",
  "/api/v1/me/project-credentials",
  // Events, account permissions, profile/consent and visibility.
  "/api/v1/me/events",
  "/api/v1/me/consents",
  "/api/v1/me/visibility",
  "/api/v1/me/profile",
  // Customer and mentor decisions can change another person's evidence.
  "/api/v1/customer/contributions",
  "/api/v1/customer/tasks",
  "/api/v1/customer/projects",
  "/api/v1/customer/applications",
  "/api/v1/customer/team-requests",
  "/api/v1/customer/deadline-requests",
  "/api/v1/mentor/reviews",
  // Operator review, recognition, scores, publishing and revocation.
  "/api/v1/ops/cases",
  "/api/v1/operations/tasks",
  "/api/v1/operations/rating-seasons",
  "/api/v1/operations/score-entries",
  "/api/v1/operations/offer-evidence",
  "/api/v1/operations/credentials",
] as const;

/**
 * These are query-key prefixes actually used by participant and cross-role
 * screens, not API paths. Nested query keys ([key, person/track/id]) refresh
 * without relying on a currently selected card or route.
 *
 * Adding a new data-consuming page requires updating this registry and its
 * consumer tests in the same change.
 */
export const participantProjectionKeys = [
  // Home, development, role grades, learning and skill evidence.
  "development-overview",
  "participant-development-overview",
  "trajectory-roadmaps",
  "trajectory-roadmap",
  "trajectory-roadmap-catalog",
  "trajectory-map",
  "trajectory-map-detail",
  "growth-snapshot",
  "growth-next-step",
  "participant-growth-analytics",
  "participant-analytics",
  "agentic-coding-profile",
  "impulse-study",
  "impulse-learning-summary",
  "bootcamp-catalog",
  "bootcamp-v2-overview",
  "bootcamp-v2-detail",
  "course-detail",
  "bootcamp-certificates",
  "certificates",
  "streak",
  "engagement-overview",
  "engagement-freeze",
  "engagement-rhythm",
  "monthly-goal",
  // Project, task, skills and evidence: reads used across roles.
  "my-work",
  "workspace-task-detail",
  "task-catalog-v2",
  "task-catalog-v2-detail",
  "task-recommendations",
  "talent-passport",
  "portfolio",
  "project-credentials",
  "event-claims",
  "events",
  "event-detail",
  "event-registration",
  "ecosystem-events",
  "customer-tasks",
  "customer-activity-events",
  // Recognition: a published season, not speculative learning XP.
  "rating",
  "rating-seasons",
  "rating-season-leaderboard",
  "achievements",
  // Role/access-scoped actor details may change after consent/profile writes.
  "me",
] as const;

/** Normalize only the pathname; retain path segment boundaries. */
function isEndpointOrChild(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isCrossSectionMutation(path: string, method: string): boolean {
  const verb = method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(verb)) return false;
  const pathname = (path.split(/[?#]/, 1)[0] ?? path).replace(/\/$/, "");
  return progressWritePaths.some(prefix => isEndpointOrChild(pathname, prefix));
}
