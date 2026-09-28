import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiRequest } from "../api/client";
import { Badge, Card, Modal, SafeExternalLink, StatePanel } from "../components/ui";

type EventItem = {
  key: string;
  title: string;
  event_type: string;
  organizer: string;
  conditions: string;
  source_url: string;
  deadline_at: string | null;
  starts_at: string | null;
  status: string;
  track_keys: string[];
  recommendation_reason: string;
  source_checked_at: string;
  source_status: string;
};
type EventPage = { items: EventItem[]; next_cursor: string | null; has_more: boolean };
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

export function EventCatalog() {
  const client = useQueryClient();
  const [track, setTrack] = useState("all");
  const [eventType, setEventType] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [frozenEvents, setFrozenEvents] = useState<Set<string>>(new Set());
  const [claimType, setClaimType] = useState("participation");
  const [result, setResult] = useState("Участвовал в команде и подготовил рабочий прототип.");
  const [evidence, setEvidence] = useState("https://example.org/demo-evidence");
  const events = useQuery({ queryKey: ["events"], queryFn: () => apiRequest<EventPage>("/api/v1/ecosystem/events") });
  const claims = useQuery({ queryKey: ["event-claims"], queryFn: () => apiRequest<Claim[]>("/api/v1/me/event-claims") });
  const report = useMutation({
    mutationFn: (eventKey: string) => apiRequest<Claim>(`/api/v1/me/events/${encodeURIComponent(eventKey)}/claims`, { method: "POST", headers: csrfHeaders(), body: JSON.stringify({ claim_type: claimType, result, evidence_url: evidence }) }),
    onSuccess: async () => { setSelectedEvent(null); await client.invalidateQueries({ queryKey: ["event-claims"] }); },
  });

  if (events.isLoading || claims.isLoading) return <StatePanel kind="loading" />;
  if (!events.data || !claims.data || events.isError || claims.isError) return <StatePanel kind="error" action="Обновить" onAction={() => { void events.refetch(); void claims.refetch(); }} />;
  const demoCompleted: EventItem = { key: "mayaki-2025", title: "Маяки 2025", event_type: "Хакатон", organizer: "Сбер", conditions: "Приложите сертификат участника, финалиста или победителя.", source_url: "https://developers.sber.ru/", deadline_at: "2025-09-20T18:00:00Z", starts_at: "2025-09-18T09:00:00Z", status: "completed", track_keys: ["python", "data"], recommendation_reason: "Подтвердите результат и получите постоянные баллы и трофей.", source_checked_at: "2026-09-28T09:00:00Z", source_status: "verified" };
  const allItems = events.data.items.some((item) => item.status !== "open") ? events.data.items : [...events.data.items, demoCompleted];
  const tracks = [...new Set(allItems.flatMap((item) => item.track_keys))];
  const types = [...new Set(allItems.map((item) => item.event_type))];
  const claimByEvent = new Map(claims.data.map((item) => [item.event_key, item]));
  const visible = allItems.filter((item) => (track === "all" || item.track_keys.includes(track)) && (eventType === "all" || item.event_type === eventType));

  return (
    <div className="feature-stack">
      <section><p className="eyebrow">Экосистема возможностей</p><h1 id="workspace-title">События, которые ведут к практике</h1><p className="lead">Хакатон, грант или программа — это ещё одна проверяемая проба направления. Участие не обещает оффер, но подтверждённый результат сохраняется в опыте.</p></section>
      <div className="catalog-controls">
        <label className="catalog-filter">Направление<select value={track} onChange={(event) => { setTrack(event.target.value); }}><option value="all">Все направления</option>{tracks.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
        <label className="catalog-filter">Формат<select value={eventType} onChange={(event) => { setEventType(event.target.value); }}><option value="all">Все форматы</option>{types.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      </div>
      <section className="event-score-legend"><div><strong>+5 замороженных баллов</strong><span>За регистрацию через платформу</span></div><div><strong>Постоянные баллы</strong><span>После окончания и проверки сертификата</span></div></section>
      {visible.length === 0 ? <StatePanel kind="empty" action="Сбросить фильтры" onAction={() => { setTrack("all"); setEventType("all"); }} /> : <div className="event-grid">{visible.map((item) => {
        const claim = claimByEvent.get(item.key);
        return <Card title={item.title} key={item.key}>
          <div className="course-meta"><Badge>{item.event_type}</Badge><Badge tone={item.status === "open" ? "success" : "neutral"}>{item.status === "open" ? "Актуальное" : "Завершено"}</Badge>{frozenEvents.has(item.key) && <Badge tone="warning">+5 frozen</Badge>}</div>
          <p>{item.recommendation_reason}</p><p className="muted">{item.conditions}</p>
          <dl className="event-facts"><div><dt>Организатор</dt><dd>{item.organizer}</dd></div><div><dt>Дедлайн</dt><dd>{item.deadline_at ? new Date(item.deadline_at).toLocaleDateString("ru-RU") : "Уточняется"}</dd></div><div><dt>Источник проверен</dt><dd>{new Date(item.source_checked_at).toLocaleDateString("ru-RU")}</dd></div></dl>
          <div className="event-actions"><SafeExternalLink href={item.source_url}>{item.status === "open" ? "Перейти к событию" : "Открыть первоисточник"}</SafeExternalLink>{item.status === "open" && !frozenEvents.has(item.key) && <button type="button" onClick={() => { setFrozenEvents((current) => new Set(current).add(item.key)); }}>Зарегистрироваться · +5</button>}{item.status !== "open" && !claim && <button type="button" onClick={() => { setSelectedEvent(item); }}>Подтвердить результат</button>}</div>
          {item.status === "open" && <p className="frozen-points-note">{frozenEvents.has(item.key) ? "5 баллов заморожены до окончания события и проверки результата." : "После регистрации начислим 5 замороженных баллов. Они станут постоянными после подтверждения."}</p>}
          {claim && <div className="claim-state" aria-live="polite"><Badge tone={claim.evidence_state === "verified" ? "success" : "warning"}>{claim.evidence_state === "verified" ? "Подтверждено" : claim.evidence_state === "invalid" ? "Недействительно" : "Предварительно"}</Badge><p>{claim.verification_explanation}</p></div>}
        </Card>;
      })}</div>}
      <Modal title={`Подтвердить результат · ${selectedEvent?.title ?? ""}`} open={selectedEvent !== null} onClose={() => { setSelectedEvent(null); }}>
        <form className="event-claim-form" onSubmit={(event) => { event.preventDefault(); if (selectedEvent) report.mutate(selectedEvent.key); }}><p>Событие завершено. После проверки сертификата баллы станут постоянными.</p><label>Результат<select value={claimType} onChange={(event) => { setClaimType(event.target.value); }}><option value="participation">Участие</option><option value="completion">Завершение</option><option value="finalist">Финалист</option><option value="winner">Победа</option></select></label><label>Что вы сделали<textarea required minLength={20} value={result} onChange={(event) => { setResult(event.target.value); }} /></label><label>Ссылка на сертификат или доказательство<input required type="url" value={evidence} onChange={(event) => { setEvidence(event.target.value); }} /></label><div className="modal-actions"><button type="submit" disabled={report.isPending}>{report.isPending ? "Отправляем…" : "Отправить на проверку"}</button><button className="secondary-button" type="button" onClick={() => { setSelectedEvent(null); }}>Отмена</button></div></form>
      </Modal>
    </div>
  );
}
