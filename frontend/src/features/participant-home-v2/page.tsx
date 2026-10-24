import { useQuery } from "@tanstack/react-query";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";

import { StatePanel } from "../../components/ui";
import { apiRequest } from "../../api/client";
import {
  TASK_NEXT_ACTION_LABELS,
  formatDayLabel,
  formatWeekdayShort,
  loadDevelopmentOverview,
  overviewQueryKey,
  type DevelopmentOverviewView,
  type OpenTarget,
} from "./client";
import "./home-v2.scss";

type HomeGrade = DevelopmentOverviewView["concepts"]["career_grade"];
type HomePanel = "levels" | "grade-details" | null;
type HomePassport = { skills: {key: string; practical_level: string; confirmed_case_count: number}[] };

/** Same approved SVG artwork as the standalone 22.10.2026 ZIP. */
const HERO_ART = "/home-reference/mountain-path.svg";
const BUDDY_ART = "/home-reference/buddy.svg";

export function ParticipantHomeV2(props: {
  onOpenTarget: OpenTarget;
  onOpenWorkspace: (canonicalPath?: string) => void;
  buddyAvailable?: boolean;
}) {
  const overview = useQuery({
    queryKey: overviewQueryKey,
    queryFn: loadDevelopmentOverview,
  });
  if (overview.isPending) {
    return <div className="home-v2" data-reference="R-PAR-01"><StatePanel kind="loading" /></div>;
  }
  if (overview.isError) {
    return (
      <div className="home-v2" data-reference="R-PAR-01">
        <section className="home-v2-failure" role="status">
          <strong>Не удалось загрузить обзор развития.</strong>
          <p>Домашний раздел недоступен без авторизованных данных.</p>
          <button type="button" onClick={() => { void overview.refetch(); }}>Повторить</button>
        </section>
      </div>
    );
  }
  return (
    <ParticipantHomeV2Body
      overview={overview.data}
      onOpenTarget={props.onOpenTarget}
      onOpenWorkspace={props.onOpenWorkspace}
      buddyAvailable={props.buddyAvailable}
      onRetry={() => { void overview.refetch(); }}
    />
  );
}

export function ParticipantHomeV2Body(props: {
  overview: DevelopmentOverviewView;
  onOpenTarget: OpenTarget;
  onOpenWorkspace: (canonicalPath?: string) => void;
  buddyAvailable?: boolean;
  onRetry: () => void;
}) {
  const { overview } = props;
  const nextOutcome = overview.next_outcome;
  const passport = useQuery({
    queryKey: ["talent-passport"],
    queryFn: () => apiRequest<HomePassport>("/api/v1/me/talent-passport"),
  });
  const [panel, setPanel] = useState<HomePanel>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const grade = overview.concepts.career_grade;
  const activeRole = overview.roles.find((item) => item.state === "active") ?? overview.roles[0] ?? null;
  const recommendedTask = overview.active_tasks.find((task) => task.next_action !== "await_review") ?? null;
  const heroKind = recommendedTask ? "task" : overview.next_outcome?.target_kind ?? null;
  const heroKey = recommendedTask?.task_id ?? overview.next_outcome?.target_key ?? null;
  const heroTitle = recommendedTask?.title ?? overview.next_outcome?.target_title ?? null;
  const openNext = () => {
    if (nextOutcome !== null) props.onOpenTarget(nextOutcome.target_kind, nextOutcome.target_key);
  };
  const openHero = () => {
    if (heroKind !== null && heroKey !== null) props.onOpenTarget(heroKind, heroKey);
    else props.onOpenWorkspace("trajectory");
  };
  const openPanel = (next: Exclude<HomePanel, null>) => {
    if (document.activeElement instanceof HTMLElement) returnFocusRef.current = document.activeElement;
    setPanel(next);
  };
  const closePanel = () => {
    setPanel(null);
    returnFocusRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (panel !== null) {
      panelRef.current?.querySelector<HTMLButtonElement>(".home-v2-drawer-close")?.focus();
    }
  }, [panel]);

  const drawerKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closePanel();
    }
    if (event.key !== "Tab") return;
    const buttons = Array.from(
      panelRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
    );
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="home-v2" data-reference="R-PAR-01" data-as-of={overview.as_of}>
      <h1 className="sr-only" id="workspace-title">Главная участника</h1>
      <div className="home-v2-first-row">
        <section className="home-v2-block home-v2-hero" aria-label="Рекомендованная задача">
          <img src={HERO_ART} className="home-v2-hero-art" alt="" aria-hidden="true" />
          <div className="home-v2-hero-inner">
            <div className="home-v2-hero-kicker"><span className="home-v2-hero-target"><Target size={20} /></span><span>Рекомендуем сегодня</span></div>
            <h2>{heroTitle ?? "Выбери задачу для развития"}</h2>
            <p>{heroTitle ? "Продолжи работу над текущим результатом — выполненное задание поможет продвинуться по траектории." : "После выбора траектории здесь появится приоритетное действие."}</p>
            <div className="home-v2-hero-meta">
              {activeRole && <span><Layers3 size={16} />{activeRole.title}</span>}
              {recommendedTask && <span><Clock3 size={16} />{TASK_NEXT_ACTION_LABELS[recommendedTask.next_action] ?? recommendedTask.status}</span>}
            </div>
            <div className="home-v2-hero-actions">
              <button type="button" className="home-v2-primary" onClick={openHero}>{heroKind === "task" ? "Продолжить задачу" : heroKind === "course" ? "Продолжить обучение" : "Выбрать траекторию"}<ArrowRight size={18} /></button>
              {overview.next_outcome && <button type="button" className="home-v2-text-action" onClick={openNext}>Следующий шаг</button>}
            </div>
          </div>
          {grade.state !== "not_evaluable" && grade.target_grade !== null && (
            <button className="home-v2-hero-gain" type="button" onClick={() => { openPanel("grade-details"); }}><TrendingUp size={23}/><span>Открыть требования следующего грейда</span></button>
          )}
        </section>

        <GradeSummaryPanel grade={grade} hint={overview.concepts} roleTitle={activeRole?.title ?? null} onOpenLevels={() => { openPanel("levels"); }} onOpenDetails={() => { openPanel("grade-details"); }} />
        <WeeklyFocusPanel focus={overview.weekly_focus} today={overview.local_today} />
      </div>

      <div className="home-v2-bottom-grid">
        <div className="home-v2-work-column">
          <NextOutcomePanel outcome={overview.next_outcome} onOpenTarget={props.onOpenTarget} onRetry={props.onRetry} onOpenGrade={() => { openPanel("grade-details"); }} onOpenTrajectory={() => { props.onOpenWorkspace("trajectory"); }} gradeAvailable={grade.state !== "not_evaluable" && grade.target_grade !== null} />
          <ActiveTasksPanel tasks={overview.active_tasks} onOpenTarget={props.onOpenTarget} onOpenAll={() => { props.onOpenTarget("tasks", ""); }} />
        </div>
        <div className="home-v2-insights-column">
          <section className="home-v2-block home-v2-buddy">
            <header><h2><Sparkles size={23} />AI Buddy <span className="home-v2-beta">Бета</span></h2><button type="button" className="home-v2-inline-link" onClick={openNext} disabled={nextOutcome === null}>Открыть <ArrowRight size={16}/></button></header>
            <div className="home-v2-buddy-content">
              <img src={BUDDY_ART} alt="AI Buddy" />
              <div><p>{overview.next_outcome ? "Твой следующий шаг по траектории уже определён." : "Выбери роль и траекторию, чтобы получать подсказки по развитию."}</p>
                {overview.next_outcome && <button type="button" className="home-v2-buddy-tip" onClick={openNext}><BookOpen size={22}/><span><strong>Материалы и задания</strong><small>{overview.next_outcome.target_title}</small></span><ChevronRight size={15}/></button>}
              </div>
            </div>
            <button type="button" className="home-v2-buddy-footnote" onClick={() => { props.onOpenWorkspace("buddy"); }} disabled={!props.buddyAvailable} title={props.buddyAvailable ? undefined : "AI Buddy недоступен для текущей роли"}>Задать вопрос или попросить совет… <Send size={19} /></button>
          </section>
          <section className="home-v2-block home-v2-passport" aria-label="Мой скилл-паспорт">
            <header><h2>Мой скилл-паспорт</h2><button type="button" className="home-v2-inline-link" onClick={() => { props.onOpenWorkspace("skills"); }}>Все навыки <ArrowRight size={16}/></button></header>
            {passport.isPending ? <div className="home-v2-passport-message" role="status">Загружаем подтверждённые навыки…</div> : passport.isError ? (
              <div className="home-v2-passport-message" role="status">Скилл-паспорт временно недоступен. Данные о навыках не подменяются оценкой.</div>
            ) : passport.data.skills.length === 0 ? (
              <div className="home-v2-passport-message">Проверенных практических результатов пока нет. Выполняй задачи и получай подтверждение вклада.</div>
            ) : (
              <div className="home-v2-skill-list">
                {passport.data.skills.slice(0,4).map((skill,index) => (
                  <div className="home-v2-skill-row" key={skill.key}>
                    <span className={`home-v2-skill-icon home-v2-skill-icon--${String(index%4)}`}><ShieldCheck size={21}/></span>
                    <div><strong>{skill.key}</strong><small>{skill.practical_level}</small></div>
                    <span className="home-v2-skill-cases">{String(skill.confirmed_case_count)} кейс.</span>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="home-v2-passport-open" onClick={() => { props.onOpenWorkspace("skills"); }}>Перейти в скилл-паспорт <ArrowRight size={16}/></button>
          </section>
        </div>
      </div>
      {panel && (
        <div className="home-v2-drawer-layer">
          <button className="home-v2-drawer-backdrop" type="button" aria-label="Закрыть карту уровней" onClick={closePanel} />
          <div className="home-v2-drawer" role="dialog" aria-modal="true" aria-label={panel === "levels" ? "Карта уровней" : "Требования следующего грейда"} ref={panelRef} onKeyDown={drawerKeyDown}>
            <div className="home-v2-drawer-top">
              <span>{panel === "levels" ? "Траектория · Карта уровней" : "Траектория · Подробности грейда"}</span>
              <button type="button" className="home-v2-drawer-close" aria-label="Закрыть панель" onClick={closePanel}><X size={21}/></button>
            </div>
            {panel === "levels" ? (
              <div className="home-v2-drawer-body">
                <p className="home-v2-drawer-eyebrow">Профессиональный рост</p><h2>Карта уровней</h2>
                <p>Путь развития по выбранной роли. Грейды отображаются только после публикации их критериев.</p>
                {grade.state === "not_evaluable" ? (
                  <section className="home-v2-grade-unavailable" role="status"><LockKeyhole size={25}/><strong>Каталог грейдов пока не опубликован</strong><span>После согласования модели здесь появятся ступени, подтверждённые результаты и прогресс развития.</span></section>
                ) : <div className="home-v2-grade-timeline">
                  {grade.target_grade !== null && <button type="button" onClick={() => { setPanel("grade-details"); }}><span className="home-v2-grade-dot target"></span><strong>Грейд {grade.target_grade}</strong><small>Следующая цель</small><ChevronRight size={18}/></button>}
                  {grade.current_grade !== null && <button type="button" onClick={() => { setPanel("grade-details"); }}><span className="home-v2-grade-dot current"></span><strong>Грейд {grade.current_grade}</strong><small>Текущий</small><ChevronRight size={18}/></button>}
                </div>}
                {activeRole && <div className="home-v2-drawer-note">Активная роль: {activeRole.title}</div>}
              </div>
            ) : (
              <div className="home-v2-drawer-body">
                <button className="home-v2-drawer-back" type="button" onClick={() => { setPanel("levels"); }}>← Все грейды</button>
                <div className="home-v2-grade-detail-hero"><span className="home-v2-drawer-eyebrow">Следующий уровень</span><h2>{grade.target_grade === null ? "Требования ещё не опубликованы" : `Грейд ${grade.target_grade}`}</h2><p>{activeRole?.title ?? "Траектория развития"}</p></div>
                {grade.state === "not_evaluable" ? <section className="home-v2-grade-unavailable" role="status"><LockKeyhole size={25}/><strong>Оценка грейда недоступна</strong><span>После утверждения модели будут доступны требования к переходу, компетенции и прогресс.</span></section> : (
                  <section className="home-v2-grade-progress"><Target size={24}/><div><strong>Готовность к следующему уровню</strong><span>{grade.readiness_percent === null ? "Требует проверки" : `${String(grade.readiness_percent)}% по действующей политике`}</span>{grade.readiness_percent !== null && <div className="home-v2-grade-track"><span style={{ width: `${String(grade.readiness_percent)}%` }}/></div>}</div></section>
                )}
                <h3>Что нужно для перехода</h3>
                <div className="home-v2-grade-requirement"><ClipboardCheck size={21}/><div><strong>Практический результат</strong><small>Выполнить этап траектории и подтвердить личный вклад</small></div></div>
                <div className="home-v2-grade-requirement"><FileCheck2 size={21}/><div><strong>Проверенные компетенции</strong><small>Решение принимается после проверки артефактов, а не по XP</small></div></div>
                {overview.next_outcome && <button type="button" className="home-v2-primary home-v2-grade-button" onClick={() => { closePanel(); openNext(); }}>Перейти к следующему шагу <ArrowRight size={17}/></button>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function NextOutcomePanel(props: {
  outcome: DevelopmentOverviewView["next_outcome"];
  onOpenTarget: OpenTarget;
  onRetry: () => void;
  onOpenGrade?: () => void;
  onOpenTrajectory?: () => void;
  gradeAvailable?: boolean;
}) {
  const outcome = props.outcome;
  return (
    <section className="home-v2-block home-v2-next-outcome" data-testid={outcome ? `next-outcome-${outcome.target_kind}` : undefined}>
      <header><h2><ClipboardCheck size={23}/>Следующий шаг</h2>{outcome && <span className="home-v2-state">К выполнению</span>}</header>
      {outcome === null ? (
        <div className="home-v2-outcome-empty" role="status"><p>Активной траектории нет, поэтому обязательный следующий шаг не вычислен. Выберите траекторию в разделе траекторий.</p><button type="button" onClick={props.onRetry}>Обновить</button></div>
      ) : (
        <div className="home-v2-outcome-main"><span className="home-v2-outcome-symbol"><FileCheck2 size={32}/></span><div className="home-v2-outcome-content"><h3>{outcome.target_kind === "task" ? "Пройти задание" : "Продолжить обучение"}</h3><p>{outcome.target_title}</p>{outcome.stale_reason && <small role="status">{outcome.stale_reason}</small>}</div>
          <div className="home-v2-outcome-stats"><span><Target size={17}/>Этап {String(outcome.milestone_position)}</span><span><Layers3 size={17}/>{outcome.trajectory_title}</span></div>
          <div className="home-v2-outcome-actions"><button type="button" className="home-v2-primary" onClick={() => { props.onOpenTarget(outcome.target_kind, outcome.target_key); }}>Перейти к шагу <ArrowRight size={17}/></button>{props.gradeAvailable && props.onOpenGrade ? <button type="button" className="home-v2-secondary" onClick={props.onOpenGrade}>Программа уровня</button> : props.onOpenTrajectory && <button type="button" className="home-v2-secondary" onClick={props.onOpenTrajectory}>Моя траектория</button>}</div>
        </div>
      )}
    </section>
  );
}

export function GradeSummaryPanel(props: {
  grade: HomeGrade;
  hint: DevelopmentOverviewView["concepts"];
  roleTitle?: string | null;
  onOpenLevels?: () => void;
  onOpenDetails?: () => void;
}) {
  const { grade } = props;
  const valid = grade.state !== "not_evaluable";
  return (
    <section className="home-v2-block home-v2-grade" data-testid="grade-summary" data-grade-state={grade.state}>
      <header><h2>Твой уровень</h2><button type="button" className="home-v2-inline-link" onClick={props.onOpenLevels} disabled={!props.onOpenLevels}>Все уровни <ArrowRight size={16}/></button></header>
      <div className="home-v2-grade-overview">
        <div className="home-v2-ring" aria-label={valid && grade.current_grade !== null ? `Текущий грейд ${grade.current_grade}` : "Карьерный грейд пока не вычисляется"}><div><strong>{valid && grade.current_grade !== null ? grade.current_grade : "—"}</strong><span>{valid && grade.current_grade !== null ? `Грейд ${grade.current_grade}` : "Грейд не назначен"}</span></div></div>
        <div className="home-v2-grade-readiness"><small>{valid && grade.target_grade !== null ? `До грейда ${grade.target_grade}` : "До следующего грейда"}</small><strong>{valid && grade.readiness_percent !== null ? `${String(Math.max(0,100-grade.readiness_percent))}%` : "—"}</strong><div className="home-v2-progress"><span style={{width: valid && grade.readiness_percent !== null ? `${String(grade.readiness_percent)}%` : "0%"}} /></div><small>{valid && grade.readiness_percent !== null ? "Осталось до следующего уровня" : "Прогресс не утверждён"}</small></div>
      </div>
      <button type="button" className="home-v2-next-grade" onClick={props.onOpenDetails} disabled={!props.onOpenDetails}>
        <div className="home-v2-next-grade-name"><span>{valid && grade.target_grade !== null ? grade.target_grade : "—"}</span><strong>{valid && grade.target_grade !== null ? `Грейд ${grade.target_grade}` : "Следующий уровень"}</strong><ChevronRight size={17}/></div>
        <p>{props.roleTitle ?? "Выберите профессиональную роль"}</p>
      </button>
      {!valid && <p className="home-v2-grade-disclaimer" role="status">Карьерные грейды ещё не опубликованы. Прогресс появится после утверждения требований.</p>}
    </section>
  );
}

export function WeeklyFocusPanel(props: {
  focus: DevelopmentOverviewView["weekly_focus"];
  today?: string;
}) {
  const { focus } = props;
  const [selected, setSelected] = useState<string | null>(props.today ?? focus.days[0]?.date ?? null);
  const day = focus.days.find((item) => item.date === selected) ?? null;
  return (
    <section className="home-v2-block home-v2-weekly" data-testid="weekly-focus">
      <header><h2>На этой неделе</h2><small>{focus.versioned ? `выполнено ${String(focus.done_days)} из ${String(focus.target_days)}` : "Ритм недели не настроен"}</small></header>
      <div className="home-v2-week-days" role="group" aria-label="Дни недели">
        {focus.days.map((item) => {
          const active = selected === item.date;
          return <button type="button" key={item.date} aria-pressed={active} aria-label={formatDayLabel(item.date)} onClick={() => { setSelected(item.date); }} className={`home-v2-day${item.done ? " home-v2-day--done" : ""}${item.planned ? " home-v2-day--planned" : ""}${active ? " home-v2-day--selected" : ""}`}><span>{formatWeekdayShort(item.date)}</span><small>{new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short"}).format(new Date(`${item.date}T00:00:00`))}</small>{item.done ? <Check size={17}/> : <Circle size={17}/>}</button>;
        })}
      </div>
      {day && <div className="home-v2-week-day-detail" role="status"><span className="home-v2-week-target"><Target size={25}/></span><div><strong>{focus.hint ?? "План недели"}</strong><p>{day.done ? "День подтверждён квалификационным действием." : day.planned ? "Запланирован по ритму недели, выполнение пока не подтверждено." : "Не запланирован по ритму недели."}</p></div><ChevronRight size={16}/></div>}
    </section>
  );
}

export function WeeklyFocusDetail(props: {
  date: string;
  focus: DevelopmentOverviewView["weekly_focus"];
}) {
  const day = props.focus.days.find((item) => item.date === props.date);
  if (!day) return null;
  return <p role="status">{day.done ? "День подтверждён квалификационным действием." : day.planned ? "Запланирован по ритму недели, выполнение пока не подтверждено." : "Не запланирован по ритму недели."}</p>;
}

export function ActiveTasksPanel(props: {
  tasks: DevelopmentOverviewView["active_tasks"];
  onOpenTarget: OpenTarget;
  onOpenAll?: () => void;
}) {
  const { tasks } = props;
  return (
    <section className="home-v2-block home-v2-tasks" data-testid="active-tasks">
      <header><h2><BriefcaseBusiness size={21}/>Активные задачи</h2>{props.onOpenAll && <button type="button" className="home-v2-inline-link" onClick={props.onOpenAll}>Все задачи <ArrowRight size={16}/></button>}</header>
      {tasks.length === 0 ? <p className="home-v2-tasks-empty" role="status">Активных задач нет. Доступные задачи открываются из раздела задач.</p> :
        <ul className="home-v2-task-list">{tasks.slice(0,4).map((task) => <li key={task.assignment_id}><article><span className="home-v2-task-check"><CheckCircle2 size={25}/></span><div className="home-v2-task-copy"><strong>{task.title}</strong><div className="home-v2-task-tags"><span>{TASK_NEXT_ACTION_LABELS[task.next_action] ?? task.status}</span>{task.open_contributions > 0 && <span>Отправок: {String(task.open_contributions)}</span>}</div></div><button type="button" className="home-v2-task-open" onClick={() => { props.onOpenTarget("task",task.task_id); }}>Открыть задачу <ArrowRight size={15}/></button></article></li>)}</ul>}
    </section>
  );
}
