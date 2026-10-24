import type { CSSProperties, ReactNode } from "react";

import { milestoneState } from "../client";
import type { DevelopmentOverviewView, RoadmapView, RoleCardView, MilestoneView } from "../client";

import "./source-reference.scss";

/**
 * DOM-first port of ZIP app.js renderRoleCard/renderTimeline/renderStage/
 * renderGradeCard/renderNextCard/renderSkills/renderMain.
 * 
 * Does not own the workspace shell or invent task/grade/evidence data.
 * Read model and callbacks are supplied by the existing authorized page.
 */
export type VerifiedStageTask = {
  id: string;
  title: string;
  kind: string;
  status: "completed" | "current" | "locked";
  evidenceLabel?: string | null;
  completedAt?: string | null;
  xp?: number | null;
};

export type PassportCompetency = {
  key: string;
  confirmed_case_count: number;
  practical_level: string;
};

export interface SourceTrajectoryLayoutProps {
  roles: RoleCardView[];
  selectedRoleKey: string | null;
  primaryRoleKey: string | null;
  roadmap: RoadmapView | null;
  selectedStageKey: string | null;
  grade: DevelopmentOverviewView["concepts"]["career_grade"];
  nextOutcome: DevelopmentOverviewView["next_outcome"];
  competencies: PassportCompetency[];
  /** Optional server-backed task read projection. Never use ZIP demo tasks here. */
  stageTasks?: VerifiedStageTask[];
  onSelectRole: (key: string) => void;
  onSelectStage: (key: string) => void;
  onOpenRole: () => void;
  onOpenActions: () => void;
  /** Existing authorized menu can be injected without recreating its mutations. */
  roleActions?: ReactNode;
  onOpenGrades: () => void;
  onOpenTask: (milestoneKey: string) => void;
  onOpenNext: () => void;
  onOpenPassport: () => void;
}

type Glyph = "bars" | "cube" | "code" | "doc" | "chart" | "task" | "spark" | "briefcase" | "check" | "lock" | "arrow" | "route";

function SourceIcon({ name, className = "" }: { name: Glyph; className?: string }) {
  const paths: Record<Glyph, ReactNode> = {
    bars: <path d="M4 20V13m6 7V8m6 12V4m5 16v-10" strokeWidth="3"/>,
    cube: <><path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/></>,
    code: <path d="m8 5-6 7 6 7m8-14 6 7-6 7m-3-16-2 18"/>,
    doc: <><path d="M5 2h10l4 4v16H5z"/><path d="M15 2v5h4M9 11h6M9 15h6M9 19h4"/></>,
    chart: <path d="M5 21V12m7 9V4m7 17v-7"/>,
    task: <path d="M5 4h14v16H5zM8 9h8M8 13h8M8 17h5M9 4V2m6 2V2"/>,
    spark: <path d="m12 2 2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3z"/>,
    briefcase: <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M9 7V4h6v3m-12 6h18m-11 0v2h4v-2"/></>,
    check: <path d="m5 12 5 5L20 7"/>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    route: <><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="13" cy="13" r="2"/><path d="M6.8 16.7 11.4 14m3.3-2.3L17.6 7.6"/></>,
  };
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" aria-hidden="true">{paths[name]}</svg>;
}

function roleGlyph(title: string): Glyph {
  const lower = title.toLocaleLowerCase("ru-RU");
  if (lower.includes("ml") || lower.includes("инженер")) return "cube";
  if (lower.includes("python") || lower.includes("разработчик")) return "code";
  if (lower.includes("backend") || lower.includes("бэкенд")) return "task";
  if (lower.includes("ux") || lower.includes("дизайн")) return "spark";
  if (lower.includes("менеджер")) return "briefcase";
  if (lower.includes("аналитик данных") || lower.includes("data analyst")) return "chart";
  return "bars";
}

function SourceRoleCard({ role, selected, primary, onSelect }: {
  role: RoleCardView; selected: boolean; primary: boolean; onSelect: () => void;
}) {
  const unselected = role.state === "unselected";
  const denominator = role.total_milestones;
  const complete = Math.min(Math.max(0, role.completed_milestones), denominator);
  const portion = denominator > 0 ? (100 * complete) / denominator : 0;
  return (
    <button
      type="button"
      className={["role-card", selected && "primary", !selected && role.state === "active" && "active", role.state === "paused" && "paused", unselected && "disabled"].filter(Boolean).join(" ")}
      aria-pressed={selected}
      data-role-state={role.state}
      onClick={onSelect}
    >
      <span className={["badge-icon", roleGlyph(role.title) === "cube" && "ml", roleGlyph(role.title) === "code" && "python", unselected && "gray"].filter(Boolean).join(" ")}>
        <SourceIcon name={roleGlyph(role.title)} />
      </span>
      {primary && <span className="role-checked" aria-label="Основная роль"><SourceIcon name="check"/></span>}
      <strong>{role.title}</strong>
      {unselected || role.attempt_number === null ? <span className="role-caption">Не выбрана</span> : (
        <>
          <div className="mini-track" role="progressbar" aria-label={`Пройдено этапов роли ${role.title}`} aria-valuenow={complete} aria-valuemin={0} aria-valuemax={Math.max(1, denominator)}>
            <div style={{ width: `${String(portion)}%` }} />
          </div>
          <span className="role-caption">{selected && primary ? "Основная роль" : `${String(complete)} из ${String(denominator)} этапов`}{role.state === "paused" ? " · пауза" : ""}</span>
        </>
      )}
    </button>
  );
}

function ProgressRail({ current, className = "" }: { current: number | null; className?: string }) {
  return <div className={["progress-rail", className].filter(Boolean).join(" ")} role={current === null ? undefined : "progressbar"} aria-valuenow={current ?? undefined} aria-valuemin={current === null ? undefined : 0} aria-valuemax={current === null ? undefined : 100}>
    {current === null ? null : <div className="progress-fill" style={{ width: `${String(Math.min(100, Math.max(0, current)))}%` }} />}
  </div>;
}

function RoleRoadmap({ roadmap, selectedStageKey, onSelectStage }: {
  roadmap: RoadmapView; selectedStageKey: string | null; onSelectStage: (key: string) => void;
}) {
  const completed = roadmap.milestones.filter(stage => stage.completed).length;
  return <>
    <div className="path-label">Путь освоения роли <span className="path-explainer">{completed} завершено · {roadmap.milestones.length} этапов</span></div>
    <div className="roadmap-steps" style={{ "--stage-count": Math.max(7, roadmap.milestones.length), "--completed-width": `${String(Math.round(100 * completed / Math.max(1, Math.max(7, roadmap.milestones.length) - 1)))}%` } as CSSProperties} role="list" aria-label="Этапы развития роли">
      {roadmap.milestones.map(stage => {
        const state = milestoneState(stage, roadmap.next_step);
        return <button
          key={stage.key}
          type="button"
          className={["milestone", state === "completed" ? "completed" : state === "current" ? "current" : "future"].join(" ")}
          role="listitem"
          aria-pressed={stage.key === selectedStageKey}
          onClick={() => { onSelectStage(stage.key); }}
        >
          <span className="milestone-circle">{state === "completed" ? <SourceIcon name="check" /> : state === "locked" ? <SourceIcon name="lock" /> : state === "current" ? <span className="current-dot" /> : stage.position}</span>
          <strong>{stage.position}</strong>
          <span>{stage.title}</span>
        </button>;
      })}
      {Array.from({ length: Math.max(0, 7 - roadmap.milestones.length) }, (_, index) => {
        const position = roadmap.milestones.length + index + 1;
        return <span
          key={`unpublished-${String(position)}`}
          className="milestone future unpublished"
          role="listitem"
          aria-label={`Этап ${String(position)} не опубликован`}
          data-stage-state="unpublished"
        >
          <span className="milestone-circle"><SourceIcon name="lock" /></span>
          <strong>{position}</strong>
          <span>Не опубликован</span>
        </span>;
      })}
    </div>
  </>;
}

function TaskRow({ task, milestoneKey, onOpen }: { task: VerifiedStageTask; milestoneKey: string; onOpen: (key: string) => void }) {
  const completed = task.status === "completed";
  return <div className={["task-row", !completed && "current"].filter(Boolean).join(" ")}>
    <span className={["task-bullet", completed && "done"].filter(Boolean).join(" ")}>
      {completed && <SourceIcon name="check" />}
    </span>
    <div className="task-main">
      <strong>{task.title}</strong>
      <div className="task-tags">
        <span>{task.kind}</span>
        {task.evidenceLabel && <span>{task.evidenceLabel}</span>}
        {task.xp !== null && task.xp !== undefined && <span>+{task.xp} XP</span>}
      </div>
    </div>
    <span className={["task-state", !completed && "pending"].filter(Boolean).join(" ")}>
      {completed ? "Завершено" : task.status === "locked" ? "Закрыто" : "К выполнению"}
      {task.completedAt ? ` · ${task.completedAt}` : ""}
    </span>
    {task.status === "locked" ? null : <button type="button" className={["btn", completed ? "neutral" : "primary"].join(" ")} onClick={() => { onOpen(milestoneKey); }}>{completed ? "Посмотреть" : "Продолжить"} {!completed && <SourceIcon name="arrow" />}</button>}
  </div>;
}

function StageCard({ role, milestone, state, stageTasks, onOpen }: {
  role: RoleCardView; milestone: MilestoneView; state: ReturnType<typeof milestoneState>;
  stageTasks?: VerifiedStageTask[]; onOpen: (key: string) => void;
}) {
  /* The roadmap currently contains one goal per stage, not all individual
     tasks. Show a real source-backed goal until a read projection is provided. */
  const hasPublishedAssignments = stageTasks !== undefined && stageTasks.length > 0;
  const tasks = hasPublishedAssignments ? stageTasks : [{
    id: milestone.key,
    title: milestone.title,
    kind: milestone.target_kind === "course" ? "Обучение" : milestone.target_kind === "task" ? "Практическая задача" : milestone.target_kind,
    status: state === "completed" ? "completed" as const : state === "locked" ? "locked" as const : "current" as const,
  }];
  const completed = tasks.filter(task => task.status === "completed").length;
  const portion = tasks.length > 0 ? Math.round(completed / tasks.length * 100) : null;
  return <section className="stage-card card" aria-label="Этап выбранной роли">
    <div className="stage-top">
      <div>
        <span className="subhead">Этап {milestone.position} из {Math.max(role.total_milestones, milestone.position)}</span>
        <h3>{milestone.title}</h3>
        <p>{milestone.purpose}</p>
      </div>
      {state === "current" ? <div className="stage-progress">
        <span className="pill amber">◯ В процессе</span>
        <div className="stage-portion"><span>{completed} из {tasks.length} завершено</span><strong>{portion}%</strong></div>
        <ProgressRail current={portion} />
      </div> : <span className={["pill", state !== "completed" && "gray"].filter(Boolean).join(" ")}>{state === "completed" ? "✓ Этап завершён" : "Этап пока недоступен"}</span>}
    </div>
    <div className="stage-list">
      {tasks.map(task => <TaskRow key={task.id} task={task} milestoneKey={milestone.key} onOpen={onOpen} />)}
    </div>
    {!hasPublishedAssignments && <small className="stage-truth-note">Показана цель этапа из дорожной карты; детализация отдельных заданий пока недоступна</small>}
  </section>;
}

function GradeCard({ grade, title, onOpen }: {
  grade: SourceTrajectoryLayoutProps["grade"]; title: string; onOpen: () => void;
}) {
  const completed = grade.readiness_percent;
  const remaining = completed === null ? null : 100 - completed;
  return <section className="grade-card card">
    <div className="section-head"><h3>Твой грейд</h3><button type="button" className="text-link" onClick={onOpen}>Все уровни <SourceIcon name="arrow" /></button></div>
    <div className="grade-metrics">
      <div className="grade-ring" style={{ "--grade-progress": `${String(completed ?? 0)}%` } as CSSProperties}>
        <div className="grade-ring-inner"><strong>{grade.current_grade === null ? "Грейд —" : `Грейд ${grade.current_grade}`}</strong><small>{title}</small></div>
      </div>
      <div className="grade-data">
        <span className="to-grade">До следующего грейда</span>
        <div className="remaining">{remaining === null ? "Проверяем" : `${String(remaining)}%`}</div>
        <ProgressRail current={completed} />
        <span className="remain-steps">{grade.hint ?? (remaining === null ? "Политика оценки ещё не опубликована" : "По проверенным результатам")}</span>
      </div>
    </div>
    <div className="grade-hint"><span className="hint-icon"><SourceIcon name="route" /></span>
      <span>{grade.reason ?? "Грейд обновляется по подтверждённым результатам и серверной политике"}</span>
    </div>
  </section>;
}

function NextOutcomeCard({ outcome, onOpen }: { outcome: SourceTrajectoryLayoutProps["nextOutcome"]; onOpen: () => void }) {
  return <section className="next-card card">
    <div className="section-head"><h3>Следующий шаг</h3><span className="pill amber">В твоём маршруте</span></div>
    <div className="next-row">
      <span className="next-icon"><SourceIcon name="doc"/></span>
      <div className="next-data">
        <strong>{outcome?.target_title ?? "Следующий шаг пока не назначен"}</strong>
        <p>{outcome?.trajectory_title ?? "Нет подтверждённого маршрута"}</p>
        {outcome?.stale_reason && <span className="next-reason">{outcome.stale_reason}</span>}
      </div>
      {outcome && <button type="button" className="btn square" onClick={onOpen} aria-label="Открыть следующий шаг"><SourceIcon name="arrow"/></button>}
    </div>
  </section>;
}

function SkillPassportCard({ competencies, onOpen }: { competencies: PassportCompetency[]; onOpen: () => void }) {
  const maxCases = Math.max(1, ...competencies.map(item => item.confirmed_case_count));
  return <section className="skills-card card">
    <div className="section-head"><h3>Мой скилл-паспорт</h3><button type="button" className="text-link" onClick={onOpen}>Открыть <SourceIcon name="arrow"/></button></div>
    {competencies.length ? competencies.slice(0, 4).map((item, index) => <div className="skill-row" key={item.key}>
      <span className={["skill-logo", index === 1 && "gold", index === 2 && "purple", index === 3 && "indigo"].filter(Boolean).join(" ")}><SourceIcon name={index === 0 ? "doc" : index === 1 ? "spark" : index === 2 ? "bars" : "route"} /></span>
      <span>{item.key}</span>
      <ProgressRail current={Math.round(item.confirmed_case_count * 100 / maxCases)} />
      <strong>{item.confirmed_case_count} кейс.</strong>
    </div>) : <p className="empty-message">Подтверждённые компетенции пока не опубликованы</p>}
    <small className="source-note">Полосы сравнивают число подтверждённых кейсов — не уровни компетенций</small>
  </section>;
}

export function SourceTrajectoryLayout(props: SourceTrajectoryLayoutProps) {
  const role = props.roles.find(item => item.track_key === props.selectedRoleKey) ?? null;
  const roadmap = props.roadmap?.track_key === role?.track_key ? props.roadmap : null;
  const currentKey = roadmap?.next_step?.key ?? roadmap?.milestones[0]?.key ?? null;
  const activeKey = roadmap?.milestones.some(stage => stage.key === props.selectedStageKey) ? props.selectedStageKey : currentKey;
  const activeStage = roadmap?.milestones.find(stage => stage.key === activeKey) ?? null;
  const activeState = activeStage ? milestoneState(activeStage, roadmap?.next_step ?? null) : null;
  const safeTaskProjection = activeStage && props.stageTasks ? props.stageTasks : undefined;

  return <div className="trj-source" data-source-reference="TRJ-SCREEN-01">
    <div className="heading-row">
      <div className="heading-copy"><h1>Моя траектория</h1><p>Строй свою карьерную историю в Сбере — от обучения к реальным проектам</p></div>
      <div className="hero-graphic" aria-hidden="true"><span className="flag">⚑</span></div>
    </div>
    <section className="roles-grid" aria-label="Профессиональные роли">
      {props.roles.map(item => <SourceRoleCard key={item.track_key} role={item}
        selected={item.track_key === props.selectedRoleKey} primary={item.track_key === props.primaryRoleKey}
        onSelect={() => { props.onSelectRole(item.track_key); }}/>)}
    </section>
    <div className="content-columns">
      <div className="left-stack">
        <section className="role-detail card">
          {role ? <>
            <div className="role-detail-header">
              <div className="role-heading">
                <span className="badge-icon"><SourceIcon name={roleGlyph(role.title)} /></span>
                <div className="role-heading-copy">
                  <h2>{role.title}</h2>{role.track_key === props.primaryRoleKey && <span className="pill amber">Основная роль</span>}
                  <p>{role.attempt_number === null ? "Роль ещё не выбрана" : `Маршрут: ${String(role.completed_milestones)} из ${String(role.total_milestones)} этапов завершено`}</p>
                </div>
                <div className="role-heading-actions">
                  <button type="button" className="btn outline" onClick={props.onOpenRole}>О роли <SourceIcon name="arrow"/></button>
                  {props.roleActions ?? <button type="button" className="btn square" onClick={props.onOpenActions} aria-label="Действия роли">•••</button>}
                </div>
              </div>
            </div>
            {roadmap && roadmap.milestones.length > 0 ?
              <RoleRoadmap roadmap={roadmap} selectedStageKey={activeKey} onSelectStage={props.onSelectStage}/> :
              <div className="role-empty"><h3>{role.attempt_number === null ? "Эта роль пока не выбрана" : "Маршрут ещё не опубликован"}</h3><p>Здесь появятся этапы, задачи и подтверждённый прогресс после публикации дорожной карты</p></div>}
          </> : <p className="empty-message">Роли пока не опубликованы</p>}
        </section>
        {role && activeStage && activeState && <StageCard role={role} milestone={activeStage} state={activeState} stageTasks={safeTaskProjection} onOpen={props.onOpenTask} />}
      </div>
      <aside className="right-stack" aria-label="Грейд и компетенции">
        <GradeCard grade={props.grade} title={role?.title ?? "Моя роль"} onOpen={props.onOpenGrades} />
        <NextOutcomeCard outcome={props.nextOutcome} onOpen={props.onOpenNext} />
        <SkillPassportCard competencies={props.competencies} onOpen={props.onOpenPassport}/>
      </aside>
    </div>
  </div>;
}
