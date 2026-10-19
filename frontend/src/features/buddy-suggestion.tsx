import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../api/client";
import type { components } from "../api/schema";

export type BuddySuggestionView = components["schemas"]["BuddySuggestionView"];
export type BuddySuggestionStateView = components["schemas"]["BuddySuggestionStateView"];

const csrfHeaders = (): HeadersInit => ({
  "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "",
});

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
 * AI-Buddy карта главной участника (openspec 22.3).
 * Рекомендация — объяснимый автоматический анализ разрешённых данных:
 * наблюдение, пробел, действие, польза, категории источников и время расчёта.
 * Карта не вызывает модель, не записывает на курс и скрываемая (dismiss).
 */
export function BuddySuggestionCard(props: {
  onOpenWorkspace: () => void;
}) {
  const query = useQuery<BuddySuggestionStateView>({
    queryKey: ["buddy-suggestion"],
    queryFn: () =>
      apiRequest<BuddySuggestionStateView>("/api/v1/agents/buddy/suggestion"),
  });
  const queryClient = useQueryClient();
  const dismiss = useMutation({
    mutationFn: (suggestionId: string) =>
      apiRequest<null>("/api/v1/agents/buddy/suggestion/dismiss", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ suggestion_id: suggestionId }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["buddy-suggestion"] });
    },
  });
  return (
    <BuddySuggestionBody
      state={query.status}
      data={query.data}
      dismissPending={dismiss.isPending}
      onDismiss={(suggestionId) => {
        dismiss.mutate(suggestionId);
      }}
      onOpenWorkspace={props.onOpenWorkspace}
    />
  );
}

export function BuddySuggestionBody(props: {
  state: "pending" | "error" | "success";
  data: BuddySuggestionStateView | undefined;
  dismissPending: boolean;
  onDismiss: (suggestionId: string) => void;
  onOpenWorkspace: () => void;
}) {
  if (props.state === "pending") {
    return (
      <article className="ai-panel" data-testid="buddy-suggestion-card" aria-busy="true">
        <p data-testid="buddy-suggestion-loading">
          Собираем объяснимый автоматический анализ ваших разрешённых данных…
        </p>
      </article>
    );
  }
  if (props.state === "error" || !props.data) {
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
          Buddy-анализ недоступен: карта не подменяет данные и не вызывает модель.
          Доменный следующий шаг продолжает показывать карточка
          «Следующий результат».
        </p>
      </article>
    );
  }
  const data = props.data;
  const suggestion = data.suggestion ?? null;
  if (data.dismissed || suggestion === null) {
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
  const kindLabel = KIND_LABELS[suggestion.kind] ?? suggestion.kind;
  const generated = formatTimestamp(suggestion.generated_at);
  return (
    <article className="ai-panel" data-testid="buddy-suggestion-card">
      <div>
        <span className="ai-orb" aria-hidden="true">
          ✦
        </span>
        <div>
          <h2>AI Buddy</h2>
          <span className="ui-badge ui-badge--ai" data-testid="buddy-suggestion-kind">
            {kindLabel}
          </span>
        </div>
      </div>
      <p data-testid="buddy-suggestion-observation">{suggestion.observation}</p>
      <p data-testid="buddy-suggestion-gap">{suggestion.gap}</p>
      <p data-testid="buddy-suggestion-benefit">{suggestion.benefit}</p>
      <div className="ai-boundary" data-testid="buddy-suggestion-boundary">
        {data.ai_model_available
          ? "Автоматический анализ разрешённых данных; модель не вызывается."
          : "Модель AI отключена: используется только автоматический анализ ваших разрешённых данных."}
        {generated ? ` · расчёт ${generated}` : ""}
      </div>
      <details data-testid="buddy-suggestion-why">
        <summary>Почему это рекомендовано</summary>
        <p data-testid="buddy-suggestion-explanation">{suggestion.explanation}</p>
        <p data-testid="buddy-suggestion-sources">
          Источники анализа: {suggestion.source_categories.join(", ")}
        </p>
      </details>
      {suggestion.action ? (
        <button
          type="button"
          onClick={props.onOpenWorkspace}
          aria-label={suggestion.action.title}
        >
          {suggestion.action.title} →
        </button>
      ) : null}
      <button
        type="button"
        className="secondary-button"
        data-testid="buddy-suggestion-dismiss"
        disabled={props.dismissPending}
        onClick={() => {
          props.onDismiss(suggestion.suggestion_id);
        }}
      >
        Скрыть рекомендацию
      </button>
    </article>
  );
}
