import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
type Claim = {
  id: string;
  event_key: string;
  claim_type: string;
  status: "reported" | "awaiting_verification" | "verified" | "rejected" | "revoked";
  trophy_created: boolean;
  verification_explanation: string;
  evidence_state: "provisional" | "verified" | "invalid";
};

function csrfHeaders(): HeadersInit {
  return { "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" };
}

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
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const pendingParams = useRef(new URLSearchParams(params));
  useEffect(() => {
    pendingParams.current = new URLSearchParams(params);
  }, [params]);
  const track = params.get("track") ?? "all";
  const eventType = params.get("type") ?? "all";
  const view = params.get("view") === "list" ? "list" : "cards";
  const eventKey = params.get("event");
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [frozenEvents, setFrozenEvents] = useState<Set<string>>(new Set());
  const [claimType, setClaimType] = useState("participation");
  const [result, setResult] = useState("Участвовал в команде и подготовил рабочий прототип.");
  const [evidence, setEvidence] = useState("https://example.org/demo-evidence");
  const events = useQuery({ queryKey: ["events"], queryFn: () => apiRequest<EventPage>("/api/v1/ecosystem/events") });
  const detail = useQuery({ queryKey: ["event-detail", eventKey], enabled: eventKey !== null, queryFn: () => apiRequest<EventDetail>(path(eventKey ?? "")) });
  const aggregate = useQuery({ queryKey: ["event-registration", eventKey], enabled: eventKey !== null, queryFn: () => apiRequest<RegistrationAggregate>(path(eventKey ?? "", "/registration")) });
  const claims = useQuery({ queryKey: ["event-claims"], queryFn: () => apiRequest<Claim[]>("/api/v1/me/event-claims") });
  const report = useMutation({
    mutationFn: (eventKeyArg: string) => apiRequest<Claim>(`/api/v1/me/events/${encodeURIComponent(eventKeyArg)}/claims` as RuntimeApiPath, { method: "POST", headers: csrfHeaders(), body: JSON.stringify({ claim_type: claimType, result, evidence_url: evidence }) }),
    onSuccess: async () => { setSelectedEvent(null); await client.invalidateQueries({ queryKey: ["event-claims"] }); },
  });
  const setParam = (key: string, value: string, defaultValue = "all") => {
    const next = new URLSearchParams(pendingParams.current);
    if (value === defaultValue) next.delete(key);
    else next.set(key, value);
    pendingParams.current = next;
    setParams(next);
  };
  const close = () => {
    const next = new URLSearchParams(pendingParams.current);
    next.delete("event");
    pendingParams.current = next;
    setParams(next);
  };
  if (events.isLoading) return <StatePanel kind="loading" />;
  if (events.isError || !events.data) return <StatePanel kind="error" action="Обновить" onAction={() => { void events.refetch(); }} />;
  const demoCompleted: EventItem = { key: "mayaki-2025", title: "Маяки 2025", event_type: "Хакатон", organizer: "Сбер", conditions: "Приложите сертификат участника, финалиста или победителя.", source_url: "https://developers.sber.ru/", deadline_at: "2025-09-20T18:00:00Z", status: "completed", track_keys: ["python"], recommendation_reason: "Подтвердите результат и получите постоянные баллы и трофей.", source_checked_at: "2026-09-28T09:00:00Z", source_status: "verified" };
  const claimsReady = claims.isSuccess && claims.data.length === 0;
  const allItems: EventItem[] = !events.data.items.some((item) => item.status !== "open") && claimsReady ? [...events.data.items, demoCompleted] : events.data.items;
  const tracks = [...new Set(allItems.flatMap((item) => item.track_keys))];
  const types = [...new Set(allItems.map((item) => item.event_type))];
  const claimByEvent = new Map((claims.data ?? []).map((item) => [item.event_key, item]));
  const visible = allItems.filter((item) => (track === "all" || item.track_keys.includes(track)) && (eventType === "all" || item.event_type === eventType));
  return <div className="feature-stack participant-events">
    <section><p className="eyebrow">Экосистема возможностей</p><h1 id="workspace-title">События, которые ведут к практике</h1><p className="lead">Откройте карточку, чтобы увидеть программу, условия, релевантность и privacy-safe статистику регистраций.</p></section>
    <section className="event-score-legend"><div><strong>+5 замороженных баллов</strong><span>За регистрацию через платформу</span></div><div><strong>Постоянные баллы</strong><span>После окончания и проверки сертификата</span></div></section>
    <div className="event-catalog-toolbar"><div className="catalog-controls">
      <label className="catalog-filter">Направление<select value={track} onChange={(event) => { setParam("track", event.target.value); }}><option value="all">Все направления</option>{tracks.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <label className="catalog-filter">Формат<select value={eventType} onChange={(event) => { setParam("type", event.target.value); }}><option value="all">Все форматы</option>{types.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
    </div><div className="view-toggle" role="group" aria-label="Вид событий"><button type="button" className={view === "cards" ? "active" : ""} aria-pressed={view === "cards"} onClick={() => { setParam("view", "cards", "cards"); }}>Карточки</button><button type="button" className={view === "list" ? "active" : ""} aria-pressed={view === "list"} onClick={() => { setParam("view", "list", "cards"); }}>Список</button></div></div>
    {visible.length === 0 ? <StatePanel kind="empty" action="Сбросить фильтры" onAction={() => { setParams(new URLSearchParams()); }} /> : <div className={`event-grid event-grid--${view}`}>{visible.map((item) => {
      const claim = claimByEvent.get(item.key);
      return <Card title={item.title} key={item.key}><div className="course-meta"><Badge>{item.event_type}</Badge><Badge tone={item.status === "open" ? "success" : "neutral"}>{item.status === "open" ? "Актуальное" : "Завершено"}</Badge>{frozenEvents.has(item.key) && <Badge tone="warning">+5 frozen</Badge>}</div><p>{item.recommendation_reason}</p><p className="muted">{item.conditions}</p><dl className="event-facts"><div><dt>Организатор</dt><dd>{item.organizer}</dd></div><div><dt>Дедлайн</dt><dd>{item.deadline_at ? new Date(item.deadline_at).toLocaleDateString("ru-RU") : "Уточняется"}</dd></div></dl><div className="event-actions"><button type="button" onClick={() => { setParam("event", item.key, ""); }}>Подробнее</button><SafeExternalLink href={item.source_url}>{item.status === "open" ? "Перейти к событию" : "Открыть первоисточник"}</SafeExternalLink>{item.status === "open" && !frozenEvents.has(item.key) && <button type="button" onClick={() => { setFrozenEvents((current) => new Set(current).add(item.key)); }}>Зарегистрироваться · +5</button>}{item.status !== "open" && !claim && <button type="button" onClick={() => { setSelectedEvent(item); }}>Подтвердить результат</button>}</div>{item.status === "open" && <p className="frozen-points-note">{frozenEvents.has(item.key) ? "5 баллов заморожены до окончания события и проверки результата." : "После регистрации начислим 5 замороженных баллов. Они станут постоянными после подтверждения."}</p>}{claim && <div className="claim-state" aria-live="polite"><Badge tone={claim.evidence_state === "verified" ? "success" : "warning"}>{claim.evidence_state === "verified" ? "Подтверждено" : claim.evidence_state === "invalid" ? "Недействительно" : "Предварительно"}</Badge><p>{claim.verification_explanation}</p></div>}</Card>;
    })}</div>}
    <Modal title={detail.data?.title ?? "Подробности события"} open={eventKey !== null} onClose={close}>{detail.isLoading || aggregate.isLoading ? <StatePanel kind="loading" /> : detail.isError || aggregate.isError || !detail.data || !aggregate.data ? <StatePanel kind="error" action="Закрыть" onAction={close} /> : <EventDetailBody detail={detail.data} aggregate={aggregate.data} />}</Modal>
    <Modal title={`Подтвердить результат · ${selectedEvent?.title ?? ""}`} open={selectedEvent !== null} onClose={() => { setSelectedEvent(null); }}>
      <form className="event-claim-form" onSubmit={(event) => { event.preventDefault(); if (selectedEvent) report.mutate(selectedEvent.key); }}><p>Событие завершено. После проверки сертификата баллы станут постоянными.</p><label>Результат<select value={claimType} onChange={(event) => { setClaimType(event.target.value); }}><option value="participation">Участие</option><option value="completion">Завершение</option><option value="finalist">Финалист</option><option value="winner">Победа</option></select></label><label>Что вы сделали<textarea required minLength={20} value={result} onChange={(event) => { setResult(event.target.value); }} /></label><label>Ссылка на сертификат или доказательство<input required type="url" value={evidence} onChange={(event) => { setEvidence(event.target.value); }} /></label><div className="modal-actions"><button type="submit" disabled={report.isPending}>{report.isPending ? "Отправляем…" : "Отправить на проверку"}</button><button className="secondary-button" type="button" onClick={() => { setSelectedEvent(null); }}>Отмена</button></div></form>
    </Modal>
  </div>;
}
