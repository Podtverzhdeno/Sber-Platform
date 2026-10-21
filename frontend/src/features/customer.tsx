import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { apiRequest, ApiClientError } from "../api/client";
import { Badge, StatePanel } from "../components/ui";
import "./customer-ai-provenance.css";

type Task = { id: string; project_key: string; task_key: string; title: string; status: string; nominated_mentor_id: string | null; support_mode: string | null; support_assignee_id: string | null; places: number; demo?: boolean; applications?: number; deadline?: string; base?: string; b?: string; a?: string; application_count?: number | null; assignment_count?: number | null; pending_result_count?: number | null; accepted_result_count?: number | null; deadline_at?: string | null };
type Application = { id: string; task_id: string; person_id: string; accepted_terms_version: number; status: string; version: number; participant_name?: string | null; verified_case_count?: number | null };
type TaskDetail = { task: Task; problem: string; deliverable: string; acceptance_criteria: string[]; data_constraints: string; ip_terms: string; terms: { version: number; deadline_at: string; compensation: { paid: boolean; base_amount_per_assignee: string | null; b_total: string | null; a_total: string | null } } | null; applications: Application[]; assignments: { id: string; status: string }[]; contributions: { id: string; personal_summary: string; status: string; artifact_keys: string[] }[]; decisions: { contribution_id: string; decision: string; reason: string }[] };
type TaskFilter = "all" | "draft" | "in_progress" | "awaiting_acceptance" | "completed";
type TaskSort = "action" | "deadline";
type TaskMode = "open" | "invitation_only";
type ApplicationFilter = "all" | "applied" | "accepted";
type SupportModel = { code: string; name: string; responsible: string; activities: string[]; response_time: string; restrictions: string[]; available: boolean; unavailable_reason: string | null; requires_assignee: boolean };
type SupportCatalog = { version: number; models: SupportModel[] };
type DraftForm = { title: string; competencyTags: string; rubricResult: string; rubricReasoning: string; rubricUncertainty: string; rubricAiUse: string; rubricDefense: string; problem: string; deliverable: string; criterion: string; deadline: string; dataConstraints: string; ipTerms: string; places: string; baseAmount: string; aMultiplier: string; supportModel: string; supportAssignee: string };

const initialForm: DraftForm = { title: "", competencyTags: "", rubricResult: "", rubricReasoning: "", rubricUncertainty: "", rubricAiUse: "", rubricDefense: "", problem: "", deliverable: "", criterion: "", deadline: "2026-12-20T18:00", dataConstraints: "Только обезличенные демонстрационные данные", ipTerms: "Результат передаётся заказчику, авторство участника сохраняется в портфолио", places: "2", baseAmount: "50000", aMultiplier: "2", supportModel: "platform", supportAssignee: "request" };
const demoTasks: Task[] = [
  { id: "demo-task-1", project_key: "R&D · Аналитика", task_key: "recommendation", title: "Прототип рекомендательной системы для научных статей", status: "in_progress", nominated_mentor_id: null, support_mode: "platform", support_assignee_id: null, places: 6, demo: true, applications: 28, deadline: "25 апреля 2026" },
  { id: "demo-task-2", project_key: "MVP · LLM", task_key: "knowledge-chat", title: "MVP чат-ассистента для внутренних знаний", status: "submitted", nominated_mentor_id: null, support_mode: "platform", support_assignee_id: null, places: 3, demo: true, applications: 15, deadline: "12 апреля 2026" },
  { id: "demo-task-3", project_key: "Исследование · CV", task_key: "compression", title: "Исследование методов сжатия спутниковых изображений", status: "accepted", nominated_mentor_id: null, support_mode: "mentor", support_assignee_id: null, places: 4, demo: true, applications: 27, deadline: "30 апреля 2026" },
  { id: "demo-task-4", project_key: "R&D · Материалы", task_key: "efficiency", title: "Новые материалы для энергоэффективных систем", status: "published", nominated_mentor_id: null, support_mode: "platform", support_assignee_id: null, places: 8, demo: true, applications: 8, deadline: "15 мая 2026" },
];
const csrfHeaders = (): HeadersInit => ({ "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" });
const tags = (value: string) => value.split(",").map((tag) => tag.trim()).filter(Boolean);
const wizardDraftKey = "impulse_customer_wizard_draft";
const shortlistKey = "impulse_customer_shortlist";

function taskStatus(status: string) {
  return ({ draft: "Черновик", submitted: "На модерации", published: "Опубликовано", staffed: "Команда собрана", in_progress: "В работе", accepted: "Принято" } as Record<string, string>)[status] ?? status;
}

function customerTaskStatus(task: Task) {
  if ((task.pending_result_count ?? 0) > 0) return "На проверке";
  if ((task.accepted_result_count ?? 0) > 0) return "Принято";
  if ((task.assignment_count ?? 0) > 0) return "В работе";
  return taskStatus(task.status);
}

function experienceLabel(item: Application) {
  if (item.verified_case_count === null || item.verified_case_count === undefined) return "Опыт: нет данных";
  if (item.verified_case_count === 0) return "Опыт не подтверждён";
  return `Кейсов подтверждено: ${String(item.verified_case_count)}`;
}

type AiAppliedField = "problem" | "deliverable" | "criterion";

type AiAppliedPatch = { field: AiAppliedField; before: string; after: string };

const aiAppliedTitles: Record<AiAppliedField, string> = {
  problem: "Проблема",
  deliverable: "Результат",
  criterion: "Критерии приёмки",
};

export function CustomerWorkspace() {
  const queryClient = useQueryClient();
  const tasks = useQuery({ queryKey: ["customer-tasks"], queryFn: () => apiRequest<Task[]>("/api/v1/customer/tasks"), refetchOnMount: "always" });
  const publicConfig = useQuery({ queryKey: ["public-config"], queryFn: () => apiRequest<{ demo_mode?: boolean }>("/api/v1/config") });
  const supportCatalog = useQuery({ queryKey: ["customer-support-models"], queryFn: async () => {
    const response = await fetch("/api/v1/customer/support-models", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("SUPPORT_CATALOG_UNAVAILABLE");
    return await response.json() as SupportCatalog;
  } });
  const [taskMode, setTaskMode] = useState<TaskMode>("open");
  const [form, setForm] = useState<DraftForm>(initialForm);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [publishAfterCreate, setPublishAfterCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionDeadline, setDecisionDeadline] = useState(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [taskSort, setTaskSort] = useState<TaskSort>("action");
  const [applicationFilter, setApplicationFilter] = useState<ApplicationFilter>("all");
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [credentialNotice, setCredentialNotice] = useState("");
  const [credentialError, setCredentialError] = useState("");
  const [lastVerificationId, setLastVerificationId] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<{ problem: string; deliverable: string; criteria: string; notice: string } | null>(null);
  const [aiApplied, setAiApplied] = useState<AiAppliedPatch[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<string | null>(null);
  const [previewSavedView, setPreviewSavedView] = useState<{ form: Partial<DraftForm>; taskMode: TaskMode } | null>(null);
  const [previewStale, setPreviewStale] = useState(false);
  const buildWizardDraft = (): string => JSON.stringify({
    step: wizardStep,
    taskMode,
    form: {
      title: form.title, competencyTags: form.competencyTags, rubricResult: form.rubricResult, rubricReasoning: form.rubricReasoning,
      rubricUncertainty: form.rubricUncertainty, rubricAiUse: form.rubricAiUse, rubricDefense: form.rubricDefense,
      problem: form.problem, deliverable: form.deliverable, criterion: form.criterion, deadline: form.deadline,
      dataConstraints: form.dataConstraints, ipTerms: form.ipTerms, places: form.places, baseAmount: form.baseAmount, aMultiplier: form.aMultiplier,
      supportModel: form.supportModel, supportAssignee: form.supportAssignee,
    },
  });
  const aiDraftSuggestion = useMutation({
    mutationFn: () => apiRequest<{ kind: string; editable: boolean; problem: string | null; deliverable: string | null; acceptance_criteria: string[]; notice: string; gateway_called: boolean }>("/api/v1/me/assistant/customer-brief", {
      method: "POST",
      headers: csrfHeaders(),
      body: JSON.stringify({ brief: form.problem || form.title, data_class: "public", correlation_id: `wizard-${String(Date.now())}` }),
    }),
    onSuccess: (body) => {
      setAiDraft(body.kind === "manual_template" ? { problem: "", deliverable: "", criteria: "", notice: body.notice } : { problem: body.problem ?? "", deliverable: body.deliverable ?? "", criteria: body.acceptance_criteria.join("\n"), notice: body.notice });
    },
    onError: () => { setAiDraft({ problem: "", deliverable: "", criteria: "", notice: "AI-помощник недоступен, заполните бриф вручную." }); },
  });
  const detail = useQuery({ queryKey: ["customer-task-detail", selectedTask], enabled: selectedTask !== null && !selectedTask.startsWith("demo-"), queryFn: () => apiRequest<TaskDetail>(`/api/v1/customer/tasks/${selectedTask ?? ""}`) });
  const applications = useQuery({ queryKey: ["customer-applications", selectedTask], enabled: selectedTask !== null, queryFn: () => apiRequest<Application[]>(`/api/v1/customer/tasks/${selectedTask ?? ""}/applications`) });
  const portfolioDetails = useQuery({
    queryKey: ["customer-portfolio-details", tasks.data?.map((task) => task.id).join(",")],
    enabled: Boolean(tasks.data?.length),
    queryFn: () => Promise.all((tasks.data ?? []).map((task) => apiRequest<TaskDetail>(`/api/v1/customer/tasks/${task.id}`))),
  });
  const roleAnalytics = useQuery({
    queryKey: ["customer-role-analytics"],
    queryFn: () => apiRequest<{ metrics: { key: string; value: string | null; numerator: number; denominator: number; unit: string }[] }>("/api/v1/analytics/role"),
  });
  useEffect(() => {
    if (!wizardOpen || previewOpen) return;
    localStorage.setItem(wizardDraftKey, buildWizardDraft());
  });
  useEffect(() => {
    if (!previewOpen || previewSnapshot === null) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== wizardDraftKey) return;
      const saved = localStorage.getItem(wizardDraftKey);
      if (saved && saved !== previewSnapshot) setPreviewStale(true);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [previewOpen, previewSnapshot]);
  const openPreview = () => {
    setPreviewSnapshot(buildWizardDraft());
    setPreviewSavedView(null);
    setPreviewStale(false);
    setPreviewOpen(true);
  };
  const updatePreview = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(wizardDraftKey) ?? "{}") as { step?: number; taskMode?: TaskMode; form?: Partial<DraftForm> };
      if (saved.form) setPreviewSavedView({ form: saved.form, taskMode: saved.taskMode === "invitation_only" ? "invitation_only" : "open" });
      setPreviewStale(false);
    } catch {
      setPreviewStale(false);
    }
  };
  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(shortlistKey) ?? "{}") as Record<string, string[]>;
      setShortlist(parsed[selectedTask ?? ""] ?? []);
    } catch {
      setShortlist([]);
    }
  }, [selectedTask]);
  const openWizard = () => {
    try {
      const saved = localStorage.getItem(wizardDraftKey);
      if (saved) {
        const draft = JSON.parse(saved) as { form?: Partial<DraftForm>; taskMode?: TaskMode; step?: number };
        setForm({ ...initialForm, ...draft.form });
        if (draft.taskMode === "open" || draft.taskMode === "invitation_only") setTaskMode(draft.taskMode);
        if (draft.step !== undefined && draft.step >= 1 && draft.step <= 5) setWizardStep(draft.step);
      }
    } catch {
      localStorage.removeItem(wizardDraftKey);
    }
    setWizardOpen(true);
  };
  const toggleShortlist = (applicationId: string) => {
    const next = shortlist.includes(applicationId) ? shortlist.filter((item) => item !== applicationId) : [...shortlist, applicationId];
    setShortlist(next);
    try {
      const parsed = JSON.parse(localStorage.getItem(shortlistKey) ?? "{}") as Record<string, string[]>;
      parsed[selectedTask ?? ""] = next;
      localStorage.setItem(shortlistKey, JSON.stringify(parsed));
    } catch {
      localStorage.removeItem(shortlistKey);
    }
  };
  const aiFieldState = (field: AiAppliedField) => aiApplied.find((entry) => entry.field === field);
  const clearAiApplied = (field: AiAppliedField) => { setAiApplied((current) => current.filter((entry) => entry.field !== field)); };
  const undoAiApplied = (field: AiAppliedField) => {
    const entry = aiApplied.find((item) => item.field === field);
    if (entry) setForm((current) => ({ ...current, [field]: entry.before }));
    clearAiApplied(field);
  };
  const applyAiDraft = () => {
    if (!aiDraft) return;
    const sources: { field: AiAppliedField; after: string }[] = [
      { field: "problem", after: aiDraft.problem },
      { field: "deliverable", after: aiDraft.deliverable },
      { field: "criterion", after: aiDraft.criteria },
    ];
    const patches: AiAppliedPatch[] = [];
    const nextForm = { ...form };
    for (const source of sources) {
      if (source.after.trim() === "") continue;
      if (nextForm[source.field] === source.after) continue;
      patches.push({ field: source.field, before: nextForm[source.field], after: source.after });
      nextForm[source.field] = source.after;
    }
    if (patches.length > 0) {
      setForm(nextForm);
      setAiApplied((current) => [...current.filter((entry) => !patches.some((patch) => patch.field === entry.field)), ...patches]);
    }
    setAiDraft(null);
  };
  const canAdvance = (step: number): boolean => {
    if (step === 1) return form.title.trim().length > 0 && tags(form.competencyTags).length > 0;
    if (step === 2) return form.problem.trim().length > 0 && form.deliverable.trim().length > 0 && form.criterion.trim().length > 0;
    if (step === 4) {
      const model = supportCatalog.data?.models.find((item) => item.code === form.supportModel);
      return Boolean(model?.available && (!model.requires_assignee || form.supportAssignee !== ""));
    }
    return true;
  };
  const briefGaps = (view: DraftForm = form): string[] => [
    ...(view.title.trim() ? [] : ["название"]),
    ...(tags(view.competencyTags).length ? [] : ["компетенции"]),
    ...(view.problem.trim() ? [] : ["проблему"]),
    ...(view.deliverable.trim() ? [] : ["результат"]),
    ...(view.criterion.trim() ? [] : ["критерии приёмки"]),
    ...(Number(view.places) > 0 ? [] : ["количество мест"]),
  ];
  const create = useMutation({
    mutationFn: () => apiRequest<Task>("/api/v1/customer/projects/impulse-demo/tasks", { method: "POST", headers: csrfHeaders(), body: JSON.stringify({
      task_key: `task-${String(Date.now())}`, title: form.title, problem: form.problem, deliverable: form.deliverable,
      mode: taskMode,
      competency_tags: tags(form.competencyTags),
      case_rubric: form.competencyTags.trim() ? { version: 1, result: form.rubricResult, reasoning: form.rubricReasoning, uncertainty: form.rubricUncertainty, ai_use: form.rubricAiUse, defense: form.rubricDefense } : null,
      acceptance_criteria: form.criterion.split("\n").map((item) => item.trim()).filter(Boolean),
      deadline_at: new Date(form.deadline).toISOString(), data_constraints: form.dataConstraints,
      ip_terms: form.ipTerms, nominated_mentor_id: null, places: Number(form.places), compensation: {
        paid: false, base_amount_per_assignee: null,
        currency: null, a_multiplier: form.aMultiplier, quantum: "0.01",
        rounding_mode: "half_up", policy_version: 1, payout_condition: "После принятия личного вклада и публикации оценки 5+",
      },
    }) }),
    onSuccess: async (task) => {
      setSelectedTask(task.id);
      setWizardOpen(false);
      setForm(initialForm);
      setWizardStep(1);
      localStorage.removeItem(wizardDraftKey);
      await queryClient.invalidateQueries({ queryKey: ["customer-tasks"] });
      if (publishAfterCreate) submit.mutate(task.id);
    },
  });
  const submit = useMutation({ mutationFn: (taskId: string) => apiRequest<Task>(`/api/v1/customer/tasks/${taskId}/submit`, { method: "POST", headers: csrfHeaders() }), onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["customer-tasks"] }) });
  const repeat = useMutation({ mutationFn: (taskId: string) => apiRequest<Task>(`/api/v1/customer/tasks/${taskId}/repeat`, { method: "POST", headers: csrfHeaders(), body: JSON.stringify({ task_key: `repeat-${String(Date.now())}` }) }), onSuccess: async (task) => { setSelectedTask(task.id); await queryClient.invalidateQueries({ queryKey: ["customer-tasks"] }); } });
  const accept = useMutation({ mutationFn: (item: Application) => apiRequest(`/api/v1/customer/applications/${item.id}/accept`, { method: "POST", headers: csrfHeaders(), body: JSON.stringify({ expected_version: item.version }) }), onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["customer-applications", selectedTask] }), queryClient.invalidateQueries({ queryKey: ["customer-task-detail", selectedTask] }), queryClient.invalidateQueries({ queryKey: ["customer-tasks"] })]); } });
  const decide = useMutation({ mutationFn: ({ contributionId, decision }: { contributionId: string; decision: "accepted" | "revision_requested" }) => apiRequest(`/api/v1/customer/contributions/${contributionId}/decision`, { method: "POST", headers: csrfHeaders(), body: JSON.stringify({ decision, reason: decisionReason.trim(), deadline_at: decision === "revision_requested" ? new Date(decisionDeadline).toISOString() : null }) }), onSuccess: async () => { setDecisionReason(""); await Promise.all([queryClient.invalidateQueries({ queryKey: ["customer-task-detail", selectedTask] }), queryClient.invalidateQueries({ queryKey: ["customer-portfolio-details"] }), queryClient.invalidateQueries({ queryKey: ["customer-role-analytics"] }), queryClient.invalidateQueries({ queryKey: ["customer-tasks"] })]); } });

  const sign = useMutation({
    mutationFn: (contributionId: string) => apiRequest<{ verification_id: string; grade_label: string }>(`/api/v1/customer/contributions/${contributionId}/credential`, { method: "POST", headers: csrfHeaders() }),
    onSuccess: (document_) => { setCredentialError(""); setLastVerificationId(document_.verification_id); setCredentialNotice(`Документ подписан · ${document_.grade_label} · проверка ${document_.verification_id}`); },
    onError: (error) => {
      setCredentialNotice("");
      if (error instanceof ApiClientError && (error.code === "REVIEW_NOT_FIVE_PLUS" || error.code === "REVIEW_NOT_FOUND")) setCredentialError("Подписание возможно после опубликованной оценки 5+ за принятый вклад.");
      else if (error instanceof ApiClientError && error.status === 403) setCredentialError("Подписывать проектный документ может только заказчик задачи.");
      else if (error instanceof ApiClientError && error.status === 404) setCredentialError("Вклад не найден. Обновите список задач.");
      else setCredentialError("Не удалось подписать документ. Обновите данные и повторите.");
    },
  });

  if (tasks.isLoading) return <StatePanel kind="loading" />;
  if (tasks.isError || !tasks.data) return <StatePanel kind="error" action="Повторить" onAction={() => { void tasks.refetch(); }} />;
  const isDemoProjection = tasks.data.length === 0 && publicConfig.data?.demo_mode !== false;
  const displayTasks = isDemoProjection ? demoTasks : tasks.data;
  const filteredTasks = isDemoProjection || taskFilter === "all" ? displayTasks : displayTasks.filter((item) => {
    if (taskFilter === "draft") return item.status === "draft" || item.status === "submitted" || item.status === "awaiting_support" || item.status === "ready_to_publish";
    if (taskFilter === "in_progress") return item.status === "published" && (item.assignment_count ?? 0) > 0 && (item.pending_result_count ?? 0) === 0;
    if (taskFilter === "awaiting_acceptance") return (item.pending_result_count ?? 0) > 0;
    return (item.accepted_result_count ?? 0) > 0;
  });
  const orderedTasks = isDemoProjection ? filteredTasks : [...filteredTasks].sort((left, right) => {
    if (taskSort === "action") {
      const actionOrder = (right.pending_result_count ?? 0) - (left.pending_result_count ?? 0);
      if (actionOrder !== 0) return actionOrder;
    }
    return (left.deadline_at ?? "9999").localeCompare(right.deadline_at ?? "9999");
  });
  const counts = (status: string) => displayTasks.filter((item) => item.status === status).length;
  const metrics: [string, number, string][] = [
    ["Опубликовано", isDemoProjection ? 12 : counts("published"), "teal"], ["В работе", isDemoProjection ? 7 : displayTasks.filter((item) => (item.assignment_count ?? 0) > 0).length, "blue"],
    ["На проверке", isDemoProjection ? 4 : displayTasks.reduce((sum, item) => sum + (item.pending_result_count ?? 0), 0), "violet"], ["Принято", isDemoProjection ? 5 : displayTasks.reduce((sum, item) => sum + (item.accepted_result_count ?? 0), 0), "teal"],
  ];
  const priorityTask = [...tasks.data].sort((left, right) => {
    const pending = (right.pending_result_count ?? 0) - (left.pending_result_count ?? 0);
    if (pending !== 0) return pending;
    return (left.deadline_at ?? "9999").localeCompare(right.deadline_at ?? "9999");
  })[0];
  const recentResults = (portfolioDetails.data ?? []).flatMap((item) => item.contributions.map((result) => ({ task: item.task, result, decision: item.decisions.find((entry) => entry.contribution_id === result.id) }))).slice(-3).reverse();
  const acceptedMetric = roleAnalytics.data?.metrics.find((item) => item.key === "customer_acceptance_rate");
  const activeMetric = roleAnalytics.data?.metrics.find((item) => item.key === "customer_active_people");
  const previewForm: DraftForm = { ...form, ...(previewSavedView?.form ?? {}) };
  const previewMode = previewSavedView?.taskMode ?? taskMode;
  const previewMissing = briefGaps(previewForm);
  const previewCriteria = previewForm.criterion.split("\n").map((item) => item.trim()).filter(Boolean);
  const previewSupport = supportCatalog.data?.models.find((item) => item.code === previewForm.supportModel);
  return <div className="feature-stack customer-workspace">
    <header className="dashboard-heading"><div><p className="eyebrow">Заказчик · R&amp;D и MVP</p><h1 id="workspace-title">Управляйте задачами от идеи до результата</h1><p className="lead">Создайте проверяемый бриф, заранее покажите участнику условия и принимайте личный вклад по фактам.</p></div><div className="dashboard-actions"><a href="/workspace/3">Открыть аналитику</a><button type="button" onClick={openWizard}>+ Создать задачу</button></div></header>
    <section className="metric-grid" aria-label="Сводка задач">{metrics.map(([label, value, tone]) => <article className={`metric-card metric-card--${tone}`} key={label}><span className="metric-icon">◇</span><span>{label}</span><strong>{value}</strong><small>{isDemoProjection ? "+2 за последний месяц" : "Актуальное состояние"}</small><i aria-hidden="true" /></article>)}</section>
    {wizardOpen && <section className="task-wizard" aria-labelledby="wizard-title">
      <header><div><p className="eyebrow">Новая задача</p><h2 id="wizard-title">Бриф для участника и платформы</h2><span className="wizard-step-indicator">Шаг {wizardStep} из 5</span></div><button className="secondary-button" type="button" onClick={() => { setWizardOpen(false); }}>Закрыть</button></header>
      <div className="kind-switch" role="group" aria-label="Доступ к задаче">
        <button className={taskMode === "open" ? "active" : ""} type="button" onClick={() => { setTaskMode("open"); }}>Открытая</button>
        <button className={taskMode === "invitation_only" ? "active" : ""} type="button" onClick={() => { setTaskMode("invitation_only"); }}>По приглашению</button>
      </div>
      {previewOpen && <section className="customer-preview" aria-labelledby="preview-title">
        <header>
          <div>
            <p className="eyebrow">Взгляд участника</p>
            <h2 id="preview-title">Предпросмотр задачи</h2>
            <small>Проекция сохранённой версии черновика · публикация и приглашения из предпросмотра недоступны</small>
          </div>
          <button className="secondary-button" type="button" onClick={() => { setPreviewOpen(false); setPreviewSavedView(null); setPreviewStale(false); }}>Вернуться к редактированию</button>
        </header>
        {previewStale && <p role="alert" data-testid="preview-stale">Версия предпросмотра устарела: черновик изменён в другой вкладке. <button type="button" className="secondary-button" data-testid="preview-update" onClick={updatePreview}>Обновить предпросмотр</button></p>}
        {previewMissing.length > 0 && <p role="status" data-testid="preview-missing">{`Участнику не хватит: ${previewMissing.join(", ")}.`}</p>}
        <article className="preview-block">
          <h3>Бриф</h3>
          <dl>
            <div><dt>Задача</dt><dd>{previewForm.title.trim() === "" ? "не указано" : previewForm.title}</dd></div>
            <div><dt>Проблема</dt><dd>{previewForm.problem.trim() === "" ? "не указано" : previewForm.problem}</dd></div>
            <div><dt>Результат</dt><dd>{previewForm.deliverable.trim() === "" ? "не указано" : previewForm.deliverable}</dd></div>
            <div><dt>Критерии приёмки</dt><dd>{previewCriteria.length === 0 ? "не указано" : <ul>{previewCriteria.map((item, index) => <li key={`preview-criterion-${String(index)}`}>{item}</li>)}</ul>}</dd></div>
          </dl>
        </article>
        <article className="preview-block">
          <h3>Условия</h3>
          <dl>
            <div><dt>Доступ</dt><dd>{previewMode === "open" ? "Открытая заявка" : "Только адресные приглашения (talent-matching)"}</dd></div>
            <div><dt>Мест</dt><dd>{Number(previewForm.places) > 0 ? previewForm.places : "не указано"}</dd></div>
            <div><dt>Дедлайн</dt><dd>{previewForm.deadline || "не задан"}</dd></div>
            <div><dt>Версия условий</dt><dd>1 · {previewMode === "open" ? "открытая заявка" : "доступ по приглашению"}</dd></div>
            <div><dt>Оплата</dt><dd>Не утверждена платформой: суммы выплат участник увидит только после подтверждения; премия за оценку 5+ не обещается.</dd></div>
          </dl>
        </article>
        <article className="preview-block">
          <h3>Ограничения и сопровождение</h3>
          <dl>
            <div><dt>Ограничения данных</dt><dd>{previewForm.dataConstraints.trim() === "" ? "не указано" : previewForm.dataConstraints}</dd></div>
            <div><dt>Права на результат</dt><dd>{previewForm.ipTerms.trim() === "" ? "не указано" : previewForm.ipTerms}</dd></div>
            <div><dt>Поддержка</dt><dd>{previewSupport?.name ?? "модель не загружена"}</dd></div>
          </dl>
        </article>
        {previewForm.competencyTags.trim() !== "" && <article className="preview-block">
          <h3>Рубрика</h3>
          <dl>
            <div><dt>Результат</dt><dd>{previewForm.rubricResult.trim() === "" ? "не указано" : previewForm.rubricResult}</dd></div>
            <div><dt>Ход решения</dt><dd>{previewForm.rubricReasoning.trim() === "" ? "не указано" : previewForm.rubricReasoning}</dd></div>
            <div><dt>Неопределённость</dt><dd>{previewForm.rubricUncertainty.trim() === "" ? "не указано" : previewForm.rubricUncertainty}</dd></div>
            <div><dt>Использование ИИ</dt><dd>{previewForm.rubricAiUse.trim() === "" ? "не указано" : previewForm.rubricAiUse}</dd></div>
            <div><dt>Защита решения</dt><dd>{previewForm.rubricDefense.trim() === "" ? "не указано" : previewForm.rubricDefense}</dd></div>
          </dl>
        </article>}
      </section>}
      {!previewOpen && <form className="wizard-form">
        {wizardStep === 1 && (<>
          <label className="span-2" htmlFor="wizard-title-input">Название<input id="wizard-title-input" value={form.title} onChange={(event) => { setForm({ ...form, title: event.target.value }); }} /></label>
          <label className="span-2" htmlFor="wizard-tags-input">Компетенции кейса через запятую<input id="wizard-tags-input" value={form.competencyTags} onChange={(event) => { setForm({ ...form, competencyTags: event.target.value }); }} /></label>
        </>)}
        {wizardStep === 2 && (<>
          <div className={`customer-ai-field span-2${aiFieldState("problem") ? " customer-ai-applied" : ""}`}>
            <label htmlFor="wizard-problem-input">Проблема<textarea id="wizard-problem-input" rows={2} value={form.problem} onChange={(event) => { setForm({ ...form, problem: event.target.value }); clearAiApplied("problem"); }} aria-describedby={aiFieldState("problem") ? "wizard-ai-problem-note" : undefined} /></label>
            {aiFieldState("problem") && <span className="customer-ai-applied-flag" id="wizard-ai-problem-note" data-testid="wizard-ai-applied"><span aria-hidden="true">✦</span>Добавлено AI</span>}
          </div>
          <div className={`customer-ai-field span-2${aiFieldState("deliverable") ? " customer-ai-applied" : ""}`}>
            <label htmlFor="wizard-deliverable-input">Результат<textarea id="wizard-deliverable-input" rows={2} value={form.deliverable} onChange={(event) => { setForm({ ...form, deliverable: event.target.value }); clearAiApplied("deliverable"); }} aria-describedby={aiFieldState("deliverable") ? "wizard-ai-deliverable-note" : undefined} /></label>
            {aiFieldState("deliverable") && <span className="customer-ai-applied-flag" id="wizard-ai-deliverable-note" data-testid="wizard-ai-applied"><span aria-hidden="true">✦</span>Добавлено AI</span>}
          </div>
          <div className={`customer-ai-field span-2${aiFieldState("criterion") ? " customer-ai-applied" : ""}`}>
            <label htmlFor="wizard-criteria-input">Критерии приёмки построчно<textarea id="wizard-criteria-input" rows={3} value={form.criterion} onChange={(event) => { setForm({ ...form, criterion: event.target.value }); clearAiApplied("criterion"); }} aria-describedby={aiFieldState("criterion") ? "wizard-ai-criteria-note" : undefined} /></label>
            {aiFieldState("criterion") && <span className="customer-ai-applied-flag" id="wizard-ai-criteria-note" data-testid="wizard-ai-applied"><span aria-hidden="true">✦</span>Добавлено AI</span>}
          </div>
          <div className="ai-draft-editor span-2" aria-label="AI-подсказка по брифу">
            {!aiDraftSuggestion.isPending && !aiDraft && <button type="button" className="secondary-button" onClick={() => { aiDraftSuggestion.mutate(); }}>AI-подсказка по брифу</button>}
            {aiDraftSuggestion.isPending && <small>Анализируем бриф…</small>}
            {aiDraft && (<>
              <small>{aiDraft.notice}</small>
              {aiDraft.problem !== "" && (<>
                <label htmlFor="wizard-ai-problem">Черновик · проблема<textarea id="wizard-ai-problem" data-testid="wizard-ai-problem" rows={2} value={aiDraft.problem} onChange={(event) => { setAiDraft({ ...aiDraft, problem: event.target.value }); }} /></label>
                <label htmlFor="wizard-ai-deliverable">Черновик · результат<textarea id="wizard-ai-deliverable" data-testid="wizard-ai-deliverable" rows={2} value={aiDraft.deliverable} onChange={(event) => { setAiDraft({ ...aiDraft, deliverable: event.target.value }); }} /></label>
                <label htmlFor="wizard-ai-criteria">Черновик · критерии<textarea id="wizard-ai-criteria" data-testid="wizard-ai-criteria" rows={2} value={aiDraft.criteria} onChange={(event) => { setAiDraft({ ...aiDraft, criteria: event.target.value }); }} /></label>
              </>)}
              <div className="wizard-actions span-2">{aiDraft.problem !== "" && <button type="button" onClick={() => { applyAiDraft(); }}>Вставить в бриф</button>}{aiDraft.problem !== "" && <button className="secondary-button" type="button" onClick={() => { setAiDraft(null); }}>Отклонить</button>}</div>
            </>)}
          </div>
          {aiApplied.length > 0 && <section className="customer-ai-changes" aria-label="Фрагменты, добавленные AI-подсказкой">
            <header>
              <h3>Фрагменты от AI-подсказки</h3>
              <small>Метка «Добавлено AI» и описание доступны без графики; градиент — вспомогательное выделение до правки или отмены.</small>
            </header>
            <ul data-testid="wizard-ai-changes" aria-live="polite">
              {aiApplied.map((entry) => (<li className="customer-ai-change" key={entry.field} data-testid="wizard-ai-change" data-field={entry.field}>
                <span className="customer-ai-change-meta">{aiAppliedTitles[entry.field]}</span>
                <span className="customer-ai-change-diff">
                  <span className="customer-ai-before" data-testid={`wizard-ai-${entry.field}-before`}>{`До: ${entry.before.trim() === "" ? "пусто" : entry.before}`}</span>
                  <span className="customer-ai-after" data-testid={`wizard-ai-${entry.field}-after`}>{`После: ${entry.after}`}</span>
                </span>
                <button type="button" className="secondary-button" onClick={() => { undoAiApplied(entry.field); }}>Отменить</button>
              </li>))}
            </ul>
          </section>}
        </>)}
        {wizardStep === 3 && (<>
          <label htmlFor="wizard-deadline-input">Дедлайн<input id="wizard-deadline-input" type="datetime-local" value={form.deadline} onChange={(event) => { setForm({ ...form, deadline: event.target.value }); }} /></label>
          <label className="span-2" htmlFor="wizard-constraints-input">Ограничения данных<input id="wizard-constraints-input" value={form.dataConstraints} onChange={(event) => { setForm({ ...form, dataConstraints: event.target.value }); }} /></label>
          {form.competencyTags.trim() && (<>
            <label htmlFor="wizard-rubric-result">Рубрика · результат<input id="wizard-rubric-result" value={form.rubricResult} onChange={(event) => { setForm({ ...form, rubricResult: event.target.value }); }} /></label>
            <label htmlFor="wizard-rubric-reasoning">Рубрика · ход решения<input id="wizard-rubric-reasoning" value={form.rubricReasoning} onChange={(event) => { setForm({ ...form, rubricReasoning: event.target.value }); }} /></label>
            <label htmlFor="wizard-rubric-uncertainty">Рубрика · неопределённость<input id="wizard-rubric-uncertainty" value={form.rubricUncertainty} onChange={(event) => { setForm({ ...form, rubricUncertainty: event.target.value }); }} /></label>
            <label htmlFor="wizard-rubric-ai">Рубрика · использование ИИ<input id="wizard-rubric-ai" value={form.rubricAiUse} onChange={(event) => { setForm({ ...form, rubricAiUse: event.target.value }); }} /></label>
            <label htmlFor="wizard-rubric-defense">Рубрика · защита решения<input id="wizard-rubric-defense" value={form.rubricDefense} onChange={(event) => { setForm({ ...form, rubricDefense: event.target.value }); }} /></label>
          </>)}
        </>)}
        {wizardStep === 4 && (<>
          <label className="span-2" htmlFor="wizard-support-model">Модель поддержки<select id="wizard-support-model" value={form.supportModel} onChange={(event) => { setForm({ ...form, supportModel: event.target.value }); }}>{supportCatalog.data?.models.map((model) => <option key={model.code} value={model.code} disabled={!model.available}>{model.name}{model.available ? "" : ` — ${model.unavailable_reason ?? "недоступно"}`}</option>)}</select></label>
          {supportCatalog.isLoading && <small className="span-2">Загружаем опубликованные модели поддержки…</small>}
          {supportCatalog.isError && <p className="span-2" role="alert">Не удалось загрузить модели поддержки. Повторите позже.</p>}
          {(() => { const model = supportCatalog.data?.models.find((item) => item.code === form.supportModel); return model ? <section className="span-2" aria-live="polite"><h3>{model.name}</h3><p><strong>Кто отвечает:</strong> {model.responsible}</p><p><strong>Что входит:</strong> {model.activities.join(" · ")}</p><p><strong>SLA:</strong> {model.response_time}</p><p><strong>Ограничения:</strong> {model.restrictions.join(" · ")}</p>{model.requires_assignee && <label htmlFor="wizard-support-assignee">Назначение<select id="wizard-support-assignee" value={form.supportAssignee} onChange={(event) => { setForm({ ...form, supportAssignee: event.target.value }); }}><option value="request">Запросить назначение ментора у платформы</option><option value="" disabled>Выберите допустимого ментора</option></select></label>}</section> : null; })()}
          <label htmlFor="wizard-places-input">Мест для участников<input id="wizard-places-input" type="number" min="1" value={form.places} onChange={(event) => { setForm({ ...form, places: event.target.value }); }} /></label>
          <label htmlFor="wizard-factor-input">Множитель A вклада в итоговую оценку<input id="wizard-factor-input" type="text" value={form.aMultiplier} onChange={(event) => { setForm({ ...form, aMultiplier: event.target.value }); }} /></label>
          <small className="span-2">Суммы выплат участники увидят только после подтверждения платформой; неподтверждённая символическая премия не показывается как обещание.</small>
        </>)}
        {wizardStep === 5 && (<>
          <h3 id="wizard-preview-title">Предпросмотр участника</h3>
          <p><strong>{form.title}</strong></p>
          <p>{form.problem}</p>
          <p>Результат: {form.deliverable}</p>
          <ul>{form.criterion.split("\n").map((item) => item.trim()).filter(Boolean).map((item, index) => <li key={`preview-${String(index)}`}>{item}</li>)}</ul>
          <p>Условия: версия 1 · {taskMode === "open" ? "открытая заявка" : "доступ по приглашению"}</p>
          <p>Поддержка: {supportCatalog.data?.models.find((item) => item.code === form.supportModel)?.name ?? "модель не загружена"}</p>
        </>)}
      </form>}
      {!previewOpen && wizardStep === 5 && briefGaps().length > 0 && <p role="alert" data-testid="wizard-brief-complete">{`Бриф неполный: заполните ${briefGaps().join(", ")}.`}</p>}
      {!previewOpen && <div className="wizard-actions span-2">
        {wizardStep > 1 && <button className="secondary-button" type="button" onClick={() => { setWizardStep(wizardStep - 1); }}>Назад</button>}
        {wizardStep < 5 ? <button type="button" disabled={!canAdvance(wizardStep)} onClick={() => { setWizardStep(wizardStep + 1); }}>Далее</button> : (<>
          <button className="secondary-button" type="button" onClick={openPreview}>Показать предпросмотр</button>
          <button className="secondary-button" type="button" disabled={create.isPending || !form.title.trim()} onClick={() => { setPublishAfterCreate(false); create.mutate(); }}>Сохранить черновик</button>
          <button type="button" disabled={create.isPending || briefGaps().length > 0} onClick={() => { setPublishAfterCreate(true); create.mutate(); }}>Отправить на модерацию</button>
          {create.isError && <p role="alert">Не удалось сохранить задачу. Проверьте обязательные поля.</p>}
        </>)}
      </div>}
    </section>}
    {isDemoProjection && <section className="customer-hero-grid" aria-label="Демонстрационная сводка"><article className="customer-focus-card"><div><p className="eyebrow">Ближайшая задача под вашим контролем</p><div className="focus-meta"><Badge tone="success">MVP</Badge><span>ID IMP-2026-0412</span><Badge>В работе</Badge></div><h2>Прототип рекомендательной системы для научных статей</h2><p>Разработка MVP, который на основе эмбеддингов и метаданных предлагает релевантные научные статьи.</p><dl><div><dt>Заявок</dt><dd>28</dd></div><div><dt>Участников</dt><dd>6</dd></div><div><dt>Дедлайн</dt><dd>25 апреля</dd></div></dl><div className="focus-actions"><button type="button" onClick={() => { window.location.assign("/workspace/1?task=IMP-2026-0412"); }}>Открыть задачу →</button><button className="secondary-button" type="button" onClick={() => { window.location.assign("/workspace/1?task=IMP-2026-0412&result=open"); }}>Посмотреть результаты</button></div></div><div className="customer-visual" aria-hidden="true"><span /><span /><span /><span /></div></article><aside className="ai-panel customer-ai"><div><span className="ai-orb" aria-hidden="true">✦</span><div><h2>AI-помощник заказчика</h2><span className="ui-badge ui-badge--ai">Бета</span></div></div><p>Поможет сформулировать техническое задание, уточнить критерии и предложить релевантные форматы результата.</p><ul><li>Проверит полноту брифа</li><li>Подсветит риски сроков</li><li>Предложит критерии приёмки</li></ul><div className="ai-boundary">Не публикует задачу и не принимает решения за заказчика.</div><button type="button" onClick={() => { window.location.assign("/workspace/5"); }}>Получить рекомендации →</button></aside></section>}
    {!isDemoProjection && priorityTask && <section className="customer-focus-card" aria-labelledby="priority-task-title"><div><p className="eyebrow">Ближайшая задача под вашим контролем</p><h2 id="priority-task-title">{priorityTask.title}</h2><p>{customerTaskStatus(priorityTask)} · {priorityTask.pending_result_count ? `${String(priorityTask.pending_result_count)} результатов ждут решения` : "Откройте задачу, чтобы проверить состояние"}</p><dl><div><dt>Заявок</dt><dd>{priorityTask.application_count ?? 0}</dd></div><div><dt>Участников</dt><dd>{priorityTask.assignment_count ?? 0}</dd></div><div><dt>Дедлайн</dt><dd>{priorityTask.deadline_at ? new Date(priorityTask.deadline_at).toLocaleDateString("ru-RU") : "Не задан"}</dd></div></dl><div className="focus-actions"><button type="button" onClick={() => { setSelectedTask(priorityTask.id); }}>Открыть задачу →</button><button className="secondary-button" type="button" onClick={() => { setSelectedTask(priorityTask.id); }}>Посмотреть результаты</button></div></div></section>}
    {!isDemoProjection && <nav aria-label="Фильтр задач" className="kind-switch">{(["all", "draft", "in_progress", "awaiting_acceptance", "completed"] as TaskFilter[]).map((filter) => <button key={filter} type="button" className={taskFilter === filter ? "active" : ""} onClick={() => { setTaskFilter(filter); }}>{({ all: "Все", draft: "Черновики", in_progress: "В работе", awaiting_acceptance: "На проверке", completed: "Завершённые" })[filter]}</button>)}<label>Сортировка<select value={taskSort} onChange={(event) => { setTaskSort(event.target.value as TaskSort); }}><option value="action">Требует действия</option><option value="deadline">Ближайший срок</option></select></label></nav>}
    <div className="customer-lower-grid"><section className="customer-task-list" aria-labelledby="customer-tasks-title"><header><div><p className="eyebrow">Портфель задач</p><h2 id="customer-tasks-title">Мои задачи</h2></div><div className="list-tools"><span>{filteredTasks.length} показано</span></div></header>{filteredTasks.length === 0 && !isDemoProjection && <StatePanel kind="empty" />}{orderedTasks.map((task) => <article className="customer-task-row" key={task.id}><span className="activity-symbol">▤</span><div><strong>{task.title}</strong><small>{task.project_key} · {task.places} мест · {task.deadline ?? `сопровождение: ${task.support_mode ?? "назначит платформа"}`}</small></div><Badge tone={task.status === "published" || task.status === "accepted" ? "success" : task.status === "submitted" ? "warning" : "neutral"}>{customerTaskStatus(task)}</Badge><span className="task-applications"><small>Заявок</small><strong>{task.application_count ?? task.applications ?? "—"}</strong></span><div className="row-actions">{!task.demo && task.status === "draft" && <button type="button" onClick={() => { submit.mutate(task.id); }}>Отправить на модерацию</button>}<button className="secondary-button" type="button" disabled={task.demo} onClick={() => { setSelectedTask(task.id); }}>›</button></div></article>)}</section>{isDemoProjection && <aside className="customer-side-stack"><section className="compact-panel"><header><h2>Последние результаты</h2><button type="button" onClick={() => { window.location.assign("/workspace/1?task=IMP-2025-0310&result=open"); }}>Все →</button></header><article><span className="result-thumb result-thumb--one" /><div><strong>Модуль классификации</strong><small>Мария Ковалёва</small></div><Badge tone="success">Принят</Badge><b>Проверено</b></article><article><span className="result-thumb result-thumb--two" /><div><strong>Сжатие изображений</strong><small>Иван Петров</small></div><Badge tone="warning">На проверке</Badge><b>—</b></article><article><span className="result-thumb result-thumb--three" /><div><strong>Прогнозирование нагрузки</strong><small>Артём Соколов</small></div><Badge tone="success">Принят</Badge><b>Проверено</b></article></section><section className="compact-panel analytics-preview"><header><h2>Ключевая аналитика</h2><span>3 месяца</span></header><div><article><small>До результата</small><strong>18 дней</strong><em>↓ 22%</em></article><article><small>Доля принятых</small><strong>71%</strong><em>↑ 12%</em></article><article><small>Участников</small><strong>346</strong><em>↑ 28%</em></article></div></section></aside>}</div>
    {!isDemoProjection && <aside className="customer-side-stack" aria-label="Результаты и аналитика"><section className="compact-panel"><header><h2>Последние результаты</h2></header>{portfolioDetails.isLoading && <StatePanel kind="loading" />}{portfolioDetails.isError && <StatePanel kind="error" action="Повторить" onAction={() => { void portfolioDetails.refetch(); }} />}{!portfolioDetails.isLoading && recentResults.length === 0 && <p>Результаты пока не поступили.</p>}{recentResults.map(({ task, result, decision }) => <article key={result.id}><div><strong>{task.title}</strong><small>{result.personal_summary}</small></div><Badge tone={decision?.decision === "accepted" ? "success" : "warning"}>{decision?.decision === "accepted" ? "Принят" : "На проверке"}</Badge><button type="button" className="secondary-button" onClick={() => { setSelectedTask(task.id); }}>Открыть</button></article>)}</section><section className="compact-panel analytics-preview"><header><h2>Ключевая аналитика</h2><a href="/workspace/3">Подробнее</a></header><div><article><small>Доля принятых</small><strong>{acceptedMetric?.value === null || !acceptedMetric ? "Нет данных" : `${String(Number(acceptedMetric.value))}%`}</strong><em>{acceptedMetric ? `${String(acceptedMetric.numerator)} из ${String(acceptedMetric.denominator)}` : "—"}</em></article><article><small>Активных участников</small><strong>{activeMetric?.numerator ?? "—"}</strong></article></div></section></aside>}
    {selectedTask && detail.data && <div className="customer-repeat-action"><button type="button" className="secondary-button" disabled={repeat.isPending} onClick={() => { repeat.mutate(selectedTask); }}>Повторить как новый черновик</button>{repeat.isError && <p role="alert">Не удалось создать повтор задачи.</p>}</div>}
    {selectedTask && detail.isLoading && <StatePanel kind="loading" />}
    {selectedTask && detail.isError && <StatePanel kind="error" action="Повторить" onAction={() => { void detail.refetch(); }} />}
    {selectedTask && detail.data && <section className="application-queue" aria-labelledby="customer-detail-title"><header><h2 id="customer-detail-title">{detail.data.task.title}</h2><button type="button" className="secondary-button" onClick={() => { setSelectedTask(null); }}>Закрыть</button></header><p>{detail.data.problem}</p><p><strong>Результат:</strong> {detail.data.deliverable}</p><p><strong>Критерии:</strong> {detail.data.acceptance_criteria.join("; ")}</p><p><strong>Условия:</strong> версия {detail.data.terms?.version ?? "ещё не опубликована"}</p><p>Заявок: {detail.data.applications.length} · Назначений: {detail.data.assignments.length} · Вкладов: {detail.data.contributions.length}</p>{detail.data.contributions.map((item) => { const existing = detail.data.decisions.find((entry) => entry.contribution_id === item.id); return <article key={item.id}><strong>{item.personal_summary}</strong><span> · {item.status}</span><p>Артефакты: {item.artifact_keys.join(", ") || "нет"}</p>{existing ? <p>Решение: {existing.decision} · {existing.reason}</p> : item.status === "submitted" && <div><label>Причина решения<input value={decisionReason} onChange={(event) => { setDecisionReason(event.target.value); }} /></label><label>Срок доработки<input type="datetime-local" value={decisionDeadline} onChange={(event) => { setDecisionDeadline(event.target.value); }} /></label><button type="button" disabled={!decisionReason.trim() || decide.isPending} onClick={() => { decide.mutate({ contributionId: item.id, decision: "accepted" }); }}>Принять результат</button><button type="button" className="secondary-button" disabled={!decisionReason.trim() || !decisionDeadline || decide.isPending} onClick={() => { decide.mutate({ contributionId: item.id, decision: "revision_requested" }); }}>Вернуть на доработку</button></div>}{existing?.decision === "accepted" && item.status === "accepted" && <div className="credential-actions"><button type="button" disabled={sign.isPending} onClick={() => { sign.mutate(item.id); }}>{sign.isPending ? "Подписываем…" : "Подписать проектный документ (5+)"}</button>{lastVerificationId && <a className="secondary-button" href={`/verify/projects/${encodeURIComponent(lastVerificationId)}`}>Публичная ссылка</a>}</div>}</article>; })}{credentialNotice && <p className="success-banner" role="status"><span>✓</span><div><strong>{credentialNotice}</strong><small>Документ сохранён в портфолио участника.</small></div></p>}{credentialError && <p role="alert">{credentialError}</p>}{decide.isError && <p role="alert">Не удалось сохранить решение. Обновите данные и повторите.</p>}</section>}
    {selectedTask && <section className="application-queue" aria-labelledby="applications-title"><header><h2 id="applications-title">Заявки на выбранную задачу</h2><button className="secondary-button" type="button" onClick={() => { setSelectedTask(null); }}>Закрыть</button></header><div className="kind-switch" role="group" aria-label="Фильтр заявок">{(["all", "applied", "accepted"] as ApplicationFilter[]).map((filter) => <button key={filter} type="button" className={applicationFilter === filter ? "active" : ""} onClick={() => { setApplicationFilter(filter); }}>{({ all: "Все", applied: "Ожидают решения", accepted: "Принятые" })[filter]}</button>)}</div>{applications.isLoading ? <StatePanel kind="loading" /> : (() => { const visible = (applications.data ?? []).filter((item) => applicationFilter === "all" || item.status === applicationFilter); return visible.length ? visible.map((item) => <article className="application-row" data-testid="application-row" key={item.id}><div><strong>{item.participant_name ?? `Участник ${item.person_id.slice(0, 8)}`}</strong><small>Принял условия версии {item.accepted_terms_version}</small><p className="application-experience" data-testid="application-experience">{experienceLabel(item)}</p></div><div className="row-actions">{item.status === "applied" && <button type="button" disabled={accept.isPending} onClick={() => { accept.mutate(item); }}>Принять в работу</button>}<button className="secondary-button" type="button" data-testid="shortlist-toggle" onClick={() => { toggleShortlist(item.id); }}>{shortlist.includes(item.id) ? "Убрать из шорт-листа" : "В шорт-лист"}</button></div><Badge>{item.status}</Badge></article>) : <StatePanel kind="empty" />; })()}</section>}
  </div>;
}
