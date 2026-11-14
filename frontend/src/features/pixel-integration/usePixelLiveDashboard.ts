import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../api/client";
import { loadRoleLevel, roleLevelQueryKey } from "../impulse-role-level";
import { learningSummaryQueryKey, loadLearningSummary } from "../learning-progress";
import type { DevelopmentOverviewView } from "../participant-home-v2/client";
import { resolvePixelPrimaryTarget, toPixelHomeModel } from "../pixel-reference/adapter";
import type { PixelHomeModel } from "../pixel-reference/ImpulsePixelReference";

type Passport = {
  skills: { key: string; confirmed_case_count: number; practical_level: string }[];
};

export type PixelLiveDashboardState = {
  /** No fabricated defaults: unknown server fields remain null in model. */
  model: PixelHomeModel;
  loading: boolean;
  partialData: boolean;
  /** The source role used for level computations. */
  trackKey: string | null;
};

/**
 * Real production data connector; no draft API, mock counter, or invented data.
 * It receives the authenticated overview already loaded by ParticipantHomeV2.
 * The page-level owner may mount this hook after claiming that route.
 */
export function usePixelLiveDashboard(
  overview: DevelopmentOverviewView,
  buddyAvailable = false,
): PixelLiveDashboardState {
  const role = overview.roles.find(
    (item) => item.track_key === overview.next_outcome?.trajectory_key && item.state === "active",
  ) ?? overview.roles.find((item) => item.state === "active") ?? overview.roles[0] ?? null;
  const trackKey = role?.track_key ?? null;
  const target = resolvePixelPrimaryTarget(overview);
  const levelQuery = useQuery({
    queryKey: roleLevelQueryKey(trackKey),
    queryFn: () => loadRoleLevel(trackKey ?? ""),
    enabled: trackKey !== null,
    retry: false,
  });
  const passportQuery = useQuery({
    queryKey: ["talent-passport"],
    queryFn: () => apiRequest<Passport>("/api/v1/me/talent-passport"),
    retry: false,
  });
  const courseQuery = useQuery({
    queryKey: learningSummaryQueryKey,
    queryFn: loadLearningSummary,
    enabled: target.kind === "course" && Boolean(target.key),
    retry: false,
  });

  const verifiedSkills = passportQuery.data
    ? passportQuery.data.skills.filter((skill) => skill.confirmed_case_count > 0).length
    : null;
  const currentCourse = target.kind === "course"
    ? courseQuery.data?.courses.find((course) => course.course_key === target.key)
    : null;
  const courseProgress = currentCourse && currentCourse.total_units > 0
    ? { complete: currentCourse.completed_units, total: currentCourse.total_units }
    : null;
  const model = toPixelHomeModel({
    overview, roleLevel: levelQuery.data ?? null,
    confirmedSkills: verifiedSkills,
    courseProgress, buddyAvailable,
  });
  const loading = (
    (trackKey !== null && levelQuery.isPending) ||
    passportQuery.isPending ||
    (target.kind === "course" && courseQuery.isPending)
  );
  const partialData = Boolean(
    levelQuery.isError || passportQuery.isError ||
    (target.kind === "course" && courseQuery.isError),
  );
  return { model, loading, partialData, trackKey };
}
