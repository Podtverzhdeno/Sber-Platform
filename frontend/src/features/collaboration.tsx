import { useMemo, useState } from "react";

import { Badge } from "../components/ui";

type Role = "participant" | "mentor" | "customer" | "manager" | "hr" | "operator";
type Chat = { id: string; title: string; kind: string; preview: string; unread: number; members: string[] };

const chatsByRole: Record<Role, Chat[]> = {
  participant: [
    { id: "project", title: "Рекомендательная система", kind: "Команда задачи", preview: "Елена: посмотрела checkpoint API", unread: 3, members: ["Алекс · Backend", "Анна · Data", "Елена · Ментор", "Роман · Заказчик"] },
    { id: "mentor", title: "Елена Наставник", kind: "Личный чат с ментором", preview: "Давайте обсудим следующий шаг", unread: 1, members: ["Алекс · Участник", "Елена · Ментор"] },
    { id: "bootcamp", title: "Bootcamp · Python", kind: "Учебная группа", preview: "Новый checkpoint открыт", unread: 0, members: ["12 участников", "Елена · Ментор"] },
  ],
  mentor: [
    { id: "project", title: "Рекомендательная система", kind: "Команда задачи", preview: "Алекс отправил новую версию", unread: 4, members: ["Алекс · Backend", "Анна · Data", "Роман · Заказчик"] },
    { id: "mentor", title: "Алекс Речной", kind: "Сопровождение", preview: "Нужна рекомендация по роли", unread: 2, members: ["Алекс · Участник", "Елена · Ментор"] },
  ],
  customer: [{ id: "project", title: "Рекомендательная система", kind: "Проектная группа", preview: "Команда обновила MVP", unread: 5, members: ["Роман · Заказчик", "Елена · Ментор", "Алекс · Backend", "Анна · Data"] }],
  manager: [{ id: "project", title: "R&D лаборатория", kind: "Канал инициативы", preview: "Опубликован недельный статус", unread: 2, members: ["Ольга · Руководитель", "3 заказчика", "2 ментора"] }],
  hr: [{ id: "mentor", title: "Кандидат · Алекс Речной", kind: "Диалог по приглашению", preview: "Кандидат подтвердил интерес", unread: 1, members: ["Нина · HR", "Алекс · Кандидат"] }],
  operator: [{ id: "project", title: "Кейс #OPS-1042", kind: "Служебный канал", preview: "Запрошено доказательство", unread: 6, members: ["Павел · Оператор", "Елена · Ментор", "Роман · Заказчик"] }],
};

const messages = [
  { author: "Елена Наставник", role: "Ментор", time: "10:14", text: "Посмотрела checkpoint API. Контракт описан хорошо, но добавьте обработку rate limit и повторите тест." },
  { author: "Алекс Речной", role: "Backend", time: "10:27", text: "Добавил retry с backoff и приложил новую версию артефакта.", own: true },
  { author: "Роман Заказчик", role: "Заказчик", time: "11:03", text: "После этого можно переходить к сравнению baseline. Критерий приёмки не меняется." },
];

export function MessagingWorkspace({ role }: { role: Role }) {
  const chats = chatsByRole[role];
  const [selectedId, setSelectedId] = useState(chats[0]?.id ?? "");
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  const selected = chats.find((chat) => chat.id === selectedId) ?? chats[0];
  const visible = useMemo(() => chats.filter((chat) => chat.title.toLowerCase().includes(filter.toLowerCase())), [chats, filter]);
  return <div className="messenger-page">
    <header className="messenger-heading"><div><p className="eyebrow">Совместная работа</p><h1 id="workspace-title">Сообщения</h1><p className="lead">Личные диалоги и рабочие группы связаны с задачами и сохраняют контекст решений.</p></div><Badge tone="success">В сети</Badge></header>
    <div className="messenger-shell">
      <aside className="chat-list"><label className="chat-search">Поиск диалогов<input value={filter} onChange={(event) => { setFilter(event.target.value); }} placeholder="Имя, задача или группа" /></label>{visible.map((chat) => <button className={chat.id === selected?.id ? "active" : ""} type="button" key={chat.id} onClick={() => { setSelectedId(chat.id); }}><span className="chat-avatar">{chat.title.slice(0, 1)}</span><span><strong>{chat.title}</strong><small>{chat.kind}</small><em>{chat.preview}</em></span>{chat.unread > 0 && <b>{chat.unread}</b>}</button>)}</aside>
      <section className="chat-thread"><header><div><strong>{selected?.title}</strong><small>{selected?.kind} · {selected?.members.length} участника</small></div><button className="secondary-button" type="button">Поиск в чате</button></header><div className="message-history">{messages.map((message) => <article className={message.own ? "own" : ""} key={message.time}><div><strong>{message.author}</strong><Badge>{message.role}</Badge><time>{message.time}</time></div><p>{message.text}</p></article>)}{sent.map((text, index) => <article className="own" key={index}><div><strong>Вы</strong><time>сейчас</time></div><p>{text}</p></article>)}</div><form className="message-composer" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) { setSent((current) => [...current, draft.trim()]); setDraft(""); } }}><button className="secondary-button" type="button" aria-label="Прикрепить файл">＋</button><label className="sr-only" htmlFor="message-draft">Сообщение</label><textarea id="message-draft" value={draft} onChange={(event) => { setDraft(event.target.value); }} placeholder="Напишите сообщение…" /><button type="submit">Отправить</button></form></section>
      <aside className="chat-context"><p className="eyebrow">Контекст</p><h2>{selected?.title}</h2><Badge tone="warning">Checkpoint · API</Badge><dl><div><dt>Прогресс</dt><dd>70%</dd></div><div><dt>Дедлайн</dt><dd>12 октября</dd></div><div><dt>Следующий шаг</dt><dd>Повторная отправка API</dd></div></dl><h3>Участники</h3><ul>{selected?.members.map((member) => <li key={member}>{member}</li>)}</ul><button type="button">Открыть связанную задачу</button><small>Сообщения не заменяют формальную приёмку, оценку или выплату.</small></aside>
    </div>
  </div>;
}
