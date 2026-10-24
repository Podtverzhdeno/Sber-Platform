import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { apiRequest } from "../api/client";
import type { RuntimeApiPath } from "../api/client";
import { StatePanel } from "../components/ui";
import { ArrowRight, FileText, FolderOpen, MessageCircle, Plus, Settings2, Users } from "lucide-react";
import "./collaboration.scss";

import { ChatHistory } from "./messenger/chat-history";
import type { PendingMessageOverlay } from "./messenger/chat-history";
import { Composer } from "./messenger/composer";
import type {
  ComposerConnectionState,
  ComposerSendPayload,
  ComposerSendState,
} from "./messenger/composer-model";
import type {
  ApiChannelView as ChannelView,
  ApiMessageView as MessageView,
} from "./messenger/contracts";
import { ContextPanel } from "./messenger/context";
import type { ChannelWorkContextView } from "./messenger/context-model";
import { DialogList } from "./messenger/dialogs";
import { isReferenceChannel, referenceChannels, referenceMessages, referenceSharedFiles } from "./messenger/reference-fixtures";
import type { KeyValueStorage } from "./messenger/view-model";

export type Role =
  | "participant"
  | "mentor"
  | "customer"
  | "manager"
  | "hr"
  | "operator";

const csrfHeaders = (): HeadersInit => ({
  "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "",
});

const navigateClient = (url: string) => {
  window.history.pushState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECTED_CHANNEL_KEY = "impulse.messenger.selected-channel";

type MobilePane = "list" | "chat" | "context";

const storage: KeyValueStorage = window.localStorage;

function subscribeOnline(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function onlineSnapshot(): boolean {
  return navigator.onLine;
}

function subscribeNarrow(callback: () => void): () => void {
  if (typeof window.matchMedia !== "function") {
    return () => {};
  }
  const query = window.matchMedia("(max-width: 959px)");
  query.addEventListener("change", callback);
  return () => {
    query.removeEventListener("change", callback);
  };
}

function narrowSnapshot(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(max-width: 959px)").matches;
}

function channelTitleFallback(
  channel: ChannelView,
  viewerId: string | null,
): string {
  if (channel.title) return channel.title;
  const peers = channel.participants
    .filter((person) => person.id !== viewerId && person.display_name)
    .map((person) => person.display_name);
  return peers.length ? peers.join(", ") : "Личный чат";
}

export function MessagingWorkspace({
  role,
  personId,
  quickTargets,
}: {
  role: Role;
  personId: string | null;
  quickTargets?: { review?: number; plan?: number };
}) {
  const client = useQueryClient();
  const channelsQuery = useQuery({
    queryKey: ["messaging-channels"],
    queryFn: () => apiRequest<ChannelView[]>("/api/v1/me/messaging/channels"),
  });
  const runtimeConfig = useQuery({
    queryKey: ["messages-reference-runtime"],
    queryFn: () => apiRequest<{ demo_mode: boolean }>("/api/v1/config"),
    retry: false,
  });
  const useReferencePreview = role === "participant" && (
    runtimeConfig.data?.demo_mode === true ||
    new URLSearchParams(window.location.search).get("messages_preview") === "1"
  );
  const channels = useMemo(() => {
    const live = channelsQuery.data ?? [];
    if (!useReferencePreview) return live;
    const names = new Set(live.map((channel) => channel.title.trim().toLocaleLowerCase("ru-RU")));
    return [...live, ...referenceChannels.filter((channel) => !names.has(channel.title.trim().toLocaleLowerCase("ru-RU")))];
  }, [channelsQuery.data, useReferencePreview]);
  const isOnline = useSyncExternalStore(subscribeOnline, onlineSnapshot, onlineSnapshot);
  const isNarrow = useSyncExternalStore(subscribeNarrow, narrowSnapshot, narrowSnapshot);

  const requestedPeer = new URLSearchParams(window.location.search).get("participant");
  const requestedChannel = new URLSearchParams(window.location.search).get("channel");
  const requestedTask = new URLSearchParams(window.location.search).get("task");
  const reference =
    role === "participant"
      ? "R-PAR-07"
      : role === "mentor"
        ? "R-MEN-05"
        : "R-CUS-09";

  const [selectedId, setSelectedId] = useState<string>(() => {
    if (requestedChannel !== null && UUID_PATTERN.test(requestedChannel)) {
      return requestedChannel;
    }
    const stored = sessionStorage.getItem(SELECTED_CHANNEL_KEY);
    return stored ?? "";
  });
  const [mobilePane, setMobilePane] = useState<MobilePane>("list");
  const [emptyActionNote, setEmptyActionNote] = useState("");
  const [contextOpen, setContextOpen] = useState(true);
  const [pending, setPending] = useState<PendingMessageOverlay[]>([]);
  const [replyId, setReplyId] = useState<string | null>(null);
  const openedPeerRef = useRef("");
  const openedTaskRef = useRef("");

  // The approved empty state is intentional only for participant reference previews.
  // In live role workflows preserve the original first-conversation behavior:
  // sender, contextual task and message history are visible when channels exist.
  const selected =
    channels.find((item) => item.id === selectedId) ??
    (requestedChannel !== null && UUID_PATTERN.test(requestedChannel)
      ? channels.find((item) => item.id === requestedChannel)
      : undefined) ??
    (!useReferencePreview ? channels[0] : undefined);

  // Глубокая ссылка ?task=<task_id>: открываем чат команды этой задачи,
  // когда он появится в списке каналов; явный ?channel= приоритетнее.
  useEffect(() => {
    if (!requestedTask || requestedChannel !== null || openedTaskRef.current === requestedTask) {
      return;
    }
    const byTask = channels.find((item) => item.task_id === requestedTask);
    if (!byTask) {
      return;
    }
    openedTaskRef.current = requestedTask;
    setSelectedId(byTask.id);
    setMobilePane("chat");
  }, [channels, requestedChannel, requestedTask]);

  useEffect(() => {
    if (!requestedPeer || requestedPeer === openedPeerRef.current || !UUID_PATTERN.test(requestedPeer)) {
      return;
    }
    openedPeerRef.current = requestedPeer;
    void apiRequest<ChannelView>("/api/v1/me/messaging/channels/personal", {
      method: "POST",
      headers: csrfHeaders(),
      body: JSON.stringify({ peer_id: requestedPeer }),
    })
      .then((channel) => {
        setSelectedId(channel.id);
        setMobilePane("chat");
        return client.invalidateQueries({ queryKey: ["messaging-channels"] });
      })
      .catch(() => {});
  }, [client, requestedPeer]);

  useEffect(() => {
    if (selectedId) {
      sessionStorage.setItem(SELECTED_CHANNEL_KEY, selectedId);
    }
  }, [selectedId]);

  const selectChannel = (channelId: string) => {
    setSelectedId(channelId);
    setReplyId(null);
    setPending([]);
    if (isNarrow) setMobilePane("chat");
  };

  const selectedIsReference = isReferenceChannel(selected?.id);
  const messagesQuery = useInfiniteQuery({
    queryKey: ["messaging-messages", selected?.id],
    queryFn: ({ pageParam }: { pageParam: number | undefined }) => {
      const channelPart = `/api/v1/me/messaging/channels/${selected?.id ?? ""}/messages`;
      const path =
        typeof pageParam === "number"
          ? (`${channelPart}?before=${String(pageParam)}` as RuntimeApiPath)
          : (channelPart as RuntimeApiPath);
      return apiRequest<MessageView[]>(path);
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage: MessageView[]): number | undefined =>
      lastPage.length
        ? lastPage.map((item) => item.sequence).reduce(
            (smallest, current) => (current < smallest ? current : smallest),
            lastPage[0]?.sequence ?? Number.POSITIVE_INFINITY,
          )
        : undefined,
    enabled: Boolean(selected?.id) && !selectedIsReference,
  });
  const messages = useMemo(
    () => selectedIsReference ? (referenceMessages[selected?.id ?? ""] ?? []) : (messagesQuery.data?.pages.flat() ?? []),
    [messagesQuery.data, selected?.id, selectedIsReference],
  );
  const lastPageSize =
    messagesQuery.data?.pages[messagesQuery.data.pages.length - 1]?.length ?? 0;

  const contextQuery = useQuery({
    queryKey: ["messaging-work-context", selected?.id],
    queryFn: () =>
      apiRequest<ChannelWorkContextView>(
        `/api/v1/me/messaging/channels/${selected?.id ?? ""}/context`,
      ),
    enabled: Boolean(selected?.task_id) && (role === "mentor" || role === "customer"),
  });

  useEffect(() => {
    if (!selected || selectedIsReference || selected.unread <= 0 || !selected.last_message) return;
    void apiRequest<ChannelView>(
      `/api/v1/me/messaging/channels/${selected.id}/read`,
      {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ message_id: selected.last_message.id }),
      },
    )
      .then(() =>
        Promise.all([
          client.invalidateQueries({ queryKey: ["messaging-channels"] }),
          client.invalidateQueries({ queryKey: ["notifications"] }),
        ]),
      )
      .catch(() => {});
  }, [client, selected, selectedIsReference]);

  const sendMessage = useMutation({
    mutationFn: (payload: ComposerSendPayload) =>
      apiRequest<MessageView>(
        `/api/v1/me/messaging/channels/${selected?.id ?? ""}/messages`,
        {
          method: "POST",
          headers: csrfHeaders(),
          body: JSON.stringify({
            body: payload.body,
            artifact_refs: payload.artifact_refs,
          }),
        },
      ),
    onSuccess: async () => {
      setPending([]);
      setReplyId(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["messaging-messages", selected?.id] }),
        client.invalidateQueries({ queryKey: ["messaging-channels"] }),
      ]);
    },
    onError: () => {
      setPending((current) =>
        current.map((item) =>
          item.state === "sending" ? { ...item, state: "failed" } : item,
        ),
      );
    },
  });

  const submitSend = (payload: ComposerSendPayload) => {
    if (!selected || selectedIsReference || !selected.sender_enabled) return;
    const optimisticId = `pending-${String(Date.now())}`;
    setPending((current) => [
      ...current,
      { id: optimisticId, body: payload.body, author: "Вы", state: "sending" },
    ]);
    sendMessage.mutate(payload);
  };

  const retryPending = (messageId: string) => {
    const item = pending.find((entry) => entry.id === messageId);
    if (!item || !selected) return;
    setPending((current) =>
      current.map((entry) =>
        entry.id === messageId ? { ...entry, state: "sending" } : entry,
      ),
    );
    sendMessage.mutate({ body: item.body, artifact_refs: [] });
  };

  const toggleMute = useMutation({
    mutationFn: (muted: boolean) =>
      apiRequest<ChannelView>(
        `/api/v1/me/messaging/channels/${selected?.id ?? ""}/mute`,
        {
          method: "POST",
          headers: csrfHeaders(),
          body: JSON.stringify({ muted }),
        },
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["messaging-channels"] });
    },
  });

  const createDialog = (peerId: string) => {
    if (!UUID_PATTERN.test(peerId)) return;
    void apiRequest<ChannelView>("/api/v1/me/messaging/channels/personal", {
      method: "POST",
      headers: csrfHeaders(),
      body: JSON.stringify({ peer_id: peerId }),
    })
      .then((channel) => {
        setSelectedId(channel.id);
        return client.invalidateQueries({ queryKey: ["messaging-channels"] });
      })
      .catch(() => {});
  };

  const sendState: ComposerSendState = sendMessage.isError
    ? "failed"
    : sendMessage.isPending
      ? "sending"
      : "idle";
  const connectionState: ComposerConnectionState = isOnline ? "online" : "offline";

  const replySummary = useMemo(() => {
    if (replyId === null) return null;
    const source = messages.find((item) => item.id === replyId);
    if (!source) return null;
    return {
      id: replyId,
      summary: `${source.author_name ?? "Участник"}: ${source.body}`,
    };
  }, [messages, replyId]);

  const headerExtra = selected ? (
    <>
      {isNarrow && (
        <button
          type="button"
          className="msg-chat__header-action"
          onClick={() => {
            setMobilePane("list");
          }}
        >
          ←
          <span className="sr-only">К списку диалогов</span>
        </button>
      )}
      {!selectedIsReference && <button
        type="button"
        className="msg-chat__header-action"
        aria-pressed={selected.muted}
        onClick={() => {
          toggleMute.mutate(!selected.muted);
        }}
      >
        {selected.muted ? "🔔" : "🔕"}
        <span className="sr-only">
          {selected.muted ? "Включить уведомления" : "Заглушить чат"}
        </span>
      </button>}
    </>
  ) : null;

  if (channelsQuery.isPending) {
    return (
      <div
        className="messenger-page sberchat-shell"
        data-reference={reference}
        data-visual-reference="R-MSG-01"
      >
        <StatePanel kind="loading" />
      </div>
    );
  }
  if (channelsQuery.isError) {
    return (
      <div
        className="messenger-page sberchat-shell"
        data-reference={reference}
        data-visual-reference="R-MSG-01"
      >
        <StatePanel
          kind="error"
          action="Обновить"
          onAction={() => {
            void channelsQuery.refetch();
          }}
        />
      </div>
    );
  }

  const chatVisible = !isNarrow || mobilePane === "chat";
  const listVisible = !isNarrow || mobilePane === "list";
  const contextVisible = selected ? (!isNarrow ? contextOpen : mobilePane === "context") : !isNarrow;

  return (
    <div
      className="messenger-page sberchat-shell"
      data-reference={reference}
      data-visual-reference="R-MSG-01"
    >
      <div
        className={`messenger-shell${isNarrow ? ` messenger-shell--${mobilePane}` : ""}${!isNarrow && !contextVisible ? " messenger-shell--no-context" : ""}`}
        data-pane={isNarrow ? mobilePane : "desktop"}
      >
        {listVisible && (
          <DialogList
            channels={channels}
            viewerId={personId}
            selectedId={selected?.id ?? null}
            onSelect={selectChannel}
            onCreateDialog={createDialog}
            storage={storage}
          />
        )}
        {chatVisible && !selected && (
          <section className="chat-thread ref-chat-empty" aria-label="Выбор диалога" data-testid="messenger-empty-state">
            <div className="ref-empty-state">
              <div className="ref-empty-state__art" aria-hidden="true"><span className="ref-empty-state__bubble ref-empty-state__bubble--back" /><span className="ref-empty-state__bubble ref-empty-state__bubble--main">•••</span></div>
              <h2>Выберите диалог или сообщество</h2>
              <p>Слева вы можете открыть личный чат, рабочую группу или сообщество</p>
              <div className="ref-empty-state__actions">
                <button type="button" onClick={() => { const previous = channels.find((item) => item.kind === "personal") ?? channels[0]; if (previous) selectChannel(previous.id); }} disabled={channels.length === 0}>
                  <span className="ref-empty-state__action-icon">Е</span><span><strong>Открыть последний чат</strong><small>{channels.find((item) => item.kind === "personal")?.title || channels[0]?.title || "Нет доступных диалогов"}</small></span><ArrowRight size={20} />
                </button>
                <button type="button" onClick={() => { const mayaki = channels.find((item) => item.title.toLocaleLowerCase("ru-RU").includes("маяки")); if (mayaki) selectChannel(mayaki.id); }} disabled={!channels.some((item) => item.title.toLocaleLowerCase("ru-RU").includes("маяки"))}>
                  <span className="ref-empty-state__action-icon ref-empty-state__action-icon--blue">♜</span><span><strong>Перейти в Маяки</strong><small>Сообщество</small></span><ArrowRight size={20} />
                </button>
                <button type="button" onClick={() => {
                  const createButton = document.querySelector<HTMLButtonElement>(".msg-dialog-list__create-button");
                  if (createButton && !createButton.disabled) {
                    setEmptyActionNote("");
                    createButton.click();
                  } else {
                    setEmptyActionNote("Пока нет доступных контактов для нового личного чата. Откройте существующий диалог или сообщество.");
                  }
                }}>
                  <span className="ref-empty-state__action-icon ref-empty-state__action-icon--teal"><Plus size={25} /></span><span><strong>Создать новый чат</strong><small>Начните общение с коллегами</small></span><ArrowRight size={20} />
                </button>
              </div>
              {emptyActionNote && <p className="ref-empty-state__notice" role="status">{emptyActionNote}</p>}
            </div>
          </section>
        )}
        {chatVisible && selected && (
          <section className="chat-thread" aria-label="Текущий чат">
            <ChatHistory
              channel={selected}
              viewerId={selectedIsReference ? "reference:me" : personId}
              messages={messages}
              pendingMessages={pending}
              replySummaries={{}}
              isLoadingInitial={!selectedIsReference && messagesQuery.isLoading}
              isPaginating={messagesQuery.isFetchingNextPage}
              hasMoreOlder={lastPageSize >= 50}
              canSend={selectedIsReference || selected.sender_enabled}
              onLoadOlder={() => {
                void messagesQuery.fetchNextPage();
              }}
              onReply={(messageId) => {
                setReplyId(messageId);
              }}
              onRetryPending={retryPending}
              connectionState={connectionState}
              storage={storage}
              ariaLabel={`Текущий чат · ${channelTitleFallback(selected, personId)}`}
              contextOpen={contextVisible}
              onToggleContext={() => {
                if (isNarrow) {
                  setMobilePane((current) => (current === "context" ? "chat" : "context"));
                  return;
                }
                setContextOpen((current) => !current);
              }}
              headerExtra={headerExtra}
            />
            <Composer
                channelId={selected.id}
                participants={selected.participants}
                storage={storage}
                canSend={selected.sender_enabled}
                readOnlyReason={selectedIsReference ? "Демонстрация утверждённого макета — сообщения здесь не сохраняются и не отправляются." : undefined}
                sending={sendMessage.isPending}
                sendState={sendState}
                connectionState={connectionState}
                replySummary={replySummary}
                onSend={submitSend}
                onClearReply={() => {
                  setReplyId(null);
                }}
              />
          </section>
        )}
        {contextVisible && !selected && (
          <aside className="ref-empty-context" id="messenger-context-panel" aria-label="Контекст диалога" data-testid="messenger-empty-context">
            <header>КОНТЕКСТ</header>
            <div className="ref-empty-context__body">
              <MessageCircle size={83} strokeWidth={1} aria-hidden="true" />
              <h2>Здесь появится контекст диалога</h2>
              <p>Выберите чат или сообщество, чтобы увидеть информацию о нём: участников, связанные задачи и проекты, общие файлы и другие детали.</p>
              {([[Users, "Участники"], [FolderOpen, "Связанные объекты"], [FileText, "Общие файлы"], [Settings2, "Настройки чата"]] as const).map(([Icon, label]) => (
                <div className="ref-empty-context__skeleton" key={label}>
                  <Icon aria-hidden="true" size={22} />
                  <div><strong>{label}</strong><i /><i /></div>
                </div>
              ))}
            </div>
          </aside>
        )}
        {contextVisible && selected && (
          <ContextPanel
            channel={selected}
            viewerId={selectedIsReference ? "reference:me" : personId}
            workContext={contextQuery.data ?? null}
            isReferencePreview={selectedIsReference}
            sharedFiles={selectedIsReference ? (referenceSharedFiles[selected.id] ?? []) : [...new Set(messages.flatMap((message) => message.artifact_refs))]}
            open={contextVisible}
            onClose={isNarrow ? () => { setMobilePane("chat"); } : undefined}
            onOpenTask={(taskId) => {
              navigateClient(`/workspace/1?task=${encodeURIComponent(taskId)}`);
            }}
            onOpenMeeting={
              role === "mentor" && quickTargets && quickTargets.plan !== undefined && quickTargets.plan >= 0
                ? () => {
                    navigateClient(`/workspace/${String(quickTargets.plan)}`);
                  }
                : undefined
            }
            onOpenReview={
              role === "mentor" && quickTargets && quickTargets.review !== undefined && quickTargets.review >= 0
                ? () => {
                    navigateClient(`/workspace/${String(quickTargets.review)}`);
                  }
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
