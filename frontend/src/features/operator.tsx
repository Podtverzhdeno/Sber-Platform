import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiRequest } from "../api/client";
import { Badge, StatePanel } from "../components/ui";

type Case = { id: string; case_type: string; title: string; priority: string; status: string; version: number; source_refs: string[]; dependency_refs: string[]; due_at: string | null };
type Decision = { id: string; case_version: number; outcome: string; reason: string; created_at: string };
const csrf = (): HeadersInit => ({ "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" });
const labels: Record<string, string> = { failed_payout: "Сбой выплаты", external_evidence: "Внешнее достижение", moderation: "Модерация брифа" };

export function OperatorWorkspace() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cases = useQuery({ queryKey: ["ops-cases"], queryFn: () => apiRequest<Case[]>("/api/v1/ops/cases"), refetchOnMount: "always" });
  const selected = selectedId ?? cases.data?.[0]?.id ?? null;
  const timeline = useQuery({ queryKey: ["ops-timeline", selected], queryFn: () => apiRequest<Decision[]>(`/api/v1/ops/cases/${selected ?? ""}/timeline`), enabled: selected !== null });
  const decision = useMutation({ mutationFn: (item: Case) => apiRequest<Case>(`/api/v1/ops/cases/${item.id}/decide`, { method: "POST", headers: csrf(), body: JSON.stringify({ expected_version: item.version, outcome: "resolved", reason: "Факты и зависимости проверены оператором." }) }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["ops-cases"] }); await queryClient.invalidateQueries({ queryKey: ["ops-timeline"] }); } });
  if (cases.isLoading) return <StatePanel kind="loading" />;
  if (cases.isError || !cases.data) return <StatePanel kind="error" action="Повторить" onAction={() => { void cases.refetch(); }} />;
  const current = cases.data.find((item) => item.id === selected);
  const metrics = [{ label: "Открыто", value: cases.data.filter((item) => item.status === "open").length }, { label: "Критических", value: cases.data.filter((item) => item.priority === "critical" && item.status === "open").length }, { label: "Решений", value: timeline.data?.length ?? 0 }];
  return <div className="feature-stack operator-workspace"><header className="dashboard-heading"><div><p className="eyebrow">Оператор · единая очередь</p><h1 id="workspace-title">Дела, источники и зависимости</h1><p className="lead">Модерация, поддержка, достижения, споры и сбои выплат собраны в одной очереди. AI может предложить приоритет, но решение принимает оператор.</p></div><Badge tone="success">Versioned decisions</Badge></header><section className="metric-grid ops-metrics">{metrics.map((item) => <article className="metric-card metric-card--teal" key={item.label}><span className="metric-icon">◉</span><span>{item.label}</span><strong>{item.value}</strong><small>текущая очередь</small></article>)}</section><div className="ops-layout"><section className="ops-queue"><div className="section-heading"><h2>Приоритетная очередь</h2><Badge>{cases.data.length}</Badge></div>{cases.data.map((item) => <button type="button" className={selected === item.id ? "active" : ""} key={item.id} onClick={() => { setSelectedId(item.id); }}><span className={`priority-dot priority-${item.priority}`} /><span><strong>{item.title}</strong><small>{labels[item.case_type] ?? item.case_type} · v{item.version}</small></span><Badge tone={item.status === "resolved" ? "success" : "warning"}>{item.status}</Badge></button>)}</section><section className="case-workspace">{current ? <><header><div><p className="eyebrow">Карточка дела · v{current.version}</p><h2>{current.title}</h2></div>{current.status !== "resolved" && <button type="button" disabled={decision.isPending} onClick={() => { decision.mutate(current); }}>Принять решение</button>}</header>{decision.isError && <StatePanel kind="stale" action="Обновить" onAction={() => { void cases.refetch(); }} />}<div className="case-facts"><div><h3>Источники</h3>{current.source_refs.map((ref) => <code key={ref}>{ref}</code>)}</div><div><h3>Зависимости</h3>{current.dependency_refs.length ? current.dependency_refs.map((ref) => <code key={ref}>{ref}</code>) : <span className="muted">Нет блокирующих зависимостей</span>}</div></div><h3>Таймлайн</h3>{timeline.data?.length ? timeline.data.map((item) => <article className="case-timeline" key={item.id}><span /><div><strong>{item.outcome}</strong><p>{item.reason}</p><small>Решение по версии {item.case_version} · {new Date(item.created_at).toLocaleString("ru-RU")}</small></div></article>) : <StatePanel kind="empty" />}</> : <StatePanel kind="empty" />}</section></div></div>;
}
