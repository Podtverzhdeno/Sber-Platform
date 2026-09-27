import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { apiRequest } from "../api/client";
import { Badge, Card, Modal, StatePanel, Tooltip } from "../components/ui";

type Task = { id: string; title: string; status: string; places: number };
type Compensation = { paid: boolean; base_amount_per_assignee: string | null; currency: string | null; b_multiplier: string; a_multiplier: string; b_total: string | null; a_total: string | null; quantum: string; rounding_mode: string; policy_version: number; payout_condition: string };
type Terms = { version: number; deadline_at: string; deliverable: string; acceptance_criteria: string[]; support_mode: string | null; compensation: Compensation };
type MarketplaceTask = { task: Task; terms: Terms; accepted_terms_version: number | null };
type Assignment = { id: string; task_id: string; person_id: string; status: string };
type Contribution = { id: string; version: number; personal_summary: string; artifact_keys: string[]; status: string };
type Decision = { id: string; contribution_id: string; decision: "accepted" | "revision_requested"; reason: string; deadline_at: string | null; owner_id: string | null };
type WorkItem = { assignment: Assignment; task: Task; terms: Terms; contributions: Contribution[]; decisions: Decision[] };
type Application = { id: string; status: string };

const csrfHeaders = (): HeadersInit => ({ "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" });
const statusLabel: Record<string, string> = {
  staffed: "Можно начинать",
  in_progress: "В работе",
  submitted: "На приёмке",
  revision_requested: "Нужна доработка",
  disputed: "Спор — оценка и начисление приостановлены",
  accepted: "Принято заказчиком",
  closed: "Принято",
};

function WorkStatus({ status }: { status: string }) {
  const tone = status === "closed" ? "success" : status === "revision_requested" || status === "disputed" ? "warning" : "neutral";
  return <Badge tone={tone}>{statusLabel[status] ?? status}</Badge>;
}

function formatDecimal(value: string) {
  const [integer = "0", fraction] = value.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return fraction ? `${grouped},${fraction}` : grouped;
}

function formatMoney(value: string, currency: string) {
  const symbol = currency === "RUB" ? "₽" : currency;
  return `${formatDecimal(value)} ${symbol}`;
}

export function CompensationDetails({ terms, expanded = false }: { terms: Compensation; expanded?: boolean }) {
  if (!terms.paid) return <Badge tone="neutral">Неоплачиваемая задача</Badge>;
  if (!terms.base_amount_per_assignee || !terms.currency || !terms.b_total || !terms.a_total) return <Badge tone="warning">Условия оплаты недоступны</Badge>;
  const base = formatMoney(terms.base_amount_per_assignee, terms.currency);
  const bTotal = formatMoney(terms.b_total, terms.currency);
  const aTotal = formatMoney(terms.a_total, terms.currency);
  const explanation = `База ${base}. B ×${formatDecimal(terms.b_multiplier)}: ${bTotal}. A ×${formatDecimal(terms.a_multiplier)}: ${aTotal}. Условие выплаты: ${terms.payout_condition}`;
  if (!expanded) return <><Badge tone="success">Оплачиваемая задача</Badge><Tooltip label={explanation}>База {base} · B {bTotal} · A {aTotal}</Tooltip></>;
  return <div className="payment-breakdown" aria-label="Расчёт вознаграждения"><dl><div><dt>Базовая сумма</dt><dd>{base}</dd></div><div><dt>Оценка B · ×{formatDecimal(terms.b_multiplier)}</dt><dd>{bTotal}</dd></div><div><dt>Оценка A · ×{formatDecimal(terms.a_multiplier)}</dt><dd>{aTotal}</dd></div></dl><p><strong>Когда начисляется:</strong> {terms.payout_condition}</p><small>Политика версии {terms.policy_version}; округление зафиксировано в условиях.</small></div>;
}

export function ParticipantTasks() {
  const client = useQueryClient();
  const catalog = useQuery({ queryKey: ["task-catalog"], queryFn: () => apiRequest<MarketplaceTask[]>("/api/v1/marketplace/tasks"), refetchOnMount: "always" });
  const work = useQuery({ queryKey: ["my-work"], queryFn: () => apiRequest<WorkItem[]>("/api/v1/me/work"), refetchOnMount: "always" });
  const [summary, setSummary] = useState("");
  const [artifactUrl, setArtifactUrl] = useState("");
  const [consentItem, setConsentItem] = useState<MarketplaceTask | null>(null);
  const acceptTerms = useMutation({ mutationFn: (item: MarketplaceTask) => apiRequest(`/api/v1/me/tasks/${item.task.id}/terms-consent`, { method: "POST", headers: csrfHeaders(), body: JSON.stringify({ terms_version: item.terms.version }) }), onSuccess: async () => client.invalidateQueries({ queryKey: ["task-catalog"] }) });
  const apply = useMutation({ mutationFn: (taskId: string) => apiRequest<Application>(`/api/v1/me/tasks/${taskId}/applications`, { method: "POST", headers: csrfHeaders() }), onSuccess: async () => Promise.all([client.invalidateQueries({ queryKey: ["task-catalog"] }), client.invalidateQueries({ queryKey: ["my-work"] })]) });
  const start = useMutation({ mutationFn: (assignmentId: string) => apiRequest(`/api/v1/me/assignments/${assignmentId}/start`, { method: "POST", headers: csrfHeaders() }), onSuccess: async () => client.invalidateQueries({ queryKey: ["my-work"] }) });
  const contribute = useMutation({ mutationFn: (assignmentId: string) => apiRequest(`/api/v1/me/assignments/${assignmentId}/contributions`, { method: "POST", headers: csrfHeaders(), body: JSON.stringify({ personal_summary: summary, artifacts: artifactUrl ? [{ key: "personal-proof", uri: artifactUrl }] : [] }) }), onSuccess: async () => { setSummary(""); setArtifactUrl(""); await client.invalidateQueries({ queryKey: ["my-work"] }); } });

  if (catalog.isLoading || work.isLoading) return <StatePanel kind="loading" />;
  if (!catalog.data || !work.data || catalog.isError || work.isError) return <StatePanel kind="error" action="Повторить" onAction={() => { void catalog.refetch(); void work.refetch(); }} />;
  return <div className="feature-stack">
    <section><p className="eyebrow">Реальные R&amp;D и MVP</p><h1 id="workspace-title">Задачи с понятным результатом</h1><p className="lead">До отклика видны результат, критерии и срок. В «Моей работе» отдельно сохраняются командный результат и ваш личный вклад.</p></section>
    <section aria-labelledby="catalog-title"><h2 id="catalog-title">Доступные задачи</h2><div className="work-grid">{catalog.data.map((item) => <Card key={item.task.id} title={item.task.title}>
      <div className="work-meta"><CompensationDetails terms={item.terms.compensation} /><span>До {new Date(item.terms.deadline_at).toLocaleDateString("ru-RU")}</span></div>
      <p>{item.terms.deliverable}</p><ul>{item.terms.acceptance_criteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
      {item.accepted_terms_version === item.terms.version ? <button type="button" onClick={() => { apply.mutate(item.task.id); }}>Откликнуться</button> : <button type="button" onClick={() => { setConsentItem(item); }}>Открыть условия версии {item.terms.version}</button>}
    </Card>)}</div></section>
    <section aria-labelledby="my-work-title"><h2 id="my-work-title">Моя работа</h2>{work.data.length === 0 ? <StatePanel kind="empty" /> : <div className="work-grid">{work.data.map((item) => {
      const latest = item.contributions.at(-1); const decision = latest ? item.decisions.find((entry) => entry.contribution_id === latest.id) : undefined;
      return <Card key={item.assignment.id} title={item.task.title}><div className="work-meta"><WorkStatus status={item.assignment.status} /><CompensationDetails terms={item.terms.compensation} /></div>
        {decision?.decision === "revision_requested" && <div className="revision-note" role="status"><strong>Что доработать</strong><p>{decision.reason}</p><small>Срок: {decision.deadline_at ? new Date(decision.deadline_at).toLocaleString("ru-RU") : "не указан"}</small></div>}
        {latest && <div className="contribution-summary"><strong>Личный вклад · версия {latest.version}</strong><p>{latest.personal_summary}</p><WorkStatus status={latest.status} /></div>}
        {(item.assignment.status === "staffed" || item.assignment.status === "revision_requested") && <button type="button" onClick={() => { start.mutate(item.assignment.id); }}>{item.assignment.status === "revision_requested" ? "Начать доработку" : "Начать работу"}</button>}
        {item.assignment.status === "in_progress" && <form className="contribution-form" onSubmit={(event) => { event.preventDefault(); contribute.mutate(item.assignment.id); }}><label>Что сделали лично<textarea required minLength={20} value={summary} onChange={(event) => { setSummary(event.target.value); }} /></label><label>Ссылка на доказательство<input type="url" value={artifactUrl} onChange={(event) => { setArtifactUrl(event.target.value); }} placeholder="https://…" /></label><button type="submit">Отправить личный вклад</button></form>}
      </Card>;
    })}</div>}</section>
    <Modal title={`Условия задачи · версия ${String(consentItem?.terms.version ?? "")}`} open={consentItem !== null} onClose={() => { setConsentItem(null); }}>
      {consentItem && <><p>{consentItem.terms.deliverable}</p><CompensationDetails terms={consentItem.terms.compensation} expanded /><div className="modal-actions"><button type="button" onClick={() => { acceptTerms.mutate(consentItem, { onSuccess: () => { setConsentItem(null); } }); }}>Подтвердить условия и продолжить</button><button className="secondary-button" type="button" onClick={() => { setConsentItem(null); }}>Отмена</button></div></>}
    </Modal>
  </div>;
}

export function CustomerParticipantPreview() {
  const client = useQueryClient();
  const tasks = useQuery({ queryKey: ["customer-tasks"], queryFn: () => apiRequest<Task[]>("/api/v1/customer/tasks") });
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [reason, setReason] = useState("Нужно уточнить результат и приложить воспроизводимые доказательства.");
  const activeTask = selectedTask ?? tasks.data?.[0]?.id ?? null;
  const preview = useQuery({ queryKey: ["participant-preview", activeTask], enabled: activeTask !== null, queryFn: () => apiRequest<WorkItem[]>(`/api/v1/customer/tasks/${activeTask ?? ""}/participant-preview`), refetchOnMount: "always" });
  const decide = useMutation({ mutationFn: ({ contributionId, decision }: { contributionId: string; decision: "accepted" | "revision_requested" }) => apiRequest(`/api/v1/customer/contributions/${contributionId}/decision`, { method: "POST", headers: csrfHeaders(), body: JSON.stringify({ decision, reason, deadline_at: decision === "revision_requested" ? "2026-11-10T18:00:00Z" : null }) }), onSuccess: async () => client.invalidateQueries({ queryKey: ["participant-preview", activeTask] }) });
  const taskOptions = useMemo(() => tasks.data ?? [], [tasks.data]);
  if (tasks.isLoading) return <StatePanel kind="loading" />;
  if (!tasks.data || tasks.isError) return <StatePanel kind="error" action="Повторить" onAction={() => void tasks.refetch()} />;
  return <div className="feature-stack"><section><p className="eyebrow">Заказчик · preview участника</p><h1 id="workspace-title">Принимайте результат по фактам</h1><p className="lead">Видны версия личного вклада и доказательства. Решение относится к конкретной сдаче и не назначает оценку 5+ автоматически.</p></section>
    <label className="catalog-filter">Задача<select value={activeTask ?? ""} onChange={(event) => { setSelectedTask(event.target.value); }}>{taskOptions.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
    {preview.isLoading ? <StatePanel kind="loading" /> : preview.data?.length ? <div className="work-grid">{preview.data.map((item) => { const latest = item.contributions.at(-1); return <Card key={item.assignment.id} title={`Участник ${item.assignment.person_id.slice(0, 8)}`}><div className="work-meta"><WorkStatus status={item.assignment.status} /><span>{item.task.title}</span></div>{latest ? <><p><strong>Личный вклад · версия {latest.version}</strong></p><p>{latest.personal_summary}</p><p className="muted">Доказательства: {latest.artifact_keys.join(", ") || "не приложены"}</p>{latest.status === "submitted" && <><label className="decision-reason">Причина решения<textarea value={reason} onChange={(event) => { setReason(event.target.value); }} /></label><div className="course-actions"><button type="button" onClick={() => { decide.mutate({ contributionId: latest.id, decision: "accepted" }); }}>Принять результат</button><button className="secondary-button" type="button" onClick={() => { decide.mutate({ contributionId: latest.id, decision: "revision_requested" }); }}>Вернуть на доработку</button></div></>}</> : <p className="muted">Личный вклад ещё не отправлен.</p>}</Card>; })}</div> : <StatePanel kind="empty" />}
  </div>;
}
