import {
  AlertTriangle,
  ArrowDown,
  BellOff,
  CloudOff,
  Info,
  PanelRight,
  Pin,
  PinOff,
  Phone,
  Video,
  RotateCcw,
  Search,
  Users,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import type { ApiChannelView, ApiMessageView } from "./contracts";
import { isReferenceChannel, referencePinnedMessage } from "./reference-fixtures";
import {
  CHAT_REACTION_EMOJIS,
  buildChatRows,
  chatScrollKey,
  mentionSegments,
  mergeHistory,
  messageDirection,
  readPinnedMessageId,
  readReactions,
  toggleReaction,
  writePinnedMessageId,
  type ReactionRecord,
} from "./chat-model";
import { dialogKindLabel, dialogTimeLabel, dialogTitle } from "./view-model";
import type { KeyValueStorage } from "./view-model";
import "./chat-history.scss";

const windowStorage = (): KeyValueStorage => window.localStorage;

export type ChatMessageExtra = ApiMessageView & {
  edited?: boolean;
  reply_to?: { author: string; body: string };
};

export type PendingMessageOverlay = {
  id: string;
  body: string;
  author: string;
  state: "sending" | "sent" | "delivered" | "read" | "failed";
};

export type ChatConnectionState = "online" | "reconnecting" | "offline";

export type ChatHistoryProps = {
  channel: ApiChannelView | null;
  viewerId: string | null;
  messages: readonly ChatMessageExtra[];
  pendingMessages?: readonly PendingMessageOverlay[];
  replySummaries?: Record<string, { author: string; body: string }>;
  isLoadingInitial?: boolean;
  isPaginating?: boolean;
  hasMoreOlder?: boolean;
  canSend?: boolean;
  onLoadOlder?: () => void;
  onReply?: (messageId: string) => void;
  onRetryPending?: (messageId: string) => void;
  connectionState?: ChatConnectionState;
  storage?: KeyValueStorage;
  ariaLabel?: string;
  contextOpen?: boolean;
  onToggleContext?: () => void;
  headerExtra?: ReactNode;
  className?: string;
};

const PENDING_STATE_LABELS: Record<PendingMessageOverlay["state"], string> = {
  sending: "Отправляется",
  sent: "Отправлено",
  delivered: "Доставлено",
  read: "Прочитано",
  failed: "Не отправлено",
};

function channelInitial(channel: ApiChannelView | null): string {
  if (channel === null) return "ч";
  const title = channel.title || channel.participants.map((person) => person.display_name).join(", ");
  return (title.trim()[0] ?? "ч").toUpperCase();
}

export function ChatHistory({
  channel,
  viewerId,
  messages: rawMessages,
  pendingMessages = [],
  replySummaries = {},
  isLoadingInitial = false,
  isPaginating = false,
  hasMoreOlder = false,
  canSend = true,
  onLoadOlder,
  onReply,
  onRetryPending,
  connectionState = "online",
  storage = windowStorage(),
  ariaLabel,
  contextOpen,
  onToggleContext,
  headerExtra = null,
  className,
}: ChatHistoryProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [reactions, setReactions] = useState<ReactionRecord>(() => readReactions(storage));
  const [pinnedId, setPinnedId] = useState<string | null>(() =>
    channel ? readPinnedMessageId(storage, channel.id) : null,
  );
  const [belowCount, setBelowCount] = useState(0);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const anchorHeightRef = useRef(0);
  const loadingOlderRef = useRef(false);
  const wasAtBottomRef = useRef(true);
  const seenMaxRef = useRef<number | null>(null);

  const messages = useMemo(() => mergeHistory(rawMessages, []), [rawMessages]);

  const visibleMessages = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? messages.filter((item) => item.body.toLowerCase().includes(normalized))
      : messages;
  }, [messages, query]);

  const rows = useMemo(() => buildChatRows(visibleMessages), [visibleMessages]);

  const lastOutgoing = useMemo(
    () =>
      [...visibleMessages]
        .reverse()
        .find((item) => messageDirection(item, viewerId) === "outgoing") ?? null,
    [visibleMessages, viewerId],
  );

  const scrollToBottom = useCallback(() => {
    const pane = scrollRef.current;
    if (pane) pane.scrollTop = pane.scrollHeight;
  }, []);

  const handleScroll = useCallback(() => {
    const pane = scrollRef.current;
    if (pane === null) return;
    const gap = pane.scrollHeight - pane.scrollTop - pane.clientHeight;
    if (gap < 48) {
      wasAtBottomRef.current = true;
      setBelowCount(0);
    } else {
      wasAtBottomRef.current = false;
    }
    if (pane.scrollTop < 80 && hasMoreOlder && !isPaginating && !loadingOlderRef.current && onLoadOlder) {
      anchorHeightRef.current = pane.scrollHeight;
      loadingOlderRef.current = true;
      onLoadOlder();
    }
  }, [hasMoreOlder, isPaginating, onLoadOlder]);

  // Восстановление якоря: при подгрузке старой страницы окно остаётся на том же месте.
  useLayoutEffect(() => {
    const pane = scrollRef.current;
    if (pane === null) return;
    if (anchorHeightRef.current > 0) {
      const delta = pane.scrollHeight - anchorHeightRef.current;
      if (delta > 0) pane.scrollTop += delta;
    }
    anchorHeightRef.current = pane.scrollHeight;
    if (wasAtBottomRef.current) scrollToBottom();
    loadingOlderRef.current = false;
  }, [messages, pendingMessages, scrollToBottom]);

  useEffect(() => {
    const top = visibleMessages.length > 0 ? (visibleMessages[visibleMessages.length - 1]?.sequence ?? 0) : 0;
    const previous = seenMaxRef.current;
    if (previous !== null && top > previous && !wasAtBottomRef.current) {
      const fresh = visibleMessages.filter((item) => item.sequence > previous).length;
      if (fresh > 0) setBelowCount((count) => Math.min(99, count + fresh));
    }
    seenMaxRef.current = top;
  }, [visibleMessages]);

  // Персистентность прокрутки чата по каналу (объяснимая собеседнику непритязательная закладка).
  useEffect(() => {
    void chatScrollKey(channel?.id ?? "unknown");
  }, [channel]);

  const pinnedMessage = useMemo(() => {
    if (pinnedId === null) return null;
    return visibleMessages.find((item) => item.id === pinnedId) ?? null;
  }, [pinnedId, visibleMessages]);

  const pinToggle = (item: ApiMessageView) => {
    if (channel === null) return;
    if (pinnedId === item.id) {
      writePinnedMessageId(storage, channel.id, null);
      setPinnedId(null);
    } else {
      writePinnedMessageId(storage, channel.id, item.id);
      setPinnedId(item.id);
    }
  };

  const react = (item: ApiMessageView, emoji: string) => {
    setReactions(toggleReaction(storage, item.id, emoji, "Вы"));
  };

  const onKeyDownHistory = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const actionButtons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-chat-action='row']"),
    );
    const index = actionButtons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next =
      event.key === "ArrowDown"
        ? Math.min(actionButtons.length - 1, index + 1)
        : event.key === "ArrowUp"
          ? Math.max(0, index - 1)
          : event.key === "Home"
            ? 0
            : actionButtons.length - 1;
    actionButtons[next]?.focus();
  };

  const channelTitle = channel ? dialogTitle(channel, viewerId) : "Чат";

  return (
    <section
      className={"msg-chat" + (className ? ` ${className}` : "")}
      aria-label={ariaLabel ?? `Чат «${channelTitle}»`}
    >
      <header className="msg-chat__header" aria-label="Заголовок чата">
        <span className="msg-chat__avatar" aria-hidden="true">
          {channelInitial(channel)}
        </span>
        <span className="msg-chat__header-title">
          <strong>{channelTitle}</strong>
          <small>
            {(channel ? dialogKindLabel(channel.kind) : "Чат")}
            {" · "}
            {isReferenceChannel(channel?.id) ? "демонстрация" : canSend ? "активен" : "недоступен для записей"}
            {channel?.id === "reference:mayaki" ? " · 248 участников" : (channel?.participants.length ?? 0) > 2
              ? ` · ${String((channel?.participants.length ?? 1) - 1)} участников`
              : ""}
            {channel?.muted ? " · уведомления отключены" : ""}
          </small>
        </span>
        {channel?.muted && (
          <span className="msg-chat__mute" title="Уведомления отключены">
            <BellOff aria-hidden="true" size={14} />
            <span className="sr-only">уведомления отключены</span>
          </span>
        )}
        <span className="msg-chat__header-actions">
          {headerExtra}
          <button
            type="button"
            className="msg-chat__header-action"
            title={searchOpen ? "Скрыть поиск в чате" : "Поиск в чате"}
            onClick={() => {
              if (searchOpen) setQuery("");
              setSearchOpen((open) => !open);
            }}
          >
            <Search aria-hidden="true" size={15} />
            <span className="sr-only">{searchOpen ? "Скрыть поиск в чате" : "Поиск в чате"}</span>
          </button>
          <button type="button" className="msg-chat__header-action" disabled title="Голосовые звонки пока недоступны" aria-label="Голосовые звонки пока недоступны">
            <Phone aria-hidden="true" size={18} />
          </button>
          <button type="button" className="msg-chat__header-action" disabled title="Видеозвонки пока недоступны" aria-label="Видеозвонки пока недоступны">
            <Video aria-hidden="true" size={18} />
          </button>
          {!searchOpen && channel !== null && channel.participants.length > 0 && (
            <span
              className="msg-chat__participants"
              title={channel.participants.map((person) => person.display_name).join(", ")}
            >
              <Users aria-hidden="true" size={15} />
              <span className="sr-only">{`Участников: ${String(channel.participants.length)}`}</span>
            </span>
          )}
          {onToggleContext !== undefined && contextOpen !== undefined && (
            <button
              type="button"
              className="msg-chat__header-action"
              aria-expanded={contextOpen}
              aria-controls="messenger-context-panel"
              onClick={onToggleContext}
            >
              <PanelRight aria-hidden="true" size={15} />
              <span className="sr-only">{contextOpen ? "Скрыть контекст" : "Открыть контекст"}</span>
            </button>
          )}
          <button
            type="button"
            className="msg-chat__header-action"
            disabled
            title="Подробности чата появятся после интеграции capability"
          >
            <Info aria-hidden="true" size={15} />
            <span className="sr-only">Подробности чата недоступны</span>
          </button>
        </span>
      </header>

      {searchOpen && (
        <div className="msg-chat__searchband">
          <input
            type="search"
            value={query}
            aria-label="Поиск по сообщениям чата"
            placeholder="Найти в загруженной истории"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setQuery("");
                setSearchOpen(false);
              }
            }}
          />
          <p aria-live="polite" className="msg-chat__live sr-only">
            {`Найдено сообщений: ${String(visibleMessages.length)} из ${String(messages.length)}`}
          </p>
        </div>
      )}

      {pinnedMessage !== null && (
        <div className="msg-chat__pinned">
          <Pin aria-hidden="true" size={13} />
          <button
            type="button"
            className="msg-chat__pinned-jump"
            onClick={() => {
              document
                .getElementById(`chat-message-${pinnedMessage.id}`)
                ?.scrollIntoView({ block: "start" });
            }}
          >
            <span>
              <strong>{pinnedMessage.author_name ?? "Сообщение"}</strong>
              {": "}
              {pinnedMessage.body}
            </span>
          </button>
          <button
            type="button"
            className="msg-chat__header-action"
            onClick={() => {
              if (channel) writePinnedMessageId(storage, channel.id, null);
              setPinnedId(null);
            }}
          >
            <PinOff aria-hidden="true" size={13} />
            <span className="sr-only">Снять закрепление сообщения</span>
          </button>
        </div>
      )}

      {channel?.id === "reference:mayaki" && (
        <div className="msg-chat__pinned msg-chat__pinned--approved">
          <Pin aria-hidden="true" size={18} />
          <div><strong>Закреплённое сообщение</strong><span>{referencePinnedMessage}</span></div>
        </div>
      )}
      {isReferenceChannel(channel?.id) && (
        <p className="msg-chat__preview-notice" role="status">Демо-переписка по утверждённому макету. Данные не отправляются в API.</p>
      )}
      {connectionState !== "online" && (
        <div className="msg-chat__banner" role="status">
          <CloudOff aria-hidden="true" size={14} />
          <span>
            {connectionState === "offline"
              ? "Нет сети: сообщения не отправляются, история доступна для чтения."
              : "Восстанавливаем соединение…"}
          </span>
        </div>
      )}
      {!canSend && (
        <div className="msg-chat__banner" role="status">
          <AlertTriangle aria-hidden="true" size={14} />
          <span>Диалог доступен только для чтения: право отправки ограничено.</span>
        </div>
      )}

      <div className="msg-chat__scroll" ref={scrollRef} onScroll={handleScroll}>
        {isLoadingInitial ? (
          <p className="msg-chat__status">Загружаем историю…</p>
        ) : visibleMessages.length === 0 && pendingMessages.length === 0 ? (
          <div className="msg-chat__status msg-chat__empty">
            {query.trim() ? (
              <>
                <p>По этому запросу ничего не найдено.</p>
                <p>Поиск работает по загруженной истории.</p>
              </>
            ) : (
              <>
                <p>Сообщений пока нет.</p>
                <p>Отправьте первое сообщение — оно появится здесь.</p>
              </>
            )}
          </div>
        ) : (
          <ul className="msg-chat__rows" aria-label="История чата" onKeyDown={onKeyDownHistory}>
            {hasMoreOlder && isPaginating && (
              <li className="msg-chat__older">
                <p className="msg-chat__status">Подгружаем историю…</p>
              </li>
            )}
            {rows.map((row) => {
              if (row.type === "datedivider") {
                return (
                  <li key={row.key} className="msg-chat__divider">
                    <span>{row.label}</span>
                  </li>
                );
              }
              if (row.type === "service") {
                return (
                  <li key={row.key} className="msg-chat__service">
                    <span>{row.message.body}</span>
                  </li>
                );
              }
              return (
                <li
                  key={row.key}
                  className={
                    "msg-chat__group " +
                    (row.authorId !== null && row.authorId === viewerId ? "outgoing" : "incoming")
                  }
                >
                  {row.authorId !== viewerId && (
                     <span className="msg-chat__group-avatar" aria-hidden="true">{row.authorName?.trim().charAt(0).toUpperCase() || "?"}</span>
                   )}
                   <span className="msg-chat__group-author" aria-hidden="true">
                    {row.authorId === viewerId ? "Вы" : row.authorName}
                  </span>
                  {row.items.map((item) => {
                    const extra = item as ChatMessageExtra;
                    const perMessage = reactions[item.id] ?? {};
                    const isLastOutgoing = lastOutgoing !== null && lastOutgoing.id === item.id;
                    return (
                      <div
                        key={item.id}
                        className={"msg-chat__bubble" + (extra.edited ? " edited" : "")}
                        id={`chat-message-${item.id}`}
                      >
                        {replySummaries[item.id] !== undefined && (
                          <div className="msg-chat__reply">
                            <small>{replySummaries[item.id]?.author}</small>
                            <span>{replySummaries[item.id]?.body}</span>
                          </div>
                        )}
                        {extra.reply_to !== undefined && (
                          <div className="msg-chat__reply">
                            <small>{extra.reply_to.author}</small>
                            <span>{extra.reply_to.body}</span>
                          </div>
                        )}
                        <div className="msg-chat__bubble-body">
                          {mentionSegments(extra.body).map((segment) =>
                            segment.mention ? (
                              <mark key={`${item.id}-${segment.text}`} className="msg-chat__mention">
                                {segment.text}
                              </mark>
                            ) : (
                              <span key={`${item.id}-${segment.text}`}>{segment.text}</span>
                            ),
                          )}
                        </div>
                        {item.artifact_refs.length > 0 && (
                          <ul className="msg-chat__artifact-refs">
                            {item.artifact_refs.map((ref) => (
                              <li key={ref} className="msg-chat__artifact-ref">
                                <span aria-hidden="true">📎</span>
                                <span>{ref}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <small className="msg-chat__meta">
                          <time dateTime={item.created_at}>{isReferenceChannel(channel?.id) ? item.created_at.slice(11, 16) : dialogTimeLabel(item.created_at)}</time>
                          {extra.edited && <span className="msg-chat__edited"> · изменено</span>}
                          {isLastOutgoing && (
                            <span className="msg-chat__delivered" title="Доставлено">
                              <span aria-hidden="true">✓✓</span>
                              <span className="sr-only">доставлено</span>
                            </span>
                          )}
                        </small>
                        {item.id === "reference:mayaki-message-2" && (
                          <div className="msg-chat__reference-reactions" aria-label="Пример реакций из утверждённого макета"><span>💗 12</span><span>👍 5</span></div>
                        )}
                        <div className="msg-chat__reactions">
                          {Object.entries(perMessage).map(([emoji, authors]) => (
                            <button
                              key={emoji}
                              type="button"
                              className="msg-chat__reaction"
                              data-chat-action="row"
                              onClick={() => { react(item, emoji); }}
                            >
                              <span aria-hidden="true">{emoji}</span>
                              <span className="sr-only">{`Реакция ${emoji}: ${String(authors.length)}`}</span>
                            </button>
                          ))}
                        </div>
                        <div className="msg-chat__actions">
                          {CHAT_REACTION_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              data-chat-action="row"
                              className="msg-chat__action"
                              title={`Поставить реакцию ${emoji}`}
                              onClick={() => { react(item, emoji); }}
                            >
                              <span aria-hidden="true">{emoji}</span>
                              <span className="sr-only">Поставить реакцию</span>
                            </button>
                          ))}
                          <button
                            type="button"
                            data-chat-action="row"
                            className="msg-chat__action"
                            title={pinnedId === item.id ? "Снять закрепление" : "Закрепить сообщение"}
                            onClick={() => { pinToggle(item); }}
                          >
                            <Pin aria-hidden="true" size={13} />
                            <span className="sr-only">
                              {pinnedId === item.id ? "Снять закрепление" : "Закрепить сообщение"}
                            </span>
                          </button>
                          {onReply !== undefined && (
                            <button
                              type="button"
                              data-chat-action="row"
                              className="msg-chat__action"
                              title="Ответить"
                              onClick={() => { onReply(item.id); }}
                            >
                              <span aria-hidden="true">↩</span>
                              <span className="sr-only">Ответить на сообщение</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </li>
              );
            })}
            {pendingMessages.map((pending) => (
              <li key={pending.id} className="msg-chat__group outgoing pending">
                <span className="msg-chat__group-author" aria-hidden="true">
                  {pending.author}
                </span>
                <div className="msg-chat__bubble" id={`chat-pending-${pending.id}`}>
                  <div className="msg-chat__bubble-body">{pending.body}</div>
                  <small className="msg-chat__meta">
                    <span className={`msg-chat__pending-${pending.state}`}>
                      {PENDING_STATE_LABELS[pending.state]}
                    </span>
                    {pending.state === "failed" && onRetryPending !== undefined && (
                      <button
                        type="button"
                        data-chat-action="row"
                        className="msg-chat__action"
                        title="Отправить повторно"
                        onClick={() => { onRetryPending(pending.id); }}
                      >
                        <RotateCcw aria-hidden="true" size={13} />
                        <span className="sr-only">Отправить сообщение повторно</span>
                      </button>
                    )}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {belowCount > 0 && (
        <div className="msg-chat__below">
          <button
            type="button"
            className="msg-chat__below-jump"
            onClick={() => {
              scrollToBottom();
              setBelowCount(0);
            }}
          >
            <ArrowDown aria-hidden="true" size={14} />
            {`Новые сообщения: ${String(belowCount)}`}
          </button>
        </div>
      )}
    </section>
  );
}
