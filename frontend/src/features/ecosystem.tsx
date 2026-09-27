import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiRequest } from "../api/client";
import { Badge, Card, SafeExternalLink, StatePanel } from "../components/ui";

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
};

const statusLabels: Record<Claim["status"], string> = {
  reported: "Заявлено вами",
  awaiting_verification: "Ожидает проверки",
  verified: "Подтверждено",
  rejected: "Не подтверждено",
  revoked: "Отозвано",
};

function csrfHeaders(): HeadersInit {
  return { "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" };
}

export function EventCatalog() {
  const client = useQueryClient();
  const [track, setTrack] = useState("all");
  const [eventType, setEventType] = useState("all");
  const events = useQuery({ queryKey: ["events"], queryFn: () => apiRequest<EventPage>("/api/v1/ecosystem/events") });
  const claims = useQuery({ queryKey: ["event-claims"], queryFn: () => apiRequest<Claim[]>("/api/v1/me/event-claims") });
  const report = useMutation({
    mutationFn: (eventKey: string) => apiRequest<Claim>(`/api/v1/me/events/${encodeURIComponent(eventKey)}/claims`, { method: "POST", headers: csrfHeaders(), body: JSON.stringify({ claim_type: "participation" }) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["event-claims"] }); },
  });

  if (events.isLoading || claims.isLoading) return <StatePanel kind="loading" />;
  if (!events.data || !claims.data || events.isError || claims.isError) return <StatePanel kind="error" action="Обновить" onAction={() => { void events.refetch(); void claims.refetch(); }} />;
  const tracks = [...new Set(events.data.items.flatMap((item) => item.track_keys))];
  const types = [...new Set(events.data.items.map((item) => item.event_type))];
  const claimByEvent = new Map(claims.data.map((item) => [item.event_key, item]));
  const visible = events.data.items.filter((item) => (track === "all" || item.track_keys.includes(track)) && (eventType === "all" || item.event_type === eventType));

  return (
    <div className="feature-stack">
      <section><p className="eyebrow">Экосистема возможностей</p><h1 id="workspace-title">События, которые ведут к практике</h1><p className="lead">Хакатон, грант или программа — это ещё одна проверяемая проба направления. Участие не обещает оффер, но подтверждённый результат сохраняется в опыте.</p></section>
      <div className="catalog-controls">
        <label className="catalog-filter">Направление<select value={track} onChange={(event) => { setTrack(event.target.value); }}><option value="all">Все направления</option>{tracks.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
        <label className="catalog-filter">Формат<select value={eventType} onChange={(event) => { setEventType(event.target.value); }}><option value="all">Все форматы</option>{types.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      </div>
      {visible.length === 0 ? <StatePanel kind="empty" action="Сбросить фильтры" onAction={() => { setTrack("all"); setEventType("all"); }} /> : <div className="event-grid">{visible.map((item) => {
        const claim = claimByEvent.get(item.key);
        return <Card title={item.title} key={item.key}>
          <div className="course-meta"><Badge>{item.event_type}</Badge><Badge tone={item.status === "open" ? "success" : "neutral"}>{item.status === "open" ? "Приём открыт" : "Завершено"}</Badge></div>
          <p>{item.recommendation_reason}</p><p className="muted">{item.conditions}</p>
          <dl className="event-facts"><div><dt>Организатор</dt><dd>{item.organizer}</dd></div><div><dt>Дедлайн</dt><dd>{item.deadline_at ? new Date(item.deadline_at).toLocaleDateString("ru-RU") : "Уточняется"}</dd></div><div><dt>Источник проверен</dt><dd>{new Date(item.source_checked_at).toLocaleDateString("ru-RU")}</dd></div></dl>
          <SafeExternalLink href={item.source_url}>Открыть первоисточник события</SafeExternalLink>
          {claim ? <div className="claim-state" aria-live="polite"><Badge tone={claim.status === "verified" ? "success" : "warning"}>{statusLabels[claim.status]}</Badge><p>{claim.verification_explanation}</p></div> : <button type="button" onClick={() => { report.mutate(item.key); }}>Сообщить об участии</button>}
        </Card>;
      })}</div>}
    </div>
  );
}
