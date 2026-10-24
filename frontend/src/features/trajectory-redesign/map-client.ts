import { apiRequest } from "../../api/client";
import type { TrajectoryMapTrackView } from "../trajectory-map/types";
import type { MilestoneView, RoleCardView } from "../trajectory-v2/client";

export const trajectoryMapQueryKey = ["trajectory-map-v2"] as const;

export function loadTrajectoryMap(): Promise<TrajectoryMapTrackView[]> {
  return apiRequest<TrajectoryMapTrackView[]>("/api/v1/me/trajectory-map");
}

export function projectedState(role: RoleCardView, milestone: MilestoneView, track: TrajectoryMapTrackView | null) {
  if (role.state !== "active") return { css: "catalog", label: "В каталоге", actionable: false };
  const checkpoint = track?.checkpoints.find((item) => item.key === milestone.key) ?? null;
  if (checkpoint === null) return { css: "unknown", label: "Нет данных карты", actionable: false };
  return { css: checkpoint.state.toLowerCase(), label: checkpoint.state_label, actionable: checkpoint.actionable };
}

export function mapFocus(track: TrajectoryMapTrackView | null, roadmap: { milestones: MilestoneView[] } | null): MilestoneView | null {
  if (track === null || roadmap === null || track.current_key === null) return null;
  return roadmap.milestones.find((item) => item.key === track.current_key) ?? null;
}
