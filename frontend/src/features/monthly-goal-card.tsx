import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  claimRecommendedMonthlyGoal,
  loadMonthlyGoal,
  type MonthlyGoalView,
} from "./monthly-goal-client";
import "./monthly-goal.css";

const statusLabels: Record<string, string> = {
  completed: "Подтверждено",
  submitted: "Ожидает проверки",
  available: "Доступно",
  locked: "Сначала предыдущий шаг",
  unknown: "Нет опубликованного mapping",
};

export function MonthlyGoalDiagram({ goal }: { goal: MonthlyGoalView }) {
  const { current, projected, target } = goal.contours;
  const safeTarget = Math.max(target, 1);
  const rings = [
    { label: "Текущий", value: current, radius: 58, className: "current" },
    { label: "Прогноз", value: projected, radius: 45, className: "projected" },
    { label: "Цель", value: target, radius: 32, className: "target" },
  ];
  return (
    <figure className="monthly-goal-diagram" aria-label="Текущий, прогнозируемый и целевой контуры">
      <svg viewBox="0 0 140 140" role="img">
        {rings.map((ring) => {
          const circumference = 2 * Math.PI * ring.radius;
          const progress = Math.min(ring.value / safeTarget, 1);
          return (
            <circle
              key={ring.label}
              className={`monthly-goal-ring monthly-goal-ring--${ring.className}`}
              cx="70"
              cy="70"
              r={ring.radius}
              pathLength={circumference}
              strokeDasharray={`${String(circumference * progress)} ${String(circumference)}`}
            />
          );
        })}
      </svg>
      <figcaption>
        {rings.map((ring) => (
          <span key={ring.label} className={`monthly-goal-legend--${ring.className}`}>
            {ring.label}: <strong>{ring.value}</strong>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function MonthlyGoalBody({
  state,
  goal,
  claiming,
  onClaim,
}: {
  state: "pending" | "error" | "success";
  goal: MonthlyGoalView | null | undefined;
  claiming: boolean;
  onClaim: () => void;
}) {
  if (state === "pending") return <section className="monthly-goal-card" aria-busy="true">Загружаем месячную цель…</section>;
  if (state === "error") return <section className="monthly-goal-card monthly-goal-card--error">Не удалось загрузить цель. Повторите позже.</section>;
  if (!goal) {
    return (
      <section className="monthly-goal-card monthly-goal-card--empty" data-testid="monthly-goal-empty">
        <div>
          <p className="eyebrow">Месячная цель</p>
          <h2>Выберите измеримый результат месяца</h2>
          <p>Платформа построит план до ближайшего checkpoint и честно оценит его по вашему ритму.</p>
        </div>
        <button type="button" onClick={onClaim} disabled={claiming}>
          {claiming ? "Создаём план…" : "Поставить рекомендованную цель"}
        </button>
      </section>
    );
  }
  return (
    <section className="monthly-goal-card" data-testid="monthly-goal-card">
      <header>
        <div>
          <p className="eyebrow">Месячная цель · {goal.track_title}</p>
          <h2>{goal.goal_title}</h2>
          <p>{goal.days_left} дн. до конца периода · осталось {goal.remaining} checkpoint</p>
        </div>
        <span className="ui-badge">План v{goal.plan_version}</span>
      </header>
      <div className="monthly-goal-layout">
        <MonthlyGoalDiagram goal={goal} />
        <div className="monthly-goal-plan">
          <p className={`monthly-goal-feasibility monthly-goal-feasibility--${goal.feasibility.feasible ? "success" : "risk"}`}>
            {goal.feasibility.text}
          </p>
          {goal.partial_forecast && (
            <p className="monthly-goal-partial">Частичный прогноз · покрытие {Math.round(goal.coverage * 100)}%</p>
          )}
          <ol>
            {goal.steps.map((step) => (
              <li key={step.key} className={`monthly-goal-step--${step.status}`}>
                <span>{step.position}</span>
                <div><strong>{step.title}</strong><small>{step.skill} · {statusLabels[step.status]}</small></div>
              </li>
            ))}
          </ol>
          <details>
            <summary>Как считается прогноз</summary>
            <ul>{goal.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
            <small>Расчёт: {new Date(goal.generated_at).toLocaleString("ru-RU")} · {goal.timezone}</small>
          </details>
        </div>
      </div>
    </section>
  );
}

export function MonthlyGoalCard() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["monthly-goal"], queryFn: loadMonthlyGoal });
  const claim = useMutation({
    mutationFn: claimRecommendedMonthlyGoal,
    onSuccess: (goal) => queryClient.setQueryData(["monthly-goal"], goal),
  });
  return (
    <MonthlyGoalBody
      state={query.status}
      goal={query.data}
      claiming={claim.isPending}
      onClaim={() => {
        claim.mutate();
      }}
    />
  );
}
