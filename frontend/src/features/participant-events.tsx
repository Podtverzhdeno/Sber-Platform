import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { apiRequest, type RuntimeApiPath } from "../api/client";
import { Modal, SafeExternalLink, StatePanel } from "../components/ui";
import { Award, BriefcaseBusiness, GraduationCap, Users } from "lucide-react";
import { EventsHero, EventsCard, EventExperienceDetail, EventRegistrationForm, type EventTab } from "./participant-events-design";
import "./participant-events-reference.scss";
import "./participant-events.scss";
import "./participant-events-fidelity.scss";

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
  const eventKey = params.get("event");
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [activeCategory, setActiveCategory] = useState("for-you");
  const [sortBy, setSortBy] = useState("relevance");
  const [search, setSearch] = useState("");
  const [savedEvents, setSavedEvents] = useState<Set<string>>(new Set());
  const [detailTab, setDetailTab] = useState<EventTab>("about");
  const [registrationOpen, setRegistrationOpen] = useState(false);

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
  const openEvent = (key: string) => { setDetailTab("about"); setRegistrationOpen(false); setParam("event", key, ""); };
  const closeRegistration = () => {
    setRegistrationOpen(false);
    document.querySelector<HTMLButtonElement>(".ev-registration-cta")?.focus();
  };
  const close = () => {
    setRegistrationOpen(false);
    const next = new URLSearchParams(pendingParams.current);
    next.delete("event");
    pendingParams.current = next;
    setParams(next);
  };
  if (events.isLoading) return <StatePanel kind="loading" />;
  if (events.isError || !events.data) return <StatePanel kind="error" action="Обновить" onAction={() => { void events.refetch(); }} />;
  // Only events returned by the server may be shown to a participant.
  const allItems: EventItem[] = events.data.items;
  const tracks = [...new Set(allItems.flatMap((item) => item.track_keys))];
  const types = [...new Set(allItems.map((item) => item.event_type))];
  const claimByEvent = new Map((claims.data ?? []).map((item) => [item.event_key, item]));
  const selectedFocus = (params.get("focus") ?? "").split(",").filter(Boolean);
  const visible = allItems.filter((item) =>
    (track === "all" || item.track_keys.includes(track)) &&
    (eventType === "all" || item.event_type === eventType) &&
    (!selectedFocus.length || selectedFocus.some(key => item.track_keys.includes(key))) &&
    (activeCategory !== "sber" || /сбер|sber/i.test(item.organizer)) &&
    (search.trim() === "" || [item.title,item.organizer,item.recommendation_reason,...item.track_keys].join(" ").toLowerCase().includes(search.trim().toLowerCase()))
  ).sort((a,b) => sortBy === "deadline" || activeCategory === "deadline"
    ? (new Date(a.deadline_at ?? "9999-01-01").getTime() - new Date(b.deadline_at ?? "9999-01-01").getTime())
    : activeCategory === "popular" ? b.track_keys.length - a.track_keys.length : 0);
  const focus = selectedFocus.length ? selectedFocus : ["python","product","ai","ml","data"];
  const toggleSaved = (key: string) => { setSavedEvents(old => { const next=new Set(old); if(next.has(key))next.delete(key);else next.add(key);return next; }); };
  const toggleFocus = (key: string) => {
    const next=new Set(selectedFocus);
    if(next.has(key))next.delete(key);else next.add(key);
    setParam("focus", [...next].join(","), "");
  };
  const resetFilters = () => {
    setParam("focus","","");
    setParam("track","all");
    setParam("type","all");
    setActiveCategory("for-you");
    setSearch("");
  };
  return <div className="feature-stack participant-events" data-testid="events-v2">
    <EventsHero events={allItems} onChoose={() => { document.getElementById("ev-results")?.scrollIntoView({behavior:"smooth",block:"start"}); }}/>
    <div className="ev-catalog" id="ev-results">
      <aside className="ev-filters" aria-label="Фильтры событий">
        <header><h2>Подбор событий</h2><button type="button" onClick={resetFilters}>Сбросить всё</button></header>
        <div className="ev-filter-modes"><button type="button" className={activeCategory==="for-you"?"active":""} onClick={()=> { setActiveCategory("for-you"); }}>Рекомендации для вас</button><button type="button" className={activeCategory==="all"?"active":""} onClick={()=> { setActiveCategory("all"); }}>Все события</button></div>
        <label className="catalog-filter">Направление<select value={track} onChange={event=> { setParam("track",event.target.value); }}><option value="all">Все направления</option>{tracks.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
        <section className="ev-filter-group"><h3>Ваши направления</h3>{tracks.map(key=><label key={key}><input type="checkbox" checked={selectedFocus.includes(key)} onChange={()=> { toggleFocus(key); }}/>{key}</label>)}</section>
        <label className="catalog-filter">Формат<select value={eventType} onChange={event=> { setParam("type",event.target.value); }}><option value="all">Все форматы</option>{types.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
        <section className="ev-filter-group"><h3>Тип события</h3>{types.map(key=><label key={key}><input type="checkbox" checked={eventType===key} onChange={()=> { setParam("type",eventType===key?"all":key); }}/>{key}</label>)}</section>
        <section className="ev-filter-group"><h3>Найти событие</h3><input className="ev-search" value={search} onChange={e=> { setSearch(e.target.value); }} placeholder="Название, навыки, Сбер..." aria-label="Поиск событий"/></section>
        <small className="ev-filter-count">Показано: {visible.length} из {allItems.length}</small>
      </aside>
      <div className="ev-catalog-results">
        <div className="ev-result-header">
          <div className="ev-result-tabs">
            {([["for-you","Для вас"],["sber","От Сбера"],["popular","Популярные"],["deadline","Скоро дедлайн"]] as const).map(([key,label])=><button type="button" key={key} className={activeCategory===key?"active":""} onClick={()=> { setActiveCategory(key); }}>{label}{key==="for-you"?` (${String(visible.length)})`:""}</button>)}
          </div>
          <div className="ev-result-order"><label>Сортировка: <select value={sortBy} aria-label="Сортировка событий" onChange={e=> { setSortBy(e.target.value); }}><option value="relevance">По соответствию</option><option value="deadline">По дедлайну</option></select></label></div>
        </div>
        {visible.length===0?<div className="ev-empty"><h3>События не найдены</h3><p>Измените фильтры или направление развития</p><button className="ev-primary" type="button" onClick={resetFilters}>Сбросить фильтры</button></div>:
         <div className="ev-event-list">{visible.map((item,index)=>{
           const claim=claimByEvent.get(item.key);
           return <div key={item.key}><EventsCard item={item} index={index} focus={focus} evidenceState={claim?.evidence_state} verificationExplanation={claim?.verification_explanation} canReportResult={item.status !== "open" && !claim} onReportResult={() => { setSelectedEvent(item); }} saved={savedEvents.has(item.key)} onSave={()=> { toggleSaved(item.key); }} onDetails={()=> { openEvent(item.key); }}/>
             
           </div>;
         })}</div>}
        <div className="ev-benefits-bottom"><strong>После участия вы получите</strong><span><BriefcaseBusiness/> Практический опыт</span><span><Award/> Подтверждённые достижения</span><span><GraduationCap/> Развитие навыков</span><span><Users/> Новые контакты</span></div>
      </div>
    </div>
    <div className="ev-detail-modal"><Modal title={detail.data?.title ?? "Подробности события"} open={eventKey !== null} onClose={close}>{detail.isLoading || aggregate.isLoading ? <StatePanel kind="loading" /> : detail.isError || aggregate.isError || !detail.data || !aggregate.data ? <StatePanel kind="error" action="Закрыть" onAction={close} /> : <><EventExperienceDetail detail={detail.data} aggregate={aggregate.data} tab={detailTab} onTabChange={setDetailTab} onClose={close} onRegister={()=> { setRegistrationOpen(true); }} isSaved={savedEvents.has(detail.data.key)} onSave={()=> { toggleSaved(detail.data.key); }}/>{registrationOpen&&<EventRegistrationForm event={detail.data} onClose={closeRegistration}/>}</>}</Modal></div>
    <Modal title={`Подтвердить результат · ${selectedEvent?.title ?? ""}`} open={selectedEvent !== null} onClose={() => { setSelectedEvent(null); }}>
      <form className="event-claim-form" onSubmit={(event) => { event.preventDefault(); if (selectedEvent) report.mutate(selectedEvent.key); }}><p>Событие завершено. После проверки сертификата баллы станут постоянными.</p><label>Результат<select value={claimType} onChange={(event) => { setClaimType(event.target.value); }}><option value="participation">Участие</option><option value="completion">Завершение</option><option value="finalist">Финалист</option><option value="winner">Победа</option></select></label><label>Что вы сделали<textarea required minLength={20} value={result} onChange={(event) => { setResult(event.target.value); }} /></label><label>Ссылка на сертификат или доказательство<input required type="url" value={evidence} onChange={(event) => { setEvidence(event.target.value); }} /></label><div className="modal-actions"><button type="submit" disabled={report.isPending}>{report.isPending ? "Отправляем…" : "Отправить на проверку"}</button><button className="secondary-button" type="button" onClick={() => { setSelectedEvent(null); }}>Отмена</button></div></form>
    </Modal>
  </div>;
}
