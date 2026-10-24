import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { apiRequest, retrySafeRead, RuntimeApiPath } from "../../api/client";
import { Badge, Card, SafeExternalLink, StatePanel } from "../../components/ui";
import "./bootcamp-ux.scss";

type MustTake = {
  skill: string;
  current_level: string | null;
  target_level: string | null;
  projected_impact: string;
  explanation: string;
};

type CourseCardState = {
  key: string;
  title: string;
  track_keys: string[];
  source_url: string;
  access_state: "available" | "unavailable" | "prerequisite_not_met";
  access_note: string;
  completion_state: "not_started" | "reported" | "verified" | "rejected";
  relevant: boolean;
  relevance_reasons: string[];
  recommendation_reason: string;
  must_take: MustTake | null;
  pending_verification_note: string | null;
  verified_evidence: string | null;
};

type Streak = { current_days: number; qualified_dates: string[]; reason: string };

const CATALOG_PATH: RuntimeApiPath = "/api/v1/me/bootcamp/catalog";

const csrfHeaders = (): HeadersInit => ({
  "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "",
});

type BadgeTone = "neutral" | "success" | "warning";

const accessLabels: Record<CourseCardState["access_state"], { label: string; tone: BadgeTone }> = {
  available: { label: "Доступен", tone: "success" },
  unavailable: { label: "Внешний доступ ограничен", tone: "warning" },
  prerequisite_not_met: { label: "Нужен подтверждённый prerequisite", tone: "warning" },
};

const completionLabels: Partial<
  Record<CourseCardState["completion_state"], { label: string; tone: BadgeTone }>
> = {
  verified: { label: "Подтверждено", tone: "success" },
  reported: { label: "Ожидает проверки", tone: "neutral" },
  rejected: { label: "Завершение отклонено", tone: "warning" },
};

function LevelLine({ mustTake }: { mustTake: MustTake }) {
  const current = mustTake.current_level ?? "уровень ещё не зафиксирован";
  const target = mustTake.target_level ?? "уверенный";
  return (
    <p>
      Навык «{mustTake.skill}»: сейчас «{current}», целевой уровень «{target}».
    </p>
  );
}

function CardStates({ card }: { card: CourseCardState }) {
  const access = accessLabels[card.access_state];
  const completion = completionLabels[card.completion_state];
  return (
    <div className="course-meta">
      <Badge tone={access.tone}>{access.label}</Badge>
      {completion && <Badge tone={completion.tone}>{completion.label}</Badge>}
    </div>
  );
}

function CardExplanation({
  card,
  relevanceOnly,
}: {
  card: CourseCardState;
  relevanceOnly: boolean;
}) {
  return (
    <>
      <p>{card.recommendation_reason}</p>
      {card.must_take && (
        <div data-testid={`must-take-${card.key}`}>
          <Badge tone="warning">Надо пройти</Badge>
          <p>{card.must_take.explanation}</p>
          <LevelLine mustTake={card.must_take} />
          <p className="muted">{card.must_take.projected_impact}</p>
        </div>
      )}
      {relevanceOnly && card.relevant && (
        <div data-testid={`relevance-${card.key}`}>
          <p className="eyebrow">Почему актуален</p>
          <ul>{card.relevance_reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </div>
      )}
      {card.relevant && <Badge tone="success">Актуальный</Badge>}
      {card.pending_verification_note && <p className="notice">{card.pending_verification_note}</p>}
      {card.verified_evidence && (
        <small className="muted">Подтверждённое доказательство: {card.verified_evidence}</small>
      )}
      <p className="muted">{card.access_note}</p>
    </>
  );
}

function CardActions({ card }: { card: CourseCardState }) {
  const client = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const canAct = card.access_state === "available" && card.completion_state === "not_started";
  const completion = useMutation({
    mutationFn: (courseKey: string) =>
      apiRequest(`/api/v1/me/courses/${encodeURIComponent(courseKey)}/completion`, {
        method: "POST",
        headers: csrfHeaders(),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["bootcamp-catalog"] });
      await client.invalidateQueries({ queryKey: ["courses"] });
    },
  });
  const learning = useMutation({
    mutationFn: (courseKey: string) =>
      apiRequest(`/api/v1/me/courses/${encodeURIComponent(courseKey)}/learning-days`, {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ occurred_at: new Date().toISOString() }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["streak"] });
    },
  });

  function openTrajectory() {
    const next = new URLSearchParams(searchParams);
    next.set("course", card.key);
    setSearchParams(next);
  }

  return (
    <div className="course-actions">
      <button type="button" onClick={openTrajectory}>
        Открыть траекторию
      </button>
      {canAct && (
        <button
          type="button"
          className="secondary-button"
          onClick={() => { completion.mutate(card.key); }}
        >
          Отметить завершение
        </button>
      )}
      {canAct && (
        <button
          type="button"
          className="secondary-button"
          onClick={() => { learning.mutate(card.key); }}
        >
          Записать учебный день
        </button>
      )}
      {card.access_state === "available" && (
        <SafeExternalLink href={card.source_url}>Первоисточник курса</SafeExternalLink>
      )}
    </div>
  );
}

function CatalogFilters({
  searchParams,
  updateFilter,
  trackOptions,
  relevantCount,
  totalCount,
}: {
  searchParams: URLSearchParams;
  updateFilter: (key: string, value: string) => void;
  trackOptions: string[];
  relevantCount: number;
  totalCount: number;
}) {
  const relevanceFilter = searchParams.get("relevance") ?? "all";
  const trackFilter = searchParams.get("track") ?? "all";
  const view = searchParams.get("view") ?? "card";
  const query = searchParams.get("q") ?? "";
  return (
    <div className="bootcamp-catalog-toolbar">
      <div role="group" aria-label="Фильтр актуальности" className="catalog-segments">
        <button
          type="button"
          aria-pressed={relevanceFilter !== "relevant"}
          onClick={() => { updateFilter("relevance", "all"); }}
        >
          Все курсы
        </button>
        <button
          type="button"
          aria-pressed={relevanceFilter === "relevant"}
          onClick={() => { updateFilter("relevance", "relevant"); }}
        >
          Актуальные
        </button>
      </div>
      <p className="bootcamp-filter-hint">
        Актуальные — курсы, доступные сейчас и связанные с активной траекторией и незакрытым пробелом навыков.
      </p>
      <label className="bootcamp-query" htmlFor="bootcamp-search-course">
        Поиск курса
        <input
          id="bootcamp-search-course"
          type="search"
          placeholder="Название курса или навык"
          value={query}
          onChange={(event) => { updateFilter("q", event.target.value); }}
        />
      </label>
      <label className="catalog-filter">
        Направление
        <select value={trackFilter} onChange={(event) => { updateFilter("track", event.target.value); }}>
          <option value="all">Все мои направления</option>
          {trackOptions.map((track) => (
            <option key={track} value={track}>
              {track}
            </option>
          ))}
        </select>
      </label>
      <div role="group" aria-label="Вид каталога" className="catalog-segments">
        <button
          type="button"
          aria-pressed={view === "card"}
          onClick={() => { updateFilter("view", "card"); }}
        >
          Карточки
        </button>
        <button
          type="button"
          aria-pressed={view === "list"}
          onClick={() => { updateFilter("view", "list"); }}
        >
          Список
        </button>
      </div>
      <p className="bootcamp-catalog-summary" aria-live="polite">
        Актуальные: {relevantCount} из {totalCount}
      </p>
    </div>
  );
}

export function BootcampCatalog({
  honorBoardEnabled,
  honorBoardConsent,
}: {
  honorBoardEnabled: boolean;
  honorBoardConsent: boolean;
}) {
  const catalog = useQuery({
    queryKey: ["bootcamp-catalog"],
    queryFn: () => apiRequest<CourseCardState[]>(CATALOG_PATH),
    retry: retrySafeRead,
  });
  const streak = useQuery({
    queryKey: ["streak"],
    queryFn: () => apiRequest<Streak>("/api/v1/me/learning/streak"),
    retry: retrySafeRead,
  });
  const [searchParams, setSearchParams] = useSearchParams();

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete(key);
    else next.set(key, value);
    next.delete("course");
    setSearchParams(next);
  }

  if (catalog.isLoading || streak.isLoading) return <StatePanel kind="loading" />;
  if (catalog.isError || streak.isError || !catalog.data || !streak.data) {
    return (
      <StatePanel
        kind="error"
        action="Обновить"
        onAction={() => {
          void catalog.refetch();
          void streak.refetch();
        }}
      />
    );
  }

  const relevanceFilter = searchParams.get("relevance") ?? "all";
  const trackFilter = searchParams.get("track") ?? "all";
  const view = searchParams.get("view") ?? "card";
  const query = (searchParams.get("q") ?? "").trim().toLocaleLowerCase("ru-RU");
  const trackOptions = [...new Set(catalog.data.flatMap((card) => card.track_keys))];
  const relevantCount = catalog.data.filter((card) => card.relevant).length;
  const visible = catalog.data
    .filter((card) => relevanceFilter !== "relevant" || card.relevant)
    .filter((card) => trackFilter === "all" || card.track_keys.includes(trackFilter))
    .filter((card) => !query || [card.title, card.recommendation_reason, card.must_take?.skill ?? ""].some((value) => value.toLocaleLowerCase("ru-RU").includes(query)));
  const relevanceOnly = relevanceFilter === "relevant";
  const deepLinkedKey = searchParams.get("course");
  const deepLinked =
    deepLinkedKey !== null ? (catalog.data.find((card) => card.key === deepLinkedKey) ?? null) : null;
  const passesFilters = (card: CourseCardState) => visible.includes(card);
  const orderedVisible = deepLinked && passesFilters(deepLinked) ? ([deepLinked, ...visible.filter((card) => card !== deepLinked)]) : visible;
  const deepLinkFilteredOut = deepLinked !== null && !passesFilters(deepLinked);

  return (
    <div className="feature-stack bootcamp-experience" data-reference="R-PAR-03">
      <header className="bootcamp-hero">
        <div>
          <p className="eyebrow">Ваша траектория развития</p>
          <h1 id="workspace-title">Bootcamp</h1>
          <p className="lead">Выбирайте обучение под свою роль и продолжайте с того места, где остановились.</p>
        </div>
        <div className="bootcamp-hero-pulse" aria-label="Состояние обучения">
          <strong>{String(catalog.data.filter((card) => card.completion_state === "verified").length)}</strong>
          <span>подтверждённых курсов</span>
          <small>Серия обучения: {String(streak.data.current_days)} дн.</small>
        </div>
      </header>
      {deepLinkedKey !== null && deepLinked === null && (
        <p className="notice" role="status">
          Курс по ссылке «{deepLinkedKey}» не найден в актуальном каталоге.
        </p>
      )}
      {deepLinkFilteredOut && (
        <p className="notice" role="status">
          Курс по ссылке «{deepLinkedKey}» скрыт текущими фильтрами; выберите «Все курсы», чтобы
          увидеть его.
        </p>
      )}
      <div className="bootcamp-role-glance">
        <div><span>Для выбранной роли</span><strong>{String(catalog.data.filter((card) => card.must_take !== null).length)} обязательных</strong></div>
        <div><span>Актуальны сейчас</span><strong>{String(relevantCount)} курсов</strong></div>
        <div><span>Подтверждено</span><strong>{String(catalog.data.filter((card) => card.completion_state === "verified").length)} завершений</strong></div>
      </div>
      <CatalogFilters
        searchParams={searchParams}
        updateFilter={updateFilter}
        trackOptions={trackOptions}
        relevantCount={relevantCount}
        totalCount={catalog.data.length}
      />
      {view === "card" ? (
        <div className="course-grid">
          {orderedVisible.map((card) => (
            <article className="ui-card bootcamp-course-card" key={card.key} data-required={card.must_take !== null} data-access={card.access_state} data-testid={`course-${card.key}`}>
              <h2>{card.title}</h2>
              {deepLinkedKey === card.key && (
                <p className="notice" data-testid={`deeplink-${card.key}`}>
                  Курс открыт по прямой ссылке
                </p>
              )}
              <CardExplanation card={card} relevanceOnly={relevanceOnly} />
              <CardStates card={card} />
              <CardActions card={card} />
            </article>
          ))}
        </div>
      ) : (
        <ul className="course-rows" aria-label="Каталог Bootcamp списком">
          {orderedVisible.map((card) => (
            <li className="course-row bootcamp-course-row" key={card.key} data-required={card.must_take !== null} data-access={card.access_state} data-testid={`course-${card.key}`}>
              <strong>{card.title}</strong>
              {deepLinkedKey === card.key && (
                <p className="notice" data-testid={`deeplink-${card.key}`}>
                  Курс открыт по прямой ссылке
                </p>
              )}
              <CardExplanation card={card} relevanceOnly={relevanceOnly} />
              <CardStates card={card} />
              <CardActions card={card} />
            </li>
          ))}
        </ul>
      )}
      {visible.length === 0 && <StatePanel kind="empty" />}
      {honorBoardEnabled && honorBoardConsent && (
        <Card title="Зал славы курсов">
          <p>
            Здесь показываются только участники, отдельно согласившиеся на публичное отображение
            подтверждённого завершения.
          </p>
        </Card>
      )}
    </div>
  );
}
