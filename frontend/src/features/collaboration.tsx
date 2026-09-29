import { useMemo, useState } from "react";

import { Badge } from "../components/ui";

type Role =
  "participant" | "mentor" | "customer" | "manager" | "hr" | "operator";
type Chat = {
  id: string;
  title: string;
  kind: string;
  preview: string;
  unread: number;
  members: string[];
};
type Message = {
  author: string;
  role: string;
  time: string;
  text: string;
  own?: boolean;
};

const chatsByRole: Record<Role, Chat[]> = {
  participant: [
    {
      id: "project",
      title: "Рекомендательная система",
      kind: "Команда задачи",
      preview: "Елена: посмотрела checkpoint API",
      unread: 3,
      members: [
        "Алекс · Backend",
        "Анна · Data",
        "Елена · Ментор",
        "Роман · Заказчик",
      ],
    },
    {
      id: "mentor",
      title: "Елена Наставник",
      kind: "Личный чат с ментором",
      preview: "Давайте обсудим следующий шаг",
      unread: 1,
      members: ["Алекс · Участник", "Елена · Ментор"],
    },
    {
      id: "bootcamp",
      title: "Bootcamp · Python",
      kind: "Учебная группа",
      preview: "Новый checkpoint открыт",
      unread: 0,
      members: ["12 участников", "Елена · Ментор"],
    },
  ],
  mentor: [
    {
      id: "project",
      title: "Рекомендательная система",
      kind: "Команда задачи",
      preview: "Алекс отправил новую версию",
      unread: 4,
      members: ["Алекс · Backend", "Анна · Data", "Роман · Заказчик"],
    },
    {
      id: "mentor",
      title: "Алекс Речной",
      kind: "Сопровождение",
      preview: "Нужна рекомендация по роли",
      unread: 2,
      members: ["Алекс · Участник", "Елена · Ментор"],
    },
    {
      id: "customer",
      title: "Роман Воронов",
      kind: "Заказчик проекта",
      preview: "Подтвердил критерии демонстрации",
      unread: 1,
      members: ["Елена · Ментор", "Роман · Заказчик"],
    },
    {
      id: "operator",
      title: "Кейс #OPS-1042",
      kind: "Оператор платформы",
      preview: "Нужна проверка авторства артефакта",
      unread: 0,
      members: ["Елена · Ментор", "Павел · Оператор"],
    },
  ],
  customer: [
    {
      id: "project",
      title: "Рекомендательная система",
      kind: "Проектная группа",
      preview: "Команда обновила MVP",
      unread: 5,
      members: [
        "Роман · Заказчик",
        "Елена · Ментор",
        "Алекс · Backend",
        "Анна · Data",
      ],
    },
  ],
  manager: [
    {
      id: "project",
      title: "R&D лаборатория",
      kind: "Канал инициативы",
      preview: "Опубликован недельный статус",
      unread: 2,
      members: ["Ольга · Руководитель", "3 заказчика", "2 ментора"],
    },
  ],
  hr: [
    {
      id: "mentor",
      title: "Кандидат · Алекс Речной",
      kind: "Диалог по приглашению",
      preview: "Кандидат подтвердил интерес",
      unread: 1,
      members: ["Нина · HR", "Алекс · Кандидат"],
    },
  ],
  operator: [
    {
      id: "project",
      title: "Кейс #OPS-1042",
      kind: "Служебный канал",
      preview: "Запрошено доказательство",
      unread: 6,
      members: ["Павел · Оператор", "Елена · Ментор", "Роман · Заказчик"],
    },
  ],
};

const projectMessages: Message[] = [
  {
    author: "Елена Наставник",
    role: "Ментор",
    time: "10:14",
    text: "Посмотрела checkpoint API. Контракт описан хорошо, но добавьте обработку rate limit и повторите тест.",
  },
  {
    author: "Алекс Речной",
    role: "Backend",
    time: "10:27",
    text: "Добавил retry с backoff и приложил новую версию артефакта.",
    own: true,
  },
  {
    author: "Роман Заказчик",
    role: "Заказчик",
    time: "11:03",
    text: "После этого можно переходить к сравнению baseline. Критерий приёмки не меняется.",
  },
];

const conversations: Record<string, Message[]> = {
  "participant:project": projectMessages,
  "participant:mentor": [
    {
      author: "Елена Наставник",
      role: "Ментор",
      time: "09:42",
      text: "Алекс, посмотрела вашу траекторию. Предлагаю закончить checkpoint по тестам, а затем брать задачу уровня Middle.",
    },
    {
      author: "Алекс Речной",
      role: "Участник",
      time: "09:48",
      text: "Спасибо! Пришлю результаты тестов сегодня вечером.",
      own: true,
    },
  ],
  "participant:bootcamp": [
    {
      author: "Команда Bootcamp",
      role: "Куратор",
      time: "вчера",
      text: "Открыт checkpoint «Автоматические тесты». За подтверждённое выполнение будет начислено 20 баллов.",
    },
    {
      author: "Елена Наставник",
      role: "Ментор",
      time: "08:20",
      text: "Сегодня в 19:00 проведём разбор pytest и CI. Запись останется в материалах курса.",
    },
  ],
  "mentor:project": projectMessages,
  "mentor:mentor": [
    {
      author: "Алекс Речной",
      role: "Участник",
      time: "10:06",
      text: "Хочу уточнить, стоит ли параллельно развивать backend и data-направление?",
    },
  ],
  "mentor:customer": [
    {
      author: "Роман Воронов",
      role: "Заказчик",
      time: "11:40",
      text: "Для демо покажите baseline, новую модель и влияние на бизнес-метрику. Критерии зафиксированы.",
    },
  ],
  "mentor:operator": [
    {
      author: "Павел Орлов",
      role: "Оператор",
      time: "вчера",
      text: "Кейс проверки создан. Пришлите commit и версию артефакта, оценку пока не публикуйте.",
    },
  ],
  "customer:project": projectMessages,
  "manager:project": [
    {
      author: "Роман Воронов",
      role: "Заказчик",
      time: "11:30",
      text: "Команда обновила MVP и передала результат на бизнес-проверку.",
    },
  ],
  "hr:mentor": [
    {
      author: "Алекс Речной",
      role: "Кандидат",
      time: "12:15",
      text: "Подтверждаю интерес к стажировке и открыл HR-доступ к проектному портфолио.",
    },
  ],
  "operator:project": [
    {
      author: "Елена Наставник",
      role: "Ментор",
      time: "13:10",
      text: "Приложила ссылку на версию артефакта, по которой выставлена оценка.",
    },
  ],
};

export function MessagingWorkspace({ role }: { role: Role }) {
  const chats = chatsByRole[role];
  const [selectedId, setSelectedId] = useState(chats[0]?.id ?? "");
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState("");
  const [historySearchOpen, setHistorySearchOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [composerNotice, setComposerNotice] = useState("");
  const [sentByChat, setSentByChat] = useState<Record<string, string[]>>({});
  const selected = chats.find((chat) => chat.id === selectedId) ?? chats[0];
  const conversationKey = `${role}:${selected?.id ?? ""}`;
  const messages = (conversations[conversationKey] ?? projectMessages).filter(
    (message) =>
      !historySearch ||
      (message.author + " " + message.text)
        .toLowerCase()
        .includes(historySearch.toLowerCase()),
  );
  const sent = sentByChat[conversationKey] ?? [];
  const visible = useMemo(
    () =>
      chats.filter((chat) =>
        chat.title.toLowerCase().includes(filter.toLowerCase()),
      ),
    [chats, filter],
  );
  return (
    <div className="messenger-page">
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
          {visible.map((chat) => (
            <button
              className={chat.id === selected?.id ? "active" : ""}
              type="button"
              key={chat.id}
              onClick={() => {
                setSelectedId(chat.id);
                setDraft("");
              }}
            >
              <span className="chat-avatar">{chat.title.slice(0, 1)}</span>
              <span>
                <strong>{chat.title}</strong>
                <small>{chat.kind}</small>
                <em>{chat.preview}</em>
              </span>
              {chat.unread > 0 && <b>{chat.unread}</b>}
            </button>
          ))}
        </aside>
        <section className="chat-thread">
          <header>
            <div>
              <strong>{selected?.title}</strong>
              <small>
                {selected?.kind} · {selected?.members.length} участника
              </small>
            </div>
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
          <div className="message-history" aria-live="polite">
            {messages.map((message) => (
              <article
                className={message.own ? "own" : ""}
                key={`${message.time}-${message.author}`}
              >
                <div>
                  <strong>{message.author}</strong>
                  <Badge>{message.role}</Badge>
                  <time>{message.time}</time>
                </div>
                <p>{message.text}</p>
              </article>
            ))}
            {sent.map((text, index) => (
              <article
                className="own"
                key={`${conversationKey}-${String(index)}`}
              >
                <div>
                  <strong>Вы</strong>
                  <time>сейчас</time>
                </div>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <form
            className="message-composer"
            onSubmit={(event) => {
              event.preventDefault();
              const text = draft.trim();
              if (text) {
                setSentByChat((current) => ({
                  ...current,
                  [conversationKey]: [
                    ...(current[conversationKey] ?? []),
                    text,
                  ],
                }));
                setDraft("");
              }
            }}
          >
            <button
              className="message-attach-button"
              type="button"
              aria-label="Прикрепить файл"
              onClick={() => {
                setComposerNotice(
                  "Файл «review-checklist.pdf» прикреплён к черновику.",
                );
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
            <button className="message-send-button" type="submit">
              Отправить
            </button>
          </form>
          {composerNotice && (
            <small className="composer-notice">{composerNotice}</small>
          )}
        </section>
        <aside className="chat-context">
          <p className="eyebrow">Контекст</p>
          <h2>{selected?.title}</h2>
          <Badge tone={selected?.id === "bootcamp" ? "success" : "warning"}>
            {selected?.id === "bootcamp"
              ? "Bootcamp · Python"
              : "Checkpoint · API"}
          </Badge>
          <dl>
            <div>
              <dt>Прогресс</dt>
              <dd>{selected?.id === "bootcamp" ? "68%" : "70%"}</dd>
            </div>
            <div>
              <dt>Дедлайн</dt>
              <dd>12 октября</dd>
            </div>
            <div>
              <dt>Следующий шаг</dt>
              <dd>
                {selected?.id === "mentor"
                  ? "Ответ ментора"
                  : selected?.id === "bootcamp"
                    ? "Пройти checkpoint"
                    : "Повторная отправка API"}
              </dd>
            </div>
          </dl>
          <h3>Участники</h3>
          <ul>
            {selected?.members.map((member) => (
              <li key={member}>{member}</li>
            ))}
          </ul>
          <button
            className="linked-task-button"
            type="button"
            onClick={() => {
              window.location.assign(
                selected?.id === "bootcamp"
                  ? "/workspace/2?course=python-base"
                  : role === "mentor"
                    ? selected?.id === "mentor"
                      ? "/workspace/3"
                      : selected?.id === "operator"
                        ? "/workspace/5"
                        : "/workspace/1"
                    : "/workspace/4",
              );
            }}
          >
            {selected?.id === "bootcamp"
              ? "Открыть траекторию курса"
              : "Открыть связанную задачу"}
          </button>
          {role === "mentor" && (
            <div className="context-actions">
              <button
                type="button"
                onClick={() => {
                  window.location.assign("/workspace/7");
                }}
              >
                Назначить созвон
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.assign("/workspace/1");
                }}
              >
                Открыть ревью
              </button>
            </div>
          )}
          <small>
            Сообщения не заменяют формальную приёмку, оценку или выплату.
          </small>
        </aside>
      </div>
    </div>
  );
}
