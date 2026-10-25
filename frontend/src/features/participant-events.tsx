import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { apiRequest, type RuntimeApiPath } from "../api/client";
import { Modal, SafeExternalLink, StatePanel } from "../components/ui";
import { ArrowDownUp, ArrowRight, Award, BriefcaseBusiness, ChevronDown, Filter, GraduationCap, Plus, RotateCcw, Search, Users, X } from "lucide-react";
import { EventsTile, EventExperienceDetail, EventRegistrationForm, type EventTab } from "./participant-events-design";
import "./participant-events-reference.scss";
import "./participant-events.scss";
import "./participant-events-fidelity.scss";
import "./participant-events-compact.scss";

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFocus, setDraftFocus] = useState<string[]>([]);
  const [draftType, setDraftType] = useState("all");
  const filtersRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setFiltersOpen(false); };
    const onPointer = (event: MouseEvent) => {
      if (!filtersRef.current?.contains(event.target as Node)) setFiltersOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onPointer); };
  }, [filtersOpen]);
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
  const activeTracks = Array.from(new Set([...selectedFocus, ...(track === "all" ? [] : [track])]));
  const activeFilterCount = activeTracks.length + (eventType === "all" ? 0 : 1) + (activeCategory === "sber" ? 1 : 0);
  const typeName = (key: string): string => ({ educational_program: "Образовательная программа", hackathon: "Хакатон", grant: "Грант", competition: "Конкурс", workshop: "Практикум" })[key] ?? key;
  const openFilters = () => { setDraftFocus(activeTracks); setDraftType(eventType); setFiltersOpen(value => !value); };
  const toggleDraftFocus = (key: string) => { setDraftFocus(value => value.includes(key) ? value.filter(item => item !== key) : [...value, key]); };
  const applyFilters = () => {
    const next = new URLSearchParams(pendingParams.current);
    next.delete("track");
    if (draftFocus.length) next.set("focus",draftFocus.join(",")); else next.delete("focus");
    if (draftType === "all") next.delete("type"); else next.set("type",draftType);
    pendingParams.current = next;
    setParams(next);
    setFiltersOpen(false);
  };
  const previewCount = allItems.filter(item =>
    (!draftFocus.length || draftFocus.some(key => item.track_keys.includes(key))) &&
    (draftType === "all" || item.event_type === draftType) &&
    (activeCategory !== "sber" || /сбер|sber/i.test(item.organizer)) &&
    (!search.trim() || [item.title,item.organizer,item.recommendation_reason,...item.track_keys].join(" ").toLowerCase().includes(search.trim().toLowerCase()))
  ).length;
  const visible = allItems.filter((item) =>
    (track === "all" || item.track_keys.includes(track)) &&
    (eventType === "all" || item.event_type === eventType) &&
    (!selectedFocus.length || selectedFocus.some(key => item.track_keys.includes(key))) &&
    (activeCategory !== "sber" || /сбер|sber/i.test(item.organizer)) &&
    (search.trim() === "" || [item.title,item.organizer,item.recommendation_reason,...item.track_keys].join(" ").toLowerCase().includes(search.trim().toLowerCase()))
  ).sort((a,b) => sortBy === "deadline" || activeCategory === "deadline"
    ? (new Date(a.deadline_at ?? "9999-01-01").getTime() - new Date(b.deadline_at ?? "9999-01-01").getTime())
    : sortBy === "newest" ? new Date(b.source_checked_at||"1970-01-01").getTime()-new Date(a.source_checked_at||"1970-01-01").getTime()
    : activeCategory === "popular" ? b.track_keys.length - a.track_keys.length : 0);
  const focus = selectedFocus.length ? selectedFocus : ["python","product","ai","ml","data"];
  const toggleSaved = (key: string) => { setSavedEvents(old => { const next=new Set(old); if(next.has(key))next.delete(key);else next.add(key);return next; }); };
  const removeDirection = (key: string) => {
    const next = new URLSearchParams(pendingParams.current);
    if (next.get("track") === key) next.delete("track");
    const remaining = selectedFocus.filter(item => item !== key);
    if (remaining.length) next.set("focus",remaining.join(",")); else next.delete("focus");
    pendingParams.current = next;
    setParams(next);
  };
  const resetFilters = () => {
    const next = new URLSearchParams(pendingParams.current);
    next.delete("focus"); next.delete("track"); next.delete("type");
    pendingParams.current = next; setParams(next);
    setDraftFocus([]); setDraftType("all"); setFiltersOpen(false);
    setActiveCategory("for-you"); setSortBy("relevance"); setSearch("");
  };
  return <div className="feature-stack participant-events" data-testid="events-v2">
    <section className="ev-catalog-v3" id="ev-results" aria-labelledby="workspace-title">
      <header className="ev-v3-heading">
        <h1 id="workspace-title">Подбор событий</h1>
        <button type="button" className="ev-v3-reset" onClick={resetFilters}><RotateCcw size={15}/> Сбросить всё</button>
      </header>
      <nav className="ev-result-tabs ev-v3-tabs" aria-label="Категории событий">
        {([["for-you","Для вас"],["sber","От Сбера"],["popular","Популярные"],["deadline","Скоро дедлайн"]] as const).map(([key,label]) =>
          <button type="button" key={key} className={activeCategory===key?"active":""} aria-pressed={activeCategory===key} onClick={()=> { setActiveCategory(key); }}>{label}{key==="for-you"?" ("+String(visible.length)+")":""}</button>)}
      </nav>
      <div className="ev-v3-toolbar" ref={filtersRef}>
        <button type="button" className={"ev-v3-filters-trigger"+(filtersOpen?" is-open":"")} aria-expanded={filtersOpen} aria-controls="ev-filter-popover" onClick={openFilters}>
          <Filter size={19}/><strong>Фильтры</strong>{activeFilterCount>0&&<span className="ev-v3-count">{activeFilterCount}</span>}<ChevronDown className="ev-v3-trigger-chevron" size={17}/>
        </button>
        <label className="ev-v3-search"><Search size={20}/><input type="search" value={search} onChange={event=>{setSearch(event.target.value);}} placeholder="Найти событие" aria-label="Поиск событий"/></label>
        <div className="ev-v3-active-filters" aria-label="Активные фильтры">
          {activeTracks.map(key=><button key={"track-"+key} type="button" className="ev-v3-active-chip" aria-label={"Убрать направление "+key} onClick={()=>{removeDirection(key);}}>{key}<X size={13}/></button>)}
          {eventType!=="all"&&<button type="button" className="ev-v3-active-chip" aria-label={"Убрать тип "+typeName(eventType)} onClick={()=>{setParam("type","all");}}>{typeName(eventType)}<X size={13}/></button>}
          {activeCategory==="sber"&&<button type="button" className="ev-v3-active-chip" onClick={()=>{setActiveCategory("for-you");}}>От Сбера<X size={13}/></button>}
          <button type="button" className="ev-v3-add" aria-label="Добавить фильтр" onClick={openFilters}><Plus size={18}/></button>
        </div>
        <span className="ev-v3-shown">Показано: {visible.length} из {allItems.length}</span>
        <label className="ev-v3-order"><ArrowDownUp size={16}/><select value={sortBy} aria-label="Сортировка событий" onChange={e=>{setSortBy(e.target.value);}}><option value="relevance">По соответствию</option><option value="deadline">По дедлайну</option><option value="newest">Недавно проверены</option></select><ChevronDown size={14}/></label>
        {filtersOpen&&<section id="ev-filter-popover" className="ev-v3-popover" aria-label="Фильтры событий">
          <header className="ev-v3-popover-head"><div><strong>Фильтры событий</strong><small>Выберите подходящие направления и тип</small></div><button type="button" onClick={()=>{setFiltersOpen(false);}} aria-label="Закрыть фильтры"><X size={18}/></button></header>
          <div className="ev-v3-filter-section"><h3>Направления</h3><div className="ev-v3-filter-options">
            {tracks.map(key=><button type="button" key={key} aria-pressed={draftFocus.includes(key)} className={draftFocus.includes(key)?"is-active":""} onClick={()=>{toggleDraftFocus(key);}}>{key}</button>)}
          </div></div>
          <div className="ev-v3-filter-section"><h3>Тип события</h3><div className="ev-v3-filter-options">
            <button type="button" className={draftType==="all"?"is-active":""} aria-pressed={draftType==="all"} onClick={()=>{setDraftType("all");}}>Все типы</button>
            {types.map(key=><button type="button" key={key} className={draftType===key?"is-active":""} aria-pressed={draftType===key} onClick={()=>{setDraftType(draftType===key?"all":key);}}>{typeName(key)}</button>)}
          </div></div>
          <div className="ev-v3-popover-actions"><button type="button" className="ev-v3-apply" onClick={applyFilters}>Показать события · {previewCount} <ArrowRight size={15}/></button><button type="button" className="ev-v3-clear" onClick={()=>{setDraftFocus([]);setDraftType("all");}}>Очистить</button></div>
        </section>}
      </div>
      {visible.length===0?<div className="ev-empty"><h3>События не найдены</h3><p>Попробуйте изменить направление, тип события или запрос</p><button className="ev-primary" type="button" onClick={resetFilters}>Сбросить фильтры</button></div>:
        <div className="ev-event-list ev-v3-event-grid">{visible.map((item,index)=>{
          const claim=claimByEvent.get(item.key);
          return <EventsTile key={item.key} item={item} index={index} focus={focus} evidenceState={claim?.evidence_state} verificationExplanation={claim?.verification_explanation} canReportResult={item.status!=="open"&&!claim} onReportResult={()=>{setSelectedEvent(item);}} saved={savedEvents.has(item.key)} onSave={()=>{toggleSaved(item.key);}} onDetails={()=>{openEvent(item.key);}}/>;
        })}</div>}
      <div className="ev-benefits-bottom"><strong>После участия вы получите</strong><span><BriefcaseBusiness/> Практический опыт</span><span><Award/> Подтверждённые достижения</span><span><GraduationCap/> Развитие навыков</span><span><Users/> Новые контакты</span></div>
    </section>
    <div className="ev-detail-modal"><Modal title={detail.data?.title ?? "Подробности события"} open={eventKey !== null} onClose={close}>{detail.isLoading || aggregate.isLoading ? <StatePanel kind="loading" /> : detail.isError || aggregate.isError || !detail.data || !aggregate.data ? <StatePanel kind="error" action="Закрыть" onAction={close} /> : <><EventExperienceDetail detail={detail.data} aggregate={aggregate.data} tab={detailTab} onTabChange={setDetailTab} onClose={close} onRegister={()=> { setRegistrationOpen(true); }} isSaved={savedEvents.has(detail.data.key)} onSave={()=> { toggleSaved(detail.data.key); }}/>{registrationOpen&&<EventRegistrationForm event={detail.data} onClose={closeRegistration}/>}</>}</Modal></div>
    <Modal title={`Подтвердить результат · ${selectedEvent?.title ?? ""}`} open={selectedEvent !== null} onClose={() => { setSelectedEvent(null); }}>
      <form className="event-claim-form" onSubmit={(event) => { event.preventDefault(); if (selectedEvent) report.mutate(selectedEvent.key); }}><p>Событие завершено. После проверки сертификата баллы станут постоянными.</p><label>Результат<select value={claimType} onChange={(event) => { setClaimType(event.target.value); }}><option value="participation">Участие</option><option value="completion">Завершение</option><option value="finalist">Финалист</option><option value="winner">Победа</option></select></label><label>Что вы сделали<textarea required minLength={20} value={result} onChange={(event) => { setResult(event.target.value); }} /></label><label>Ссылка на сертификат или доказательство<input required type="url" value={evidence} onChange={(event) => { setEvidence(event.target.value); }} /></label><div className="modal-actions"><button type="submit" disabled={report.isPending}>{report.isPending ? "Отправляем…" : "Отправить на проверку"}</button><button className="secondary-button" type="button" onClick={() => { setSelectedEvent(null); }}>Отмена</button></div></form>
    </Modal>
  </div>;
}
