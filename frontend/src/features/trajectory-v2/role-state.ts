import type { DevelopmentOverviewView, RoleCardView } from "./client";

/** At most one primary path: the server's next-outcome focus if enrolled,
 * otherwise the first active enrollment. A read-only catalogue preview or
 * the currently viewed detail must never become primary. */
export function primaryTrajectoryKey(overview: DevelopmentOverviewView): string | null {
  const enrolled = overview.roles.filter(
    (role) => role.attempt_number !== null && role.state !== "unselected",
  );
  const serverFocus = overview.next_outcome?.trajectory_key;
  if (serverFocus && enrolled.some((role) => role.track_key === serverFocus)) {
    return serverFocus;
  }
  return enrolled.find((role) => role.state === "active")?.track_key
    ?? enrolled[0]?.track_key
    ?? null;
}

export type RoleVisualTone = "primary" | "learning" | "unselected";

export function roleVisualTone(role: RoleCardView, primary: boolean): RoleVisualTone {
  if (role.attempt_number === null || role.state === "unselected") return "unselected";
  return primary ? "primary" : "learning";
}
