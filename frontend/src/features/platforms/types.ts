/**
 * Types of the project platform connection catalog (openspec 22.20).
 * Mirror of the backend `/api/v1/projects/{project_id}/platforms` projections.
 * None of these views carries credential material: tokens stay sealed
 * server-side, diagnostics only expose a hash fingerprint.
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
