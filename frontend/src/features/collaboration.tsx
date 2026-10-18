import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { apiRequest } from "../api/client";
import { Badge, StatePanel } from "../components/ui";

const csrfHeaders = (): HeadersInit => ({
  "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "",
});
const navigateClient = (url: string) => {
  window.history.pushState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

type Role =
  "participant" | "mentor" | "customer" | "manager" | "hr" | "operator";

type ParticipantView = {
  id: string;
  display_name: string;
  role: string;
};

type MessageView = {
  id: string;
  author_id: string | null;
  author_name: string | null;
  kind: string;
  body: string;
  artifact_refs: string[];
  sequence: number;
  created_at: string;
};

type ChannelView = {
  id: string;
  kind: string;
  title: string;
  status: string;
  task_id: string | null;
  role: string;
  muted: boolean;
  sender_enabled: boolean;
  unread: number;
  participants: ParticipantView[];
  last_message: MessageView | null;
  created_at: string;
};

type ChannelWorkContext = {
  project_key: string;
  task_title: string;
  deadline_at: string | null;
  contribution_version: number | null;
  contribution_accepted: boolean | null;
  review_status: string | null;
};

const reviewStatusLabels: Record<string, string> = {
  draft: "Оценка — черновик",
  proposed: "Оценка ожидает подтверждения",
  human_confirmed: "Оценка подтверждена человеком",
  published: "Оценка опубликована",
  disputed: "Оценка оспаривается",
};

const listCategories = ["Все", "Участники", "Заказчики", "Операторы", "Проектные группы"] as const;

function channelCategories(channel: ChannelView): string[] {
  const roles = channel.participants.map((person) => person.role);
  if (channel.kind === "task_team") return ["Проектные группы"];
  if (channel.kind === "operator_case" || roles.includes("support")) {
    return ["Операторы"];
  }
  if (channel.kind === "customer" || roles.includes("customer")) return ["Заказчики"];
  return ["Участники"];
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const channelKindLabels: Record<string, string> = {
  personal: "Личный чат",
  task_team: "Команда задачи",
  customer: "Канал заказчика",
  operator_case: "Служебный канал",
};

const memberRoleLabels: Record<string, string> = {
  customer: "заказчик",
  mentor: "ментор",
  member: "участник",
  support: "оператор",
};

function formatTime(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function channelTitle(channel: ChannelView, viewerId: string | null): string {
  if (channel.title) return channel.title;
  const peers = channel.participants
    .filter((person) => person.id !== viewerId && person.display_name)
    .map((person) => person.display_name);
  return peers.length ? peers.join(", ") : "Личный чат";
}

function channelPreview(channel: ChannelView): string {
  const last = channel.last_message;
  if (!last) return "Сообщений пока нет";
  return last.body;
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
  const channels = useMemo(() => channelsQuery.data ?? [], [channelsQuery.data]);
  const requestedPeer = new URLSearchParams(window.location.search).get(
    "participant",
  );
  const reference = role === "participant" ? "R-PAR-07" : role === "mentor" ? "R-MEN-05" : "R-CUS-09";
  const requestedChannel = new URLSearchParams(window.location.search).get(
    "channel",
  );
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("Все");
  const [draft, setDraft] = useState("");
  const [artifactRefs, setArtifactRefs] = useState<string[]>([]);
  const [historySearchOpen, setHistorySearchOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [notice, setNotice] = useState("");
  const openedPeerRef = useRef("");
  useEffect(() => {
    if (
      !requestedPeer ||
      requestedPeer === openedPeerRef.current ||
      !UUID_PATTERN.test(requestedPeer)
    ) {
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
        return client.invalidateQueries({ queryKey: ["messaging-channels"] });
      })
      .catch(() => {
        setNotice("Не удалось открыть диалог с этим участником.");
      });
  }, [client, requestedPeer]);
  const selected =
    channels.find((item) => item.id === selectedId) ??
    (requestedChannel && UUID_PATTERN.test(requestedChannel)
      ? channels.find((item) => item.id === requestedChannel)
      : undefined) ??
    (channels.length ? channels[0] : undefined);
  const messagesQuery = useQuery({
    queryKey: ["messaging-messages", selected?.id],
    queryFn: () =>
      apiRequest<MessageView[]>(
        `/api/v1/me/messaging/channels/${selected?.id ?? ""}/messages`,
      ),
    enabled: Boolean(selected?.id),
  });
  const contextQuery = useQuery({
    queryKey: ["messaging-work-context", selected?.id],
    queryFn: () =>
      apiRequest<ChannelWorkContext | null>(
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
      .catch(() => {
        setNotice("Не удалось обновить статус прочтения.");
      });
  }, [client, selected]);
  const sendMessage = useMutation({
    mutationFn: (body: string) =>
      apiRequest<MessageView>(
        `/api/v1/me/messaging/channels/${selected?.id ?? ""}/messages`,
        {
          method: "POST",
          headers: csrfHeaders(),
          body: JSON.stringify({ body, artifact_refs: artifactRefs }),
        },
      ),
    onSuccess: async () => {
      setDraft("");
      setNotice("");
      await Promise.all([
        client.invalidateQueries({
          queryKey: ["messaging-messages", selected?.id],
        }),
        client.invalidateQueries({ queryKey: ["messaging-channels"] }),
      ]);
    },
    onError: () => {
      setNotice("Не удалось отправить сообщение. Попробуйте ещё раз.");
    },
  });
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
  const messages = (messagesQuery.data ?? []).filter(
    (message) =>
      !historySearch ||
      `${message.author_name ?? ""} ${message.body}`
        .toLowerCase()
        .includes(historySearch.toLowerCase()),
  );
  const visible = channels.filter((channel) => {
    const matchesSearch = channelTitle(channel, personId)
      .toLowerCase()
      .includes(filter.toLowerCase());
    const matchesCategory =
      categoryFilter === "Все" || channelCategories(channel).includes(categoryFilter);
    return matchesSearch && matchesCategory;
  });
  if (channelsQuery.isPending) {
    return (
      <div className="messenger-page" data-reference={reference}>
        <StatePanel kind="loading" />
      </div>
    );
  }
  if (channelsQuery.isError) {
    return (
      <div className="messenger-page" data-reference={reference}>
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
  return (
    <div className="messenger-page" data-reference={reference}>
      <header className="messenger-heading">
        <div>
          <p className="eyebrow">Совместная работа</p>
          <h1 id="workspace-title">Сообщения</h1>
          <p className="lead">
            Личные диалоги и рабочие группы связаны с задачами и сохраняют
            контекст решений.
          </p>
        </div>
        <Badge tone="success">В сети</Badge>
      </header>
      <div className="messenger-shell">
        <aside className="chat-list">
          <label className="chat-search">
            Поиск диалогов
            <input
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
              }}
              placeholder="Имя, задача или группа"
            />
          </label>
          <div className="chat-filters" aria-label="Фильтры диалогов">
            {listCategories.map((category) => (
              <button
                className={categoryFilter === category ? "active" : ""}
                type="button"
                key={category}
                onClick={() => {
                  setCategoryFilter(category);
                }}
              >
                {category}
              </button>
            ))}
          </div>
          {visible.length ? (
            visible.map((channel) => (
              <button
                className={channel.id === selected?.id ? "active" : ""}
                type="button"
                key={channel.id}
                onClick={() => {
                  setSelectedId(channel.id);
                  setDraft("");
                  setNotice("");
                }}
              >
                <span className="chat-avatar">
                  {channelTitle(channel, personId).slice(0, 1)}
                </span>
                <span>
                  <strong>{channelTitle(channel, personId)}</strong>
                  <small>{channelKindLabels[channel.kind] ?? channel.kind}</small>
                  <em>{channelPreview(channel)}</em>
                </span>
                {channel.unread > 0 && <b>{channel.unread}</b>}
              </button>
            ))
          ) : (
            <StatePanel kind="empty" />
          )}
        </aside>
        {!selected ? (
          <section className="chat-thread">
            <StatePanel kind="empty" />
          </section>
        ) : (
          <section className="chat-thread">
            <header>
              <div>
                <strong>{channelTitle(selected, personId)}</strong>
                <small>
                  {channelKindLabels[selected.kind] ?? selected.kind}
                  {selected.muted ? " · уведомления отключены" : ""}
                </small>
              </div>
              <button
                className="secondary-button"
                type="button"
                aria-pressed={selected.muted}
                onClick={() => {
                  toggleMute.mutate(!selected.muted);
                }}
              >
                {selected.muted ? "Включить уведомления" : "Заглушить чат"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setHistorySearchOpen((current) => !current);
                }}
              >
                Поиск в чате
              </button>
            </header>
            {historySearchOpen && (
              <label className="chat-history-search">
                <span className="sr-only">Поиск по сообщениям</span>
                <input
                  autoFocus
                  value={historySearch}
                  onChange={(event) => {
                    setHistorySearch(event.target.value);
                  }}
                  placeholder="Текст или автор сообщения"
                />
              </label>
            )}
            {messagesQuery.isPending ? (
              <StatePanel kind="loading" />
            ) : messagesQuery.isError ? (
              <StatePanel
                kind="error"
                action="Обновить"
                onAction={() => {
                  void messagesQuery.refetch();
                }}
              />
            ) : messages.length ? (
              <div className="message-history" aria-live="polite">
                {messages.map((message) => {
                  const own = personId !== null && message.author_id === personId;
                  const author = message.author_name || "Участник";
                  return (
                    <article className={own ? "own" : ""} key={message.id}>
                      <div>
                        <strong>
                          {own
                            ? "Вы"
                            : message.kind === "system"
                              ? "Система"
                              : author}
                        </strong>
                        {message.artifact_refs.length > 0 && (
                          <Badge>{message.artifact_refs.join(", ")}</Badge>
                        )}
                        <time>{formatTime(message.created_at)}</time>
                      </div>
                      <p>{message.body}</p>
                    </article>
                  );
                })}
              </div>
            ) : (
              <StatePanel kind="empty" />
            )}
            {selected.sender_enabled ? (
              <form
                className="message-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  const text = draft.trim();
                  if (text && !sendMessage.isPending) {
                    sendMessage.mutate(text);
                  }
                }}
              >
                <button
                  className="message-attach-button"
                  type="button"
                  aria-label="Прикрепить артефакт"
                  onClick={() => {
                    if (artifactRefs.includes("repository")) {
                      setArtifactRefs((refs) =>
                        refs.filter((ref) => ref !== "repository"),
                      );
                    } else {
                      setArtifactRefs((refs) => [...refs, "repository"]);
                    }
                  }}
                >
                  ＋
                </button>
                <label className="sr-only" htmlFor="message-draft">
                  Сообщение
                </label>
                <textarea
                  id="message-draft"
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                  }}
                  placeholder="Напишите сообщение…"
                />
                <button
                  className="message-send-button"
                  type="submit"
                  disabled={sendMessage.isPending || !draft.trim()}
                >
                  {sendMessage.isPending ? "Отправляем…" : "Отправить"}
                </button>
              </form>
            ) : (
              <small className="composer-notice">
                Доступ к отправке отозван: история сохранена, новые сообщения
                недоступны.
              </small>
            )}
            {artifactRefs.length > 0 && selected.sender_enabled && (
              <div className="composer-refs">
                {artifactRefs.map((ref) => (
                  <Badge key={ref}>Артефакт: {ref}</Badge>
                ))}
              </div>
            )}
            {(notice || selected.muted) && (
              <small className="composer-notice">{notice}</small>
            )}
          </section>
        )}
        {selected && (
          <aside className="chat-context">
            <p className="eyebrow">Контекст</p>
            <h2>{channelTitle(selected, personId)}</h2>
            <Badge tone={selected.muted ? "warning" : "success"}>
              {channelKindLabels[selected.kind] ?? selected.kind}
            </Badge>
            <dl>
              <div>
                <dt>Непрочитанных</dt>
                <dd>{selected.unread}</dd>
              </div>
              <div>
                <dt>Статус</dt>
                <dd>{selected.status === "active" ? "активен" : "закрыт"}</dd>
              </div>
              {(role === "mentor" || role === "customer") && contextQuery.data && (
                <>
                  <div>
                    <dt>Проект</dt>
                    <dd>{contextQuery.data.project_key}</dd>
                  </div>
                  <div>
                    <dt>Дедлайн</dt>
                    <dd>
                      {contextQuery.data.deadline_at
                        ? new Date(contextQuery.data.deadline_at).toLocaleString("ru-RU", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "не задан"}
                    </dd>
                  </div>
                  <div>
                    <dt>Вклад</dt>
                    <dd>
                      {contextQuery.data.contribution_version
                        ? `версия ${String(contextQuery.data.contribution_version)} · ${
                            contextQuery.data.contribution_accepted
                              ? "принят заказчиком"
                              : "ожидает приёмки"
                          }`
                        : "не отправлен"}
                    </dd>
                  </div>
                  <div>
                    <dt>Оценка</dt>
                    <dd>
                      {contextQuery.data.review_status
                        ? reviewStatusLabels[contextQuery.data.review_status] ??
                          contextQuery.data.review_status
                        : "не создана"}
                    </dd>
                  </div>
                  <div>
                    <dt>Вложения</dt>
                    <dd>
                      {selected.sender_enabled
                        ? "артефакты задачи разрешены"
                        : "отправка недоступна"}
                    </dd>
                  </div>
                </>
              )}
            </dl>
            <h3>Участники</h3>
            <ul>
              {selected.participants.map((person) => (
                <li key={person.id}>
                  {person.display_name || "Без имени"}
                  <small>
                    {" · "}
                    {memberRoleLabels[person.role] ?? person.role}
                  </small>
                </li>
              ))}
            </ul>
            {selected.task_id && (
              <div className="chat-quick-actions">
                <button
                  className="linked-task-button"
                  type="button"
                  onClick={() => {
                    navigateClient(
                      `/workspace/1?task=${encodeURIComponent(selected.task_id ?? "")}`,
                    );
                  }}
                >
                  Открыть вклад
                </button>
                {role === "mentor" && quickTargets && quickTargets.review !== undefined && (
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={quickTargets.review < 0}
                    onClick={() => {
                      navigateClient(`/workspace/${String(quickTargets.review)}`);
                    }}
                  >
                    Открыть review workspace
                  </button>
                )}
                {role === "mentor" && quickTargets && quickTargets.plan !== undefined && (
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={quickTargets.plan < 0}
                    onClick={() => {
                      navigateClient(`/workspace/${String(quickTargets.plan)}`);
                    }}
                  >
                    Форма встречи
                  </button>
                )}
              </div>
            )}
            <small>
              Сообщения не изменяют официальные статусы; приёмка и оценка
              создаются только в доменных экранах.
            </small>
          </aside>
        )}
      </div>
    </div>
  );
}
