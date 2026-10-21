import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { apiRequest, type RuntimeApiPath } from "../api/client";
import { Badge, Card, Modal, SafeExternalLink, StatePanel } from "../components/ui";
import "./participant-events.css";

type EventItem = {
  key: string; title: string; event_type: string; organizer: string; conditions: string;
  source_url: string; deadline_at: string | null; status: string; track_keys: string[];
  recommendation_reason: string; source_checked_at: string; source_status: string;
};
type EventPage = { items: EventItem[]; next_cursor: string | null; has_more: boolean };
export type EventDetail = EventItem & {
  description: string | null; target_audience: string | null; prerequisites: string[] | null;
  program: Array<{ day: string; title: string; detail: string }> | null;
  expected_result: string | null; participation_rules: string | null;
  venue_format: string | null; timezone: string | null;
};
export type RegistrationAggregate = {
  confirmed_registrations: number | null; participations: number | null;
  counter_state: "ok" | "zero" | "unknown"; definition_text: string;
};

function path(key: string, suffix = ""): RuntimeApiPath {
  return `/api/v1/ecosystem/events/${encodeURIComponent(key)}${suffix}` as RuntimeApiPath;
}
function count(value: number | null, state: RegistrationAggregate["counter_state"]): string {
  return state === "unknown" || value === null ? "Нет данных" : String(value);
}

export function EventDetailBody({ detail, aggregate }: { detail: EventDetail; aggregate: RegistrationAggregate }) {
  return <div className="event-detail" data-testid="event-detail">
    <p className="event-detail-lead">{detail.description ?? "Описание ещё не опубликовано."}</p>
    <dl className="event-detail-facts">
      <div><dt>Для кого</dt><dd>{detail.target_audience ?? "Уточняется организатором"}</dd></div>
      <div><dt>Формат</dt><dd>{detail.venue_format ?? "Уточняется"}</dd></div>
      <div><dt>Условия</dt><dd>{detail.conditions}</dd></div>
      <div><dt>Результат</dt><dd>{detail.expected_result ?? "Уточняется"}</dd></div>
    </dl>
    <section aria-labelledby="event-registration-title"><h3 id="event-registration-title">Участники</h3>
      <div className="event-counters"><span><strong>{count(aggregate.confirmed_registrations, aggregate.counter_state)}</strong> подтверждённых регистраций</span><span><strong>{count(aggregate.participations, aggregate.counter_state)}</strong> подтверждённых участий</span></div>
      <p className="muted">{aggregate.definition_text}</p>
      {aggregate.counter_state === "unknown" && <p className="event-unknown">Источник временно не даёт надёжный агрегат — неизвестное не показано как ноль.</p>}
    </section>
    {detail.program && detail.program.length > 0 && <section><h3>Программа</h3><ol className="event-program">{detail.program.map((stage) => <li key={`${stage.day}-${stage.title}`}><strong>{stage.day} · {stage.title}</strong><p>{stage.detail}</p></li>)}</ol></section>}
    {detail.prerequisites && detail.prerequisites.length > 0 && <section><h3>Что потребуется</h3><ul>{detail.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul></section>}
    <div className="event-source-proof"><span>Источник: {detail.source_status} · проверен {detail.source_checked_at ? new Date(detail.source_checked_at).toLocaleDateString("ru-RU") : "дата неизвестна"}</span><SafeExternalLink href={detail.source_url}>Открыть первоисточник</SafeExternalLink></div>
  </div>;
}

export function ParticipantEventCatalog() {
  const [params, setParams] = useSearchParams();
  const track = params.get("track") ?? "all";
  const eventType = params.get("type") ?? "all";
  const view = params.get("view") === "list" ? "list" : "cards";
  const eventKey = params.get("event");
  const events = useQuery({ queryKey: ["events"], queryFn: () => apiRequest<EventPage>("/api/v1/ecosystem/events") });
  const detail = useQuery({ queryKey: ["event-detail", eventKey], enabled: eventKey !== null, queryFn: () => apiRequest<EventDetail>(path(eventKey ?? "")) });
  const aggregate = useQuery({ queryKey: ["event-registration", eventKey], enabled: eventKey !== null, queryFn: () => apiRequest<RegistrationAggregate>(path(eventKey ?? "", "/registration")) });
  const setParam = (key: string, value: string, defaultValue = "all") => { const next = new URLSearchParams(params); if (value === defaultValue) next.delete(key); else next.set(key, value); setParams(next); };
  const close = () => { const next = new URLSearchParams(params); next.delete("event"); setParams(next); };
  if (events.isLoading) return <StatePanel kind="loading" />;
  if (events.isError || !events.data) return <StatePanel kind="error" action="Обновить" onAction={() => { void events.refetch(); }} />;
  const tracks = [...new Set(events.data.items.flatMap((item) => item.track_keys))];
  const types = [...new Set(events.data.items.map((item) => item.event_type))];
  const visible = events.data.items.filter((item) => (track === "all" || item.track_keys.includes(track)) && (eventType === "all" || item.event_type === eventType));
  return <div className="feature-stack participant-events">
    <section><p className="eyebrow">Экосистема возможностей</p><h1 id="workspace-title">События, которые ведут к практике</h1><p className="lead">Откройте карточку, чтобы увидеть программу, условия, релевантность и privacy-safe статистику регистраций.</p></section>
    <div className="event-catalog-toolbar"><div className="catalog-controls">
      <label className="catalog-filter">Направление<select value={track} onChange={(event) => { setParam("track", event.target.value); }}><option value="all">Все направления</option>{tracks.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <label className="catalog-filter">Формат<select value={eventType} onChange={(event) => { setParam("type", event.target.value); }}><option value="all">Все форматы</option>{types.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
    </div><div className="view-toggle" role="group" aria-label="Вид событий"><button type="button" className={view === "cards" ? "active" : ""} aria-pressed={view === "cards"} onClick={() => { setParam("view", "cards", "cards"); }}>Карточки</button><button type="button" className={view === "list" ? "active" : ""} aria-pressed={view === "list"} onClick={() => { setParam("view", "list", "cards"); }}>Список</button></div></div>
    {visible.length === 0 ? <StatePanel kind="empty" action="Сбросить фильтры" onAction={() => { setParams(new URLSearchParams()); }} /> : <div className={`event-grid event-grid--${view}`}>{visible.map((item) => <Card title={item.title} key={item.key}><div className="course-meta"><Badge>{item.event_type}</Badge><Badge tone={item.status === "open" ? "success" : "neutral"}>{item.status === "open" ? "Актуальное" : "Завершено"}</Badge></div><p>{item.recommendation_reason}</p><p className="muted">{item.conditions}</p><dl className="event-facts"><div><dt>Организатор</dt><dd>{item.organizer}</dd></div><div><dt>Дедлайн</dt><dd>{item.deadline_at ? new Date(item.deadline_at).toLocaleDateString("ru-RU") : "Уточняется"}</dd></div></dl><div className="event-actions"><button type="button" onClick={() => { setParam("event", item.key, ""); }}>Подробнее</button><SafeExternalLink href={item.source_url}>Страница события</SafeExternalLink></div></Card>)}</div>}
    <Modal title={detail.data?.title ?? "Подробности события"} open={eventKey !== null} onClose={close}>{detail.isLoading || aggregate.isLoading ? <StatePanel kind="loading" /> : detail.isError || aggregate.isError || !detail.data || !aggregate.data ? <StatePanel kind="error" action="Закрыть" onAction={close} /> : <EventDetailBody detail={detail.data} aggregate={aggregate.data} />}</Modal>
  </div>;
}
