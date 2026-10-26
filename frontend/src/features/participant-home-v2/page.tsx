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
import { apiRequest, type RuntimeApiPath } from "../../api/client";
import type { components } from "../../api/schema";
import { learningSummaryQueryKey, loadLearningSummary } from "../learning-progress";
import {
  TASK_NEXT_ACTION_LABELS,
  formatDayLabel,
  formatWeekdayShort,
  loadDevelopmentOverview,
  overviewQueryKey,
  type DevelopmentOverviewView,
  type OpenTarget,
} from "./client";
import { levelCoursesProgress, loadRoleLevel, roleLevelQueryKey, type ImpulseRoleLevel } from "../impulse-role-level";
import "./home-v2.scss";

type HomeGrade = DevelopmentOverviewView["concepts"]["career_grade"];
type HomePanel = "levels" | "grade-details" | null;
type HomePassport = { skills: {key: string; practical_level: string; confirmed_case_count: number}[] };
type GradeCourseCatalog = components["schemas"]["BootcampOverviewV2"];

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
  const activeRole = overview.roles.find(item => item.track_key === overview.next_outcome?.trajectory_key && item.state === "active")
    ?? overview.roles.find((item) => item.state === "active") ?? overview.roles[0] ?? null;
  const levelRoleKey = activeRole?.track_key ?? null;
  const impulseLevel = useQuery({
    queryKey:roleLevelQueryKey(levelRoleKey),
    queryFn:()=>loadRoleLevel(levelRoleKey ?? ""),
    enabled:levelRoleKey!==null,
    retry:false,
  });
  const showRequiredCourses = panel === "grade-details" &&
    impulseLevel.data?.curriculum_state === "published" &&
    (impulseLevel.data.required_course_keys?.length ?? 0) > 0;
  const studyCourses = useQuery({
    queryKey: learningSummaryQueryKey,
    queryFn: loadLearningSummary,
    enabled: showRequiredCourses,
    retry: false,
  });
  const gradeCourseCatalog = useQuery({
    queryKey: ["bootcamp-v2-overview", levelRoleKey],
    queryFn: () => apiRequest<GradeCourseCatalog>(
      `/api/v1/me/bootcamp/overview?track=${encodeURIComponent(levelRoleKey ?? "")}` as RuntimeApiPath,
    ),
    enabled: showRequiredCourses && levelRoleKey !== null,
    retry: false,
  });
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
              <button type="button" className={`home-v2-primary${heroKind === "course" ? " home-v2-primary--learning" : ""}`} onClick={openHero}>{heroKind === "task" ? "Продолжить задачу" : heroKind === "course" ? "Продолжить обучение" : "Выбрать траекторию"}<ArrowRight size={18} aria-hidden="true" /></button>
              {overview.next_outcome && <button type="button" className="home-v2-text-action" onClick={openNext}>Следующий шаг</button>}
            </div>
          </div>
          {grade.state !== "not_evaluable" && grade.target_grade !== null && (
            <button className="home-v2-hero-gain" type="button" onClick={() => { openPanel("grade-details"); }}><TrendingUp size={23}/><span>Открыть требования следующего грейда</span></button>
          )}
        </section>

        <GradeSummaryPanel grade={grade} hint={overview.concepts} levelData={impulseLevel.data ?? null} levelPending={impulseLevel.isPending} roleTitle={activeRole?.title ?? null} onOpenLevels={() => { openPanel("levels"); }} onOpenDetails={() => { openPanel("grade-details"); }} />
        <WeeklyFocusPanel focus={overview.weekly_focus} today={overview.local_today} />
      </div>

      <div className="home-v2-bottom-grid">
        <div className="home-v2-work-column">
          <NextOutcomePanel outcome={overview.next_outcome} onOpenTarget={props.onOpenTarget} onRetry={props.onRetry} onOpenGrade={() => { openPanel("grade-details"); }} onOpenTrajectory={() => { props.onOpenWorkspace("trajectory"); }} gradeAvailable={grade.state !== "not_evaluable" && grade.target_grade !== null} />
          <ActiveTasksPanel tasks={overview.active_tasks} onOpenTarget={props.onOpenTarget} onOpenAll={() => { props.onOpenTarget("tasks", ""); }} />
        </div>
        <div className="home-v2-insights-column">
          <section className="home-v2-block home-v2-buddy">
            <header><h2><Sparkles size={23} />AI Buddy <span className="home-v2-beta">Бета</span></h2><button type="button" className="home-v2-inline-link" onClick={() => { props.onOpenWorkspace("buddy"); }} disabled={!props.buddyAvailable}>Открыть <ArrowRight size={16}/></button></header>
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
                <p className="home-v2-drawer-eyebrow">Путь развития Impulse</p><h2>Карта уровней</h2>
                <p>Начни с L0. Заверши учебную программу и получи независимое подтверждение практики, чтобы перейти на следующий уровень.</p>
                <div className="home-v2-grade-timeline">
                  {(["Стартовый цикл", "Архитектура и оценка", "Эксплуатация и A2A", "Итог программы"] as const).map((label,index)=><button key={label} type="button" onClick={() => { setPanel("grade-details"); }}>
                    <span className={`home-v2-grade-dot ${impulseLevel.data?.level===index?"current":impulseLevel.data && impulseLevel.data.level>index?"current":"target"}`}/>
                    <strong>L{index} · {label}</strong>
                    <small>{impulseLevel.data?.level === index ? "Текущий уровень" : impulseLevel.data && impulseLevel.data.level > index ? "Получен" : "Впереди"}</small>
                    <ChevronRight size={18}/>
                  </button>)}
                </div>
                {activeRole && <div className="home-v2-drawer-note">Роль: {activeRole.title}</div>}
                <div className="home-v2-drawer-note">Это учебные уровни Impulse. Официальный карьерный грейд рассчитывается отдельно.</div>
              </div>
            ) : (
              <div className="home-v2-drawer-body">
                <button className="home-v2-drawer-back" type="button" onClick={() => { setPanel("levels"); }}>← Все уровни</button>
                <div className="home-v2-grade-detail-hero">
                  <span className="home-v2-drawer-eyebrow">Учебный уровень Impulse</span>
                  <h2>{impulseLevel.data ? impulseLevel.data.level >= (impulseLevel.data.max_level ?? 3) ? "L3 · Программа освоена" : `L${String(impulseLevel.data.level)} → L${String(impulseLevel.data.level+1)}` : "Данные ещё загружаются"}</h2>
                  <p>{activeRole?.title ?? "Траектория развития"}</p>
                </div>
                {impulseLevel.data ? <>
                  <section className="home-v2-grade-progress"><Target size={24}/><div>
                    <strong>Курсы выбранной роли</strong>
                    <span>{impulseLevel.data.completed_courses} из {impulseLevel.data.required_courses} пройдено</span>
                    <div className="home-v2-grade-track"><span style={{width:`${String(levelCoursesProgress(impulseLevel.data))}%`}}/></div>
                  </div></section>
                  <h3>Что нужно для перехода</h3>
                  <section className="home-v2-grade-courses" aria-label="Обязательные курсы для нового уровня" data-testid="home-grade-required-courses">
                    <div className="home-v2-grade-courses-header">
                      <FileCheck2 size={21} aria-hidden="true"/>
                      <div><strong>Обязательные курсы · {impulseLevel.data.completed_courses}/{impulseLevel.data.required_courses}</strong>
                        <small>Проходи курсы своей роли. Сертификаты учитываются один раз за цикл.</small>
                      </div>
                    </div>
                    {impulseLevel.data.curriculum_state === "published" && (impulseLevel.data.required_course_keys?.length ?? 0) > 0 ? (
                      <ol className="home-v2-grade-course-list">
                        {impulseLevel.data.required_course_keys?.map((key, index) => {
                          const course = studyCourses.data?.courses.find((item) => item.course_key === key);
                          const catalogCourse = gradeCourseCatalog.data?.courses.find((item) => item.card.key === key);
                          const title = catalogCourse?.card.title ?? course?.title ??
                            (studyCourses.isPending || gradeCourseCatalog.isPending ? "Загружаем название курса…" : `Курс · ${key}`);
                          const done = (course?.finished === true && course.certificate_id !== null) ||
                            catalogCourse?.card.completion_state === "verified";
                          const started = (course?.completed_units ?? 0) > 0 ||
                            catalogCourse?.card.completion_state === "in_progress" ||
                            catalogCourse?.card.completion_state === "reported";
                          return <li key={key} className="home-v2-grade-course" data-course-key={key}>
                            <span className={done ? "home-v2-grade-course-index is-done" : "home-v2-grade-course-index"} aria-hidden="true">
                              {done ? <Check size={16}/> : index + 1}
                            </span>
                            <div className="home-v2-grade-course-info">
                              <strong>{title}</strong>
                              <small>{done ? "Завершён · сертификат получен" :
                                started ? `В процессе${course?.total_units ? ` · ${String(course.completed_units)} из ${String(course.total_units)} уроков` : ""}` :
                                  "Ещё не начат"}</small>
                            </div>
                            {done ? <span className="home-v2-grade-course-done"><CheckCircle2 size={16}/> Пройден</span> :
                              <button type="button" className="home-v2-grade-course-action"
                                aria-label={`${started ? "Продолжить" : "Пройти"} курс «${title}»`}
                                onClick={() => { closePanel(); props.onOpenTarget("course", key); }}>
                                {started ? "Продолжить" : "Пройти"} <ArrowRight size={15}/>
                              </button>}
                          </li>;
                        })}
                      </ol>
                    ) : impulseLevel.data.curriculum_state === "published" && impulseLevel.data.required_courses > 0 ? (
                      <p className="home-v2-grade-course-message" role="status">
                        Перечень обязательных курсов пока не получен. Открой траекторию, чтобы посмотреть опубликованную программу.
                      </p>
                    ) : (
                      <p className="home-v2-grade-course-message" role="status">
                        {impulseLevel.data.level >= (impulseLevel.data.max_level ?? 3)
                          ? "Все учебные циклы завершены."
                          : "Курсы следующего цикла ещё не опубликованы."}
                      </p>
                    )}
                    {studyCourses.isError && showRequiredCourses &&
                      <p className="home-v2-grade-course-message" role="status">Статусы обучения временно недоступны. Для подтверждённого прогресса открой Bootcamp.</p>}
                  </section>
                  <div className="home-v2-grade-requirement"><ClipboardCheck size={21}/><div>
                    <strong>Проверенная практика: {impulseLevel.data.approved_practices}/{impulseLevel.data.required_practices}</strong>
                    <small>Результат подтверждает проверяющий, не сам участник</small>
                  </div></div>
                  {impulseLevel.data.level < (impulseLevel.data.max_level ?? 3) && impulseLevel.data.curriculum_state==="unpublished" && <section className="home-v2-grade-unavailable" role="status">
                    <LockKeyhole size={23}/><strong>Новая программа ещё не опубликована</strong>
                    <span>Старые сертификаты не повышают уровень повторно.</span>
                  </section>}
                </> : <section className="home-v2-grade-unavailable" role="status">Сервис учебных уровней недоступен. Текущее значение не подменяется выдуманной оценкой.</section>}
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
  levelData: ImpulseRoleLevel | null;
  levelPending: boolean;
  roleTitle?: string | null;
  onOpenLevels?: () => void;
  onOpenDetails?: () => void;
}) {

  const {levelData:level,levelPending} = props;
  const complete = level !== null && level.level >= (level.max_level ?? 3);
  const pct = complete ? 100 : level ? levelCoursesProgress(level) : 0;
  return (
    <section className="home-v2-block home-v2-grade" data-testid="grade-summary"
      data-grade-state={level ? "impulse-known" : levelPending ? "loading" : "unavailable"}>
      <header><h2>Уровень Impulse</h2>
        <button type="button" className="home-v2-inline-link" onClick={props.onOpenLevels} disabled={!props.onOpenLevels}>Все уровни <ArrowRight size={16}/></button>
      </header>
      <div className="home-v2-grade-overview">
        <div className="home-v2-ring"
          style={{background:`conic-gradient(#04e8e9 0deg ${String(pct*3.6)}deg, #1d4666 ${String(pct*3.6)}deg 360deg)`}}
          aria-label={level ? `Уровень Impulse L${String(level.level)}` : "Данные уровня загружаются"}>
          <div><strong>{level ? `L${String(level.level)}` : "—"}</strong><span>{level ? `Цикл ${String(level.cycle_number)}` : "Загрузка"}</span></div>
        </div>
        <div className="home-v2-grade-readiness">
          <small>{complete ? "Учебная программа завершена" : level ? `До L${String(level.level+1)}` : "До следующего уровня"}</small>
          <strong>{complete ? "L3 достигнут" : level?.curriculum_state === "published" ? `${String(level.completed_courses)}/${String(level.required_courses)}` : "—"}</strong>
          <div className="home-v2-progress"><span style={{width:`${String(pct)}%`}}/></div>
          <small>{complete ? "Три цикла с практикой и проверкой пройдены" : level?.curriculum_state === "published"
            ? `Практика: ${String(level.approved_practices)} из ${String(level.required_practices)}`
            : level ? "Данные программы недоступны" : "Уровень пока недоступен"}</small>
        </div>
      </div>
      <button type="button" className="home-v2-next-grade" onClick={props.onOpenDetails} disabled={!props.onOpenDetails}>
        <div className="home-v2-next-grade-name"><span>{complete ? "L3" : level ? `L${String(level.level+1)}` : "—"}</span>
          <strong>{complete ? "Программа освоена" : level?.advance_ready ? "Готов к повышению" : "Следующий уровень"}</strong>
          <ChevronRight size={17}/></div>
        <p>{props.roleTitle ?? "Выберите профессиональную роль"}</p>
      </button>
      <p className="home-v2-grade-disclaimer" role="status">Это уровень развития Impulse, не официальный карьерный грейд Сбера.</p>
    </section>
  );
}

export function WeeklyFocusPanel(props: {
  focus: DevelopmentOverviewView["weekly_focus"];
  today?: string;
}) {
  const { focus } = props;
  const [selected, setSelected] = useState<string | null>(props.today ?? focus.days[0]?.date ?? null);
  const [planOpen, setPlanOpen] = useState(false);
  const planTriggerRef = useRef<HTMLButtonElement>(null);
  const planCloseRef = useRef<HTMLButtonElement>(null);
  const day = focus.days.find((item) => item.date === selected) ?? null;

  const closePlan = () => {
    setPlanOpen(false);
    planTriggerRef.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (planOpen) planCloseRef.current?.focus({ preventScroll: true });
  }, [planOpen]);

  return (
    <section className="home-v2-block home-v2-weekly" data-testid="weekly-focus">
      <header>
        <h2>На этой неделе</h2>
        <button
          type="button"
          className="home-v2-inline-link"
          ref={planTriggerRef}
          onClick={() => { setPlanOpen(true); }}
          aria-haspopup="dialog"
        >План недели <ArrowRight size={16}/></button>
      </header>
      <div className="home-v2-week-days" role="group" aria-label="Дни недели">
        {focus.days.map((item) => {
          const active = selected === item.date;
          return <button type="button" key={item.date} aria-pressed={active} aria-label={formatDayLabel(item.date)} onClick={() => { setSelected(item.date); }} className={`home-v2-day${item.done ? " home-v2-day--done" : ""}${item.planned ? " home-v2-day--planned" : ""}${active ? " home-v2-day--selected" : ""}`}><span>{formatWeekdayShort(item.date)}</span><small>{new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short"}).format(new Date(`${item.date}T00:00:00`))}</small>{item.done ? <Check size={17}/> : <Circle size={17}/>}</button>;
        })}
      </div>
      {day && <div className="home-v2-week-day-detail" role="status"><span className="home-v2-week-target"><Target size={25}/></span><div><strong>{focus.hint ?? "План недели"}</strong><p>{day.done ? "День подтверждён квалификационным действием." : day.planned ? "Запланирован по ритму недели, выполнение пока не подтверждено." : "Не запланирован по ритму недели."}</p></div><ChevronRight size={16}/></div>}
      {planOpen && (
        <div className="home-v2-week-dialog-layer">
          <button className="home-v2-week-dialog-backdrop" type="button" aria-label="Закрыть план недели" onClick={closePlan}/>
          <section className="home-v2-week-dialog" role="dialog" aria-modal="true" aria-labelledby="home-week-plan-title" onKeyDown={(event) => {
            if (event.key === "Escape") {event.preventDefault(); closePlan();}
            if (event.key === "Tab") {event.preventDefault(); planCloseRef.current?.focus();}
          }}>
            <header><div><small>Текущая неделя</small><h2 id="home-week-plan-title">План недели</h2></div><button type="button" ref={planCloseRef} aria-label="Закрыть" onClick={closePlan}><X size={21}/></button></header>
            <p role="status">{focus.versioned ? `Выполнено ${String(focus.done_days)} из ${String(focus.target_days)} запланированных дней` : "План на эту неделю ещё не настроен"}</p>
            <div className="home-v2-week-dialog-days">
              {focus.days.map((item) => <div key={item.date}><span>{formatWeekdayShort(item.date)} · {formatDayLabel(item.date)}</span><strong className={item.done ? "home-v2-week-done" : ""}>{item.done ? "Выполнено" : item.planned ? "Запланировано" : "Без плана"}</strong></div>)}
            </div>
          </section>
        </div>
      )}
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
