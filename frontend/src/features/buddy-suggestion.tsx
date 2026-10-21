import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest, type RuntimeApiPath } from "../api/client";
import type { components } from "../api/schema";

type GeneratedSuggestion = components["schemas"]["BuddySuggestionView"];
type GeneratedAction = NonNullable<GeneratedSuggestion["action"]>;
type CompatibilityActionFields =
  | "canonical_path"
  | "target_kind"
  | "target_id"
  | "checkpoint_id"
  | "target_version"
  | "estimated_minutes"
  | "deadline_at"
  | "points"
  | "points_note"
  | "skill_forecast"
  | "effect_state"
  | "available"
  | "stale_reason";
type RichAction = Omit<GeneratedAction, CompatibilityActionFields> & {
  canonical_path?: string;
  target_kind?: string;
  target_id?: string;
  checkpoint_id?: string | null;
  target_version?: number | null;
  estimated_minutes?: number | null;
  deadline_at?: string | null;
  points?: number | null;
  points_note?: string;
  skill_forecast?: string;
  effect_state?: string;
  available?: boolean;
  stale_reason?: string | null;
};
export type BuddySuggestionView = Omit<
  GeneratedSuggestion,
  "action" | "rank_score" | "partial" | "coverage_note"
> & {
  action: RichAction | null;
  rank_score?: string;
  partial?: boolean;
  coverage_note?: string;
};
export type BuddySuggestionStateView = Omit<
  components["schemas"]["BuddySuggestionStateView"],
  "suggestion" | "suggestions"
> & {
  suggestion: BuddySuggestionView | null;
  suggestions?: BuddySuggestionView[];
};

const csrfHeaders = (): HeadersInit => ({
  "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "",
});

const FEEDBACK_PATH = "/api/v1/agents/buddy/suggestion/feedback" as RuntimeApiPath;

const KIND_LABELS: Record<string, string> = {
  bootcamp_idle: "Давно нет проверенного checkpoint",
  domain_next: "Доменный следующий шаг",
};

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

/**
 * AI-Buddy карта главной участника (openspec 22.3, activation 22.26).
 * Рекомендация — объяснимый автоматический анализ разрешённых данных:
 * наблюдение, пробел, действие, польза, категории источников и время расчёта.
 * Пока участник не нажал «Получить рекомендацию», frontend не выполняет
 * необязательный recommendation request: запрос read-only, не считается
 * активностью и не вызывает модель. Ошибка — честный retry, без подмены
 * старым или вымышленным советом.
 */
export function BuddySuggestionCard(props: {
  onOpenWorkspace: (canonicalPath?: string) => void;
}) {
  const [navigationError, setNavigationError] = useState("");
  const query = useQuery<BuddySuggestionStateView>({
    queryKey: ["buddy-suggestion"],
    queryFn: () =>
      apiRequest<BuddySuggestionStateView>("/api/v1/agents/buddy/suggestion"),
    enabled: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const dismiss = useMutation({
    mutationFn: (suggestionId: string) =>
      apiRequest<null>("/api/v1/agents/buddy/suggestion/dismiss", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ suggestion_id: suggestionId }),
      }),
    onSuccess: () => {
      void query.refetch();
    },
  });
  const feedback = useMutation({
    mutationFn: ({ suggestionId, action }: { suggestionId: string; action: "snooze" | "irrelevant" }) =>
      apiRequest<null>(FEEDBACK_PATH, {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ suggestion_id: suggestionId, action }),
      }),
    onSuccess: () => {
      void query.refetch();
    },
  });
  const resolveTarget = useMutation({
    mutationFn: (suggestionId: string) =>
      apiRequest<{ target: RichAction }>(
        `/api/v1/agents/buddy/suggestion/target?suggestion_id=${encodeURIComponent(suggestionId)}` as RuntimeApiPath,
      ),
    onMutate: () => {
      setNavigationError("");
    },
    onSuccess: (resolved) => {
      props.onOpenWorkspace(resolved.target.canonical_path);
    },
    onError: () => {
      setNavigationError("Объект изменился или больше недоступен. Пересчитайте рекомендации.");
      void query.refetch();
    },
  });
  const phase: BuddyCardPhase =
    query.fetchStatus === "fetching"
      ? "loading"
      : query.isError
        ? "error"
        : query.data !== undefined
          ? "result"
          : "idle";
  return (
    <BuddySuggestionBody
      phase={phase}
      data={query.data}
      dismissPending={dismiss.isPending || feedback.isPending || resolveTarget.isPending}
      onActivate={() => {
        void query.refetch();
      }}
      onDismiss={(suggestionId) => {
        dismiss.mutate(suggestionId);
      }}
      onFeedback={(suggestionId, action) => {
        feedback.mutate({ suggestionId, action });
      }}
      onOpenWorkspace={(suggestionId) => {
        resolveTarget.mutate(suggestionId);
      }}
      navigationError={navigationError}
    />
  );
}

type BuddyCardPhase = "idle" | "loading" | "error" | "result";

export function BuddySuggestionBody(props: {
  phase: BuddyCardPhase;
  data?: BuddySuggestionStateView;
  dismissPending: boolean;
  onActivate: () => void;
  onDismiss: (suggestionId: string) => void;
  onFeedback?: (suggestionId: string, action: "snooze" | "irrelevant") => void;
  onOpenWorkspace: (suggestionId: string) => void;
  navigationError?: string;
}) {
  if (props.phase === "idle") {
    return (
      <article className="ai-panel" data-testid="buddy-suggestion-card">
        <div>
          <span className="ai-orb" aria-hidden="true">
            ✦
          </span>
          <div>
            <h2>AI Buddy</h2>
            <span className="ui-badge ui-badge--ai">Автоматический анализ</span>
          </div>
        </div>
        <p data-testid="buddy-suggestion-purpose">
          Buddy предложит объяснимый следующий шаг по вашим подтверждённым
          данным: главное наблюдение, закрываемый пробел, действие и пользу.
          Анализ запускается только по кнопке — заранее готового персонального
          вывода здесь нет.
        </p>
        <button
          type="button"
          data-testid="buddy-suggestion-activate"
          onClick={props.onActivate}
        >
          Получить рекомендацию
        </button>
        <p className="ai-boundary" data-testid="buddy-suggestion-idle-hint">
          Доменный следующий шаг всегда доступен в карточке «Следующий
          результат».
        </p>
      </article>
    );
  }
  if (props.phase === "loading") {
    return (
      <article className="ai-panel" data-testid="buddy-suggestion-card" aria-busy="true">
        <p data-testid="buddy-suggestion-loading">
          Собираем объяснимый автоматический анализ ваших разрешённых данных…
        </p>
      </article>
    );
  }
  if (props.phase === "error") {
    return (
      <article className="ai-panel" data-testid="buddy-suggestion-card">
        <div>
          <span className="ai-orb" aria-hidden="true">
            ✦
          </span>
          <div>
            <h2>AI Buddy</h2>
            <span className="ui-badge ui-badge--ai">Автоматический анализ</span>
          </div>
        </div>
        <p data-testid="buddy-suggestion-unavailable">
          Buddy-анализ недоступен: карта не подменяет данные и не вызывает
          модель. Доменный следующий шаг продолжает показывать карточка
          «Следующий результат».
        </p>
        <button
          type="button"
          className="secondary-button"
          data-testid="buddy-suggestion-retry"
          disabled={props.dismissPending}
          onClick={props.onActivate}
        >
          Попробовать снова
        </button>
      </article>
    );
  }
  const data = props.data;
  if (!data) {
    return null;
  }
  const suggestions = data.suggestions?.length ? data.suggestions : data.suggestion ? [data.suggestion] : [];
  if (data.dismissed || suggestions.length === 0) {
    return (
      <article className="ai-panel" data-testid="buddy-suggestion-card">
        <p data-testid="buddy-suggestion-dismissed">
          {data.dismissed
            ? "Рекомендация скрыта. Доменный следующий шаг остаётся в карточке «Следующий результат»."
            : "Пока нет шага для автоматического анализа. Карточка не выдумывает данные."}
        </p>
      </article>
    );
  }
  return (
    <article className="ai-panel" data-testid="buddy-suggestion-card">
      <div>
        <span className="ai-orb" aria-hidden="true">
          ✦
        </span>
        <div>
          <h2>AI Buddy</h2>
          <span className="ui-badge ui-badge--ai">До трёх следующих действий</span>
        </div>
      </div>
      {props.navigationError ? <p role="alert" data-testid="buddy-suggestion-stale">{props.navigationError}</p> : null}
      <div className="buddy-action-list" aria-label="Рекомендованные действия">
        {suggestions.slice(0, 3).map((suggestion, index) => {
          const kindLabel = KIND_LABELS[suggestion.kind] ?? suggestion.kind;
          const generated = formatTimestamp(suggestion.generated_at);
          const testId = (base: string) => index === 0 ? base : `${base}-${String(index)}`;
          return <section className="buddy-action-card" key={suggestion.suggestion_id} data-testid={testId("buddy-action-card")}>
            <span className="ui-badge ui-badge--ai" data-testid={testId("buddy-suggestion-kind")}>{kindLabel}</span>
            <p data-testid={testId("buddy-suggestion-observation")}>{suggestion.observation}</p>
            <p data-testid={testId("buddy-suggestion-gap")}>{suggestion.gap}</p>
            <p data-testid={testId("buddy-suggestion-benefit")}>{suggestion.benefit}</p>
            {suggestion.action ? <dl className="buddy-action-meta">
              <div><dt>Время</dt><dd>{suggestion.action.estimated_minutes == null ? "Не оценено" : `${String(suggestion.action.estimated_minutes)} мин`}</dd></div>
              <div><dt>Срок</dt><dd>{suggestion.action.deadline_at ? formatTimestamp(suggestion.action.deadline_at) : "Без срока"}</dd></div>
              <div><dt>Баллы</dt><dd>{suggestion.action.points ?? "После проверки"}</dd></div>
              <div><dt>Навык</dt><dd>{suggestion.action.skill_forecast ?? "Прогноз недоступен"}</dd></div>
            </dl> : null}
            <div className="ai-boundary" data-testid={testId("buddy-suggestion-boundary")}>
              {data.ai_model_available
                ? "Автоматический анализ разрешённых данных; модель не вызывается."
                : "Модель AI отключена: используется только автоматический анализ ваших разрешённых данных."}
              {generated ? ` · расчёт ${generated}` : ""}
              {suggestion.partial ? " · частичное покрытие" : ""}
            </div>
            <details data-testid={testId("buddy-suggestion-why")}>
              <summary>Почему это рекомендовано</summary>
              <p data-testid={testId("buddy-suggestion-explanation")}>{suggestion.explanation}</p>
              <p data-testid={testId("buddy-suggestion-sources")}>Источники анализа: {suggestion.source_categories.join(", ")}</p>
              {suggestion.coverage_note ? <p>{suggestion.coverage_note}</p> : null}
            </details>
            {suggestion.action ? <button type="button" onClick={() => { props.onOpenWorkspace(suggestion.suggestion_id); }} aria-label={suggestion.action.title}>{suggestion.action.title} →</button> : null}
            <div className="buddy-feedback-actions">
              <button type="button" className="secondary-button" data-testid={testId("buddy-suggestion-dismiss")} disabled={props.dismissPending} onClick={() => { props.onDismiss(suggestion.suggestion_id); }}>Скрыть рекомендацию</button>
              <button type="button" className="secondary-button" disabled={props.dismissPending} onClick={() => { props.onFeedback?.(suggestion.suggestion_id, "snooze"); }}>Напомнить через неделю</button>
              <button type="button" className="secondary-button" disabled={props.dismissPending} onClick={() => { props.onFeedback?.(suggestion.suggestion_id, "irrelevant"); }}>Не подходит</button>
            </div>
          </section>;
        })}
      </div>
    </article>
  );
}
