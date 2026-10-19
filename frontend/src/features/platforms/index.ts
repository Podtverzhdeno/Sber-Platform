/**
 * Project platform connection catalog (openspec 22.20).
 *
 * Frontend module without shared-surface wiring: route registration into the project
 * workspace and the OpenAPI snapshot regeneration are separate shared-surface
 * lanes. Export the section and its typed views for the integrator:
 *
 * - `<PlatformsSection projectId={...} />` renders the «Платформы» block.
 * - Handoff: add `frontend/src/features/platforms/PlatformsSection` to the
 *   project workspace page, register `/api/v1/projects/{project_id}/platforms`
 *   router server-side, and extend `RuntimeApiPath` after `api:generate`.
 */

export { safeExternalUrl, platformRequest, csrfHeaders } from "./client";
export { PlatformsSection, PlatformsSectionBody } from "./platforms-section";
export {
  PLATFORM_STATUS_LABELS,
  PLATFORM_STATUS_TONES,
} from "./statuses";
export type { PlatformsSectionProps } from "./statuses";
export type {
  ConnectChallengeView,
  ConnectionCardView,
  ConnectionViewResponse,
  DeepLinkView,
  PlatformCatalogResponse,
  PlatformConnectionStatus,
  PlatformDiagnosticsView,
  ProviderCardView,
} from "./types";
