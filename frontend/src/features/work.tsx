import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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

export function ParticipantTasks({ view = "catalog" }: { view?: "catalog" | "projects" }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const catalog = useQuery({ queryKey: ["task-catalog"], queryFn: () => apiRequest<MarketplaceTask[]>("/api/v1/marketplace/tasks"), refetchOnMount: "always" });
  const work = useQuery({ queryKey: ["my-work"], queryFn: () => apiRequest<WorkItem[]>("/api/v1/me/work"), refetchOnMount: "always" });
  const [summary, setSummary] = useState("");
  const [artifactUrl, setArtifactUrl] = useState("");
  const [consentItem, setConsentItem] = useState<MarketplaceTask | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);
  const [applicationNotice, setApplicationNotice] = useState<string | null>(null);
  const [catalogView, setCatalogView] = useState<"cards" | "list">(() => localStorage.getItem("impulse_task_catalog_view") === "list" ? "list" : "cards");
  const [appliedTaskIds, setAppliedTaskIds] = useState<string[]>(() => {
    try { return JSON.parse(sessionStorage.getItem("impulse_applied_tasks") ?? "[]") as string[]; } catch { return []; }
  });
  const acceptTerms = useMutation({ mutationFn: (item: MarketplaceTask) => apiRequest(`/api/v1/me/tasks/${item.task.id}/terms-consent`, { method: "POST", headers: csrfHeaders(), body: JSON.stringify({ terms_version: item.terms.version }) }), onSuccess: async () => client.invalidateQueries({ queryKey: ["task-catalog"] }) });
  const apply = useMutation({ mutationFn: (taskId: string) => apiRequest<Application>(`/api/v1/me/tasks/${taskId}/applications`, { method: "POST", headers: csrfHeaders() }), onSuccess: async (_application, taskId) => { const next = Array.from(new Set([...appliedTaskIds, taskId])); setAppliedTaskIds(next); sessionStorage.setItem("impulse_applied_tasks", JSON.stringify(next)); setApplicationNotice(taskId); await Promise.all([client.invalidateQueries({ queryKey: ["task-catalog"] }), client.invalidateQueries({ queryKey: ["my-work"] })]); } });
  const start = useMutation({ mutationFn: (assignmentId: string) => apiRequest(`/api/v1/me/assignments/${assignmentId}/start`, { method: "POST", headers: csrfHeaders() }), onSuccess: async () => client.invalidateQueries({ queryKey: ["my-work"] }) });
  const contribute = useMutation({ mutationFn: (assignmentId: string) => apiRequest(`/api/v1/me/assignments/${assignmentId}/contributions`, { method: "POST", headers: csrfHeaders(), body: JSON.stringify({ personal_summary: summary, artifacts: artifactUrl ? [{ key: "personal-proof", uri: artifactUrl }] : [] }) }), onSuccess: async () => { setSummary(""); setArtifactUrl(""); await client.invalidateQueries({ queryKey: ["my-work"] }); } });

  if (catalog.isLoading || work.isLoading) return <StatePanel kind="loading" />;
  if (!catalog.data || !work.data || catalog.isError || work.isError) return <StatePanel kind="error" action="Повторить" onAction={() => { void catalog.refetch(); void work.refetch(); }} />;
  const selectedWork = view === "projects" ? work.data.find((item) => item.assignment.id === selectedAssignment) : undefined;
  if (selectedWork) {
    const latest = selectedWork.contributions.at(-1);
    const projectCheckpoints: Array<[string, string, string, string]> = [
      ["Исследование источников", "accepted", "Алекс · Анна", "Отчёт и выбор Semantic Scholar"],
      ["Контракт API", "accepted", "Алекс", "OpenAPI-схема и обработка ошибок"],
      ["Baseline ранжирования", "accepted", "Анна", "Метрики Precision@10 и NDCG"],
      ["Гибридный прототип", "in_progress", "Команда", "Интеграция API и модели"],
      ["Итоговая проверка MVP", "not_started", "Роман · Елена", "Демо, отчёт и воспроизводимость"],
    ];
    return <div className="feature-stack task-detail-page">
      <button className="text-button" type="button" onClick={() => { setSelectedAssignment(null); }}>← Вернуться к моим задачам</button>
      <header className="task-detail-hero"><div><p className="eyebrow">Моя задача · {selectedWork.task.id.slice(0, 8)}</p><h1 id="workspace-title">{selectedWork.task.title}</h1><p className="lead">Разработать и проверить прототип рекомендаций научных статей на открытых данных.</p><div className="work-meta"><WorkStatus status={selectedWork.assignment.status} /><Badge tone="warning">MVP · 70%</Badge><span>Дедлайн 12 октября 2026</span></div></div><CompensationDetails terms={selectedWork.terms.compensation} expanded /></header>
      <section className="task-people-grid"><article><span className="eyebrow">Заказчик</span><strong>Роман Воронов</strong><small>Руководитель R&amp;D · принимает бизнес-результат</small></article><article><span className="eyebrow">Ментор команды</span><strong>Елена Наставник</strong><small>ML Lead · проверяет вклад и даёт обратную связь</small><button className="text-button" type="button" onClick={() => { void navigate("/workspace/10"); }}>Написать ментору</button></article><article><span className="eyebrow">Ваша роль</span><strong>Backend-разработчик</strong><small>API источников, ранжирование и воспроизводимость</small></article></section>
      <div className="task-detail-grid"><section className="task-work-plan"><div className="section-heading"><div><p className="eyebrow">План работы</p><h2>Checkpoints проекта</h2></div><strong>3 из 5 выполнено</strong></div>{projectCheckpoints.map(([title, status, owner, result], index) => <article className={`task-checkpoint task-checkpoint--${status}`} key={title}><span>{status === "accepted" ? "✓" : index + 1}</span><div><strong>{title}</strong><small>{owner} · {result}</small></div><Badge tone={status === "accepted" ? "success" : status === "in_progress" ? "warning" : "neutral"}>{status === "accepted" ? "Принято" : status === "in_progress" ? "В работе" : "Не начато"}</Badge></article>)}</section>
        <aside className="task-team-panel"><h2>Команда</h2><ul><li><span>АР</span><div><strong>Алекс Речной</strong><small>Backend · вы</small></div></li><li><span>АК</span><div><strong>Анна Крылова</strong><small>Data Scientist</small></div></li><li><span>МС</span><div><strong>Максим Соколов</strong><small>Product / Research</small></div></li></ul><button type="button" onClick={() => { void navigate("/workspace/10"); }}>Открыть чат команды</button></aside></div>
      <section className="task-feedback"><div><p className="eyebrow">Последняя обратная связь</p><h2>Ревью ментора · версия {latest?.version ?? 2}</h2><p>API-контракт и структура решения соответствуют критериям. Добавьте retry с backoff, зафиксируйте лимиты источника и повторите нагрузочный тест.</p><div className="feedback-criteria"><span><strong>A</strong> Архитектура</span><span><strong>B</strong> Надёжность</span><span><strong>A</strong> Документация</span><span><strong>B</strong> Командный вклад</span></div><small>Елена Наставник · 28 сентября, 10:14 · относится к checkpoint «Контракт API»</small></div><div className="task-next-action"><Badge tone="warning">Следующий шаг</Badge><strong>Обновить обработку rate limit</strong><button type="button">Загрузить новую версию</button></div></section>
      <section className="task-history"><h2>История вашего вклада</h2><article><time>28 сентября</time><div><strong>Контракт API · версия 2</strong><p>Получена обратная связь ментора, запрошено уточнение retry.</p></div></article><article><time>25 сентября</time><div><strong>Контракт API · версия 1</strong><p>Отправлена OpenAPI-схема и коллекция тестов.</p></div></article><article><time>20 сентября</time><div><strong>Исследование источников</strong><p>Результат принят заказчиком.</p></div></article></section>
    </div>;
  }
  const pendingItems = catalog.data.filter((item) => appliedTaskIds.includes(item.task.id));
  return <div className={`feature-stack participant-work participant-work--${view}`}>
    <header className="participant-page-heading"><div><p className="eyebrow">{view === "catalog" ? "Реальные R&D и MVP" : "Практика и личный вклад"}</p><h1 id="workspace-title">{view === "catalog" ? "Задачи для вашего развития" : "Мои проекты"}</h1><p className="lead">{view === "catalog" ? "Выберите задачу под траекторию, заранее изучите результат, поддержку и прозрачное вознаграждение." : "Работайте с командой, фиксируйте личный вклад и получайте предметную обратную связь."}</p></div>{view === "catalog" && <Badge tone="success">{catalog.data.length} задач доступно</Badge>}</header>
    {view === "catalog" && applicationNotice && <div className="success-banner" role="status"><span>✓</span><div><strong>Вы успешно откликнулись</strong><small>Задача добавлена в «Мои задачи» со статусом «Заявка отправлена».</small></div><button type="button" onClick={() => { document.getElementById("my-applications")?.scrollIntoView({ behavior: "smooth" }); }}>Открыть мои задачи</button></div>}
    {view === "catalog" && <section className="task-marketplace" aria-labelledby="catalog-title">
      <div className="section-heading marketplace-heading"><div><p className="eyebrow">Витрина</p><h2 id="catalog-title">Рекомендуемые задачи</h2></div><div className="marketplace-toolbar"><div className="task-filter-row"><button type="button">Все</button><button type="button">Аналитика</button><button type="button">ML / AI</button><button type="button">Разработка</button></div><div className="catalog-view-toggle" aria-label="Способ отображения"><button className={catalogView === "cards" ? "active" : ""} type="button" aria-pressed={catalogView === "cards"} onClick={() => { setCatalogView("cards"); localStorage.setItem("impulse_task_catalog_view", "cards"); }}><span aria-hidden="true">▦</span> Карточки</button><button className={catalogView === "list" ? "active" : ""} type="button" aria-pressed={catalogView === "list"} onClick={() => { setCatalogView("list"); localStorage.setItem("impulse_task_catalog_view", "list"); }}><span aria-hidden="true">☷</span> Список</button></div></div></div>
      {catalogView === "cards" ? <div className="work-grid">{catalog.data.map((item) => <Card key={item.task.id} title={item.task.title}><div className="work-meta"><CompensationDetails terms={item.terms.compensation} /><span>До {new Date(item.terms.deadline_at).toLocaleDateString("ru-RU")}</span></div><p>{item.terms.deliverable}</p><ul>{item.terms.acceptance_criteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>{appliedTaskIds.includes(item.task.id) ? <button className="application-sent" type="button" onClick={() => { setApplicationNotice(item.task.id); }}>✓ Заявка отправлена</button> : item.accepted_terms_version === item.terms.version ? <button type="button" disabled={apply.isPending} onClick={() => { apply.mutate(item.task.id); }}>{apply.isPending ? "Отправляем…" : "Откликнуться"}</button> : <button type="button" onClick={() => { setConsentItem(item); }}>Открыть условия версии {item.terms.version}</button>}{apply.isError && apply.variables === item.task.id && <p className="error-message" role="alert">Не удалось отправить отклик. Проверьте соединение и повторите.</p>}</Card>)}</div> : <div className="participant-task-list" role="list">{catalog.data.map((item, index) => <article className="participant-task-row" role="listitem" key={item.task.id}><span className={`task-kind-icon task-kind-icon--${String(index % 3)}`} aria-hidden="true">{index % 3 === 0 ? "⌁" : index % 3 === 1 ? "◫" : "◇"}</span><div className="task-list-main"><div><Badge>{index % 3 === 0 ? "ML / AI" : index % 3 === 1 ? "Аналитика" : "Разработка"}</Badge><small>Совпадение {92 - index * 4}%</small></div><strong>{item.task.title}</strong><p>{item.terms.deliverable}</p></div><div className="task-list-deadline"><small>Дедлайн</small><strong>{new Date(item.terms.deadline_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</strong></div><div className="task-list-reward"><small>Вознаграждение</small><CompensationDetails terms={item.terms.compensation} /></div><div className="task-list-action">{appliedTaskIds.includes(item.task.id) ? <button className="application-sent" type="button" onClick={() => { setApplicationNotice(item.task.id); }}>✓ Отправлено</button> : item.accepted_terms_version === item.terms.version ? <button type="button" disabled={apply.isPending} onClick={() => { apply.mutate(item.task.id); }}>{apply.isPending ? "Отправляем…" : "Откликнуться"}</button> : <button type="button" onClick={() => { setConsentItem(item); }}>Условия →</button>}</div></article>)}</div>}
    </section>}
    {view === "catalog" && <section id="my-applications" className="my-applications" aria-labelledby="my-applications-title"><div className="section-heading"><div><p className="eyebrow">Статус решения</p><h2 id="my-applications-title">Мои задачи</h2></div><Badge>{pendingItems.length}</Badge></div>{pendingItems.length === 0 ? <div className="empty-application"><strong>Пока нет отправленных заявок</strong><p>Откликнитесь на подходящую задачу — она сразу появится здесь.</p></div> : pendingItems.map((item) => <article key={item.task.id}><span className="activity-symbol">▤</span><div><strong>{item.task.title}</strong><small>Заявка отправлена · условия версии {item.terms.version}</small></div><Badge tone="warning">Ожидает решения</Badge><button type="button" onClick={() => { document.getElementById("catalog-title")?.scrollIntoView({ behavior: "smooth" }); }}>Открыть карточку</button></article>)}</section>}
    {view === "projects" && <section aria-labelledby="my-work-title"><div className="section-heading"><div><p className="eyebrow">Принятые назначения</p><h2 id="my-work-title">Проекты в работе</h2></div><Badge tone="success">{work.data.length}</Badge></div>{work.data.length === 0 ? <StatePanel kind="empty" /> : <div className="work-grid">{work.data.map((item) => {
      const latest = item.contributions.at(-1); const decision = latest ? item.decisions.find((entry) => entry.contribution_id === latest.id) : undefined;
      return <Card key={item.assignment.id} title={item.task.title}><button className="task-card-open" type="button" onClick={() => { setSelectedAssignment(item.assignment.id); }}>Открыть рабочую область →</button><div className="work-meta"><WorkStatus status={item.assignment.status} /><CompensationDetails terms={item.terms.compensation} /></div>
        {decision?.decision === "revision_requested" && <div className="revision-note" role="status"><strong>Что доработать</strong><p>{decision.reason}</p><small>Срок: {decision.deadline_at ? new Date(decision.deadline_at).toLocaleString("ru-RU") : "не указан"}</small></div>}
        {latest && <div className="contribution-summary"><strong>Личный вклад · версия {latest.version}</strong><p>{latest.personal_summary}</p><WorkStatus status={latest.status} /></div>}
        {(item.assignment.status === "staffed" || item.assignment.status === "revision_requested") && <button type="button" onClick={() => { start.mutate(item.assignment.id); }}>{item.assignment.status === "revision_requested" ? "Начать доработку" : "Начать работу"}</button>}
        {item.assignment.status === "in_progress" && <form className="contribution-form" onSubmit={(event) => { event.preventDefault(); contribute.mutate(item.assignment.id); }}><label>Что сделали лично<textarea required minLength={20} value={summary} onChange={(event) => { setSummary(event.target.value); }} /></label><label>Ссылка на доказательство<input type="url" value={artifactUrl} onChange={(event) => { setArtifactUrl(event.target.value); }} placeholder="https://…" /></label><button type="submit">Отправить личный вклад</button></form>}
      </Card>;
    })}</div>}</section>}
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
