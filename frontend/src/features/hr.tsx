import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { apiRequest } from "../api/client";
import { Badge, StatePanel } from "../components/ui";

type Stage = "invitation" | "interview" | "offer" | "hire";
type Candidate = { person_id: string; display_name: string; accepted_projects: number; verified_courses: number; top_grade: string | null };
type Contribution = { contribution_id: string; project_title: string; personal_summary: string; artifact_keys: string[]; grade: string | null; review_reason: string | null };
type Portfolio = { person_id: string; display_name: string; contributions: Contribution[]; courses: { key: string; title: string; status: string }[] };
type PipelineEvent = { id: string; candidate_id: string; candidate_name: string; stage: Stage; note: string; occurred_at: string; origin: "human" };
type Pipeline = { counts: Record<Stage, number>; events: PipelineEvent[] };

const stages: { key: Stage; title: string }[] = [
  { key: "invitation", title: "Приглашение" }, { key: "interview", title: "Интервью" },
  { key: "offer", title: "Оффер" }, { key: "hire", title: "Найм" },
];
const csrfHeaders = (): HeadersInit => ({ "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" });

export function HrWorkspace({ pipelineOnly = false }: { pipelineOnly?: boolean }) {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const candidates = useQuery({ queryKey: ["hr-candidates"], queryFn: () => apiRequest<Candidate[]>("/api/v1/hr/candidates"), refetchOnMount: "always" });
  const pipeline = useQuery({ queryKey: ["hr-pipeline"], queryFn: () => apiRequest<Pipeline>("/api/v1/hr/pipeline"), refetchOnMount: "always" });
  const selected = selectedId ?? candidates.data?.[0]?.person_id ?? null;
  const portfolio = useQuery({ queryKey: ["hr-candidate", selected], queryFn: () => apiRequest<Portfolio>(`/api/v1/hr/candidates/${selected ?? ""}`), enabled: selected !== null });
  const record = useMutation({
    mutationFn: ({ candidateId, stage }: { candidateId: string; stage: Stage }) => apiRequest<PipelineEvent>(`/api/v1/hr/candidates/${candidateId}/pipeline-events`, { method: "POST", headers: csrfHeaders(), body: JSON.stringify({ stage, note: `Решение HR: ${stages.find((item) => item.key === stage)?.title ?? stage}` }) }),
    onSuccess: async () => client.invalidateQueries({ queryKey: ["hr-pipeline"] }),
  });
  const filtered = useMemo(() => (candidates.data ?? []).filter((item) => item.display_name.toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru"))), [candidates.data, search]);
  const selectedEvents = (pipeline.data?.events ?? []).filter((item) => item.candidate_id === selected);
  const nextStage = stages[selectedEvents.length];
  if (candidates.isLoading || pipeline.isLoading) return <StatePanel kind="loading" />;
  if (candidates.isError || pipeline.isError || !pipeline.data) return <StatePanel kind="error" action="Повторить" onAction={() => { void candidates.refetch(); void pipeline.refetch(); }} />;
  return <div className="feature-stack hr-workspace">
    <header className="dashboard-heading"><div><p className="eyebrow">HR · подтверждённый опыт</p><h1 id="workspace-title">{pipelineOnly ? "Кадровая воронка" : "Кандидаты и evidence-first резюме"}</h1><p className="lead">В поиске только участники с активным согласием. Рейтинг помогает найти профиль, но не создаёт приглашение, интервью, оффер или найм.</p></div><Badge tone="success">Только решения человека</Badge></header>
    <section className="metric-grid" aria-label="Стадии кадровой воронки">{stages.map((stage) => <article className={`metric-card metric-card--${stage.key === "offer" ? "violet" : "teal"}`} key={stage.key}><span className="metric-icon">◇</span><span>{stage.title}</span><strong>{pipeline.data.counts[stage.key]}</strong><small>human event</small></article>)}</section>
    {!pipelineOnly && <div className="hr-layout"><section className="candidate-search"><header><div><p className="eyebrow">Поиск</p><h2>Кандидаты с согласием</h2></div><Badge>{filtered.length}</Badge></header><label className="search-field"><span className="sr-only">Поиск кандидата</span><input type="search" value={search} placeholder="Имя кандидата…" onChange={(event) => { setSearch(event.target.value); }} /></label><div className="candidate-list">{filtered.map((item) => <button className={selected === item.person_id ? "active" : ""} type="button" key={item.person_id} onClick={() => { setSelectedId(item.person_id); }}><span className="candidate-avatar">{item.display_name.slice(0, 1)}</span><span><strong>{item.display_name}</strong><small>{item.accepted_projects} проектов · {item.verified_courses} курсов</small></span>{item.top_grade && <span className="grade-orb">{item.top_grade}</span>}</button>)}{filtered.length === 0 && <StatePanel kind="empty" />}</div></section>
      <section className="candidate-resume">{portfolio.isLoading ? <StatePanel kind="loading" /> : portfolio.data ? <><header><div><p className="eyebrow">Evidence-first резюме</p><h2>{portfolio.data.display_name}</h2></div>{nextStage && <button type="button" disabled={record.isPending} onClick={() => { record.mutate({ candidateId: portfolio.data.person_id, stage: nextStage.key }); }}>{nextStage.title} →</button>}</header><p className="human-note">Каждая кнопка фиксирует отдельное решение HR. AI не может нажать её или создать стадию через рекомендацию.</p><h3>Подтверждённые проекты</h3>{portfolio.data.contributions.length ? portfolio.data.contributions.map((item) => <article className="resume-evidence" key={item.contribution_id}><div><Badge tone="success">Вклад принят</Badge>{item.grade && <span className="grade-orb">{item.grade}</span>}</div><h4>{item.project_title}</h4><p>{item.personal_summary}</p>{item.review_reason && <blockquote>{item.review_reason}</blockquote>}<small>Артефакты: {item.artifact_keys.join(", ")}</small></article>) : <StatePanel kind="empty" />}</> : <StatePanel kind="empty" />}</section></div>}
    {pipelineOnly && <section className="pipeline-board"><div className="section-heading"><div><p className="eyebrow">История решений</p><h2>События воронки</h2></div><Badge>{pipeline.data.events.length}</Badge></div>{pipeline.data.events.length ? pipeline.data.events.slice().reverse().map((event) => <article className="pipeline-event" key={event.id}><span className="event-dot" /><div><strong>{event.candidate_name}</strong><small>{new Date(event.occurred_at).toLocaleString("ru-RU")}</small></div><Badge tone={event.stage === "offer" || event.stage === "hire" ? "success" : "neutral"}>{stages.find((item) => item.key === event.stage)?.title}</Badge><span className="human-origin">Человек</span></article>) : <StatePanel kind="empty" />}</section>}
  </div>;
}
