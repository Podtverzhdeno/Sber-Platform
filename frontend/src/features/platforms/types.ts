/**
 * Types of the project platform connection catalog (openspec 22.20) and its
 * sync projections (openspec 22.21).
 * Mirror of the backend `/api/v1/projects/{project_id}/platforms` projections.
 * None of these views carries credential material: tokens stay sealed
 * server-side, diagnostics only expose a hash fingerprint, and imported
 * platform objects are never confirmed evidence by themselves.
 */

/** Lifecycle state machine of a platform connection for one project. */
export type PlatformConnectionStatus =
  | "not_connected"
  | "connecting"
  | "connected"
  | "action_required"
  | "expired"
  | "revoked"
  | "unavailable"
  | "error";

export interface ConnectionCardView {
  id: string;
  provider_key: string;
  workspace_ref: string | null;
  scopes: string[];
  status: PlatformConnectionStatus;
  last_sync_at: string | null;
  last_error: string | null;
}

/** One provider row of the «Платформы» section of a project workspace. */
export interface ProviderCardView {
  provider_key: string;
  title: string;
  purpose: string;
  required_permissions: string[];
  repository_label: string;
  connection: ConnectionCardView | null;
}

export interface PlatformCatalogResponse {
  items: ProviderCardView[];
}

export interface ConnectChallengeView {
  provider_key: string;
  authorization_url: string;
  state: string;
  expires_at: string;
}

export interface ConnectionViewResponse {
  id: string;
  provider_key: string;
  project_id: string;
  workspace_ref: string | null;
  scopes: string[];
  status: PlatformConnectionStatus;
  last_sync_at: string | null;
  last_error: string | null;
}

/** Kind of a projected platform object: repositories, runs, artifacts, activity. */
export type SyncItemKind =
  | "repository"
  | "commit"
  | "agent_run"
  | "artifact"
  | "activity";

/**
 * The only two observable sync states: an imported or provisional object is
 * never confirmed evidence until a human verifies the bound checkpoint.
 */
export type SyncItemStatus = "imported" | "provisional";

export interface SyncItemView {
  id: string;
  connection_id: string;
  provider_key: string;
  kind: SyncItemKind;
  status: SyncItemStatus;
  external_id: string;
  title_label: string | null;
  source_url: string | null;
  occurred_at: string | null;
  imported_at: string;
  last_synced_at: string;
  bound_checkpoint_key: string | null;
  verification_status: "not_bound" | "awaiting_human_verification";
}

export interface SyncItemsResponse {
  items: SyncItemView[];
}

export interface SyncRefreshView {
  connection_id: string;
  checked_at: string;
  imported_new: number;
  refreshed_existing: number;
  skipped_invalid: number;
  items: SyncItemView[];
}

/** One actor-owned actionable checkpoint offered for explicit binding. */
export interface TrajectoryCheckpointOption {
  key: string;
  title: string;
  state_label: string;
}

/** Redacted diagnostics; the token text never appears in any payload. */
export interface PlatformDiagnosticsView {
  connection_id: string;
  provider_key: string;
  status: PlatformConnectionStatus;
  scopes: string[];
  token_fingerprint: string | null;
  token_expires_at: string | null;
  sync_paused: boolean;
  last_sync_at: string | null;
  last_error: string | null;
}

export interface DeepLinkView {
  url: string;
}
