import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { StatePanel } from "../../components/ui";
import {
  BuddySuggestionCard,
} from "../buddy-suggestion";
import { MonthlyGoalCard } from "../monthly-goal-card";
import { PassportNextResultCard } from "../next-result";
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

/**
 * Home v2 preview (participant-home-trajectory-grades, participant-experience).
 * One versioned overview request feeds the canonical blocks; Next Result,
 * Buddy and Monthly Goal reuse the existing components with identical
 * properties, so no client-side joins by title are performed. Prototype
 * panels stay API-backed: demo constants are never rendered here.
 */
export function ParticipantHomeV2(props: {
  onOpenTarget: OpenTarget;
  onOpenWorkspace: (canonicalPath?: string) => void;
}) {
  const overview = useQuery({
    queryKey: overviewQueryKey,
    queryFn: loadDevelopmentOverview,
  });
  if (overview.isPending) {
    return (
      <div className="home-v2" data-reference="R-PAR-01">
        <StatePanel kind="loading" />
      </div>
    );
  }
  if (overview.isError) {
    return (
      <div className="home-v2" data-reference="R-PAR-01">
        <section className="home-v2-failure" role="status">
          <strong>Не удалось загрузить обзор развития.</strong>
          <p>Блоки домашнего раздела остаются недоступными без авторизованного снимка.</p>
          <button
            type="button"
            onClick={() => {
              void overview.refetch();
            }}
          >
            Повторить
          </button>
        </section>
      </div>
    );
  }
  return (
    <ParticipantHomeV2Body
      overview={overview.data}
      onOpenTarget={props.onOpenTarget}
      onOpenWorkspace={props.onOpenWorkspace}
      onRetry={() => {
        void overview.refetch();
      }}
    />
  );
}

export function ParticipantHomeV2Body(props: {
  overview: DevelopmentOverviewView;
  onOpenTarget: OpenTarget;
  onOpenWorkspace: (canonicalPath?: string) => void;
  onRetry: () => void;
}) {
  const { overview } = props;
  const asOf = useMemo(
    () =>
      new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(new Date(overview.as_of)),
    [overview.as_of],
  );
  return (
    <div className="home-v2" data-reference="R-PAR-01" data-as-of={overview.as_of}>
      <header className="home-v2-freshness">
        <p className="eyebrow">Предпросмотр нового домашнего раздела</p>
        <small>Снимок авторизованных данных от {asOf}</small>
      </header>
      <div className="home-v2-first-row">
        <NextOutcomePanel
          outcome={overview.next_outcome}
          onOpenTarget={props.onOpenTarget}
          onRetry={props.onRetry}
        />
        <GradeSummaryPanel grade={overview.concepts.career_grade} hint={overview.concepts} />
        <WeeklyFocusPanel focus={overview.weekly_focus} />
      </div>
      <ActiveTasksPanel
        tasks={overview.active_tasks}
        onOpenTarget={props.onOpenTarget}
      />
      <div className="home-v2-support-rail">
        <section className="home-v2-rail-block" aria-label="Навыки и следующий результат">
          <h2>Skills Passport</h2>
          <PassportNextResultCard
            onOpenWorkspace={() => {
              props.onOpenWorkspace();
            }}
            onOpenTarget={props.onOpenTarget}
          />
        </section>
        <section className="home-v2-rail-block" aria-label="AI Buddy recommendation">
          <h2>AI-Buddy</h2>
          <BuddySuggestionCard onOpenWorkspace={props.onOpenWorkspace} />
        </section>
      </div>
      <MonthlyGoalCard />
    </div>
  );
}

export function NextOutcomePanel(props: {
  outcome: DevelopmentOverviewView["next_outcome"];
  onOpenTarget: OpenTarget;
  onRetry: () => void;
}) {
  const outcome = props.outcome;
  if (outcome === null) {
    return (
      <section className="home-v2-block home-v2-next-outcome home-v2-next-outcome--empty" role="status">
        <h2>Главный результат</h2>
        <p>
          Активной траектории нет, поэтому обязательный следующий шаг не вычислен.
          Выберите траекторию в разделе траекторий.
        </p>
        <button type="button" onClick={props.onRetry}>
          Обновить
        </button>
      </section>
    );
  }
  return (
    <section className="home-v2-block home-v2-next-outcome" data-testid={`next-outcome-${outcome.target_kind}`}>
      <header>
        <h2>Главный результат</h2>
        <small>{outcome.trajectory_title} · этап {String(outcome.milestone_position)} · политика v{String(outcome.policy_version)}</small>
      </header>
      <p className="home-v2-outcome-title">{outcome.target_title}</p>
      <ul className="home-v2-outcome-reasons">
        {outcome.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      {outcome.stale_reason !== null && (
        <p className="home-v2-outcome-stale" role="status">{outcome.stale_reason}</p>
      )}
      <button
        type="button"
        onClick={() => {
          props.onOpenTarget(outcome.target_kind, outcome.target_key);
        }}
      >
        Перейти к шагу
      </button>
    </section>
  );
}

export function GradeSummaryPanel(props: {
  grade: DevelopmentOverviewView["concepts"]["career_grade"];
  hint: DevelopmentOverviewView["concepts"];
}) {
  const grade = props.grade;
  return (
    <section className="home-v2-block home-v2-grade" data-testid="grade-summary" data-grade-state={grade.state}>
      <header>
        <h2>Карьерный грейд</h2>
        <small>политика v{String(grade.policy_version)}</small>
      </header>
      {grade.state === "not_evaluable" ? (
        <div className="home-v2-grade-not-evaluable" role="status">
          <p>
            Грейд пока не вычисляется: каталог грейдов не опубликован
            {grade.reason !== null && grade.reason.length > 0 ? ` (${grade.reason})` : ""}.
          </p>
          {grade.hint !== null && <small>{grade.hint}</small>}
        </div>
      ) : (
        <div>{grade.current_grade ?? "—"}</div>
      )}
      <dl className="home-v2-concepts">
        <div>
          <dt>Компетенция</dt>
          <dd>{props.hint.competency_level.value_state}</dd>
        </div>
        <div>
          <dt>Этап</dt>
          <dd>{props.hint.stage_progress.value_state}</dd>
        </div>
        <div>
          <dt>Готовность</dt>
          <dd>{props.hint.readiness_percent.value_state}</dd>
        </div>
        <div>
          <dt>Рейтинг</dt>
          <dd>{props.hint.rating_xp.value_state}</dd>
        </div>
        <div>
          <dt>Ревью</dt>
          <dd>{props.hint.review_grade.value_state}</dd>
        </div>
      </dl>
    </section>
  );
}

export function WeeklyFocusPanel(props: {
  focus: DevelopmentOverviewView["weekly_focus"];
}) {
  const focus = props.focus;
  const [selected, setSelected] = useState<string | null>(
    focus.days[0]?.date ?? null,
  );
  return (
    <section className="home-v2-block home-v2-weekly" data-testid="weekly-focus">
      <header>
        <h2>Фокус недели</h2>
        <small>
          {focus.versioned && focus.preset !== null
            ? `${focus.preset} · выполнено ${String(focus.done_days)} из ${String(focus.target_days)}`
            : "Ритм недели не настроен"}
        </small>
      </header>
      <div className="home-v2-week-days" role="group" aria-label="Дни недели">
        {focus.days.map((day) => {
          const label = formatWeekdayShort(day.date);
          const active = day.date === selected;
          const state = day.done ? "done" : day.planned ? "planned" : "off";
          return (
            <button
              type="button"
              key={day.date}
              className={`home-v2-day home-v2-day--${state}${active ? " home-v2-day--selected" : ""}`}
              aria-pressed={active}
              onClick={() => {
                setSelected(day.date);
              }}
            >
              <span>{label}</span>
              <strong>{formatDayLabel(day.date)}</strong>
            </button>
          );
        })}
      </div>
      {selected !== null && <WeeklyFocusDetail date={selected} focus={props.focus} />}
    </section>
  );
}

export function WeeklyFocusDetail(props: {
  date: string;
  focus: DevelopmentOverviewView["weekly_focus"];
}) {
  const day = props.focus.days.find((item) => item.date === props.date) ?? null;
  if (day === null) return null;
  const title = formatDayLabel(day.date);
  return (
    <div className="home-v2-week-day-detail" role="status" aria-label={`Фокус на ${title}`}>
      <strong>{title}</strong>
      <p>
        {day.done
          ? "День подтверждён квалификационным действием."
          : day.planned
            ? "Запланирован по ритму недели, выполнение пока не подтверждено."
            : "Не запланирован по ритму недели."}
      </p>
    </div>
  );
}

export function ActiveTasksPanel(props: {
  tasks: DevelopmentOverviewView["active_tasks"];
  onOpenTarget: OpenTarget;
}) {
  const { tasks } = props;
  return (
    <section className="home-v2-block home-v2-tasks" data-testid="active-tasks">
      <header>
        <h2>Активные задачи</h2>
        <small>{tasks.length === 0 ? "нет активных назначений" : String(tasks.length)}</small>
      </header>
      {tasks.length === 0 ? (
        <p className="home-v2-tasks-empty" role="status">
          Активных задач нет. Доступные задачи открываются из раздела задач.
        </p>
      ) : (
        <ul className="home-v2-task-list">
          {tasks.map((task) => (
            <li key={task.assignment_id}>
              <article>
                <div>
                  <strong>{task.title}</strong>
                  <small>
                    {TASK_NEXT_ACTION_LABELS[task.next_action] ?? task.status}
                  </small>
                </div>
                {task.open_contributions > 0 && (
                  <small>открытых отправок: {String(task.open_contributions)}</small>
                )}
                <button
                  type="button"
                  onClick={() => {
                    props.onOpenTarget("task", task.task_id);
                  }}
                >
                  Открыть задачу
                </button>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
