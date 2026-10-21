import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { FC } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { apiRequest, ApiClientError } from "../api/client";
import { Badge, Card, Modal, StatePanel } from "../components/ui";
import { TaskWorkspacePage, type TeamQuickCard } from "../components/task-workspace-page";

type Task = { id: string; title: string; status: string; places: number; mode?: "open" | "invitation_only" };
type Compensation = { paid: boolean; base_amount_per_assignee: string | null; currency: string | null; b_multiplier: string; a_multiplier: string; b_total: string | null; a_total: string | null; quantum: string; rounding_mode: string; policy_version: number; payout_condition: string };
type Terms = { version: number; deadline_at: string; deliverable: string; acceptance_criteria: string[]; support_mode: string | null; compensation: Compensation };
type MarketplaceTask = { task: Task; terms: Terms; accepted_terms_version: number | null; invitation_status?: "pending" | "accepted" | null };
type Assignment = { id: string; task_id: string; person_id: string; status: string };
type Contribution = { id: string; version: number; personal_summary: string; artifact_keys: string[]; status: string };
type Decision = { id: string; contribution_id: string; decision: "accepted" | "revision_requested"; reason: string; deadline_at: string | null; owner_id: string | null };
type WorkItem = { assignment: Assignment; task: Task; terms: Terms; allowed_artifacts?: string[]; contributions: Contribution[]; decisions: Decision[] };
type Application = { id: string; status: string };
type PartnerView = { id: string; display_name: string };
type CheckpointRecord = { key: string; title: string; status: string };
type ContributionRecord = { id: string; assignment_id: string; version: number; personal_summary: string; artifact_keys: string[]; status: string };
type FeedbackRecord = { contribution_id: string; contribution_version: number; review_version: number; grade: string; explanation: string; status: string };
type TermsHistoryEntry = { version: number; deadline_at: string; deliverable: string };
type DeadlineRequest = { id: string; task_id: string; base_terms_version: number; proposed_deadline_at: string; reason: string; impact: string; status: string; decision_comment: string | null; decided_at: string | null; created_at: string | null };
type ProjectLayout = "cards" | "list";
type ProjectFilter = "all" | "in_progress" | "submitted" | "done";
type TaskDetail = {
  task: Task;
  problem: string;
  deliverable: string;
  acceptance_criteria: string[];
  deadline_at: string | null;
  data_constraints: string;
  ip_terms: string;
  terms: Terms;
  terms_history: TermsHistoryEntry[];
  accepted_terms_version: number | null;
  invitation_status: string | null;
  customer: PartnerView;
  mentor: PartnerView | null;
  support: { mode: string; assignee: PartnerView } | null;
  team: { person_id: string; display_name: string; status: string }[];
  membership: Assignment | null;
  checkpoints: CheckpointRecord[];
  personal: ContributionRecord[];
  feedback: FeedbackRecord[];
  applications: { id: string; status: string }[];
};

const csrfHeaders = (): HeadersInit => ({ "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" });
const statusLabel: Record<string, string> = {
  staffed: "Можно начинать",
  in_progress: "В работе",
  submitted: "На приёмке",
  revision_requested: "Нужна доработка",
  disputed: "Спор — оценка приостановлена",
  accepted: "Принято заказчиком",
  closed: "Принято",
};

function withdrawErrorText(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "ACCEPTED_WITHDRAW_FORBIDDEN") return "Заявка уже принята — отзыв недоступен. Продолжайте работу в рабочей области.";
    if (error.code === "INVALID_APPLICATION_TRANSITION") return "Заявку уже нельзя отозвать — решение по заявке изменилось без вас.";
    if (error.code === "STALE_APPLICATION") return "Заявка изменилась впервые за отзыв — обновите список задач и повторите.";
    if (error.status === 404) return "Заявка не найдена — обновите список задач.";
  }
  return "Не удалось отозвать заявку. Проверьте соединение и повторите.";
}

function deadlineErrorText(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "DEADLINE_CHANGE_PENDING") return "Уже есть активный запрос на перенос срока — дождитесь решения заказчика.";
    if (error.code === "STALE_DEADLINE_CHANGE") return "Предыдущий запрос устарел — срок уже обновлён. Отправьте перенос для новых условий.";
    if (error.code === "DEADLINE_CHANGE_CONCURRENT") return "Срок только что изменили — обновите запрос к актуальным условиям.";
    if (error.code === "TASK_TERMS_REQUIRED") return "Сначала подтвердите условия задачи.";
    if (error.code === "INVALID_DEADLINE_CHANGE_TRANSITION") return "Запрос нельзя изменить — статус уже обновлён.";
  }
  return "Не удалось отправить запрос на перенос срока. Проверьте поля и повторите.";
}

const deadlineStatusLabel: Record<string, string> = {
  pending: "Ожидает решения заказчика",
  approved: "Срок обновлён",
  rejected: "Отклонено заказчиком",
  stale: "Запрос устарел",
};

const proposableStatuses = new Set(["staffed", "in_progress", "revision_requested"]);
const activeProjectStatuses = ["staffed", "in_progress", "revision_requested"] as const;
const submittedProjectStatuses = ["submitted", "disputed"] as const;
const doneProjectStatuses = ["accepted", "closed"] as const;
const projectFilterRows: { key: ProjectFilter; label: string; statuses: string[] }[] = [
  { key: "all", label: "Все", statuses: [] },
  { key: "in_progress", label: "В работе", statuses: [...activeProjectStatuses] },
  { key: "submitted", label: "На приёмке", statuses: [...submittedProjectStatuses] },
  { key: "done", label: "Принято", statuses: [...doneProjectStatuses] },
];

function WorkStatus({ status }: { status: string }) {
  const tone = status === "closed" ? "success" : status === "revision_requested" || status === "disputed" ? "warning" : "neutral";
  return <Badge tone={tone}>{statusLabel[status] ?? status}</Badge>;
}

export const CompensationDetails: FC<{ terms: Compensation; expanded?: boolean }> = () => null;

export function ParticipantTasks({ view = "catalog" }: { view?: "catalog" | "projects" }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const catalog = useQuery({ queryKey: ["task-catalog"], queryFn: () => apiRequest<MarketplaceTask[]>("/api/v1/marketplace/tasks"), refetchOnMount: "always" });
  const work = useQuery({ queryKey: ["my-work"], queryFn: () => apiRequest<WorkItem[]>("/api/v1/me/work"), refetchOnMount: "always" });
  const [searchParams, setSearchParams] = useSearchParams();
  const detailMode = searchParams.get("detail") === "1";
  const layoutParam = searchParams.get("layout");
  const projectLayout: ProjectLayout = layoutParam === "list" ? "list" : "cards";
  const filterParam = searchParams.get("filter");
  const projectFilter: ProjectFilter = filterParam === "in_progress" || filterParam === "submitted" || filterParam === "done" ? filterParam : "all";
  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next);
  };
  const [summary, setSummary] = useState("");
  const [artifactUrl, setArtifactUrl] = useState("");
  const [consentItem, setConsentItem] = useState<MarketplaceTask | null>(null);
  const [taskPreview, setTaskPreview] = useState<{ taskId: string; assignmentId: string | null; title: string } | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<string | null>(null);
  const [withdrawNotice, setWithdrawNotice] = useState<string | null>(null);
  const [deadlineSummary, setDeadlineSummary] = useState("");
  const [deadlineImpact, setDeadlineImpact] = useState("");
  const [deadlineAt, setDeadlineAt] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(() => { const fromUrl = searchParams.get("project"); if (fromUrl !== null) return fromUrl; const assignmentId = sessionStorage.getItem("impulse_open_assignment"); sessionStorage.removeItem("impulse_open_assignment"); return assignmentId; });
  const [selectedTeamMember, setSelectedTeamMember] = useState<string | null>(null);
  const [applicationNotice, setApplicationNotice] = useState<string | null>(null);
  const [catalogView, setCatalogView] = useState<"cards" | "list">(() => localStorage.getItem("impulse_task_catalog_view") === "list" ? "list" : "cards");
  const [taskCategory, setTaskCategory] = useState<"Все" | "Аналитика" | "ML / AI" | "Разработка">("Все");
  const [appliedTaskIds, setAppliedTaskIds] = useState<string[]>(() => {
    try { return JSON.parse(sessionStorage.getItem("impulse_applied_tasks") ?? "[]") as string[]; } catch { return []; }
  });
  const acceptTerms = useMutation({ mutationFn: (item: MarketplaceTask) => apiRequest(`/api/v1/me/tasks/${item.task.id}/terms-consent`, { method: "POST", headers: csrfHeaders(), body: JSON.stringify({ terms_version: item.terms.version }) }), onSuccess: async () => { setConsentItem(null); await client.invalidateQueries({ queryKey: ["task-catalog"] }); } });
  const decideInvitation = useMutation({ mutationFn: ({ taskId, accepted }: { taskId: string; accepted: boolean }) => apiRequest(`/api/v1/me/tasks/${taskId}/invitation`, { method: "POST", headers: csrfHeaders(), body: JSON.stringify({ accepted }) }), onSuccess: async () => client.invalidateQueries({ queryKey: ["task-catalog"] }) });
  const apply = useMutation({ mutationFn: (taskId: string) => apiRequest<Application>(`/api/v1/me/tasks/${taskId}/applications`, { method: "POST", headers: csrfHeaders() }), onSuccess: async (_application, taskId) => { const next = Array.from(new Set([...appliedTaskIds, taskId])); setAppliedTaskIds(next); sessionStorage.setItem("impulse_applied_tasks", JSON.stringify(next)); setApplicationNotice(taskId); await Promise.all([client.invalidateQueries({ queryKey: ["task-catalog"] }), client.invalidateQueries({ queryKey: ["my-work"] })]); } });
  const start = useMutation({ mutationFn: (assignmentId: string) => apiRequest(`/api/v1/me/assignments/${assignmentId}/start`, { method: "POST", headers: csrfHeaders() }), onSuccess: async () => client.invalidateQueries({ queryKey: ["my-work"] }) });
  const contribute = useMutation({ mutationFn: (assignmentId: string) => apiRequest(`/api/v1/me/assignments/${assignmentId}/contributions`, { method: "POST", headers: csrfHeaders(), body: JSON.stringify({ personal_summary: summary, artifacts: artifactUrl ? [{ key: "personal-proof", uri: artifactUrl }] : [] }) }), onSuccess: async () => { setSummary(""); setArtifactUrl(""); await client.invalidateQueries({ queryKey: ["my-work"] }); } });
  const withdraw = useMutation({
    mutationFn: async (taskId: string) => {
      const detail = await client.query({
        queryKey: ["task-detail", taskId],
        queryFn: () => apiRequest<TaskDetail>(`/api/v1/me/tasks/${taskId}`),
        staleTime: 0,
      });
      const mine = detail.applications.find((item) => item.status === "applied") ?? detail.applications[0];
      if (!mine) {
        throw new ApiClientError(409, "STALE_APPLICATION", "Заявка изменилась впервые за отзыв.", false);
      }
      return apiRequest<Application>(`/api/v1/me/applications/${mine.id}/withdraw`, { method: "POST", headers: csrfHeaders() });
    },
    onSuccess: async (_result, taskId) => {
      const next = appliedTaskIds.filter((id) => id !== taskId);
      setAppliedTaskIds(next);
      sessionStorage.setItem("impulse_applied_tasks", JSON.stringify(next));
      setWithdrawTarget(null);
      setApplicationNotice(null);
      setWithdrawNotice(taskId);
      await Promise.all([client.invalidateQueries({ queryKey: ["task-catalog"] }), client.invalidateQueries({ queryKey: ["my-work"] })]);
    },
  });
  const deadlineRequests = useQuery({
    queryKey: ["deadline-requests", selectedAssignment],
    queryFn: () => apiRequest<DeadlineRequest[]>(`/api/v1/me/assignments/${selectedAssignment ?? ""}/deadline-requests`),
    enabled: view === "projects" && detailMode && selectedAssignment !== null && work.data !== undefined,
  });
  const proposeDeadline = useMutation({
    mutationFn: (assignmentId: string) => apiRequest<DeadlineRequest>(`/api/v1/me/assignments/${assignmentId}/deadline-requests`, { method: "POST", headers: csrfHeaders(), body: JSON.stringify({ base_terms_version: selectedWork?.terms.version ?? 1, proposed_deadline_at: new Date(deadlineAt).toISOString(), reason: deadlineSummary, impact: deadlineImpact }) }),
    onSuccess: async () => {
      setDeadlineSummary("");
      setDeadlineImpact("");
      await client.invalidateQueries({ queryKey: ["deadline-requests"] });
    },
  });
  const taskDetail = useQuery({
    queryKey: ["task-detail", taskPreview?.taskId],
    queryFn: () => apiRequest<TaskDetail>(`/api/v1/me/tasks/${taskPreview?.taskId ?? ""}`),
    enabled: taskPreview !== null,
  });
  const selectedWorkForWorkspace = work.data?.find((item) => item.assignment.id === selectedAssignment);
  const workspaceDetail = useQuery({
    queryKey: ["workspace-task-detail", selectedWorkForWorkspace?.task.id],
    queryFn: () => apiRequest<TaskDetail>(`/api/v1/me/tasks/${selectedWorkForWorkspace?.task.id ?? ""}`),
    enabled: view === "projects" && !detailMode && selectedWorkForWorkspace !== undefined,
  });
  const teamQuickCard = useQuery({
    queryKey: ["workspace-team-quick-card", selectedWorkForWorkspace?.task.id, selectedTeamMember],
    queryFn: () => apiRequest<TeamQuickCard>(`/api/v1/me/tasks/${selectedWorkForWorkspace?.task.id ?? ""}/team/${selectedTeamMember ?? ""}/quick-card`),
    enabled: selectedWorkForWorkspace !== undefined && selectedTeamMember !== null,
    retry: false,
  });

  if (catalog.isLoading || work.isLoading) return <StatePanel kind="loading" />;
  if (!catalog.data || !work.data || catalog.isError || work.isError) return <StatePanel kind="error" action="Повторить" onAction={() => { void catalog.refetch(); void work.refetch(); }} />;
  const selectedWork = view === "projects" ? selectedWorkForWorkspace : undefined;
  if (selectedWork && !detailMode) {
    return <TaskWorkspacePage mode="participant" title={selectedWork.task.title} taskId={selectedWork.task.id} projectId={selectedWork.task.id} description={selectedWork.terms.deliverable} deadline={new Date(selectedWork.terms.deadline_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} tags={["AI / ML", "Python", "RAG", "Backend"]} workspace={workspaceDetail.data ? { team: workspaceDetail.data.team, checkpoints: workspaceDetail.data.checkpoints, contributions: workspaceDetail.data.personal, feedback: workspaceDetail.data.feedback, freshness: `условия версии ${String(workspaceDetail.data.terms.version)}` } : undefined} quickCard={teamQuickCard.data ?? null} quickCardLoading={teamQuickCard.isLoading && selectedTeamMember !== null} quickCardError={teamQuickCard.isError} onSelectMember={(personId) => { setSelectedTeamMember(personId); }} onCloseQuickCard={() => { setSelectedTeamMember(null); }} onOpenProfile={(personId) => { void navigate(`/workspace/7?participant=${encodeURIComponent(personId)}&project=${encodeURIComponent(selectedWork.task.id)}&return=${encodeURIComponent(`/workspace/4?project=${selectedWork.assignment.id}`)}`); }} onOpenDirectMessage={(personId) => { void navigate(`/workspace/10?participant=${encodeURIComponent(personId)}&task=${encodeURIComponent(selectedWork.task.id)}`); }} onMessage={() => { void navigate(`/workspace/10?task=${encodeURIComponent(selectedWork.task.id)}`); }} onPrimaryAction={() => { setSummary("Новая версия результата готова к отправке"); setArtifactUrl("https://github.com/impulse/project/releases/latest"); }} />;
  }
    const pendingItems = catalog.data.filter((item) => appliedTaskIds.includes(item.task.id));
  const categoryOrder = ["ML / AI", "Аналитика", "Разработка"] as const;
  const categorizedCatalog = catalog.data.map((item, index) => ({ item, category: categoryOrder[index % categoryOrder.length], originalIndex: index }));
  const visibleCatalog = categorizedCatalog.filter(({ category }) => taskCategory === "Все" || category === taskCategory);
  const projectItems = work.data.filter((item) => {
    if (projectFilter === "all") return true;
    const row = projectFilterRows.find((candidate) => candidate.key === projectFilter);
    return row !== undefined && row.statuses.includes(item.assignment.status);
  });
  return <div className={`feature-stack participant-work participant-work--${view}`} data-reference={view === "catalog" ? "R-PAR-04" : "R-PAR-06"}>
    <header className="participant-page-heading"><div><p className="eyebrow">{view === "catalog" ? "Реальные R&D и MVP" : "Практика и личный вклад"}</p><h1 id="workspace-title">{view === "catalog" ? "Задачи для вашего развития" : "Мои проекты"}</h1><p className="lead">{view === "catalog" ? "Выберите задачу под траекторию, заранее изучите результат, критерии и формат поддержки." : "Работайте с командой, фиксируйте личный вклад и получайте предметную обратную связь."}</p></div>{view === "catalog" && <Badge tone="success">{catalog.data.length} задач доступно</Badge>}</header>
    {view === "catalog" && applicationNotice && <div className="success-banner" role="status"><span>✓</span><div><strong>Вы успешно откликнулись</strong><small>Задача добавлена в «Мои задачи» со статусом «Заявка отправлена».</small></div><button type="button" onClick={() => { document.getElementById("my-applications")?.scrollIntoView({ behavior: "smooth" }); }}>Открыть мои задачи</button></div>}
    {view === "catalog" && withdrawNotice && <div className="success-banner" role="status"><span>✓</span><div><strong>Заявка отозвана</strong><small>Повторный отклик доступен, пока заказчик не выбрал исполнителей.</small></div><button type="button" onClick={() => { setWithdrawNotice(null); }}>Понятно</button></div>}
    {view === "catalog" && <section className="task-marketplace" aria-labelledby="catalog-title">
      <div className="section-heading marketplace-heading"><div><p className="eyebrow">Витрина</p><h2 id="catalog-title">Рекомендуемые задачи</h2></div><div className="marketplace-toolbar"><div className="task-filter-row" role="group" aria-label="Категория задач">{(["Все", "Аналитика", "ML / AI", "Разработка"] as const).map((category) => <button className={taskCategory === category ? "active" : ""} type="button" aria-pressed={taskCategory === category} key={category} onClick={() => { setTaskCategory(category); }}>{category}</button>)}</div><div className="catalog-view-toggle" role="group" aria-label="Способ отображения"><button className={catalogView === "cards" ? "active" : ""} type="button" aria-pressed={catalogView === "cards"} onClick={() => { setCatalogView("cards"); localStorage.setItem("impulse_task_catalog_view", "cards"); }}><span aria-hidden="true">▦</span> Карточки</button><button className={catalogView === "list" ? "active" : ""} type="button" aria-pressed={catalogView === "list"} onClick={() => { setCatalogView("list"); localStorage.setItem("impulse_task_catalog_view", "list"); }}><span aria-hidden="true">☷</span> Список</button></div></div></div>
      {visibleCatalog.length === 0 ? <div className="empty-application"><strong>В этой категории пока нет задач</strong><p>Выберите другую категорию или вернитесь позже.</p></div> : catalogView === "cards" ? <div className="work-grid">{visibleCatalog.map(({ item, category }) => <Card key={item.task.id} title={item.task.title}><Badge>{category}</Badge><div className="work-meta"><span>До {new Date(item.terms.deadline_at).toLocaleDateString("ru-RU")}</span></div><p>{item.terms.deliverable}</p><ul>{item.terms.acceptance_criteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>{appliedTaskIds.includes(item.task.id) ? <button className="application-sent" type="button" onClick={() => { setApplicationNotice(item.task.id); }}>✓ Заявка отправлена</button> : item.invitation_status === "pending" ? <div><button type="button" disabled={decideInvitation.isPending} onClick={() => { decideInvitation.mutate({ taskId: item.task.id, accepted: true }); }}>Принять приглашение</button><button type="button" className="secondary-button" disabled={decideInvitation.isPending} onClick={() => { decideInvitation.mutate({ taskId: item.task.id, accepted: false }); }}>Отказаться</button></div> : item.accepted_terms_version === item.terms.version ? <button type="button" disabled={apply.isPending} onClick={() => { apply.mutate(item.task.id); }}>{apply.isPending ? "Отправляем…" : "Откликнуться"}</button> : <button type="button" onClick={() => { setConsentItem(item); }}>Открыть условия версии {item.terms.version}</button>}{apply.isError && apply.variables === item.task.id && <p className="error-message" role="alert">Не удалось отправить отклик. Проверьте соединение и повторите.</p>}</Card>)}</div> : <div className="participant-task-list" role="list">{visibleCatalog.map(({ item, category, originalIndex }) => <article className="participant-task-row" role="listitem" key={item.task.id}><span className={`task-kind-icon task-kind-icon--${String(originalIndex % 3)}`} aria-hidden="true">{category === "ML / AI" ? "⌁" : category === "Аналитика" ? "◫" : "◇"}</span><div className="task-list-main"><div><Badge>{category}</Badge><small>Совпадение {92 - originalIndex * 4}%</small></div><strong>{item.task.title}</strong><p>{item.terms.deliverable}</p></div><div className="task-list-deadline"><small>Дедлайн</small><strong>{new Date(item.terms.deadline_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</strong></div><div className="task-list-action">{appliedTaskIds.includes(item.task.id) ? <button className="application-sent" type="button" onClick={() => { setApplicationNotice(item.task.id); }}>✓ Отправлено</button> : item.invitation_status === "pending" ? <div><button type="button" disabled={decideInvitation.isPending} onClick={() => { decideInvitation.mutate({ taskId: item.task.id, accepted: true }); }}>Принять приглашение</button><button type="button" className="secondary-button" disabled={decideInvitation.isPending} onClick={() => { decideInvitation.mutate({ taskId: item.task.id, accepted: false }); }}>Отказаться</button></div> : item.accepted_terms_version === item.terms.version ? <button type="button" disabled={apply.isPending} onClick={() => { apply.mutate(item.task.id); }}>{apply.isPending ? "Отправляем…" : "Откликнуться"}</button> : <button type="button" onClick={() => { setConsentItem(item); }}>Условия →</button>}</div></article>)}</div>}
    </section>}
    {view === "catalog" && <section id="my-applications" className="my-applications" aria-labelledby="my-applications-title"><div className="section-heading"><div><p className="eyebrow">Заявки и принятые задачи</p><h2 id="my-applications-title">Мои задачи</h2></div><Badge>{pendingItems.length + work.data.length}</Badge></div>{pendingItems.length === 0 && work.data.length === 0 ? <div className="empty-application"><strong>Пока нет отправленных заявок</strong><p>Откликнитесь на подходящую задачу — она сразу появится здесь.</p></div> : <>{work.data.map((item) => <article className="my-task-row my-task-row--active" key={item.assignment.id}><span className="activity-symbol">▤</span><div><strong>{item.task.title}</strong><small>Проект сформирован · рабочая область доступна</small></div><Badge tone="success">В работе</Badge><button type="button" onClick={() => { setTaskPreview({ taskId: item.task.id, assignmentId: item.assignment.id, title: item.task.title }); }}>Открыть карточку</button></article>)}{pendingItems.map((item) => <article className="my-task-row" key={item.task.id}><span className="activity-symbol">▤</span><div><strong>{item.task.title}</strong><small>Заявка отправлена · условия версии {item.terms.version}</small></div><div className="my-task-controls"><Badge tone="warning">Ожидает решения</Badge><button className="secondary-button" type="button" disabled={withdraw.isPending} onClick={() => { setWithdrawTarget(item.task.id); }}>Отозвать заявку</button></div><button type="button" onClick={() => { setTaskPreview({ taskId: item.task.id, assignmentId: null, title: item.task.title }); }}>Открыть карточку</button>{withdraw.isError && withdraw.variables === item.task.id && <p className="error-message" role="alert">{withdrawErrorText(withdraw.error)}</p>}</article>)}</>}</section>}
    {view === "projects" && <section aria-labelledby="my-work-title"><div className="section-heading"><div><p className="eyebrow">Принятые назначения</p><h2 id="my-work-title">Проекты в работе</h2></div><div className="marketplace-toolbar">{selectedWork ? <button className="secondary-button" type="button" aria-label="Вернуться к списку проектов" onClick={() => { setSelectedAssignment(null); updateParams({ project: null, detail: null }); }}>← К списку проектов</button> : <><div className="task-filter-row" role="group" aria-label="Статус проектов">{projectFilterRows.map((row) => <button className={projectFilter === row.key ? "active" : ""} type="button" aria-pressed={projectFilter === row.key} key={row.key} onClick={() => { const next = new URLSearchParams(searchParams); if (row.key === "all") next.delete("filter"); else next.set("filter", row.key); setSearchParams(next); }}>{row.label}</button>)}</div><div className="catalog-view-toggle" role="group" aria-label="Вид проектов"><button className={projectLayout === "cards" ? "active" : ""} type="button" aria-pressed={projectLayout === "cards"} onClick={() => { const next = new URLSearchParams(searchParams); next.set("layout", "cards"); setSearchParams(next); }}><span aria-hidden="true">▦</span> Карточки</button><button className={projectLayout === "list" ? "active" : ""} type="button" aria-pressed={projectLayout === "list"} onClick={() => { const next = new URLSearchParams(searchParams); next.set("layout", "list"); setSearchParams(next); }}><span aria-hidden="true">☷</span> Список</button></div></>}<Badge tone="success">{work.data.length}</Badge></div></div>
      {selectedWork ? <article className="project-detail">
        <div className="section-heading"><div><p className="eyebrow">Проект</p><h3 id="project-detail-title">{selectedWork.task.title}</h3></div><WorkStatus status={selectedWork.assignment.status} /></div>
        <div className="work-meta"><span>Срок: {new Date(selectedWork.terms.deadline_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</span><Badge>условия версии {selectedWork.terms.version}</Badge></div>
        <p>{selectedWork.terms.deliverable}</p>
        <section aria-label="Критерии результата"><h4>Критерии результата</h4><ul>{selectedWork.terms.acceptance_criteria.map((criterion) => <li key={criterion}>✓ {criterion}</li>)}</ul></section>
        <section aria-label="История доказательств"><h4>История доказательств</h4>{selectedWork.contributions.length === 0 ? <p className="muted-line">Личные вклады ещё не отправлены — история появится после первой отправки.</p> : <ul>{selectedWork.contributions.map((entry) => <li key={entry.id}><strong>Личный вклад · версия {entry.version}</strong><p>{entry.personal_summary}</p>{entry.artifact_keys.length > 0 && <small className="allowed-artifacts">доказательства: {entry.artifact_keys.join(", ")}</small>}<WorkStatus status={entry.status} /></li>)}</ul>}
          {selectedWork.decisions.some((entry) => entry.decision === "accepted") && <div className="success-banner" role="status"><span>✓</span><div><strong>Результат принят заказчиком</strong><small>Приёмка зафиксирована по фактам.</small></div></div>}
          {selectedWork.decisions.some((entry) => entry.decision === "revision_requested") && (() => { const latest = selectedWork.contributions.at(-1); const decision = latest ? selectedWork.decisions.find((entry) => entry.contribution_id === latest.id) : undefined; return decision?.decision === "revision_requested" ? <div className="revision-note" role="status"><strong>Что доработать</strong><p>{decision.reason}</p><small>Срок: {decision.deadline_at ? new Date(decision.deadline_at).toLocaleString("ru-RU") : "не указан"}</small></div> : null; })()}
        </section>
        <section aria-label="Обсуждение сроков" className="deadline-discussion">
          <h4>Обсуждение сроков</h4>
          {deadlineRequests.isPending && <StatePanel kind="loading" />}
          {deadlineRequests.isError && <StatePanel kind="error" action="Повторить" onAction={() => { void deadlineRequests.refetch(); }} />}
          {deadlineRequests.data && (deadlineRequests.data.length === 0 ? <p className="muted-line">Переносы срока не запрашивались. Условия версии {selectedWork.terms.version} действуют до {new Date(selectedWork.terms.deadline_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}.</p> : <ul>{deadlineRequests.data.map((request) => <li key={request.id}><strong>{deadlineStatusLabel[request.status] ?? request.status}</strong><p>Предложенный срок: {new Date(request.proposed_deadline_at).toLocaleString("ru-RU")}</p><p>{request.reason}</p>{request.impact && <small className="allowed-artifacts">Влияние: {request.impact}</small>}{request.decision_comment && <small className="allowed-artifacts">Комментарий заказчика: {request.decision_comment}</small>}</li>)}</ul>)}
          {proposableStatuses.has(selectedWork.assignment.status) ? <form className="deadline-proposal-form" onSubmit={(event) => { event.preventDefault(); proposeDeadline.mutate(selectedWork.assignment.id); }}><div className="deadline-proposal-fields"><label>Предлагаемый срок<input type="datetime-local" required value={deadlineAt || selectedWork.terms.deadline_at.slice(0, 16)} onChange={(event) => { setDeadlineAt(event.target.value); }} /></label><label>Обоснование<textarea required minLength={10} value={deadlineSummary} onChange={(event) => { setDeadlineSummary(event.target.value); }} placeholder="Что изменилось в нагрузке или объёме задачи…" /></label><label>Влияние на приёмку<textarea required minLength={6} value={deadlineImpact} onChange={(event) => { setDeadlineImpact(event.target.value); }} placeholder="Как перенос влияет на качество и сроки приёмки…" /></label></div>{proposeDeadline.isError && <p className="error-message" role="alert">{deadlineErrorText(proposeDeadline.error)}</p>}<button className="secondary-button" type="button" disabled={proposeDeadline.isPending} onClick={() => { proposeDeadline.mutate(selectedWork.assignment.id); }}>{proposeDeadline.isPending ? "Отправляем…" : "Запросить перенос срока"}</button></form> : <small className="allowed-artifacts">Обсуждение срока доступно, пока работа идёт. Для принятых проектов история переносов остаётся документацией.</small>}
        </section>
        <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => { setSelectedAssignment(null); updateParams({ project: null, detail: null }); }}>← К списку проектов</button><button type="button" onClick={() => { updateParams({ detail: null }); }}>Открыть рабочую область →</button></div>
      </article> : work.data.length === 0 ? <StatePanel kind="empty" /> : projectItems.length === 0 ? <div className="empty-application"><strong>В этом статусе проектов пока нет</strong><p>Смените фильтр статуса сверху.</p></div> : projectLayout === "cards" ? <div className="work-grid">{projectItems.map((item) => {
        const latest = item.contributions.at(-1); const decision = latest ? item.decisions.find((entry) => entry.contribution_id === latest.id) : undefined;
        return <Card key={item.assignment.id} title={item.task.title}><button className="task-card-open" type="button" onClick={() => { setSelectedAssignment(item.assignment.id); const next = new URLSearchParams(searchParams); next.set("project", item.assignment.id); next.set("detail", "1"); setSearchParams(next); }}>Открыть проект →</button><div className="work-meta"><WorkStatus status={item.assignment.status} /></div>
          {decision?.decision === "revision_requested" && <div className="revision-note" role="status"><strong>Что доработать</strong><p>{decision.reason}</p><small>Срок: {decision.deadline_at ? new Date(decision.deadline_at).toLocaleString("ru-RU") : "не указан"}</small></div>}
          {latest && <div className="contribution-summary"><strong>Личный вклад · версия {latest.version}</strong><p>{latest.personal_summary}</p><WorkStatus status={latest.status} /></div>}
          {(item.assignment.status === "staffed" || item.assignment.status === "revision_requested") && <button type="button" onClick={() => { start.mutate(item.assignment.id); }}>{item.assignment.status === "revision_requested" ? "Начать доработку" : "Начать работу"}</button>}
          {item.assignment.status === "in_progress" && <form className="contribution-form" onSubmit={(event) => { event.preventDefault(); contribute.mutate(item.assignment.id); }}><label>Что сделали лично<textarea required minLength={20} value={summary} onChange={(event) => { setSummary(event.target.value); }} /></label><label>Ссылка на доказательство<input type="url" value={artifactUrl} onChange={(event) => { setArtifactUrl(event.target.value); }} placeholder="https://…" /></label>{item.allowed_artifacts && item.allowed_artifacts.length > 0 && <small className="allowed-artifacts">Разрешённые артефакты: {item.allowed_artifacts.join(", ")}</small>}{contribute.isError && <p role="alert">Не удалось отправить вклад. Проверьте описание и разрешённые артефакты.</p>}<button type="submit">Отправить личный вклад</button></form>}
        </Card>;
      })}</div> : <div className="participant-task-list" role="list">{projectItems.map((item) => <article className="participant-task-row" role="listitem" key={item.assignment.id}><span className="activity-symbol" aria-hidden="true">▤</span><div><strong>{item.task.title}</strong><small>{statusLabel[item.assignment.status] ?? item.assignment.status}</small></div><WorkStatus status={item.assignment.status} /><button type="button" onClick={() => { setSelectedAssignment(item.assignment.id); const next = new URLSearchParams(searchParams); next.set("project", item.assignment.id); next.set("detail", "1"); setSearchParams(next); }}>Открыть проект →</button></article>)}</div>}</section>}
    <Modal title={`Условия задачи · версия ${String(consentItem?.terms.version ?? "")}`} open={consentItem !== null} onClose={() => { setConsentItem(null); }}>
      {consentItem && <><p>{consentItem.terms.deliverable}</p><div className="modal-actions"><button type="button" disabled={acceptTerms.isPending} onClick={() => { acceptTerms.mutate(consentItem); }}>{acceptTerms.isPending ? "Подтверждаем…" : "Подтвердить условия и продолжить"}</button><button className="secondary-button" type="button" disabled={acceptTerms.isPending} onClick={() => { setConsentItem(null); }}>Отмена</button></div></>}
    </Modal>
    <Modal title={taskPreview?.title ?? "Карточка задачи"} open={taskPreview !== null} onClose={() => { setTaskPreview(null); }}>
      {taskPreview && (taskDetail.isPending ? <StatePanel kind="loading" /> : taskDetail.isError ? <StatePanel kind="error" action="Повторить" onAction={() => { void taskDetail.refetch(); }} /> : (() => { const detail = taskDetail.data; return <div className="my-task-preview" data-reference="R-PAR-05">
        <div className="task-preview-status"><Badge tone={detail.membership ? "success" : "warning"}>{detail.membership ? "Проект в работе" : detail.invitation_status === "pending" ? "Приглашение ожидает решения" : "Заявка ожидает решения"}</Badge>{detail.deadline_at && <span>Дедлайн {new Date(detail.deadline_at).toLocaleDateString("ru-RU")}</span>}</div>
        <p className="lead">{detail.problem}</p>
        <div className="task-preview-people"><article><small>Заказчик</small><strong>{detail.customer.display_name || "—"}</strong></article>{detail.mentor && <article><small>Ментор</small><strong>{detail.mentor.display_name}</strong></article>}{detail.support && <article><small>Поддержка · {detail.support.mode}</small><strong>{detail.support.assignee.display_name || "—"}</strong></article>}</div>
        <section><h3>Критерии результата</h3><ul>{detail.acceptance_criteria.map((criterion) => <li key={criterion}>✓ {criterion}</li>)}</ul></section>
        {detail.terms_history.length > 0 && <section><h3>Версии условий</h3><ul>{detail.terms_history.map((entry) => <li key={entry.version}>Версия {entry.version}: {entry.deliverable} · до {new Date(entry.deadline_at).toLocaleDateString("ru-RU")}</li>)}</ul></section>}
        {detail.checkpoints.length > 0 && <section><h3>Checkpoint-и</h3><ul>{detail.checkpoints.map((item) => <li key={item.key}>{item.title} · {item.status}</li>)}</ul></section>}
        {detail.personal.length > 0 && <section><h3>Личные вклады</h3><ul>{detail.personal.map((entry) => <li key={entry.id}>Версия {entry.version} · {statusLabel[entry.status] ?? entry.status}{entry.artifact_keys.length > 0 ? ` · доказательства: ${entry.artifact_keys.join(", ")}` : ""}</li>)}</ul></section>}
        {detail.feedback.length > 0 && <section><h3>Обратная связь по ревью</h3><ul>{detail.feedback.map((entry) => <li key={`${entry.contribution_id}-${String(entry.review_version)}`}>Оценка {entry.grade} · {entry.explanation}</li>)}</ul></section>}
        <div className="modal-actions">{detail.membership ? <button type="button" onClick={() => { sessionStorage.setItem("impulse_open_assignment", detail.membership?.id ?? ""); setSelectedAssignment(detail.membership?.id ?? null); setTaskPreview(null); void navigate("/workspace/4"); }}>Перейти в рабочую область →</button> : <button type="button" disabled title="Рабочая область откроется после принятия заявки">Рабочая область после принятия</button>}{(detail.membership || detail.invitation_status) && <button type="button" onClick={() => { setTaskPreview(null); void navigate("/workspace/10"); }}>Перейти в чат команды</button>}<button className="secondary-button" type="button" onClick={() => { setTaskPreview(null); }}>Закрыть</button></div>
      </div>; })())}
    </Modal>
    <Modal title="Отозвать заявку?" open={withdrawTarget !== null} onClose={() => { setWithdrawTarget(null); }}>
      {withdrawTarget && <><p>{catalog.data.find((item) => item.task.id === withdrawTarget)?.task.title ?? withdrawTarget}</p><p className="muted">Заявку можно отозвать, пока заказчик не выбрал исполнителей. После отзыва повторный отклик остаётся доступным.</p>{withdraw.isError && withdrawTarget && <p className="error-message" role="alert">{withdrawErrorText(withdraw.error)}</p>}<div className="modal-actions"><button type="button" disabled={withdraw.isPending} onClick={() => { withdraw.mutate(withdrawTarget); }}>{withdraw.isPending ? "Отзываем…" : "Подтвердить отзыв"}</button><button className="secondary-button" type="button" disabled={withdraw.isPending} onClick={() => { setWithdrawTarget(null); }}>Отмена</button></div></>}
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
