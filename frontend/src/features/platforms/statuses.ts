import type {
  ConnectChallengeView,
  PlatformConnectionStatus,
  ProviderCardView,
} from "./types";

/** Honest human labels for every connection state (openspec 22.20). */
export const PLATFORM_STATUS_LABELS: Record<PlatformConnectionStatus, string> = {
  not_connected: "Не подключено",
  connecting: "Ожидает авторизации",
  connected: "Подключено",
  action_required: "Требует вашего действия",
  expired: "Срок доступа истёк",
  revoked: "Доступ отозван",
  unavailable: "Платформа недоступна",
  error: "Ошибка подключения",
};

export type PlatformStatusTone = "neutral" | "success" | "warning";

export const PLATFORM_STATUS_TONES: Record<
  PlatformConnectionStatus,
  PlatformStatusTone
> = {
  not_connected: "neutral",
  connecting: "warning",
  connected: "success",
  action_required: "warning",
  expired: "warning",
  revoked: "neutral",
  unavailable: "warning",
  error: "warning",
};

/** Props of the presenter behind the «Платформы» section (openspec 22.20). */
export interface PlatformsSectionProps {
  data: { items: ProviderCardView[] };
  challenge: ConnectChallengeView | null;
  connecting: boolean;
  revokingConnectionId: string | null;
  completing: boolean;
  openingLinkConnectionId: string | null;
  linkUrl: { connectionId: string; url: string } | null;
  onConnect: (providerKey: string, workspaceRef: string, scopes: string[]) => void;
  onCancelChallenge: () => void;
  onComplete: (providerKey: string, state: string, code: string) => void;
  onReconnect: (providerKey: string) => void;
  onRevoke: (connectionId: string) => void;
  onOpenDeepLink: (connectionId: string) => void;
  onRetry: () => void;
}
