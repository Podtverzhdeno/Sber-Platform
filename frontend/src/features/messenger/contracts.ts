/**
 * API shapes of `/api/v1/me/messaging/channels` as delivered by the backend.
 * Kept local so the messenger module stays isolated from other features; the
 * shapes mirror `src/impulse/api/v1/messaging.py` and must be updated together
 * with that router (safe, public demo data only).
 */

export type ApiParticipantView = {
  id: string;
  display_name: string;
  role: string;
};

export type ApiMessageView = {
  id: string;
  author_id: string | null;
  author_name: string | null;
  kind: string;
  body: string;
  artifact_refs: string[];
  sequence: number;
  created_at: string;
};

export type ApiChannelView = {
  id: string;
  kind: string;
  title: string;
  status: string;
  task_id: string | null;
  role: string;
  muted: boolean;
  sender_enabled: boolean;
  unread: number;
  participants: ApiParticipantView[];
  last_message: ApiMessageView | null;
  created_at: string;
};
