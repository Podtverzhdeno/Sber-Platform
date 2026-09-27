import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "../api/client";
import { Badge, StatePanel } from "../components/ui";

type Result = { contribution_id: string; task_id: string; task_title: string; personal_summary: string; artifact_keys: string[]; reused: boolean };
type Initiative = { project_key: string; task_id: string; task_title: string; status: string; deadline_at: string | null; accepted_results: Result[] };
type Overview = { initiatives: Initiative[]; task_count: number; accepted_result_count: number; reused_result_count: number };

export function ManagerWorkspace() {
  const query = useQuery({ queryKey: ["manager-overview"], queryFn: () => apiRequest<Overview>("/api/v1/manager/overview"), refetchOnMount: "always" });
  if (query.isLoading) return <StatePanel kind="loading" />;
  if (query.isError || !query.data) return <StatePanel kind="error" action="Повторить" onAction={() => { void query.refetch(); }} />;
  const data = query.data;
  const metrics: [string, string | number, string][] = [
    ["Инициативы", data.task_count, "blue"], ["Принятые результаты", data.accepted_result_count, "teal"], ["Использовано повторно", data.reused_result_count, "violet"], ["Reuse rate", data.accepted_result_count ? `${String(Math.round(data.reused_result_count / data.accepted_result_count * 100))}%` : "—", "teal"],
  ];
  return <div className="feature-stack manager-workspace"><header><p className="eyebrow">Руководитель · портфель инициатив</p><h1 id="workspace-title">Результаты команд без лишних персональных данных</h1><p className="lead">Здесь видны сроки, принятые артефакты и повторное использование. Чаты, закрытые комментарии ментора и выплаты участников недоступны.</p></header><section className="metric-grid" aria-label="Сводка инициатив">{metrics.map(([label, value, tone]) => <article className={`metric-card metric-card--${tone}`} key={label}><span className="metric-icon">◇</span><span>{label}</span><strong>{value}</strong><small>Только безопасный агрегат</small></article>)}</section><section className="initiative-list" aria-labelledby="initiatives-title"><div className="section-heading"><div><p className="eyebrow">Контроль сроков</p><h2 id="initiatives-title">Инициативы и результаты</h2></div><a href="/workspace/2">Открыть аналитику →</a></div>{data.initiatives.length ? data.initiatives.map((item) => <article className="initiative-card" key={item.task_id}><header><div><span>{item.project_key}</span><h3>{item.task_title}</h3></div><Badge tone={item.status === "accepted" ? "success" : "neutral"}>{item.status}</Badge></header><p className="muted">Дедлайн: {item.deadline_at ? new Date(item.deadline_at).toLocaleString("ru-RU") : "не указан"}</p>{item.accepted_results.length ? <div className="accepted-results">{item.accepted_results.map((result) => <article key={result.contribution_id}><div><strong>Принятый артефакт</strong>{result.reused && <Badge tone="success">Использован повторно</Badge>}</div><p>{result.personal_summary}</p><small>Артефакты: {result.artifact_keys.join(", ") || "зафиксированы в задаче"}</small></article>)}</div> : <p className="manager-empty">Принятых результатов пока нет. Рабочие переписки и незавершённые ревью здесь не показываются.</p>}</article>) : <StatePanel kind="empty" />}</section></div>;
}
