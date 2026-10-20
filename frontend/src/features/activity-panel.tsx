import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "../api/client";
import type { components } from "../api/schema";

export type GrowthSnapshotView = components["schemas"]["GrowthSnapshotView"];
export type ActivityBucketView = components["schemas"]["ActivityBucketView"];
export type ActivityStateView = components["schemas"]["ActivityStateView"];

const PERIODS = [
  { key: "day", label: "День" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "year", label: "Год" },
] as const;

export type ActivityPeriod = (typeof PERIODS)[number]["key"];

const KIND_KEYS = [
  "course_checkpoint",
  "project_submission",
  "revision_accepted",
  "event_participation",
] as const;

const KIND_LABELS: Record<(typeof KIND_KEYS)[number], string> = {
  course_checkpoint: "Курсы и checkpoints",
  project_submission: "Проекты",
  revision_accepted: "Принятые исправления",
  event_participation: "События",
};

const PERIOD_ALIASES: Record<ActivityPeriod, string> = {
  day: "день",
  week: "неделю",
  month: "месяц",
  year: "год",
};

const KIND_LABEL_MAP = new Map<string, string>(Object.entries(KIND_LABELS));

function kindTitle(kind: string): string {
  return KIND_LABEL_MAP.get(kind) ?? kind;
}

function formatStamp(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

/**
 * Панель «Активность» главной страницы участника (openspec 22.4).
 * Данные — только из /me/growth/snapshot: компактный выбор день/неделя/месяц/год,
 * разложение по квалифицированным категориям, состояние против плана
 * (риск/успех/нейтрально) и раскрытие «Как считается» с версией определения,
 * таймзоной, периодом и свежестью. Цвет никогда не единственное объяснение —
 * у каждого состояния есть текст.
 */
export function ActivityPanel(props: { onOpenAnalytics: () => void }) {
  const query = useQuery<GrowthSnapshotView>({
    queryKey: ["growth-snapshot"],
    queryFn: () => apiRequest<GrowthSnapshotView>("/api/v1/me/growth/snapshot"),
  });
  const [period, setPeriod] = useState<ActivityPeriod>("day");
  return (
    <ActivityBody
      state={query.status}
      data={query.data}
      period={period}
      onPeriod={setPeriod}
      onOpenAnalytics={props.onOpenAnalytics}
    />
  );
}

export function ActivityBody(props: {
  state: "pending" | "error" | "success";
  data: GrowthSnapshotView | undefined;
  period: ActivityPeriod;
  onPeriod: (period: ActivityPeriod) => void;
  onOpenAnalytics: () => void;
}) {
  const bucket = props.data?.activity[props.period] ?? null;
  const activityState = props.data?.activity_state[props.period] ?? null;
  return (
    <aside className="insight-panel" data-testid="activity-panel">
      <header>
        <h2>Активность</h2>
        <div data-testid="activity-scale">
          <select
            aria-label="Период активности"
            className="activity-scale-button activity-scale-button--active"
            value={props.period}
            onChange={(event) => {
              props.onPeriod(event.target.value as ActivityPeriod);
            }}
          >
            {PERIODS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </header>
      {props.state === "pending" ? (
        <p data-testid="activity-loading" aria-busy="true">
          Собираем квалифицированные события за {PERIOD_ALIASES[props.period]}.
        </p>
      ) : null}
      {props.state === "error" ? (
        <p data-testid="activity-unavailable">
          Прогноз активности недоступен: платформа не показывает выдуманные числа.
          Попробуйте позже — панель ждёт подтверждённые события.
        </p>
      ) : null}
      {props.state === "success" && bucket && props.data ? (
        <>
          <Histogram bucket={bucket} period={props.period} />
          <KindTable bucket={bucket} />
          <StateLine state={activityState} />
          <HowItWorks data={props.data} period={props.period} />
        </>
      ) : null}
      <button
        className="secondary-button activity-analytics-button"
        type="button"
        onClick={props.onOpenAnalytics}
      >
        Открыть аналитику →
      </button>
    </aside>
  );
}

function Histogram({ bucket, period }: { bucket: ActivityBucketView; period: ActivityPeriod }) {
  const top = Math.max(bucket.total, 1);
  return (
    <div
      className="home-histogram"
      role="img"
      aria-label={`Квалифицированные события за ${PERIOD_ALIASES[period]}: всего ${String(bucket.total)}`}
      data-testid="activity-histogram"
    >
      {KIND_KEYS.map((kind) => (
        <i
          key={kind}
          title={`${KIND_LABELS[kind]}: ${String(bucket[kind])}`}
          style={{ height: `${String(Math.max(8, (bucket[kind] / top) * 100))}%` }}
        />
      ))}
      <i
        className="activity-total-bar"
        title={`Всего: ${String(bucket.total)}`}
        style={{ height: "100%" }}
      />
    </div>
  );
}

function KindTable({ bucket }: { bucket: ActivityBucketView }) {
  return (
    <ul className="activity-kind-table" data-testid="activity-kinds">
      <li data-testid="activity-total">
        <span>Всего событий</span>
        <strong>{bucket.total}</strong>
      </li>
      {KIND_KEYS.map((kind) => (
        <li key={kind} data-testid={`activity-kind-${kind}`}>
          <span>{KIND_LABELS[kind]}</span>
          <strong>{bucket[kind]}</strong>
        </li>
      ))}
    </ul>
  );
}

function StateLine({ state }: { state: ActivityStateView | null }) {
  if (!state) {
    return (
      <p className="activity-state activity-state--neutral" data-testid="activity-state-neutral">
        Состояние активности пока не определено: ждём данные плана. Числа выше
        остаются текстом и без цвета.
      </p>
    );
  }
  const className = `activity-state activity-state--${state.state}`;
  const testid = `activity-state-${state.state}`;
  return (
    <div className={className} data-testid={testid}>
      <p>{state.text}</p>
      {state.action ? (
        <p className="activity-state-action" data-testid="activity-state-action">
          Конкретное действие: {state.action}
        </p>
      ) : null}
    </div>
  );
}

function HowItWorks({
  data,
  period,
}: {
  data: GrowthSnapshotView;
  period: ActivityPeriod;
}) {
  const boundaries = data.period_boundaries[period];
  const events = data.events.filter((event) => event.kind in KIND_LABELS).slice(0, 5);
  const rest = Math.max(0, data.events.length - events.length);
  return (
    <details className="activity-how" data-testid="activity-how">
      <summary>Как считается</summary>
      <dl>
        <dt>Определение</dt>
        <dd data-testid="activity-definition">
          {data.definitions.activity}; вес квалифицированного события — 1
        </dd>
        <dt>Таймзона</dt>
        <dd data-testid="activity-timezone">{data.actor_timezone}</dd>
        <dt>Период</dt>
        <dd data-testid="activity-period">
          {formatStamp(boundaries?.start)} — {formatStamp(boundaries?.end)}
        </dd>
        <dt>Свежесть</dt>
        <dd data-testid="activity-freshness">
          {data.freshness.known
            ? `последнее подтверждённое событие: ${formatStamp(data.freshness.latest_observed_at)}`
            : "подтверждённых событий пока нет"}
        </dd>
        <dt>События</dt>
        <dd>
          <ul data-testid="activity-events">
            {events.length === 0 ? <li>За весь след не попало ни одного квалифицированного события.</li> : null}
            {events.map((event) => (
              <li key={`${event.source_kind}:${event.source_ref}`}>
                {formatStamp(event.occurred_at)} — {kindTitle(event.kind)}: {event.title}
              </li>
            ))}
          </ul>
          {rest > 0 ? <p>и ещё {rest} событий — полная история в аналитике.</p> : null}
        </dd>
      </dl>
    </details>
  );
}
