/** Server-persisted Impulse study level for one enrolled role.
 * Not a corporate job grade, competency rank or skill verification.
 */
import { apiRequest, type RuntimeApiPath } from "../api/client";

export type ImpulseRoleLevel = {
  track_key: string;
  level: number;
  cycle_number: number;
  curriculum_state: "published" | "unpublished";
  completed_courses: number;
  required_courses: number;
  approved_practices: number;
  credited_practices: number;
  required_practices: number;
  advance_ready: boolean;
  history: {from: number; to: number; awarded_at: string; policy_version: number}[];
  policy_version: number;
  max_level?: number;
  required_course_keys?: string[];
};

export const roleLevelQueryKey = (trackKey: string | null) =>
  ["impulse-role-level", trackKey] as const;

export function loadRoleLevel(trackKey: string): Promise<ImpulseRoleLevel> {
  return apiRequest<ImpulseRoleLevel>(
    (`/api/v1/me/bootcamp/impulse-level?track=${encodeURIComponent(trackKey)}`) as RuntimeApiPath,
    {cache:"no-store"},
  );
}

export function advanceRoleLevel(trackKey: string): Promise<ImpulseRoleLevel> {
  return apiRequest<ImpulseRoleLevel>(
    (`/api/v1/me/bootcamp/impulse-level/advance?track=${encodeURIComponent(trackKey)}`) as RuntimeApiPath,
    {
      method:"POST",
      headers:{"X-CSRF-Token":sessionStorage.getItem("impulse_csrf") ?? ""},
    },
  );
}

export function levelTitle(data: ImpulseRoleLevel): string {
  return `L${String(data.level)} · цикл ${String(data.cycle_number)}`;
}

export function levelCoursesProgress(data: ImpulseRoleLevel): number {
  return data.required_courses > 0
    ? Math.round(100 * data.completed_courses / data.required_courses) : 0;
}
