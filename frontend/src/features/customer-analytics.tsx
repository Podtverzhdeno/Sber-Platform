import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, ArrowRight, BarChart3, BriefcaseBusiness, CalendarDays, CheckCircle2,
  Clock3, Download, FileCheck2, FileText, Filter, Info, RefreshCw,
  Search, ShieldCheck, Target, Users,
} from "lucide-react";

import { apiRequest } from "../api/client";
import "./customer-analytics.scss";

type Tab = "overview" | "activity" | "projects" | "people" | "results";
type Task = {
  id: string;
  title: string;
  status: string;
  places: number;
  deadline?: string | null;
  deadline_at?: string | null;
  application_count?: number | null;
  applications?: number | null;
  assignment_count?: number | null;
  pending_result_count?: number | null;
  accepted_result_count?: number | null;
};
type Metric = {
  key: string;
  label: string;
  numerator: number;
  denominator: number;
  value: string | null;
  unit: "percent" | "count" | "hours";
  definition: string;
  freshness: "fresh" | "stale" | "unknown";
  suppressed: boolean;
  suppression_reason: string | null;
  period_start: string;
  period_end: string;
  cohort: string;
};
type AnalyticsData = { role: string; metrics: Metric[] };
type StatusGroup = "draft" | "published" | "working" | "review" | "finished" | "other";

const tabs: { key: Tab; title: string; Icon: typeof Activity }[] = [
  { key: "overview", title: "Обзор", Icon: BarChart3 },
  { key: "activity", title: "Активность", Icon: Activity },
  { key: "projects", title: "Проекты", Icon: BriefcaseBusiness },
  { key: "people", title: "Участники", Icon: Users },
  { key: "results", title: "Результаты", Icon: FileCheck2 },
];
const statuses: Record<StatusGroup, { label: string; color: string }> = {
  draft: { label: "Черновики", color: "muted" },
  published: { label: "Опубликованы", color: "blue" },
  working: { label: "В работе", color: "cyan" },
  review: { label: "На проверке", color: "violet" },
  finished: { label: "Завершены", color: "green" },
  other: { label: "Другой статус", color: "muted" },
};
const metricNames: Record<string, string> = {
  customer_tasks: "Всего задач",
  customer_applications: "Заявки",
  customer_active_people: "Участники",
  customer_revisions: "Доработки",
};
const nf = new Intl.NumberFormat("ru-RU");
const dateValue = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const showDate = (value: string | null | undefined) => {
  const timestamp = dateValue(value);
  return timestamp === null ? "Срок не указан" : new Date(timestamp).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
};
const deadline = (task: Task) => task.deadline_at ?? task.deadline;
const statusGroup = (status: string): StatusGroup => {
  const value = status.toLowerCase();
  if (["draft", "черновик"].includes(value)) return "draft";
  if (["published", "open", "опубликована"].includes(value)) return "published";
  if (["staffed", "in_progress", "active", "в работе"].includes(value)) return "working";
  if (["submitted", "review", "awaiting_acceptance", "на проверке"].includes(value)) return "review";
  if (["accepted", "closed", "completed", "принята", "завершена"].includes(value)) return "finished";
  return "other";
};
const sumField = (tasks: Task[], field: "pending_result_count" | "accepted_result_count" | "assignment_count") => {
  if (tasks.length === 0) return 0;
  if (tasks.some(task => typeof task[field] !== "number")) return null;
  return tasks.reduce((total, task) => total + (task[field] ?? 0), 0);
};
function metricValue(metric: Metric | undefined) {
  if (!metric || metric.suppressed || metric.value === null || metric.freshness === "unknown") return "—";
  const value = Number(metric.value);
  if (!Number.isFinite(value)) return "—";
  if (metric.unit === "percent") return `${nf.format(Math.round(value * 10) / 10)}%`;
  if (metric.unit === "hours") return `${nf.format(Math.round(value * 10) / 10)} ч`;
  return nf.format(value);
}
function MetricCard({ title, value, caption, Icon, tone = "cyan", note }: {
  title: string; value: string; caption: string; Icon: typeof Activity; tone?: string; note?: string;
}) {
  return <article className={`ca2-metric ca2-tone-${tone}`}>
    <div className="ca2-metric-top"><span className="ca2-icon"><Icon size={19}/></span><span className="ca2-metric-note">{note ?? "По данным платформы"}</span></div>
    <span className="ca2-metric-title">{title}</span><strong>{value}</strong><p>{caption}</p>
  </article>;
}
function Section({ eyebrow, title, caption, action, children, className = "" }: {
  eyebrow: string; title: string; caption?: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return <section className={`ca2-panel ${className}`}>
    <header className="ca2-panel-head"><div><span>{eyebrow}</span><h2>{title}</h2>{caption && <p>{caption}</p>}</div>{action}</header>
    {children}
  </section>;
}
function DataBar({ title, value, max, color = "cyan", detail }: {
  title: string; value: number; max: number; color?: string; detail?: string;
}) {
  const width = max > 0 ? Math.max(0, Math.min(100, Math.round(value / max * 100))) : 0;
  return <div className="ca2-data-row">
    <div className="ca2-data-row-label"><strong>{title}</strong><span>{nf.format(value)}{detail ? ` · ${detail}` : ""}</span></div>
    <div className="ca2-bar"><span className={`ca2-bar-${color}`} style={{width:`${String(width)}%`}}/></div>
  </div>;
}
function Empty({ title, body }: { title: string; body: string }) {
  return <div className="ca2-empty"><Info size={22}/><strong>{title}</strong><span>{body}</span></div>;
}
function ActionLink({ children, onClick, primary = false, disabled = false }: {
  children: ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean;
}) {
  return <button type="button" className={primary ? "ca2-action ca2-action-primary" : "ca2-action"} onClick={onClick} disabled={disabled}>{children}<ArrowRight size={15}/></button>;
}
function csvCell(value: string | number) {
  const raw = String(value);
  const safe = /^[=+@-]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function CustomerAnalytics({ navigation = [] }: { navigation?: string[] }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState<StatusGroup | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [explain, setExplain] = useState<string | null>(null);
  const tasksQuery = useQuery({
    queryKey: ["customer-tasks"], queryFn: () => apiRequest<Task[]>("/api/v1/customer/tasks"),
    refetchOnMount: "always",
  });
  const metricsQuery = useQuery({
    queryKey: ["customer-role-analytics"], queryFn: () => apiRequest<AnalyticsData>("/api/v1/analytics/role"),
    refetchOnMount: "always",
  });
  const tasks = tasksQuery.data ?? [];
  const metrics = metricsQuery.data?.role === "customer" ? metricsQuery.data.metrics : [];
  const findMetric = (key: string) => metrics.find(metric => metric.key === key);
  const counts = (Object.keys(statuses) as StatusGroup[]).reduce<Record<StatusGroup, number>>((acc, key) => {
    acc[key] = tasks.filter(task => statusGroup(task.status) === key).length;
    return acc;
  }, { draft: 0, published: 0, working: 0, review: 0, finished: 0, other: 0 });
  const pending = sumField(tasks, "pending_result_count");
  const accepted = sumField(tasks, "accepted_result_count");
  const total = tasks.length;
  const now = Date.now();
  const overdue = tasks.filter(task => {
    const d = dateValue(deadline(task));
    return d !== null && d < now && !["finished", "draft"].includes(statusGroup(task.status));
  });
  const coming = tasks.filter(task => {
    const d = dateValue(deadline(task));
    return d !== null && d >= now && d <= now + 14 * 86400000 && statusGroup(task.status) !== "finished";
  }).sort((a, b) => (dateValue(deadline(a)) ?? 0) - (dateValue(deadline(b)) ?? 0));
  const attention = [...tasks].filter(task => (task.pending_result_count ?? 0) > 0 || overdue.some(item => item.id === task.id))
    .sort((a, b) => (b.pending_result_count ?? 0) - (a.pending_result_count ?? 0));
  const filtered = tasks.filter(task => (filter === "all" || statusGroup(task.status) === filter)
    && (task.title.toLocaleLowerCase("ru-RU").includes(search.trim().toLocaleLowerCase("ru-RU"))))
    .sort((a, b) => (b.pending_result_count ?? 0) - (a.pending_result_count ?? 0));
  const current = filtered.find(task => task.id === selectedTask) ?? filtered[0];
  const navigateSection = (name: string, taskId?: string) => {
    const index = navigation.indexOf(name);
    if (index < 0) return;
    const suffix = taskId ? `?task=${encodeURIComponent(taskId)}` : "";
    void navigate(`/workspace/${String(index)}${suffix}`);
  };
  const hasNavigation = (name: string) => navigation.includes(name);
  const refresh = () => { void tasksQuery.refetch(); void metricsQuery.refetch(); };
  const exportCsv = () => {
    if (!tasksQuery.data && !metricsQuery.data) return;
    const rows: (string | number)[][] = [
      ["Impulse · аналитика заказчика", new Date().toLocaleString("ru-RU")],
      ["Источник", "Данные задач заказчика и /api/v1/analytics/role"],
      ["Показатель", "Значение", "Описание"],
      ...metrics.map(item => [item.label, metricValue(item), item.definition]),
      [],
      ["Задача", "Статус", "Заявки", "Назначения", "Ожидают проверки", "Принятые результаты", "Дедлайн"],
      ...tasks.map(item => [item.title, statuses[statusGroup(item.status)].label,
        item.application_count ?? item.applications ?? "—", item.assignment_count ?? "—",
        item.pending_result_count ?? "—", item.accepted_result_count ?? "—", showDate(deadline(item))]),
    ];
    const csv = "\uFEFF" + rows.map(row => row.map(csvCell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "impulse-customer-analytics.csv"; anchor.click();
    URL.revokeObjectURL(url);
  };
  const hasTasks = tasksQuery.isSuccess;
  const hasMetrics = metricsQuery.isSuccess && metricsQuery.data.role === "customer";
  const loading = tasksQuery.isPending && metricsQuery.isPending;

  return <div className="customer-analytics-v2" data-reference="R-CUS-06">
    <header className="ca2-top">
      <div className="ca2-head-title"><span className="ca2-eyebrow"><span className="ca2-live-dot"/> IMPULSE / АНАЛИТИКА ЗАКАЗЧИКА</span>
        <h1 id="workspace-title">Результаты под контролем</h1>
        <p>Задачи, участники и решения по приёмке — в одном месте. Только показатели, которые можно проверить.</p>
      </div>
      <div className="ca2-header-actions">
        <span className="ca2-source-note"><ShieldCheck size={15}/> Срез по вашим задачам</span>
        <button type="button" className="ca2-icon-button" title="Обновить данные" aria-label="Обновить аналитику" onClick={refresh}><RefreshCw size={18}/></button>
        <button type="button" className="ca2-export" onClick={exportCsv} disabled={!hasTasks && !hasMetrics}><Download size={16}/> Скачать CSV</button>
      </div>
    </header>
    {loading && <div className="ca2-state" role="status"><RefreshCw size={18}/> Загружаем показатели заказчика…</div>}
    {(tasksQuery.isError || metricsQuery.isError || (metricsQuery.isSuccess && !hasMetrics)) && <div className="ca2-warning" role="status"><Info size={18}/><span>Часть данных недоступна. Показатели без подтверждённого источника отображаются как «—».</span><button type="button" onClick={refresh}>Повторить</button></div>}
    <nav className="ca2-tabs" role="tablist" aria-label="Разделы аналитики">
      {tabs.map(item => {const Icon = item.Icon;return <button key={item.key} role="tab" type="button" aria-selected={tab===item.key} className={tab===item.key?"is-active":""} onClick={()=>{setTab(item.key);}}>
        <Icon size={17}/>{item.title}</button>;})}
    </nav>
    <section className="ca2-kpis" aria-label="Главные показатели">
      <MetricCard title="Задачи" value={hasTasks ? nf.format(total) : "—"} caption="Всего в вашем портфеле" Icon={BriefcaseBusiness} />
      <MetricCard title="Заявки" value={hasMetrics ? metricValue(findMetric("customer_applications")) : "—"} caption="Отклики на ваши задачи" Icon={FileText} tone="blue" />
      <MetricCard title="Участники" value={hasMetrics ? metricValue(findMetric("customer_active_people")) : "—"} caption="Уникальные назначенные" Icon={Users} tone="violet" />
      <MetricCard title="Ожидают приёмки" value={hasTasks && pending!==null ? nf.format(pending) : "—"} caption="Результаты требуют решения" Icon={Clock3} tone="gold" note={pending!==null && pending>0?"Требует внимания":"Текущий статус"}/>
    </section>

    {tab==="overview" && <div className="ca2-grid ca2-grid-overview" role="tabpanel" aria-label="Обзор">
      <div className="ca2-stack">
        <Section eyebrow="РАБОЧИЙ ПРОЦЕСС" title="От задачи до принятого результата"
          caption="Заявки, назначения и версии результатов — разные сущности. Не выдаём их за уникальных людей.">
          <div className="ca2-funnel">
            <DataBar title="Задачи" value={hasTasks?total:0} max={Math.max(total,1)} color="blue"/>
            {hasMetrics && ["customer_applications", "customer_active_people", "customer_revisions"].map((key,index)=>{
              const item=findMetric(key); const values=metrics.filter(x=>["customer_applications","customer_active_people","customer_revisions"].includes(x.key)).map(x=>x.suppressed?0:x.numerator);
              const max=Math.max(total,...values,1);
              return !item || item.suppressed ? <div className="ca2-data-row ca2-data-row-unknown" key={key}><div className="ca2-data-row-label"><strong>{metricNames[key]??key}</strong><span>—</span></div><div className="ca2-bar"/></div> : <DataBar key={key} title={metricNames[key]??key} value={item.numerator} max={max} color={index===0?"cyan":index===1?"violet":"gold"}/>;
            })}
          </div>
          {!hasMetrics&&<Empty title="Нет данных по переходам" body="Метрики появятся после загрузки аналитики роли заказчика."/>}
          <div className="ca2-explain"><Info size={17}/><span>Показатели отражают состояние ваших задач и историю решений. Это не воронка регистрации всей платформы.</span></div>
        </Section>
        <Section eyebrow="ПОРТФЕЛЬ" title="Структура задач" caption="Распределение по текущим статусам">
          {hasTasks ? <div className="ca2-status-grid">{(Object.keys(statuses) as StatusGroup[]).filter(key=>key!=="other"||counts.other>0).map(key=>
            <button key={key} type="button" className={`ca2-status-tile ca2-border-${statuses[key].color}`} onClick={()=>{setFilter(key);setTab("projects");}}>
              <strong>{counts[key]}</strong><span>{statuses[key].label}</span><ArrowRight size={14}/></button>)}</div> : <Empty title="Нет данных по задачам" body="Портфель недоступен до загрузки задач."/>}
        </Section>
      </div>
      <div className="ca2-stack">
        <Section eyebrow="НУЖНО ВНИМАНИЕ" title="Что требует решения"
          action={<span className="ca2-counter">{attention.length} задач</span>}>
          {hasTasks&&attention.length>0?<div className="ca2-attention-list">{attention.slice(0,4).map(task=>
            <button type="button" key={task.id} onClick={()=>{navigateSection("Мои задачи",task.id);}} disabled={!hasNavigation("Мои задачи")}>
              <span className="ca2-attention-mark"><Target size={16}/></span><span><strong>{task.title}</strong>
              <small>{(task.pending_result_count??0)>0?`${String(task.pending_result_count)} на приёмке`:"Нужно проверить срок"} · {showDate(deadline(task))}</small></span><ArrowRight size={16}/></button>)}</div>
            :<Empty title="Нет срочных сигналов" body={hasTasks?"Нет результатов, ожидающих приёмки, и просроченных задач.":"Сигналы появятся после загрузки задач."}/>}
          <ActionLink onClick={()=>{navigateSection("Мои задачи");}} disabled={!hasNavigation("Мои задачи")}>Открыть мои задачи</ActionLink>
        </Section>
        <Section eyebrow="БЛИЖАЙШИЕ ДАТЫ" title="Контроль сроков" caption="Сроки задач в следующие 14 дней">
          {hasTasks&&coming.length>0?<div className="ca2-dates">{coming.slice(0,4).map(task=><div key={task.id}>
            <span><CalendarDays size={15}/>{showDate(deadline(task))}</span><strong>{task.title}</strong></div>)}</div>
            :<Empty title="Нет ближайших дедлайнов" body="Задачи с указанными сроками появятся здесь автоматически."/>}
          <button type="button" className="ca2-text-link" onClick={()=>{setTab("activity");}}>Вся активность <ArrowRight size={15}/></button>
        </Section>
      </div>
    </div>}

    {tab==="activity" && <div className="ca2-grid" role="tabpanel" aria-label="Активность">
      <div className="ca2-stack">
        <Section eyebrow="АКТИВНОСТЬ" title="В каком состоянии работа"
          caption="Распределение текущих задач, а не вымышленная недельная статистика посещений">
          {hasTasks?<div className="ca2-activity-bars">{(Object.keys(statuses) as StatusGroup[]).filter(key=>counts[key]>0).map(key=>
            <DataBar key={key} title={statuses[key].label} value={counts[key]} max={Math.max(total,1)} color={statuses[key].color}/>)}
            {total===0&&<Empty title="Портфель пока пуст" body="После публикации задач здесь появится их активность."/>}</div>
          :<Empty title="Активность недоступна" body="Не удалось загрузить статусы задач."/>}
        </Section>
        <Section eyebrow="КОНТРОЛЬ" title="Задачи с близкими сроками">
          {coming.length>0?<div className="ca2-task-list">{coming.map(task=><button type="button" key={task.id} onClick={()=>{navigateSection("Мои задачи",task.id);}} disabled={!hasNavigation("Мои задачи")}><span><strong>{task.title}</strong><small>{statuses[statusGroup(task.status)].label}</small></span><b>{showDate(deadline(task))}</b><ArrowRight size={15}/></button>)}</div>:<Empty title="Сроков на ближайшие две недели нет" body="Здесь отображаются только реальные даты задач."/>}
        </Section>
      </div>
      <div className="ca2-stack">
        <Section eyebrow="СИГНАЛЫ" title="Где может быть задержка">
          <div className="ca2-alert-summary"><div><span>Просроченные задачи</span><strong>{hasTasks?overdue.length:"—"}</strong></div><div><span>Результаты на приёмке</span><strong>{hasTasks&&pending!==null?pending:"—"}</strong></div><div><span>Черновики без публикации</span><strong>{hasTasks?counts.draft:"—"}</strong></div></div>
        </Section>
        <Section eyebrow="ПРИМЕЧАНИЕ" title="Как считается активность">
          <div className="ca2-explain ca2-explain-plain"><Info size={20}/><span>Платформа пока не передаёт сюда полноценную историю событий по датам. Вместо фиктивного календаря показываем реальные статусы, сроки и очередь приёмки.</span></div>
          <ActionLink onClick={()=>{navigateSection("Мои задачи");}} disabled={!hasNavigation("Мои задачи")}>Перейти к работе</ActionLink>
        </Section>
      </div>
    </div>}

    {tab==="projects" && <div className="ca2-grid ca2-grid-projects" role="tabpanel" aria-label="Проекты">
      <Section eyebrow="ПОРТФЕЛЬ ЗАДАЧ" title="Все задачи заказчика" caption="Ищи задачу, фильтруй по статусу и открывай её рабочую область">
        <div className="ca2-toolbar"><label className="ca2-search"><Search size={17}/><input aria-label="Найти задачу" placeholder="Название проекта или задачи…" value={search} onChange={e=>{setSearch(e.target.value);}}/></label><label className="ca2-select"><Filter size={16}/><select aria-label="Фильтр статуса" value={filter} onChange={e=>{setFilter(e.target.value as StatusGroup|"all");}}><option value="all">Все статусы</option>{(Object.keys(statuses) as StatusGroup[]).map(key=><option key={key} value={key}>{statuses[key].label}</option>)}</select></label></div>
        {hasTasks&&filtered.length>0?<div className="ca2-project-table" role="table" aria-label="Показатели проектов"><div className="ca2-project-row ca2-project-row-head" role="row"><span>Проект</span><span>Статус</span><span>Заявки</span><span>Приёмка</span><span>Срок</span><span/></div>
          {filtered.map(task=><button type="button" className="ca2-project-row" role="row" key={task.id} onClick={()=>{setSelectedTask(task.id);}} aria-pressed={current?.id===task.id}><strong>{task.title}</strong><span className={`ca2-tag ca2-tag-${statuses[statusGroup(task.status)].color}`}>{statuses[statusGroup(task.status)].label}</span><span>{task.application_count??task.applications??"—"}</span><span>{task.pending_result_count??"—"}</span><span>{showDate(deadline(task))}</span><ArrowRight size={15}/></button>)}</div>
          :<Empty title="Задачи не найдены" body="Попробуй изменить фильтр или поисковый запрос."/>}
      </Section>
      <Section eyebrow="ВЫБРАННАЯ ЗАДАЧА" title="Карточка проекта">
        {current?<div className="ca2-selected"><span className={`ca2-tag ca2-tag-${statuses[statusGroup(current.status)].color}`}>{statuses[statusGroup(current.status)].label}</span><h3>{current.title}</h3>
          <dl><div><dt>Заявки</dt><dd>{current.application_count??current.applications??"—"}</dd></div><div><dt>Назначения</dt><dd>{current.assignment_count??"—"}</dd></div><div><dt>На приёмке</dt><dd>{current.pending_result_count??"—"}</dd></div><div><dt>Принятые результаты</dt><dd>{current.accepted_result_count??"—"}</dd></div><div><dt>Срок</dt><dd>{showDate(deadline(current))}</dd></div></dl>
          <ActionLink primary onClick={()=>{navigateSection("Мои задачи",current.id);}} disabled={!hasNavigation("Мои задачи")}>Открыть задачу</ActionLink></div>
          :<Empty title="Выбери задачу" body="Информация о выбранной задаче появится здесь."/>}
      </Section>
    </div>}

    {tab==="people" && <div className="ca2-grid" role="tabpanel" aria-label="Участники">
      <div className="ca2-stack"><Section eyebrow="КОМАНДА" title="Участники ваших проектов"
        caption="Уникальные люди с назначениями, а не все пользователи Impulse">
        <div className="ca2-feature-metric"><Users size={27}/><div><strong>{metricValue(findMetric("customer_active_people"))}</strong><span>назначенных участников</span></div></div>
        <div className="ca2-ratio-grid">{["customer_staffing_rate","customer_repeat_participants"].map(key=><div key={key}><strong>{metricValue(findMetric(key))}</strong><span>{key==="customer_staffing_rate"?"Назначения относительно заявок":"Возвращаются в другие задачи"}</span></div>)}</div>
        <ActionLink onClick={()=>{navigateSection("База участников");}} disabled={!hasNavigation("База участников")}>Перейти к участникам</ActionLink>
      </Section>
      <Section eyebrow="ПО ПРОЕКТАМ" title="Где задействованы участники" caption="Назначения по задачам; один человек может быть в нескольких">
        {hasTasks&&tasks.length>0?<div className="ca2-count-list">{[...tasks].sort((a,b)=>(b.assignment_count??-1)-(a.assignment_count??-1)).slice(0,8).map(task=>
          <div key={task.id}><strong>{task.title}</strong><span>{task.assignment_count===null||task.assignment_count===undefined?"—":nf.format(task.assignment_count)} назначений</span></div>)}</div>
          :<Empty title="Нет информации о назначениях" body="Список появится после публикации и назначения участников."/>}
      </Section></div>
      <div className="ca2-stack"><Section eyebrow="ПЕРЕХОДЫ" title="От заявки до участия">
        {["customer_applications","customer_staffing_rate","customer_repeat_participants"].map(key=>{const metric=findMetric(key);return <div className="ca2-interpret" key={key}><span>{metric?.label??key}</span><strong>{metricValue(metric)}</strong><button type="button" onClick={()=>{setExplain(explain===key?null:key);}} aria-expanded={explain===key}><Info size={15}/></button>{explain===key&&<p>{metric?.definition??"Расчёт пока недоступен"}{metric?.suppressed?" · Значение скрыто для небольшой когорты.":""}</p>}</div>;})}
      </Section>
      <Section eyebrow="КАК РАБОТАЕТ" title="Проверяемый опыт"><p className="ca2-note-text">Сильный кандидат — не просто отклик. Важны подтверждённый личный вклад, качество результата и история совместной работы. Участники без разрешённого доступа не раскрываются в аналитике.</p></Section></div>
    </div>}

    {tab==="results" && <div className="ca2-grid" role="tabpanel" aria-label="Результаты">
      <div className="ca2-stack">
        <Section eyebrow="КАЧЕСТВО И ПРИЁМКА" title="Что происходит с результатами">
          <div className="ca2-result-kpis"><MetricCard title="Принятые результаты" value={hasTasks&&accepted!==null?nf.format(accepted):"—"} caption="По данным ваших задач" Icon={CheckCircle2}/><MetricCard title="Отправлено на доработку" value={metricValue(findMetric("customer_revisions"))} caption="Решения по результатам" Icon={RefreshCw} tone="gold"/></div>
          <div className="ca2-ratio-grid"><div><strong>{metricValue(findMetric("customer_submission_rate"))}</strong><span>Сданных версий относительно назначений</span></div><div><strong>{metricValue(findMetric("customer_acceptance_rate"))}</strong><span>Доля решений о приёмке</span></div></div>
          <div className="ca2-explain"><Info size={17}/><span>Повторно сданные версии учитываются отдельно, поэтому переходы могут быть больше 100%. Приёмка считается по решениям заказчика.</span></div>
        </Section>
        <Section eyebrow="НА ПРОВЕРКЕ" title="Очередь результатов" caption="Задачи, где есть результат для решения заказчика">
          {hasTasks&&tasks.some(task=>(task.pending_result_count??0)>0)?<div className="ca2-task-list">{tasks.filter(task=>(task.pending_result_count??0)>0).map(task=>
            <button type="button" key={task.id} disabled={!hasNavigation("Мои задачи")} onClick={()=>{navigateSection("Мои задачи",task.id);}}><span><strong>{task.title}</strong><small>Результат ожидает решения</small></span><b>{task.pending_result_count}</b><ArrowRight size={15}/></button>)}</div>
            :<Empty title="Очередь приёмки пуста" body="Ожидающие решения результаты появятся здесь."/>}
        </Section>
      </div>
      <div className="ca2-stack">
        <Section eyebrow="СКОРОСТЬ" title="Время до принятия результата" caption="От отправки версии до решения о приёмке">
          <div className="ca2-feature-metric"><Clock3 size={26}/><div><strong>{metricValue(findMetric("customer_time_to_result_hours"))}</strong><span>среднее время на проверку</span></div></div>
          <p className="ca2-note-text">Показатель рассчитывается только по принятым версиям, для которых известны обе отметки времени. Без наблюдений отображается прочерк.</p>
        </Section>
        <Section eyebrow="ЧТО ДАЛЬШЕ" title="Следующий шаг"><p className="ca2-note-text">Разбери результаты, оставь конкретную обратную связь и зафиксируй решение. После приёмки подтверждённый опыт учитывается в портфолио участника.</p><ActionLink primary onClick={()=>{navigateSection("Приёмка");}} disabled={!hasNavigation("Приёмка")}>Перейти к приёмке</ActionLink></Section>
      </div>
    </div>}
    <footer className="ca2-footer"><ShieldCheck size={16}/><span>Данные только по доступным задачам заказчика · скрытые показатели не подменяются нулями · обновление по запросу</span></footer>
  </div>;
}
