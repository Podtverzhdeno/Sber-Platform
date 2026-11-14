import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Compass,
  GraduationCap,
  Layers3,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";

import { apiRequest } from "../../../api/client";
import { learningSummaryQueryKey, loadLearningSummary } from "../../learning-progress";
import {
  levelCoursesProgress,
  loadRoleLevel,
  roleLevelQueryKey,
} from "../../impulse-role-level";
import type { DevelopmentOverviewView, OpenTarget } from "../client";
import { TASK_NEXT_ACTION_LABELS, formatDayLabel, formatWeekdayShort } from "../client";
import "./calm-home.scss";

type HomePassport = {
  skills: { key: string; practical_level: string; confirmed_case_count: number }[];
};
type GradeCourseCatalog = {
  key: string;
  title: string;
  completion_state: "not_started" | "reported" | "verified" | "rejected";
}[];

export interface CalmParticipantHomeProps {
  overview: DevelopmentOverviewView;
  onOpenTarget: OpenTarget;
  onOpenWorkspace: (canonicalPath?: string) => void;
  buddyAvailable?: boolean;
}

export function CalmParticipantHome({
  overview,
  onOpenTarget,
  onOpenWorkspace,
  buddyAvailable = false,
}: CalmParticipantHomeProps) {
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>(
    overview.weekly_focus.days.find((day) => day.date === overview.local_today)?.date
      ?? overview.weekly_focus.days[0]?.date
      ?? "",
  );

  const role = overview.roles.find((item) =>
    item.track_key === overview.next_outcome?.trajectory_key && item.state === "active",
  ) ?? overview.roles.find((item) => item.state === "active") ?? overview.roles[0] ?? null;
  const roleKey = role?.track_key ?? null;

  const level = useQuery({
    queryKey: roleLevelQueryKey(roleKey),
    queryFn: () => loadRoleLevel(roleKey ?? ""),
    enabled: roleKey !== null,
    retry: false,
  });
  const passport = useQuery({
    queryKey: ["talent-passport"],
    queryFn: () => apiRequest<HomePassport>("/api/v1/me/talent-passport"),
    retry: false,
  });
  const showRequiredCourses = requirementsOpen &&
    level.data?.curriculum_state === "published" &&
    (level.data.required_course_keys?.length ?? 0) > 0;
  const studyCourses = useQuery({
    queryKey: learningSummaryQueryKey,
    queryFn: loadLearningSummary,
    enabled: showRequiredCourses,
    retry: false,
  });
  const gradeCourseCatalog = useQuery({
    queryKey: ["bootcamp-catalog"],
    queryFn: () => apiRequest<GradeCourseCatalog>("/api/v1/me/bootcamp/catalog"),
    enabled: showRequiredCourses,
    retry: false,
  });

  const actionableTask = overview.active_tasks.find(
    (task) => task.next_action !== "await_review",
  ) ?? null;
  const nextOutcome = overview.next_outcome;
  const targetKind = actionableTask ? "task" : (nextOutcome?.target_kind ?? null);
  const targetKey = actionableTask?.task_id ?? nextOutcome?.target_key ?? null;
  const targetTitle = actionableTask?.title ?? nextOutcome?.target_title ?? null;
  const primaryLabel = actionableTask
    ? "Открыть задачу"
    : targetKind === "course"
      ? "Продолжить обучение"
      : targetKind === "task"
        ? "Перейти к практике"
        : "Выбрать траекторию";
  const targetState = actionableTask
    ? TASK_NEXT_ACTION_LABELS[actionableTask.next_action] ?? actionableTask.status
    : nextOutcome
      ? nextOutcome.target_kind === "course" ? "Следующий курс" : "Следующий этап"
      : "Начните с направления";

  const followPriority = () => {
    if (targetKind !== null && targetKey !== null) {
      onOpenTarget(targetKind, targetKey);
    } else {
      onOpenWorkspace("trajectory");
    }
  };

  const focus = overview.weekly_focus;
  const day = focus.days.find((item) => item.date === selectedDay) ?? null;
  const completedSkills = passport.data?.skills.length ?? null;
  const currentLevel = level.data;
  const levelComplete = currentLevel &&
    currentLevel.level >= (currentLevel.max_level ?? 3);
  const levelPercent = currentLevel
    ? Math.min(100, Math.max(0, levelComplete ? 100 : levelCoursesProgress(currentLevel)))
    : null;

  return (
    <div className="calm-home" data-testid="calm-participant-home" data-as-of={overview.as_of}>
      <header className="calm-home__heading">
        <div>
          <p className="calm-home__eyebrow">МОЁ ПРОСТРАНСТВО</p>
          <h1 id="workspace-title" className="calm-home__title">Главная</h1>
          <p className="calm-home__subtitle">
            {role ? role.title : "Выберите направление развития"} · Ваш следующий шаг и актуальный прогресс
          </p>
        </div>
        <button
          className="calm-home__header-link"
          type="button"
          onClick={() => { onOpenWorkspace("trajectory"); }}
        >
          Мой путь <ArrowRight size={17} aria-hidden="true" />
        </button>
      </header>

      <section className="calm-home__focus" aria-labelledby="calm-home-focus-title">
        <div className="calm-home__focus-copy">
          <span className="calm-home__focus-kicker"><span className="calm-home__focus-dot" />{targetState}</span>
          <p className="calm-home__focus-label">В ФОКУСЕ</p>
          <h2 id="calm-home-focus-title">{targetTitle ?? "Начните с выбора траектории"}</h2>
          <p className="calm-home__focus-hint">
            {targetTitle
              ? "Продолжайте с того места, где остановились. Все материалы и детали доступны в соответствующем разделе."
              : "Определите направление — после этого здесь появится ваш первый конкретный шаг."}
          </p>
          {nextOutcome?.stale_reason && !actionableTask &&
            <p className="calm-home__notice" role="status">{nextOutcome.stale_reason}</p>}
          <button className="calm-home__primary" type="button" onClick={followPriority}>
            {primaryLabel} <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="calm-home__focus-aside" aria-hidden="true">
          <div className="calm-home__focus-orbit">
            <span><Compass size={33} strokeWidth={1.5} /></span>
          </div>
          <span className="calm-home__focus-aside-caption">Всё начинается с одного шага</span>
        </div>
      </section>

      <section className="calm-home__metrics" aria-label="Краткий обзор прогресса">
        <div className="calm-home__metric">
          <span className="calm-home__metric-label"><Layers3 size={16} aria-hidden="true" /> Уровень Impulse</span>
          <strong data-testid="calm-impulse-level">{currentLevel ? `L${String(currentLevel.level)}` : "—"}</strong>
          <small>{currentLevel
            ? levelComplete ? "Программа освоена" : "Текущий учебный уровень"
            : roleKey === null ? "Выберите направление" : level.isPending ? "Загружаем данные" : "Данные недоступны"}</small>
        </div>
        <div className="calm-home__metric">
          <span className="calm-home__metric-label"><BriefcaseBusiness size={16} aria-hidden="true" /> Активные задачи</span>
          <strong>{String(overview.active_tasks.length)}</strong>
          <small>{overview.active_tasks.length ? "В работе сейчас" : "Пока нет задач"}</small>
        </div>
        <div className="calm-home__metric">
          <span className="calm-home__metric-label"><ShieldCheck size={16} aria-hidden="true" /> Практические навыки</span>
          <strong data-testid="calm-verified-skills">{completedSkills === null ? "—" : String(completedSkills)}</strong>
          <small>{completedSkills === null
            ? passport.isPending ? "Загружаем данные" : "Данные недоступны"
            : "Навыков в скилл-паспорте"}</small>
        </div>
      </section>

      <div className="calm-home__work-grid">
        <section className="calm-home__panel calm-home__tasks" aria-labelledby="calm-home-tasks-title">
          <header className="calm-home__panel-heading">
            <div><span className="calm-home__overline">ВАША РАБОТА</span><h2 id="calm-home-tasks-title">Активные задачи</h2></div>
            <button type="button" className="calm-home__text-action"
              onClick={() => { onOpenTarget("tasks", ""); }}>
              Все задачи <ArrowRight size={16} aria-hidden="true" />
            </button>
          </header>
          {overview.active_tasks.length ? (
            <ul className="calm-home__task-list">
              {overview.active_tasks.slice(0, 3).map((task) => (
                <li key={task.assignment_id}>
                  <button className="calm-home__task" type="button" onClick={() => { onOpenTarget("task", task.task_id); }}>
                    <span className="calm-home__task-icon"><BriefcaseBusiness size={19} aria-hidden="true" /></span>
                    <span className="calm-home__task-description">
                      <strong>{task.title}</strong>
                      <small>{TASK_NEXT_ACTION_LABELS[task.next_action] ?? task.status}</small>
                    </span>
                    <ChevronRight size={19} className="calm-home__chevron" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="calm-home__empty">
              <p>Пока нет активных задач. Можно выбрать первую практику из каталога.</p>
              <button type="button" className="calm-home__text-action"
                onClick={() => { onOpenTarget("tasks", ""); }}>Посмотреть задачи <ArrowRight size={16} /></button>
            </div>
          )}
        </section>

        <section className="calm-home__panel calm-home__week" aria-labelledby="calm-home-week-title">
          <header className="calm-home__panel-heading">
            <div><span className="calm-home__overline">РИТМ РАЗВИТИЯ</span><h2 id="calm-home-week-title">Эта неделя</h2></div>
            <span className="calm-home__week-total">
              {focus.versioned ? `${String(focus.done_days)} из ${String(focus.target_days)} дней` : "Нет плана"}
            </span>
          </header>
          <div className="calm-home__week-days" role="group" aria-label="Дни недели">
            {focus.days.map((entry) => (
              <button
                key={entry.date}
                type="button"
                className={`calm-home__day${entry.done ? " calm-home__day--done" : ""}${entry.date === selectedDay ? " calm-home__day--current" : ""}`}
                aria-pressed={entry.date === selectedDay}
                aria-label={`${formatDayLabel(entry.date)}: ${entry.done ? "выполнено" : entry.planned ? "запланировано" : "без плана"}`}
                onClick={() => { setSelectedDay(entry.date); }}
              >
                <span>{formatWeekdayShort(entry.date)}</span>
                {entry.done ? <Check size={17} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
              </button>
            ))}
          </div>
          {day && (
            <p className="calm-home__day-info" role="status">
              <strong>{formatDayLabel(day.date)}</strong> · {day.done
                ? "День подтверждён выполненным действием"
                : day.planned ? "Запланирован, пока не выполнен" : "Без запланированной активности"}
            </p>
          )}
        </section>
      </div>

      <section className="calm-home__path calm-home__panel" aria-labelledby="calm-home-path-title">
        <div className="calm-home__path-main">
          <div>
            <span className="calm-home__overline">РАЗВИТИЕ</span>
            <h2 id="calm-home-path-title">Ваш уровень и следующий этап</h2>
            <p>
              {currentLevel
                ? levelComplete ? "Учебная программа Impulse завершена."
                  : currentLevel.curriculum_state === "published"
                    ? `Уровень L${String(currentLevel.level)} · пройдено ${String(currentLevel.completed_courses)} из ${String(currentLevel.required_courses)} обязательных курсов`
                    : `Уровень L${String(currentLevel.level)} · программа следующего цикла пока не опубликована`
                : roleKey === null ? "После выбора роли появятся требования к следующему уровню."
                  : level.isPending ? "Загружаем требования к уровню…" : "Данные об уровне пока недоступны."}
            </p>
          </div>
          <div className="calm-home__path-actions">
            {currentLevel && <strong className="calm-home__path-level">L{currentLevel.level}{!levelComplete && ` → L${String(currentLevel.level + 1)}`}</strong>}
            <button type="button" className="calm-home__secondary" aria-expanded={requirementsOpen}
              aria-controls="calm-home-requirements" onClick={() => { setRequirementsOpen((opened) => !opened); }}>
              Требования уровня <ChevronDown size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        {currentLevel && levelPercent !== null && currentLevel.curriculum_state === "published" && (
          <div className="calm-home__progress-wrap">
            <div className="calm-home__progress" role="progressbar" aria-label="Прогресс обязательных курсов"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={levelPercent}>
              <span style={{ width: `${String(levelPercent)}%` }} />
            </div>
            <span>{String(levelPercent)}% курсов</span>
          </div>
        )}
        {requirementsOpen && (
          <div id="calm-home-requirements" className="calm-home__requirements" role="region"
            aria-label="Требования следующего уровня" data-testid="calm-home-requirements">
            <p className="calm-home__disclaimer">Учебный уровень Impulse и официальный карьерный грейд — разные показатели.</p>
            {currentLevel ? (
              <>
                <div className="calm-home__req-line">
                  <GraduationCap size={20} aria-hidden="true" />
                  <div><strong>Обязательные курсы</strong>
                    <small>{String(currentLevel.completed_courses)} из {String(currentLevel.required_courses)} завершены</small></div>
                </div>
                {currentLevel.curriculum_state === "published" && (currentLevel.required_course_keys?.length ?? 0) > 0 ? (
                  <ul className="calm-home__course-list">
                    {currentLevel.required_course_keys?.map((key) => {
                      const course = studyCourses.data?.courses.find((item) => item.course_key === key);
                      const catalogCourse = gradeCourseCatalog.data?.find((item) => item.key === key);
                      const title = catalogCourse?.title ?? course?.title ??
                        (studyCourses.isPending || gradeCourseCatalog.isPending ? "Загружаем курс…" : `Курс · ${key}`);
                      const completed = course?.finished === true || catalogCourse?.completion_state === "verified";
                      const started = (course?.completed_units ?? 0) > 0 || catalogCourse?.completion_state === "reported";
                      return <li key={key}>
                        <div className="calm-home__course-name">
                          <BookOpen size={17} aria-hidden="true" />
                          <div><strong>{title}</strong><small>{completed ? "Завершён" : started ? "В процессе" : "Не начат"}</small></div>
                        </div>
                        {completed ? <span className="calm-home__course-done"><Check size={16} /> Пройден</span> :
                          <button type="button" className="calm-home__text-action"
                            onClick={() => { onOpenTarget("course", key, roleKey ?? undefined); }}>
                            {started ? "Продолжить" : "Пройти"} <ArrowRight size={16} />
                          </button>}
                      </li>;
                    })}
                  </ul>
                ) : <p className="calm-home__req-note" role="status">{currentLevel.curriculum_state === "unpublished"
                  ? "Курсы следующего цикла ещё не опубликованы."
                  : levelComplete ? "Обязательная программа завершена." : "Перечень курсов не получен. Откройте траекторию."}</p>}
                {showRequiredCourses && (studyCourses.isError || gradeCourseCatalog.isError) &&
                  <p className="calm-home__req-note" role="status">Часть данных о курсах недоступна. Для актуальной информации откройте Bootcamp.</p>}
                <div className="calm-home__req-line">
                  <Target size={20} aria-hidden="true" />
                  <div><strong>Практика</strong><small>Засчитано: {String(currentLevel.credited_practices)} из {String(currentLevel.required_practices)}. Подтверждение компетенций учитывается отдельно.</small></div>
                </div>
              </>
            ) : <p role="status" className="calm-home__req-note">Требования уровня сейчас недоступны. Можно открыть свою траекторию.</p>}
            <button type="button" className="calm-home__text-action"
              onClick={() => { onOpenWorkspace("trajectory"); }}>Перейти к траектории <ArrowRight size={16} /></button>
          </div>
        )}
      </section>

      <section className="calm-home__footer" aria-label="Другие инструменты">
        <div className="calm-home__footer-heading">
          <h2>Всё остальное — под рукой</h2>
          <p>Откройте нужный раздел, когда он понадобится.</p>
        </div>
        <div className="calm-home__shortcuts">
          <button type="button" onClick={() => { onOpenWorkspace("trajectory"); }}><Compass size={20} /> Траектория <ChevronRight size={16} /></button>
          <button type="button" onClick={() => { onOpenWorkspace("skills"); }}><ShieldCheck size={20} /> Скилл-паспорт <ChevronRight size={16} /></button>
          {buddyAvailable &&
            <button type="button" onClick={() => { onOpenWorkspace("buddy"); }}><Sparkles size={20} /> AI Buddy <ChevronRight size={16} /></button>}
        </div>
        {passport.data && passport.data.skills.length > 0 &&
          <p className="calm-home__skills-preview"><ShieldCheck size={16} aria-hidden="true" /> Последний подтверждённый навык: {passport.data.skills[0]?.key}</p>}
      </section>
    </div>
  );
}
