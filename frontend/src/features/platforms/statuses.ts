import type {
  ConnectChallengeView,
  PlatformConnectionStatus,
  ProviderCardView,
  SyncItemKind,
  SyncItemStatus,
  SyncItemView,
  TrajectoryCheckpointOption,
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

/** Honest labels of sync projections; none of them claims confirmed evidence. */
export const SYNC_ITEM_STATUS_LABELS: Record<SyncItemStatus, string> = {
  imported: "Импортировано, не подтверждено",
  provisional: "Ожидает проверки",
};

export const SYNC_ITEM_STATUS_TONES: Record<SyncItemStatus, PlatformStatusTone> =
  {
    imported: "neutral",
    provisional: "warning",
  };

export const SYNC_KIND_LABELS: Record<SyncItemKind, string> = {
  repository: "Репозиторий",
  commit: "Коммит",
  agent_run: "Прогон агента",
  artifact: "Артефакт",
  activity: "Активность",
};

/** State of the «Данные платформы» panel for one connection (openspec 22.21). */
export interface PlatformSyncPanel {
  connectionId: string;
  connectionTitle: string;
  pending: boolean;
  refreshing: boolean;
  bindPending: boolean;
  error: string | null;
  bindError: string | null;
  items: SyncItemView[];
  checkpoints: TrajectoryCheckpointOption[];
  checkpointsPending: boolean;
}

/** Props of the presenter behind the «Платформы» section. */
export interface PlatformsSectionProps {
  data: { items: ProviderCardView[] };
  challenge: ConnectChallengeView | null;
  connecting: boolean;
  revokingConnectionId: string | null;
  completing: boolean;
  openingLinkConnectionId: string | null;
  linkUrl: { connectionId: string; url: string } | null;
  syncPanel: PlatformSyncPanel | null;
  onConnect: (providerKey: string, workspaceRef: string, scopes: string[]) => void;
  onCancelChallenge: () => void;
  onComplete: (providerKey: string, state: string, code: string) => void;
  onReconnect: (providerKey: string) => void;
  onRevoke: (connectionId: string) => void;
  onOpenDeepLink: (connectionId: string) => void;
  onOpenSync: (connectionId: string, connectionTitle: string) => void;
  onCloseSync: () => void;
  onRefreshSync: () => void;
  onBindSync: (itemId: string, checkpointKey: string) => void;
  onRetry: () => void;
}
