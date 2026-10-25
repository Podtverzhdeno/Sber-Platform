import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { apiRequest, ApiClientError } from "../api/client";
import type { RuntimeApiPath } from "../api/client";
import { StatePanel } from "../components/ui";
import "./collaboration.scss";
import "./messenger/reference.scss";

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
import { EmptyChatState, EmptyContextPlaceholder } from "./messenger/reference-states";
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
  quickTargets?: { review?: number; plan?: number; task?: number };
}) {
  const client = useQueryClient();
  const channelsQuery = useQuery({
    queryKey: ["messaging-channels"],
    queryFn: () => apiRequest<ChannelView[]>("/api/v1/me/messaging/channels"),
  });
  const channels = useMemo(() => channelsQuery.data ?? [], [channelsQuery.data]);
  const contactsQuery = useQuery({
    queryKey: ["messaging-contacts"],
    queryFn: () => apiRequest<Array<{id:string;display_name:string;role:string}>>("/api/v1/me/messaging/contacts"),
    staleTime: 60_000,
  });
  const [actionError, setActionError] = useState("");
  const actionErrorText = (error: unknown): string =>
    error instanceof ApiClientError
      ? error.code === "CSRF_INVALID"
        ? "Сессия устарела. Обновите страницу для восстановления защиты и повторите действие."
        : error.message
      : "Не удалось выполнить действие. Проверьте соединение и повторите.";

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
  const [contextOpen, setContextOpen] = useState(true);
  const [createSignal, setCreateSignal] = useState(0);
  const [findSignal, setFindSignal] = useState(0);
  const [pending, setPending] = useState<PendingMessageOverlay[]>([]);
  const [replyId, setReplyId] = useState<string | null>(null);
  const openedPeerRef = useRef("");
  const openedTaskRef = useRef("");

  const selected =
    channels.find((item) => item.id === selectedId) ??
    (requestedChannel !== null && UUID_PATTERN.test(requestedChannel)
      ? channels.find((item) => item.id === requestedChannel)
      : undefined) ??
    undefined;

  // React Router reuses the workspace component between two ?channel= links.
  // Re-select on query changes so notification clicks open the correct chat.
  useEffect(() => {
    if (requestedChannel && UUID_PATTERN.test(requestedChannel)) {
      setSelectedId(requestedChannel);
      setContextOpen(true);
      if (isNarrow) setMobilePane("chat");
    }
  }, [requestedChannel, isNarrow]);

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
    setContextOpen(true);
    setReplyId(null);
    setPending([]);
    if (isNarrow) setMobilePane("chat");
  };

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
    enabled: Boolean(selected?.id),
  });
  const messages = useMemo(
    () => messagesQuery.data?.pages.flat() ?? [],
    [messagesQuery.data],
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
    if (!selected || selected.unread <= 0 || !selected.last_message) return;
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
  }, [client, selected]);

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
    if (!selected || !selected.sender_enabled) return;
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

  const createDialog = async (peerId: string): Promise<void> => {
    if (!UUID_PATTERN.test(peerId)) {
      setActionError("Неверный идентификатор контакта.");
      return;
    }
    setActionError("");
    try {
      const channel = await apiRequest<ChannelView>("/api/v1/me/messaging/channels/personal", {
        method: "POST", headers: csrfHeaders(),
        body: JSON.stringify({peer_id:peerId}),
      });
      setSelectedId(channel.id);
      setContextOpen(true);
      setMobilePane("chat");
      await client.invalidateQueries({queryKey:["messaging-channels"]});
    } catch (error) {
      setActionError(actionErrorText(error));
      throw error;
    }
  };

  const createGroup = async (title: string, peerIds: string[]): Promise<void> => {
    setActionError("");
    try {
      const channel = await apiRequest<ChannelView>("/api/v1/me/messaging/channels/group", {
        method:"POST", headers:csrfHeaders(),
        body:JSON.stringify({title,peer_ids:peerIds}),
      });
      setSelectedId(channel.id);
      setContextOpen(true);
      setMobilePane("chat");
      await client.invalidateQueries({queryKey:["messaging-channels"]});
    } catch(error) {
      setActionError(actionErrorText(error));
      throw error;
    }
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
      <button
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
      </button>
    </>
  ) : null;

  if (channelsQuery.isPending) {
    return (
      <div
        className="messenger-page sberchat-shell sberchat-reference"
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
        className="messenger-page sberchat-shell sberchat-reference"
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

  const recentChannel = channels
    .filter((channel) => channel.kind === "personal")
    .sort((a, b) =>
      (b.last_message?.created_at ?? b.created_at).localeCompare(a.last_message?.created_at ?? a.created_at)
    )[0] ?? null;
  const mayakiChannel = channels.find((channel) => channel.title.trim().toLowerCase() === "маяки") ?? null;
  const openCreate = () => {
    setCreateSignal((current) => current + 1);
    if (isNarrow) setMobilePane("list");
  };
  const findMayaki = () => {
    setFindSignal((current) => current + 1);
    if (isNarrow) setMobilePane("list");
  };

  const chatVisible = !isNarrow || mobilePane === "chat";
  const listVisible = !isNarrow || mobilePane === "list";
  const contextVisible = selected ? (!isNarrow ? contextOpen : mobilePane === "context") : false;

  return (
    <div
      className="messenger-page sberchat-shell sberchat-reference"
      data-reference={reference}
      data-visual-reference="R-MSG-01"
      data-message-state={selected === undefined ? "empty" : selected.kind === "community" ? "community" : "direct"}
    >
      <header className="messenger-heading">
        <div>
          <h1 id="workspace-title">Сообщения</h1>
          <small>Диалоги и рабочие группы</small>
        </div>
        {isOnline ? (
          <span className="workspace-online-badge" aria-live="polite">
            В сети
          </span>
        ) : (
          <span className="workspace-online-badge" data-badge="offline">
            Нет соединения
          </span>
        )}
      </header>
      <div
        className={`messenger-shell${isNarrow ? ` messenger-shell--${mobilePane}` : ""}${!isNarrow && !contextVisible && selected !== undefined ? " messenger-shell--no-context" : ""}`}
        data-pane={isNarrow ? mobilePane : "desktop"}
      >
        {listVisible && (
          <DialogList
            channels={channels}
            directoryContacts={contactsQuery.data ?? []}
            actionError={actionError}
            onCreateGroup={createGroup}
            viewerId={personId}
            selectedId={selected?.id ?? null}
            createSignal={createSignal}
            findSignal={findSignal}
            onSelect={selectChannel}
            onCreateDialog={createDialog}
            storage={storage}
          />
        )}
        {chatVisible && (
          <section className="chat-thread" aria-label="Текущий чат">
            {selected ? <ChatHistory
              channel={selected}
              viewerId={personId}
              messages={messages}
              pendingMessages={pending}
              replySummaries={{}}
              isLoadingInitial={messagesQuery.isLoading}
              isPaginating={messagesQuery.isFetchingNextPage}
              hasMoreOlder={lastPageSize >= 50}
              canSend={selected.sender_enabled}
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
            /> : (
              <EmptyChatState recent={recentChannel} mayaki={mayakiChannel}
                onOpen={selectChannel} onCreate={openCreate} onFindCommunity={findMayaki}/>
            )}
            {selected && (
              <Composer
                channelId={selected.id}
                participants={selected.participants}
                storage={storage}
                canSend={selected.sender_enabled}
                sending={sendMessage.isPending}
                sendState={sendState}
                failureReason={sendMessage.isError ? actionErrorText(sendMessage.error) : undefined}
                connectionState={connectionState}
                replySummary={replySummary}
                onSend={submitSend}
                onClearReply={() => {
                  setReplyId(null);
                }}
              />
            )}
          </section>
        )}
        {(!isNarrow && selected === undefined) && <EmptyContextPlaceholder />}
        {contextVisible && selected && (
          <ContextPanel
            channel={selected}
            viewerId={personId}
            workContext={contextQuery.data ?? null}
            open={contextVisible}
            onClose={() => { if (isNarrow) setMobilePane("chat"); else setContextOpen(false); }}
            onToggleMute={() => { toggleMute.mutate(!selected.muted); }}
            messageRefs={messages.flatMap((message) => message.artifact_refs)}
            onOpenTask={quickTargets?.task !== undefined && quickTargets.task >= 0
              ? (taskId) => {
                  navigateClient(`/workspace/${String(quickTargets.task)}?task=${encodeURIComponent(taskId)}`);
                }
              : undefined}
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
