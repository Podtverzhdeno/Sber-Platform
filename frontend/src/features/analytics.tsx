import { useQuery } from "@tanstack/react-query";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { apiRequest } from "../api/client";
import { Badge, StatePanel } from "../components/ui";
import { loadMonthlyGoal, type MonthlyGoalView } from "./monthly-goal-client";
import { MonthlyGoalDiagram } from "./monthly-goal-card";
import "./analytics-growth.css";

type Stage = { key: string; title: string; status: "completed" | "in_progress" | "not_started" | "unknown"; completed: boolean; count: number };
type Earnings = { calculated: string; approved: string; paid: string; failed: string; currency: string | null; unknown_items: number };
type Analytics = { stages: Stage[]; successful: boolean; next_action: string; earnings: Earnings; freshness: string; generated_at: string };
type Role = "mentor" | "customer" | "manager" | "hr" | "operator";
type Metric = { key: string; label: string; numerator: number; denominator: number; value: string | null; unit: "percent" | "count"; period_start: string; period_end: string; cohort: string; freshness: "fresh" | "stale" | "unknown"; definition: string; suppressed: boolean; suppression_reason: string | null };
type RoleAnalyticsData = { role: Role; metrics: Metric[] };
type GrowthSkill = { skill_key: string; title: string; current_level: string; target_level: string; known: boolean };
type GrowthTrajectory = { track_key: string; track_title: string; policy_version: number; readiness_skills: GrowthSkill[]; readiness: { percent: number | null; coverage: number; partial: boolean }; completion: { percent: number | null; coverage: number; partial: boolean } };
type GrowthSnapshot = { snapshot_id: string; generated_at: string; actor_timezone: string; definitions: Record<string, string>; freshness: { known: boolean; latest_observed_at: string | null }; trajectories: GrowthTrajectory[] };
type EvidenceAnchorView = { competency_key: string; source_kind: string; source_ref: string; level: string; observed_at: string; reason: string; counted: boolean };
type FrameworkSkillView = { skill_key: string; skill_title: string; level: string; explanation: string; anchors: EvidenceAnchorView[]; excluded: EvidenceAnchorView[] };
type FrameworkReportView = { framework_key: string; domain: "course" | "role" | "project"; version: number; title: string; created_at: string; skills: FrameworkSkillView[] };
type BuddySuggestionView = { suggestion_id: string; kind: string; observation: string; gap: string; benefit: string; explanation: string; source_categories: string[]; model_called: boolean; auto_enrolled: boolean; partial: boolean; coverage_note: string };
type BuddySuggestionStateView = { policy_version: number; ai_model_available: boolean; dismissed: boolean; suggestion: BuddySuggestionView | null; suggestions: BuddySuggestionView[] };
const demoAnalytics: Analytics = {
  stages: [
    { key: "learning", title: "Обучение", status: "completed", completed: true, count: 6 },
    { key: "applications", title: "Отклики", status: "completed", completed: true, count: 4 },
    { key: "work", title: "Работа", status: "completed", completed: true, count: 3 },
    { key: "accepted", title: "Принятый результат", status: "completed", completed: true, count: 2 },
  ],
  successful: true,
  next_action: "Завершить MVP рекомендательной системы и отправить артефакты до 12 октября",
  earnings: { calculated: "225000", approved: "200000", paid: "125000", failed: "0", currency: "RUB", unknown_items: 0 },
  freshness: "fresh", generated_at: "2026-09-28T12:00:00Z",
};

type CompetencyView = "technical" | "practical" | "soft";
type Competency = { title: string; level: string; score: number; delta: number; evidence: string; detail: string };

type CourseCertificate = { certificate_id: string; course_key: string; course_title: string; holder_name: string; issued_at: string; period: string; preview_marking: string; program_version: number; result: string; specialization: string; verification_id: string; workload_hours: number; competencies: { competency: string; evidence: string; level: string }[] };
type ProjectCredential = { artifact_keys: string[]; competencies: { competency: string; evidence_refs: string[]; finding: string; level: string }[]; contribution_version: number; credential_id: string; customer_name: string; grade_label: string; holder_name: string; payment_status: string; period: string; personal_summary: string; project_key: string; review_explanation: string; signed_at: string; status: string; superseded_by: string | null; task_key: string; task_title: string; verification_id: string };
type DocumentRecord = { key: string; kind: "certificate" | "project"; title: string; meta: string; verification_id: string; details: [string, string][]; openLabel: string; openHref: string };

const certificateDocuments = (items: CourseCertificate[]): DocumentRecord[] => items.map((item) => ({
  key: `certificate-${item.certificate_id}`,
  kind: "certificate",
  title: item.course_title,
  meta: `Сертификат курса · ${item.period} · ${String(item.workload_hours)} ч`,
  verification_id: item.verification_id,
  details: [
    ["Держатель", item.holder_name] as [string, string],
    ["Специализация", item.specialization] as [string, string],
    ["Компетенции", item.competencies.map((entry) => `${entry.competency} · ${entry.level}`).join("; ")] as [string, string],
    ["Доказательства", item.competencies.map((entry) => entry.evidence).join("; ")] as [string, string],
    ["Результат", item.result] as [string, string],
    ["Версия программы", String(item.program_version)] as [string, string],
    ["Выдан", new Date(item.issued_at).toLocaleDateString("ru-RU")] as [string, string],
    ["Verification ID", item.verification_id] as [string, string],
  ],
  openLabel: "Открыть публичную проверку сертификата",
  openHref: `/verify/${encodeURIComponent(item.verification_id)}`,
}));

const projectCredentialDocuments = (items: ProjectCredential[]): DocumentRecord[] => items.map((item) => ({
  key: `project-${item.verification_id}`,
  kind: "project",
  title: item.task_title,
  meta: `Проектный credential · оценка ${item.grade_label} · ${item.period}`,
  verification_id: item.verification_id,
  details: [
    ["Статус", item.status] as [string, string],
    ["Задача", item.task_title] as [string, string],
    ["Заказчик", item.customer_name] as [string, string],
    ["Держатель", item.holder_name] as [string, string],
    ["Компетенции", item.competencies.map((entry) => `${entry.competency} · ${entry.level}`).join("; ")] as [string, string],
    ["Находки", item.competencies.map((entry) => entry.finding).join("; ")] as [string, string],
    ["Артефакты", item.artifact_keys.join(", ")] as [string, string],
    ["Личное резюме", item.personal_summary] as [string, string],
    ["Решение ревьюера", item.review_explanation] as [string, string],
    ["Подписан", new Date(item.signed_at).toLocaleDateString("ru-RU")] as [string, string],
    ["Verification ID", item.verification_id] as [string, string],
  ],
  openLabel: "Открыть публичную проверку проектного credential",
  openHref: `/verify/projects/${encodeURIComponent(item.verification_id)}`,
}));

export function VerifiedDocumentsPanel() {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const certificates = useQuery({ queryKey: ["bootcamp-certificates"], queryFn: () => apiRequest<CourseCertificate[]>("/api/v1/me/bootcamp/certificates"), refetchOnMount: "always" });
  const projectCredentials = useQuery({ queryKey: ["project-credentials-summary"], queryFn: () => apiRequest<ProjectCredential[]>("/api/v1/me/project-credentials"), refetchOnMount: "always" });
  const documents = [...certificateDocuments(certificates.data ?? []), ...projectCredentialDocuments(projectCredentials.data ?? [])];
  const errorState = certificates.isError || projectCredentials.isError;
  return <><p className="eyebrow">Документы</p><h2 id="documents-title">Проверяемые документы</h2>{documentState(errorState, certificates.isLoading || projectCredentials.isLoading, () => { void certificates.refetch(); void projectCredentials.refetch(); })}{!errorState && !certificates.isLoading && !projectCredentials.isLoading && (documents.length === 0 ? <p role="status">Проверяемых документов пока нет: появляются после подтверждённых результатов.</p> : <section data-testid="document-list" aria-label="Проверяемый список документов">{documents.map((document) => { const open = openKey === document.key; return <article className={open ? "document-item document-item--open" : "document-item"} data-testid="document-item" key={document.key}><span aria-hidden="true">{document.kind === "certificate" ? "✓" : "◆"}</span><div><strong>{document.title}</strong><small>{document.meta}</small></div><button aria-expanded={open} aria-controls={`document-details-${document.key}`} className="document-toggle" type="button" onClick={() => { setOpenKey(open ? null : document.key); }}>{open ? "Свернуть" : "Проверить"}</button>{open && <section className="document-viewer" data-testid="document-viewer" id={`document-details-${document.key}`} aria-label={`Проверка документа ${document.title}`}><p className="document-viewer-heading">Verification viewer · {document.verification_id}</p><dl>{document.details.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl><a href={document.openHref}>{document.openLabel}</a><button data-testid="document-pdf" type="button" onClick={() => { window.print(); }}>Печать / PDF</button></section>}</article>; })}</section>)}</>;
}

const documentState = (error: boolean, isLoading: boolean, retry: () => void): ReactNode => error ? <StatePanel kind="error" action="Повторить" onAction={retry} /> : isLoading ? <StatePanel kind="loading" /> : null;

type ReadinessPlanProps = { navigation: string[]; gapExpanded: boolean; setGapExpanded: (update: (value: boolean) => boolean) => void };

function readinessPlan({ navigation, gapExpanded, setGapExpanded }: ReadinessPlanProps): ReactNode {
  const tasksIndex = navigation.indexOf("Задачи");
  const workspaceHref = tasksIndex >= 0 ? `/workspace/${String(tasksIndex)}` : null;
  const workspaceLabel = workspaceHref ? "Открыть рабочую область задачи →" : "Рабочая область задачи недоступна в боковой навигации";
  const planSteps: { label: string; detail: string; actionLabel: string }[] = [
    { label: "Добавить unit-тесты", detail: "retry, timeout и rate limit", actionLabel: "Открыть рабочую область задачи с checkpoint →" },
    { label: "Запустить integration suite", detail: "минимум 80% критического пути", actionLabel: "Открыть рабочую область задачи с suite →" },
    { label: "Отправить evidence ментору", detail: "отчёт, commit и объяснение границ", actionLabel: "Открыть рабочую область задачи с формой evidence →" },
  ];
  return <>
    <button className={`readiness-gap${gapExpanded ? " readiness-gap--expanded" : ""}`} type="button" aria-expanded={gapExpanded} onClick={() => { setGapExpanded((value) => !value); }}><span className="readiness-gap__top"><strong>До следующего уровня</strong><i>{gapExpanded ? "−" : "+"}</i></span><p>Завершите проектный checkpoint по автоматическим тестам.</p><em>Прогноз после принятия: 54% → 66% (+12%)</em></button>
    {gapExpanded && <div className="readiness-detail"><p className="eyebrow">План подтверждения</p><h3>Автоматические тесты API</h3><ul>{planSteps.map((step, index) => <li key={step.label}><span>{String(index + 1)}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div>{workspaceHref ? <a data-testid={`plan-step-${String(index)}`} href={workspaceHref}>{step.actionLabel}</a> : <span role="status">{workspaceLabel}</span>}</li>)}</ul><dl><div><dt>Сейчас</dt><dd>54%</dd></div><div><dt>Прогноз после принятия</dt><dd>66%</dd></div><div><dt>Дедлайн</dt><dd>12 октября</dd></div></dl>{workspaceHref && <a href={workspaceHref}>Открыть проектный checkpoint →</a>}</div>}
	</>;
}

const competencyGroups: Record<CompetencyView, { label: string; eyebrow: string; competencies: Competency[] }> = {
  technical: {
    label: "Технические знания",
    eyebrow: "Курсы + проверенные задания",
    competencies: [
      { title: "Python", level: "Уверенный", score: 82, delta: 9, evidence: "2 курса · итоговый тест 91%", detail: "Синтаксис, асинхронность и структура приложений подтверждены курсами Python для R&D и 6 проверенными заданиями." },
      { title: "API и интеграции", level: "Уверенный", score: 76, delta: 14, evidence: "Checkpoint + ревью ментора", detail: "Спроектирован контракт внешних источников; ментор подтвердил пагинацию, обработку лимитов и версионирование." },
      { title: "Автотесты", level: "Развивается", score: 54, delta: 8, evidence: "Курс · не хватает project evidence", detail: "Учебные тесты пройдены, но проектный checkpoint с unit и integration coverage ещё не принят." },
      { title: "OpenSpec / SDD", level: "Уверенный", score: 71, delta: 18, evidence: "Сертификат · 4 задания", detail: "Подтверждены формализация требований, сценарии WHEN/THEN и трассировка реализации до спецификации." },
      { title: "Работа с данными", level: "Базовый+", score: 64, delta: 6, evidence: "Курс + notebook", detail: "Подтверждены подготовка выборки, валидация схемы и базовая оценка качества данных." },
    ],
  },
  practical: {
    label: "Практические навыки",
    eyebrow: "Принятые проекты + артефакты",
    competencies: [
      { title: "Декомпозиция задачи", level: "Сильный", score: 86, delta: 12, evidence: "2 проекта · оценка A", detail: "Бизнес-задача разделена на проверяемые этапы, зависимости и критерии приёмки; план принят заказчиком." },
      { title: "Качество решения", level: "Уверенный", score: 79, delta: 10, evidence: "Benchmark + оценка A", detail: "Результат сравнивался с baseline, ограничения описаны, воспроизводимый отчёт принят ментором." },
      { title: "Надёжность", level: "Развивается", score: 61, delta: 7, evidence: "2 ревью · checkpoint в работе", detail: "Обработка ошибок реализована частично; следующий шаг — автоматические тесты retry, timeout и rate limit." },
      { title: "Документация", level: "Уверенный", score: 77, delta: 11, evidence: "README + OpenAPI", detail: "Архитектурное решение, запуск и API-контракт проверены в проекте рекомендательной системы." },
      { title: "Доставка результата", level: "Подтверждён", score: 83, delta: 15, evidence: "2 принятых вклада", detail: "Два личных вклада приняты заказчиками в срок и связаны с проверяемыми версиями артефактов." },
    ],
  },
  soft: {
    label: "Гибкие навыки",
    eyebrow: "Отзывы команды + решения людей",
    competencies: [
      { title: "Командная работа", level: "Сильный", score: 88, delta: 9, evidence: "4 human feedback", detail: "Участник синхронизировал API-контракт с Data Science и помог команде подготовить финальную защиту." },
      { title: "Коммуникация", level: "Уверенный", score: 81, delta: 13, evidence: "Ментор + заказчик", detail: "Статусы и риски формулировались заранее; уточнения привели к сокращению повторных доработок." },
      { title: "Самостоятельность", level: "Уверенный", score: 78, delta: 8, evidence: "3 checkpoint без эскалации", detail: "Три этапа завершены самостоятельно с корректным запросом обратной связи в точках решения." },
      { title: "Работа с обратной связью", level: "Сильный", score: 90, delta: 16, evidence: "2 итерации · без повтора ошибок", detail: "Замечания ментора преобразованы в конкретные изменения; повторное ревью принято без возврата." },
      { title: "Презентация результата", level: "Развивается", score: 66, delta: 5, evidence: "1 защита проекта", detail: "Техническая часть убедительна; следующий рост — короче связывать метрики модели с бизнес-эффектом." },
    ],
  },
};

function CompetencyRadar({ items }: { items: Competency[] }) {
  const centerX = 170;
  const centerY = 140;
  const radius = 78;
  const point = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / items.length;
    const scaled = radius * value / 100;
    return `${String(centerX + Math.cos(angle) * scaled)},${String(centerY + Math.sin(angle) * scaled)}`;
  };
  const labelPoint = (index: number) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / items.length;
    return { x:centerX + Math.cos(angle) * 112, y:centerY + Math.sin(angle) * 108, anchor:Math.cos(angle) > .25 ? "start" : Math.cos(angle) < -.25 ? "end" : "middle" } as const;
  };
  const rings = [25, 50, 75, 100];
  return <div className="competency-radar"><svg viewBox="0 0 340 280" role="img" aria-label="Циклограмма уровня компетенций с подписями показателей">
    {rings.map((ring) => <polygon className="radar-ring" key={ring} points={items.map((_, index) => point(index, ring)).join(" ")} />)}
    {items.map((item, index) => <line className="radar-axis" key={item.title} x1={centerX} y1={centerY} x2={point(index, 100).split(",")[0]} y2={point(index, 100).split(",")[1]} />)}
    <polygon className="radar-value" points={items.map((item, index) => point(index, item.score)).join(" ")} />
    {items.map((item, index) => { const [cx, cy] = point(index, item.score).split(","); return <circle className="radar-point" key={item.title} cx={cx} cy={cy} r="4" />; })}
    {items.map((item,index)=>{const label=labelPoint(index);return <text className="radar-axis-label" key={`label-${item.title}`} x={label.x} y={label.y} textAnchor={label.anchor}><tspan x={label.x}>{item.title}</tspan><tspan className="radar-axis-score" x={label.x} dy="13">{item.score}%</tspan></text>;})}
  </svg><div className="radar-legend">{items.map((item, index) => <span key={item.title}><i style={{ "--radar-index": index } as CSSProperties} />{item.title}<strong>{item.score}%</strong></span>)}</div></div>;
}

const growthLevelRank: Record<string, number> = { "базовый": 1, "уверенный": 2 };

function growthLevel(label: string, known: boolean): number | null {
  if (!known) return null;
  return growthLevelRank[label.toLowerCase()] ?? null;
}

const monthlyGoalStatusLabels: Record<string, string> = {
  completed: "Подтверждено",
  submitted: "Ожидает проверки",
  available: "Доступно",
  locked: "Сначала предыдущий шаг",
  unknown: "Нет опубликованного mapping",
};

const drilldownSuggestionNeedle = (suggestion: BuddySuggestionView): string =>
  `${suggestion.observation} ${suggestion.gap} ${suggestion.benefit} ${suggestion.explanation}`.toLowerCase();

function SkillDrilldown({ snapshot, skill, reports, reportsPending, reportsError, onRetryReports, buddy, buddyPending }: {
  snapshot: GrowthSnapshot;
  skill: GrowthSkill;
  reports?: FrameworkReportView[];
  reportsPending?: boolean;
  reportsError?: boolean;
  onRetryReports?: () => void;
  buddy?: BuddySuggestionStateView;
  buddyPending?: boolean;
}) {
  const needle = skill.title.toLowerCase();
  const lineage = (reports ?? [])
    .map((report) => ({ report, entry: report.skills.find((item) => item.skill_key === skill.skill_key) ?? null }))
    .filter((item): item is { report: FrameworkReportView; entry: FrameworkSkillView } => item.entry !== null);
  const buddyTip: BuddySuggestionView | null =
    (buddy?.suggestions ?? []).find((suggestion) => drilldownSuggestionNeedle(suggestion).includes(needle)) ??
    (buddy?.suggestion != null && drilldownSuggestionNeedle(buddy.suggestion).includes(needle) ? buddy.suggestion : null);
  const observed = lineage.flatMap(({ entry }) => entry.anchors.map((anchor) => anchor.observed_at));
  const lastObserved = observed.length > 0 ? new Date(Math.max(...observed.map((value) => new Date(value).getTime()))).toLocaleString("ru-RU") : null;
  return <section className="skill-drilldown" id={`drilldown-${skill.skill_key}`} data-testid="skill-drilldown" aria-labelledby="skill-drilldown-title">
    <h3 id="skill-drilldown-title">{skill.title}</h3>
    {!skill.known && <p role="status">Уровень не подтверждён: разрешённые источники ещё не наблюдались. «Не подтверждено» — точная подпись, а не ноль.</p>}
    <p data-testid="skill-definition">Определение: навык подтверждается только источниками, разрешёнными версиями фреймворков; уровень считается по формуле <strong>{snapshot.definitions.readiness ?? "impulse-growth-readiness"}</strong>.</p>
    <p data-testid="skill-formula">Формула: взвешенная доля min(текущий, цель) с ограничением до 100%; неизвестный обязательный уровень не заменяется нулём — итог остаётся неполным (coverage).</p>
    {reportsError ? <p data-testid="skill-lineage" role="alert">Линия доказательств недоступна прямо сейчас. Уровень остаётся с точной подписью.<button className="secondary-button" type="button" onClick={onRetryReports}>Повторить</button></p>
      : reportsPending ? <p data-testid="skill-lineage" role="status">Загружается линия доказательств…</p>
      : lineage.length === 0 ? <p data-testid="skill-lineage">Источники для навыка в ваших фреймворках не зафиксированы: линия пуста, «не подтверждено» не заменяется нулём.</p>
      : <div data-testid="skill-lineage">{lineage.map(({ report, entry }) => <div className="skill-lineage" key={report.framework_key}><h4>{report.title} · v{String(report.version)}</h4><p>{entry.explanation}</p><ul>{entry.anchors.map((anchor, index) => <li key={index}>{anchor.source_kind}:{anchor.source_ref} · {anchor.level} · {new Date(anchor.observed_at).toLocaleDateString("ru-RU")}</li>)}{entry.excluded.map((anchor, index) => <li key={`excluded-${String(index)}`} className="skill-evidence--excluded">{anchor.source_kind}:{anchor.source_ref} — не учитывается: {anchor.reason}</li>)}</ul></div>)}</div>}
    <p data-testid="skill-history">История: {lastObserved === null ? "подтверждённых точек ещё нет — пусто, не ноль." : `последнее подтверждённое наблюдение ${lastObserved}`}.</p>
    <p data-testid="skill-freshness">Свежесть: {snapshot.freshness.known && snapshot.freshness.latest_observed_at !== null ? `последнее проверяемое событие снапшота ${new Date(snapshot.freshness.latest_observed_at).toLocaleString("ru-RU")}` : "проверяемых событий ещё нет — данные не подменяются нулём."}</p>
    <aside className="skill-buddy" data-testid="skill-buddy">
      <p className="eyebrow">Совет Buddy · не решение</p>
      {buddyPending ? <p role="status">Buddy готовит совет…</p> : buddyTip !== null ? <>
        <p><strong>{buddyTip.gap}</strong></p>
        <p>{buddyTip.observation}</p>
        <p><strong>Что даст:</strong> {buddyTip.benefit}</p>
        <small>{buddyTip.explanation}</small>
      </> : <p>Пока нет совета по этому навыку: Buddy опирается только на подтверждённые данные и не меняет уровень.</p>}
      <small>Совет не вызывает модель и не переносит уровень навыка: подтверждение возможно только через проверяемое evidence.</small>
    </aside>
  </section>;
}

export function TrajectoryGrowthAnalytics({ snapshot, selectedTrajectoryKey, onTrajectorySelect, selectedSkillKey, onSkillSelect, reports, reportsPending, reportsError, onRetryReports, buddy, buddyPending, goal }: {
  snapshot: GrowthSnapshot;
  selectedTrajectoryKey?: string;
  onTrajectorySelect?: (track: string) => void;
  selectedSkillKey?: string | null;
  onSkillSelect?: (skill: string | null) => void;
  reports?: FrameworkReportView[];
  reportsPending?: boolean;
  reportsError?: boolean;
  onRetryReports?: () => void;
  buddy?: BuddySuggestionStateView;
  buddyPending?: boolean;
  goal?: MonthlyGoalView | null;
}) {
  const [localTrajectory, setLocalTrajectory] = useState(snapshot.trajectories[0]?.track_key ?? "");
  const [localSkill, setLocalSkill] = useState<string | null>(null);
  const trajectoryKey = selectedTrajectoryKey !== undefined ? selectedTrajectoryKey : localTrajectory;
  const skillKey = selectedSkillKey !== undefined ? selectedSkillKey : localSkill;
  const selectTrajectory = (track: string) => { if (onTrajectorySelect === undefined) setLocalTrajectory(track); else onTrajectorySelect(track); };
  const toggleSkill = (skill: string) => { if (onSkillSelect === undefined) setLocalSkill((current) => (current === skill ? null : skill)); else onSkillSelect(skillKey === skill ? null : skill); };
  const selected = snapshot.trajectories.find((item) => item.track_key === trajectoryKey) ?? snapshot.trajectories[0];
  if (!selected) return <StatePanel kind="empty" />;
  const skills = selected.readiness_skills;
  const drilldownSkill = skills.find((skill) => skill.skill_key === skillKey) ?? null;
  const activeGoal = goal !== undefined && goal !== null && goal.track_key === selected.track_key ? goal : null;
  const center = 130;
  const radius = 86;
  const point = (index: number, rank: number) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(skills.length, 1);
    const scale = Math.min(rank / 2, 1);
    return { x: center + Math.cos(angle) * radius * scale, y: center + Math.sin(angle) * radius * scale };
  };
  const targetPoints = skills.map((skill, index) => point(index, growthLevel(skill.target_level, true) ?? 2));
  const currentPoints = skills.map((skill, index) => { const rank = growthLevel(skill.current_level, skill.known); return rank === null ? null : point(index, rank); });
  return <section className="trajectory-growth-analytics" aria-labelledby="trajectory-growth-title">
    <header><div><p className="eyebrow">По выбранной траектории</p><h2 id="trajectory-growth-title">Текущий уровень и цель</h2></div><label>Траектория<select value={selected.track_key} onChange={(event) => { selectTrajectory(event.target.value); }}>{snapshot.trajectories.map((item) => <option value={item.track_key} key={item.track_key}>{item.track_title}</option>)}</select></label></header>
    <div className="trajectory-growth-grid">
      <div className="trajectory-growth-radar"><svg viewBox="0 0 260 260" role="img" aria-label={`Циклограмма траектории ${selected.track_title}: жёлтая цель, красный дефицит, зелёный достигнутый уровень, серый неизвестный уровень`}>
        {[1, 2].map((rank) => <polygon className="growth-ring" key={rank} points={skills.map((_, index) => { const p = point(index, rank); return `${String(p.x)},${String(p.y)}`; }).join(" ")} />)}
        <polygon className="growth-target" points={targetPoints.map((p) => `${String(p.x)},${String(p.y)}`).join(" ")} />
        {currentPoints.map((current, index) => { const nextIndex = (index + 1) % Math.max(skills.length, 1); const next = currentPoints[nextIndex]; if (!current || !next) return null; const currentRank = growthLevel(skills[index]?.current_level ?? "", skills[index]?.known ?? false) ?? 0; const targetRank = growthLevel(skills[index]?.target_level ?? "", true) ?? 2; const nextCurrent = growthLevel(skills[nextIndex]?.current_level ?? "", skills[nextIndex]?.known ?? false) ?? 0; const nextTarget = growthLevel(skills[nextIndex]?.target_level ?? "", true) ?? 2; const achieved = currentRank >= targetRank && nextCurrent >= nextTarget; return <line className={achieved ? "growth-achieved" : "growth-deficit"} key={`${selected.track_key}-${String(index)}`} x1={current.x} y1={current.y} x2={next.x} y2={next.y} />; })}
        {skills.map((skill, index) => { const current = currentPoints[index]; const target = targetPoints[index] ?? point(index, 2); const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(skills.length, 1); const label = { x: center + Math.cos(angle) * 112, y: center + Math.sin(angle) * 112 }; return <g key={skill.skill_key}>{current ? <circle className={(growthLevel(skill.current_level, skill.known) ?? 0) >= (growthLevel(skill.target_level, true) ?? 2) ? "growth-achieved-fill" : "growth-deficit-fill"} cx={current.x} cy={current.y} r="4" /> : <circle className="growth-unknown-fill" cx={target.x} cy={target.y} r="4" />}<text x={label.x} y={label.y} textAnchor={Math.cos(angle) > .2 ? "start" : Math.cos(angle) < -.2 ? "end" : "middle"}>{skill.title}</text></g>; })}
      </svg><div className="trajectory-growth-legend"><span className="target">Цель</span><span className="deficit">Ниже цели</span><span className="achieved">Цель достигнута</span><span className="unknown">Нет данных</span></div></div>
      <div className="trajectory-growth-facts"><p><strong>Прогресс траектории:</strong> {selected.completion.percent === null ? "Недостаточно данных" : `${String(selected.completion.percent)}%`}</p><p><strong>Готовность роли:</strong> {selected.readiness.percent === null ? "Недостаточно данных" : `${String(selected.readiness.percent)}%`}</p>{selected.readiness.partial && <p className="growth-partial" role="status">Охват данных {Math.round(selected.readiness.coverage * 100)}%. Неизвестные уровни не заменены нулём.</p>}<ul aria-label="Числовая альтернатива циклограммы">{skills.map((skill) => { const current = growthLevel(skill.current_level, skill.known); const target = growthLevel(skill.target_level, true); const state = current === null || target === null ? "unknown" : current < target ? "deficit" : "achieved"; return <li className={`growth-skill--${state}`} key={skill.skill_key}><button type="button" aria-expanded={skillKey === skill.skill_key} aria-controls={`drilldown-${skill.skill_key}`} aria-label={`Подробнее о навыке ${skill.title}`} data-testid={`skill-toggle-${skill.skill_key}`} onClick={() => { toggleSkill(skill.skill_key); }}><strong>{skill.title}</strong><span>Сейчас: {current === null ? "нет подтверждённых данных" : skill.current_level}</span><span>Цель: {target === null ? "несовместимая шкала" : skill.target_level}</span></button></li>; })}</ul>{drilldownSkill !== null && <SkillDrilldown key={drilldownSkill.skill_key} snapshot={snapshot} skill={drilldownSkill} reports={reports} reportsPending={reportsPending} reportsError={reportsError} onRetryReports={onRetryReports} buddy={buddy} buddyPending={buddyPending} />}<small>Формулы версии {selected.policy_version}. Снимок {new Date(snapshot.generated_at).toLocaleString("ru-RU")} · {snapshot.actor_timezone}</small></div>
    </div>
    {activeGoal !== null && <div className="trajectory-monthly-goal" data-testid="trajectory-monthly-goal" aria-label="Прогноз месячной цели по выбранной траектории">
      <header>
        <div>
          <p className="eyebrow">Месячная цель · прогноз</p>
          <h3>{activeGoal.goal_title}</h3>
          <small>{String(activeGoal.days_left)} дн. до конца периода · осталось {String(activeGoal.remaining)} checkpoint</small>
        </div>
        <Badge tone={activeGoal.feasibility.feasible ? "success" : "warning"}>{activeGoal.feasibility.feasible ? "План выполним" : "План под риском"}</Badge>
      </header>
      <div className="trajectory-monthly-goal-grid">
        <MonthlyGoalDiagram goal={activeGoal} />
        <div className="monthly-goal-plan">
          <p className={`monthly-goal-feasibility monthly-goal-feasibility--${activeGoal.feasibility.feasible ? "success" : "risk"}`}>{activeGoal.feasibility.text}</p>
          {activeGoal.partial_forecast && <p className="monthly-goal-partial">Частичный прогноз · покрытие {Math.round(activeGoal.coverage * 100)}%. Прогноз не изменяет подтверждённый уровень.</p>}
          <ol>
            {activeGoal.steps.map((step) => (
              <li key={step.key} className={`monthly-goal-step--${step.status}`}>
                <span>{String(step.position)}</span>
                <div><strong>{step.title}</strong><small>{step.skill} · {monthlyGoalStatusLabels[step.status]}</small></div>
              </li>
            ))}
          </ol>
          <details>
            <summary>Как считается прогноз</summary>
            <ul>{activeGoal.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
            <small>Расчёт: {new Date(activeGoal.generated_at).toLocaleString("ru-RU")} · {activeGoal.timezone}</small>
          </details>
        </div>
      </div>
    </div>}
  </section>;
}

export function ParticipantAnalytics({ navigation = [] }: { navigation?: string[] }) {
  const [competencyView, setCompetencyView] = useState<CompetencyView>("technical");
  const [selectedSkill, setSelectedSkill] = useState<Competency | null>(null);
  const [gapExpanded, setGapExpanded] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useQuery({ queryKey: ["participant-analytics"], queryFn: () => apiRequest<Analytics>("/api/v1/me/analytics/journey"), refetchOnMount: "always" });
  const growthQuery = useQuery({ queryKey: ["participant-growth-analytics"], queryFn: () => apiRequest<GrowthSnapshot>("/api/v1/me/growth/snapshot"), refetchOnMount: "always" });
  const skillReportsQuery = useQuery({ queryKey: ["participant-skill-reports"], queryFn: () => apiRequest<FrameworkReportView[]>("/api/v1/me/competencies"), refetchOnMount: "always" });
  const buddyQuery = useQuery({ queryKey: ["participant-buddy-drilldown"], queryFn: () => apiRequest<BuddySuggestionStateView>("/api/v1/agents/buddy/suggestion"), refetchOnMount: "always" });
  const monthlyGoalQuery = useQuery({ queryKey: ["monthly-goal"], queryFn: loadMonthlyGoal, refetchOnMount: "always" });
  const updateParams = (key: string, value: string | null) => { setSearchParams((previous) => { const next = new URLSearchParams(previous); if (value) next.set(key, value); else next.delete(key); return next; }); };
  const urlSkill = searchParams.get("skill");
  const urlTrajectory = searchParams.get("trajectory");
  if (query.isLoading) return <StatePanel kind="loading" />;
  const data = query.data ?? demoAnalytics;
  const activity = [42, 58, 51, 73, 66, 88, 79, 94];
  const competencyGroup = competencyGroups[competencyView];
  const competencyAverage = Math.round(competencyGroup.competencies.reduce((sum, item) => sum + item.score, 0) / competencyGroup.competencies.length);
  const confirmedCompetencies = competencyGroup.competencies.filter((item) => item.score >= 70).length;
  const evidenceCoverage = competencyView === "technical" ? 84 : competencyView === "practical" ? 76 : 71;
  return <div className="feature-stack participant-analytics analytics-dashboard">
    {query.isError && <div className="demo-fallback-note" role="status"><strong>Демонстрационная аналитика</strong><span>API временно недоступен — показана связанная mock-проекция.</span><button className="secondary-button" type="button" onClick={() => { void query.refetch(); }}>Повторить</button></div>}
    <header className="dashboard-heading"><div><p className="eyebrow">Аналитика · личный путь</p><h1 id="workspace-title">Ваш прогресс и подтверждённый результат</h1><p className="lead">Показываем, как обучение превращается в проекты, оценки и позицию в рейтинге.</p></div><div className="analytics-controls"><label>Период<select defaultValue="90"><option value="30">30 дней</option><option value="90">3 месяца</option><option value="season">Сезон</option></select></label><label>Направление<select defaultValue="all"><option value="all">Все</option><option value="python">Python</option><option value="data">Data</option></select></label><div className="freshness-chip"><span className="fresh-dot" />Обновлено сегодня</div></div></header>
    {growthQuery.status === "pending" ? <StatePanel kind="loading" /> : growthQuery.status === "error" ? <StatePanel kind="error" action="Повторить аналитику траекторий" onAction={() => { void growthQuery.refetch(); }} /> : <TrajectoryGrowthAnalytics snapshot={growthQuery.data} selectedTrajectoryKey={urlTrajectory ?? undefined} onTrajectorySelect={(track) => { setSearchParams((previous) => { const next = new URLSearchParams(previous); next.set("trajectory", track); next.delete("skill"); return next; }); }} selectedSkillKey={urlSkill ?? undefined} onSkillSelect={(skill) => { updateParams("skill", skill); }} reports={skillReportsQuery.data} reportsPending={skillReportsQuery.isPending} reportsError={skillReportsQuery.isError} onRetryReports={() => { void skillReportsQuery.refetch(); }} buddy={buddyQuery.data ?? undefined} buddyPending={buddyQuery.isPending} goal={monthlyGoalQuery.data ?? undefined} />}
    <section className="competency-overview competency-overview--expanded">
      <div className="competency-main">
        <div className="section-heading"><div><p className="eyebrow">Главный результат развития</p><h2>Расширенная матрица · Python-разработчик</h2></div><Badge tone="success">Готовность 72%</Badge></div>
        <p>Знания, применение в реальной работе и гибкие навыки разделены. Каждый уровень связан с проверяемым источником.</p>
        <div className="competency-switcher" role="tablist" aria-label="Срез матрицы компетенций">{(Object.entries(competencyGroups) as [CompetencyView, typeof competencyGroups[CompetencyView]][]).map(([key, group]) => <button className={competencyView === key ? "active" : ""} type="button" role="tab" aria-selected={competencyView === key} key={key} onClick={() => { setCompetencyView(key); setSelectedSkill(null); }}>{group.label}</button>)}</div>
        <div className="competency-stat-grid"><article><span>Средний уровень</span><strong>{competencyAverage}%</strong><small>+{Math.round(competencyGroup.competencies.reduce((sum, item) => sum + item.delta, 0) / competencyGroup.competencies.length)}% за 3 месяца</small></article><article><span>Подтверждено</span><strong>{confirmedCompetencies} из {competencyGroup.competencies.length}</strong><small>уровень 70% и выше</small></article><article><span>Покрытие доказательствами</span><strong>{evidenceCoverage}%</strong><small>{competencyView === "practical" ? "проекты и артефакты" : competencyView === "soft" ? "обратная связь людей" : "курсы и checkpoints"}</small></article><article><span>Сильнейший рост</span><strong>+{Math.max(...competencyGroup.competencies.map((item) => item.delta))}%</strong><small>за выбранный период</small></article></div>
        <div className="competency-evidence-layout">
          <div><div className="competency-matrix">{competencyGroup.competencies.map((item) => <button className={selectedSkill?.title === item.title ? "active" : ""} type="button" aria-pressed={selectedSkill?.title === item.title} key={item.title} onClick={() => { setSelectedSkill(item); }}><span><strong>{item.title}</strong><small>{item.evidence}</small></span><i><b style={{ width: `${String(item.score)}%` }} /></i><em><b>{item.score}%</b>{item.level}</em></button>)}</div>{selectedSkill && <article className="competency-detail" role="status"><header><div><p className="eyebrow">Почему такой уровень</p><h3>{selectedSkill.title} · {selectedSkill.score}%</h3></div><Badge tone={selectedSkill.score >= 70 ? "success" : "warning"}>{selectedSkill.level}</Badge></header><p>{selectedSkill.detail}</p><footer><span>Динамика <strong>+{selectedSkill.delta}%</strong></span><span>Источник <strong>{selectedSkill.evidence}</strong></span></footer></article>}</div>
          <aside className="radar-card"><div><p className="eyebrow">Циклограмма</p><h3>{competencyGroup.label}</h3><small>{competencyGroup.eyebrow}</small></div><CompetencyRadar items={competencyGroup.competencies} /></aside>
        </div>
      </div>
      <aside className="credential-summary"><VerifiedDocumentsPanel />{readinessPlan({ navigation, gapExpanded, setGapExpanded })}</aside>
    </section>
    <section className="metric-grid participant-kpi-grid"><article className="metric-card metric-card--teal"><span>Прогресс траектории</span><strong>68%</strong><small>+12% за месяц</small></article><article className="metric-card metric-card--blue"><span>Активные проекты</span><strong>2</strong><small>1 результат до 12 октября</small></article><article className="metric-card metric-card--violet"><span>Подтверждённый опыт</span><strong>7</strong><small>2 оценки A · 3 оценки B</small></article><article className="metric-card metric-card--teal"><span>Принятые результаты</span><strong>3</strong><small>+1 за месяц</small></article></section>
    <div className="analytics-main-grid"><section className="analytics-panel"><div className="section-heading"><div><p className="eyebrow">Конверсия пути</p><h2>От обучения до принятого результата</h2></div><Badge tone="success">42% до результата</Badge></div><div className="analytics-funnel">{[{ label: "Обучение", value: 12, rate: "100%" }, { label: "Отклики", value: 8, rate: "67%" }, { label: "Работа", value: 5, rate: "63%" }, { label: "Принято", value: 3, rate: "60%" }, { label: "Подтверждено", value: 2, rate: "67%" }].map((stage, index) => <div key={stage.label} style={{ width: `${String(100 - index * 11)}%` }}><span>{stage.label}</span><strong>{stage.value}</strong><small>{stage.rate}</small></div>)}</div></section>
      <section className="analytics-panel activity-chart-panel"><div className="section-heading"><div><p className="eyebrow">Динамика</p><h2>Активность по неделям</h2></div><Badge>8 недель</Badge></div><div className="analytics-histogram" role="img" aria-label="Активность по восьми неделям">{activity.map((value, index) => <div key={index}><div className="histogram-bar-wrap" style={{ "--bar-height": `${String(value)}%` } as CSSProperties}><small>{value}</small><i style={{ height: `${String(value)}%` }} /></div><span>Н{index + 1}</span></div>)}</div><footer className="histogram-caption"><span><i />Учебные и проектные действия</span><strong>Среднее: 69 в неделю</strong></footer></section></div>
    <div className="analytics-main-grid"><section className="analytics-panel"><h2>Баллы и рейтинг</h2><div className="score-split"><div><span>Постоянные</span><strong>450</strong><small>Принятые проекты и подтверждённые события</small></div><div><span>Замороженные</span><strong>+5</strong><small>AI Journey 2026 · до проверки результата</small></div><div><span>Позиция</span><strong>3 → 2</strong><small>50 баллов до следующего места</small></div></div></section><section className="analytics-panel"><h2>Распределение результата</h2><div className="direction-bars"><div><span>Python / Backend</span><i><b style={{ width: "74%" }} /></i><strong>74%</strong></div><div><span>Data / ML</span><i><b style={{ width: "18%" }} /></i><strong>18%</strong></div><div><span>Product</span><i><b style={{ width: "8%" }} /></i><strong>8%</strong></div></div></section></div>
    <section className="learning-effectiveness"><div><p className="eyebrow">Эффективность обучения</p><h2>Навыки применяются в реальных проектах</h2></div><div><strong>18</strong><span>checkpoint завершено</span></div><div><strong>42 ч</strong><span>осмысленного обучения</span></div><div><strong>3</strong><span>курса подтверждено</span></div><div><strong>78%</strong><span>навыков применено</span></div></section>
    <section className="analytics-results"><div className="section-heading"><h2>Последние подтверждённые результаты</h2><Badge tone="success">Проверены человеком</Badge></div><article><strong>Рекомендательная система</strong><span>Оценка A · +150 баллов</span></article><article><strong>Прогнозирование нагрузки</strong><span>Оценка B · +90 баллов</span></article></section>
    <section className="analytics-ai-insight"><span className="ai-orb">✦</span><div><p className="eyebrow">AI insight · не решение</p><h2>{data.next_action}</h2><p>Checkpoint связан с текущим проектом и даст максимальный прирост подтверждённого опыта на этой неделе.</p></div><Badge tone={data.successful ? "success" : "warning"}>{data.successful ? "Путь подтверждён" : "Путь продолжается"}</Badge></section>
  </div>;
}

const roleTitles: Record<Role, string> = { mentor: "Качество и скорость ревью", customer: "Путь задачи до принятого результата", manager: "Результаты и повторное использование", hr: "Воронка кандидатов по решениям людей", operator: "Качество операционного контура" };

export function RoleAnalytics({ role }: { role: Role }) {
  const query = useQuery({ queryKey: ["role-analytics", role], queryFn: () => apiRequest<RoleAnalyticsData>("/api/v1/analytics/role"), refetchOnMount: "always" });
  if (query.isLoading) return <StatePanel kind="loading" />;
  if (query.isError || !query.data) return <StatePanel kind="error" action="Повторить" onAction={() => { void query.refetch(); }} />;
  const stale = query.data.metrics.some((metric) => metric.freshness !== "fresh");
  return <div className="feature-stack role-analytics" data-reference={role === "operator" ? "R-OPS-09" : undefined}><header className="dashboard-heading"><div><p className="eyebrow">Аналитика роли · проверяемые формулы</p><h1 id="workspace-title">{roleTitles[role]}</h1><p className="lead">Каждое значение показывает период, когорту, числитель и знаменатель. Подавленные или задержанные данные не заменяются нулём.</p></div><Badge tone={stale ? "warning" : "success"}>{stale ? "Данные задерживаются" : "Данные актуальны"}</Badge></header>{stale && <div className="analytics-stale" role="status"><strong>Источник обновляется с задержкой</strong><span>Последнее доступное значение сохранено; нулевой результат не подставляется.</span></div>}<section className="role-metric-grid" aria-label="Метрики роли">{query.data.metrics.map((metric) => <article className={`role-metric-card ${metric.suppressed ? "role-metric-card--suppressed" : ""}`} key={metric.key}><header><span>{metric.label}</span><Badge tone={metric.freshness === "fresh" ? "success" : "warning"}>{metric.freshness === "fresh" ? "Актуально" : "Задержка"}</Badge></header><strong>{metric.suppressed ? "Скрыто" : metric.value === null ? "Нет данных" : metric.unit === "percent" ? `${metric.value}%` : metric.value}</strong><small>{new Date(metric.period_start).toLocaleDateString("ru-RU")} — {new Date(metric.period_end).toLocaleDateString("ru-RU")}</small><details><summary>Как рассчитано</summary><p>{metric.definition}</p><dl><div><dt>Числитель</dt><dd>{metric.suppressed ? "—" : metric.numerator}</dd></div><div><dt>Знаменатель</dt><dd>{metric.suppressed ? "—" : metric.denominator}</dd></div><div><dt>Когорта</dt><dd>{metric.cohort}</dd></div></dl>{metric.suppressed && <p className="privacy-note">Малая когорта: значение и персональная детализация скрыты.</p>}</details></article>)}</section></div>;
}
