import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { StatePanel } from "../../components/ui";
import { trackCatalogEvent } from "./analytics";
import {
  catalogErrorMessage,
  catalogQueryKey,
  loadCatalogDetail,
  loadCatalogPage,
  setCatalogBookmark,
  withdrawCatalogApplication,
} from "./client";
import { ConditionsDialog } from "./conditions-dialog";
import { TaskCatalogList } from "./list";
import type {
  CatalogFilters,
  CatalogItem,
  CatalogLayout,
  CatalogSort,
} from "./types";
import "./catalog-v2.scss";

const difficultyLabels: Record<string, string> = {
  beginner: "Начальный",
  intermediate: "Средний",
  advanced: "Продвинутый",
};
const formatLabels: Record<string, string> = {
  remote: "Удалённо",
  hybrid: "Гибрид",
  onsite: "На площадке",
};
const timeframeLabels: Record<string, string> = {
  "7d": "ближайшие 7 дней",
  "30d": "ближайшие 30 дней",
  "90d": "ближайшие 90 дней",
};
const applicationLabels = {
  none: "Можно откликнуться",
  submitted: "Отклик отправлен",
  under_review: "Отклик на рассмотрении",
  accepted: "Отклик принят",
  assigned: "Вы назначены на задачу",
  closed: "Участие завершено",
  unavailable: "Действие недоступно",
} as const;
const customerVerificationLabels = {
  verified: "Проверенный заказчик",
  unverified: "Заказчик не верифицирован",
  demo: "Демо-заказчик",
} as const;
const missingFactorLabels: Record<string, string> = {
  ROLE_REQUIREMENTS: "не выбрана или не сопоставлена траектория",
  VERIFIED_COMPETENCIES: "нет актуальных подтверждений",
  GROWTH_FIT: "не опубликованы цели развития",
  FORMAT_FIT: "не заданы предпочтения формата",
};

function sortValue(value: string | null): CatalogSort {
  return value === "deadline" || value === "duration" || value === "newest" || value === "skill-growth"
    ? value
    : "match-default";
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "Длительность не указана";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${String(hours)} ч ${String(rest)} мин` : `${String(rest)} мин`;
}

function formatDeadline(value: string | null): string {
  if (value === null) return "Срок не указан";
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(value),
  );
}

function formatCalculatedAt(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function customerLabel(item: CatalogItem): string {
  return `${item.customer.display_name} · ${customerVerificationLabels[item.customer.verification]}`;
}

function isOfflineError(error: unknown): boolean {
  return (typeof navigator !== "undefined" && !navigator.onLine) || error instanceof TypeError;
}

function MatchBadge({ item, showRing = false }: { item: CatalogItem; showRing?: boolean }) {
  if (item.match.status !== "calculated" || item.match.percent === null) {
    const explanation = item.match.missing_factors
      .map((code) => missingFactorLabels[code] ?? code)
      .join("; ");
    return (
      <span
        className="catalog-v2-match catalog-v2-match--unknown"
        title={explanation || "Недостаточно авторитетных данных для расчёта"}
      >
        Недостаточно данных
      </span>
    );
  }
  const percent = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(
    Number(item.match.percent),
  );
  const badge = (
    <span
      className="catalog-v2-match"
      aria-label={`Релевантность ${percent} процентов`}
      title="Релевантность выбранной траектории и требованиям, не вероятность отбора или найма"
    >
      {percent}% релевантности
    </span>
  );
  if (!showRing) return badge;
  const ringPercent = Math.min(100, Math.max(0, Number(item.match.percent)));
  return (
    <span className="catalog-v2-match-visual">
      <svg viewBox="0 0 44 44" aria-hidden="true" focusable="false">
        <circle className="catalog-v2-match-ring-track" cx="22" cy="22" r="18" pathLength="100" />
        <circle
          className="catalog-v2-match-ring-value"
          cx="22"
          cy="22"
          r="18"
          pathLength="100"
          strokeDasharray={`${String(ringPercent)} 100`}
        />
      </svg>
      {badge}
    </span>
  );
}

function TaskSummary(props: {
  item: CatalogItem;
  layout: CatalogLayout;
  selected: boolean;
  bookmarkPending: boolean;
  onOpen: () => void;
  onConditions: () => void;
  onBookmark: () => void;
  onShare: () => void;
}) {
  const { item } = props;
  const canApply = item.allowed_actions.includes("apply") && item.eligibility.status === "eligible";
  return (
    <article
      className={`catalog-v2-card catalog-v2-card--${props.layout}`}
      tabIndex={0}
      aria-label={`Задача: ${item.title}`}
      data-selected={props.selected}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          props.onOpen();
        }
      }}
    >
      <header>
        <div>
          <p className="eyebrow">{customerLabel(item)}</p>
          <h2>{item.title}</h2>
        </div>
        <MatchBadge item={item} />
      </header>
      <p className="catalog-v2-brief">{item.brief_summary}</p>
      <ul className="catalog-v2-tags" aria-label="Компетенции">
        {item.competency_tags.map((tag) => <li key={tag}>{tag}</li>)}
      </ul>
      <dl className="catalog-v2-facts">
        <div><dt>Формат</dt><dd>{item.work_format === null ? "Не указан" : formatLabels[item.work_format] ?? item.work_format}</dd></div>
        <div><dt>Сложность</dt><dd>{item.difficulty === null ? "Не указана" : difficultyLabels[item.difficulty] ?? item.difficulty}</dd></div>
        <div><dt>Нагрузка</dt><dd>{formatDuration(item.duration_minutes)}</dd></div>
        <div><dt>Места</dt><dd>{item.places_available ?? "—"} из {item.places_total}</dd></div>
        <div><dt>Отклик до</dt><dd>{formatDeadline(item.deadline_at)}</dd></div>
      </dl>
      <p className={`catalog-v2-state catalog-v2-state--${item.application_state}`}>
        {applicationLabels[item.application_state]}
      </p>
      {item.eligibility.missing_prerequisites.length ? (
        <p className="catalog-v2-eligibility">
          Нужны подтверждения: {item.eligibility.missing_prerequisites.join(", ")}
        </p>
      ) : null}
      <footer>
        <button type="button" onClick={props.onOpen}>Подробнее</button>
        {item.allowed_actions.includes("open_conditions") || canApply ? (
          <button type="button" className="catalog-v2-primary" disabled={!canApply} onClick={(event) => { event.currentTarget.focus(); props.onConditions(); }}>
            Условия и отклик
          </button>
        ) : null}
        <button
          type="button"
          aria-pressed={item.bookmarked}
          disabled={props.bookmarkPending}
          onClick={props.onBookmark}
        >
          {props.bookmarkPending ? "Сохраняем…" : item.bookmarked ? "Сохранено" : "Сохранить"}
        </button>
        {item.allowed_actions.includes("share") ? <button type="button" onClick={props.onShare}>Поделиться</button> : null}
      </footer>
    </article>
  );
}

function TaskDetail(props: {
  item: CatalogItem;
  withdrawPending: boolean;
  onClose: () => void;
  onConditions: () => void;
  onWorkspace: (assignmentId: string) => void;
  onWithdraw: (applicationId: string) => void;
  onGrowthExpand: () => void;
}) {
  const { item } = props;
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [growthExpanded, setGrowthExpanded] = useState(true);
  const canApply = item.allowed_actions.includes("apply") && item.eligibility.status === "eligible";
  return (
    <section className="catalog-v2-detail" aria-labelledby="catalog-detail-title">
      <header>
        <div>
          <p className="eyebrow">Детали задачи · условия v{item.terms_version}</p>
          <h2 id="catalog-detail-title">{item.title}</h2>
        </div>
        <MatchBadge item={item} showRing />
        <button type="button" aria-label="Закрыть детали" onClick={props.onClose}>×</button>
      </header>
      <p>{item.brief_summary}</p>
      <div className="catalog-v2-detail-grid">
        <section>
          <h3>Факты и ограничения</h3>
          <dl className="catalog-v2-facts">
            <div><dt>Заказчик</dt><dd>{customerLabel(item)}</dd></div>
            <div><dt>Формат</dt><dd>{item.work_format === null ? "Не указан" : formatLabels[item.work_format] ?? item.work_format}</dd></div>
            <div><dt>Сложность</dt><dd>{item.difficulty === null ? "Не указана" : difficultyLabels[item.difficulty] ?? item.difficulty}</dd></div>
            <div><dt>Длительность</dt><dd>{formatDuration(item.duration_minutes)}</dd></div>
            <div><dt>Нагрузка в неделю</dt><dd>{item.weekly_workload_minutes === null ? "Не указана" : formatDuration(item.weekly_workload_minutes)}</dd></div>
            <div><dt>Поддержка / ментор</dt><dd>{item.support_model ?? "Модель поддержки не опубликована"}</dd></div>
            <div><dt>Команда</dt><dd>{item.places_available ?? "—"} свободных мест из {item.places_total}</dd></div>
            <div><dt>Ограничения</dt><dd>{item.eligibility.missing_prerequisites.length ? `Нужны: ${item.eligibility.missing_prerequisites.join(", ")}` : "Дополнительные ограничения не опубликованы"}</dd></div>
          </dl>
        </section>
        <section>
          <h3>Почему задача рекомендована</h3>
          {item.match.reasons.length ? (
            <ul>{item.match.reasons.map((reason) => <li key={reason.code}>{reason.label}</li>)}</ul>
          ) : <p>Причины появятся после накопления достаточного coverage.</p>}
          <small>Алгоритм: {item.match.algorithm_version ?? "не рассчитан"} · расчёт: {formatCalculatedAt(item.match.calculated_at)}. Это не вероятность отбора или найма.</small>
          <small className="catalog-v2-match-snapshot">Снимок входных данных: <code>{item.match.source_snapshot_version}</code></small>
        </section>
        <section>
          <h3>Вклад в развитие</h3>
          <button
            type="button"
            aria-expanded={growthExpanded}
            onClick={() => {
              if (!growthExpanded) props.onGrowthExpand();
              setGrowthExpanded((value) => !value);
            }}
          >
            {growthExpanded ? "Скрыть сравнение уровней" : "Показать сравнение уровней"}
          </button>
          {growthExpanded ? (
            item.skill_impact.length ? (
              <ul className="catalog-v2-growth-list" aria-label="Сравнение текущего и потенциального уровня">
                {item.skill_impact.map((impact) => (
                  <li key={impact.skill_id}>
                    <strong>{impact.title}</strong>
                    <dl>
                      <div><dt>Текущий уровень</dt><dd>{impact.current_level ?? "Нет подтверждённого уровня"}</dd></div>
                      <div><dt>Прогноз после проверки</dt><dd>{impact.projected_level ?? "Качественный потенциал, без числового прогноза"}</dd></div>
                      <div><dt>Потенциальный рост</dt><dd>{impact.status === "calculated" ? "Рассчитан моделью; требует верификации" : "Не рассчитан численно"}</dd></div>
                    </dl>
                    <p>{impact.explanation}</p>
                    <small>{impact.verification_required ? "Результат не становится подтверждённым навыком автоматически." : "Статус проверки не указан."}</small>
                  </li>
                ))}
              </ul>
            ) : <p>Компетенции для прогноза не опубликованы; числовой рост не рассчитывается.</p>
          ) : null}
        </section>
        <section>
          <h3>План участия</h3>
          {item.stage_plan.stages.length ? (
            <ol>{item.stage_plan.stages.map((stage) => <li key={stage.key}><strong>{stage.title}</strong><p>{stage.summary}</p><small>{stage.state === "locked" ? "Заблокировано в плане" : "Запланировано"} · {formatDuration(stage.estimated_minutes)}</small></li>)}</ol>
          ) : <p>Заказчик не опубликовал ориентировочный план. Это не операционный прогресс задачи.</p>}
        </section>
        <section>
          <h3>Возможные преимущества</h3>
          {item.benefits.length ? (
            <ul>{item.benefits.map((benefit) => <li key={benefit.code}><strong>{benefit.label}</strong><p>{benefit.condition}</p><small>{benefit.state === "potential" ? "При выполнении условия" : benefit.state}</small></li>)}</ul>
          ) : <p>Дополнительные преимущества не опубликованы.</p>}
        </section>
      </div>
      <footer>
        {item.assignment_id !== null && item.allowed_actions.includes("open_workspace") ? (
          <button type="button" className="catalog-v2-primary" onClick={() => { props.onWorkspace(item.assignment_id as string); }}>
            Перейти в рабочую область
          </button>
        ) : null}
        {canApply ? <button type="button" className="catalog-v2-primary" onClick={(event) => { event.currentTarget.focus(); props.onConditions(); }}>Прочитать условия и откликнуться</button> : null}
        {item.application_id !== null && item.allowed_actions.includes("withdraw") ? (
          confirmWithdraw ? (
            <span className="catalog-v2-withdraw-confirm" role="group" aria-label="Подтверждение отзыва">
              <span>Отозвать отправленный отклик?</span>
              <button type="button" disabled={props.withdrawPending} onClick={() => { props.onWithdraw(item.application_id as string); }}>Да, отозвать</button>
              <button type="button" disabled={props.withdrawPending} onClick={() => { setConfirmWithdraw(false); }}>Оставить</button>
            </span>
          ) : <button type="button" onClick={() => { setConfirmWithdraw(true); }}>Отозвать отклик</button>
        ) : null}
      </footer>
    </section>
  );
}

export function TaskCatalogV2(props: { onOpenWorkspace: (assignmentId: string) => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo<CatalogFilters>(() => ({
    q: searchParams.get("q")?.trim() ?? "",
    difficulty: searchParams.get("difficulty") ?? "",
    workFormat: searchParams.get("work_format") ?? "",
    customer: searchParams.get("customer") ?? "",
    direction: searchParams.get("direction") ?? "",
    competency: searchParams.get("competency") ?? "",
    timeframe: searchParams.get("timeframe") ?? "",
    saved: searchParams.get("saved") === "true",
    sort: sortValue(searchParams.get("sort")),
  }), [searchParams]);
  const layout: CatalogLayout = searchParams.get("catalog_view") === "list" ? "list" : "cards";
  const selectedTaskId = searchParams.get("task");
  const [searchInput, setSearchInput] = useState(filters.q);
  const [conditionsTask, setConditionsTask] = useState<CatalogItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const client = useQueryClient();
  const catalog = useInfiniteQuery({
    queryKey: catalogQueryKey(filters),
    queryFn: ({ pageParam }) => loadCatalogPage(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    placeholderData: keepPreviousData,
  });
  const items = useMemo(() => {
    const byId = new Map<string, CatalogItem>();
    for (const page of catalog.data?.pages ?? []) {
      for (const item of page.items) byId.set(item.task_id, item);
    }
    return Array.from(byId.values());
  }, [catalog.data]);
  const selectedFromCatalog = items.find((item) => item.task_id === selectedTaskId);
  const detail = useQuery({
    queryKey: [
      "task-catalog-v2-detail",
      selectedTaskId,
      selectedFromCatalog?.snapshot_version ?? "unlisted",
    ],
    queryFn: () => loadCatalogDetail(selectedTaskId as string),
    enabled: selectedTaskId !== null,
    staleTime: 30_000,
    gcTime: 300_000,
  });
  const selected = selectedFromCatalog ?? detail.data;
  const totals = catalog.data?.pages[0];

  useEffect(() => {
    setSearchInput(filters.q);
  }, [filters.q]);

  const updateParams = (patch: Record<string, string | null>, clearSelection = false) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    if (clearSelection) next.delete("task");
    setSearchParams(next);
  };
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["task-catalog-v2"] });
    await client.invalidateQueries({ queryKey: ["task-catalog-v2-detail"] });
  };
  const bookmark = useMutation({
    mutationFn: ({ taskId, saved }: { taskId: string; saved: boolean }) => setCatalogBookmark(taskId, saved),
    onSuccess: async (_data, variables) => {
      setNotice(variables.saved ? "Задача сохранена." : "Задача удалена из сохранённых.");
      await refresh();
    },
    onError: (error: unknown) => { setNotice(catalogErrorMessage(error)); },
  });
  const withdraw = useMutation({
    mutationFn: withdrawCatalogApplication,
    onSuccess: async () => {
      setNotice("Отклик отозван. Назначение и прошлые результаты не изменены.");
      await refresh();
    },
    onError: (error: unknown) => { setNotice(catalogErrorMessage(error)); },
  });
  const shareTask = async (item: CatalogItem) => {
    const url = new URL(window.location.pathname, window.location.origin);
    url.searchParams.set("task", item.task_id);
    try {
      await navigator.clipboard.writeText(url.toString());
      setNotice("Ссылка на задачу скопирована. Доступ по-прежнему проверяется сервером.");
    } catch {
      setNotice(`Не удалось скопировать автоматически. Ссылка: ${url.toString()}`);
    }
  };

  const analyticsItem = items[0];
  useEffect(() => {
    if (totals === undefined) return;
    const snapshotVersion = analyticsItem?.snapshot_version ?? null;
    trackCatalogEvent({
      eventName: "catalog_view",
      view: layout,
      algorithmVersion: analyticsItem?.match.algorithm_version ?? null,
      snapshotVersion,
      dedupeKey: `catalog-view:${layout}:${snapshotVersion ?? totals.snapshot_at ?? "empty"}`,
    });
  }, [analyticsItem?.match.algorithm_version, analyticsItem?.snapshot_version, layout, totals]);

  const openTask = (item: CatalogItem) => {
    trackCatalogEvent({ eventName: "task_select", task: item });
    const next = new URLSearchParams(searchParams);
    next.set("task", item.task_id);
    setSearchParams(next);
  };
  const openConditions = (item: CatalogItem) => {
    trackCatalogEvent({ eventName: "conditions_open", task: item });
    setConditionsTask(item);
  };
  const changeLayout = (nextLayout: CatalogLayout) => {
    if (nextLayout === layout) return;
    trackCatalogEvent({
      eventName: "view_change",
      view: nextLayout,
      algorithmVersion: analyticsItem?.match.algorithm_version ?? null,
      snapshotVersion: analyticsItem?.snapshot_version ?? null,
    });
    updateParams({ catalog_view: nextLayout });
  };

  const activeFilterChips = [
    filters.q ? { key: "q", label: `Поиск: ${filters.q}` } : null,
    filters.competency ? { key: "competency", label: `Навык: ${filters.competency}` } : null,
    filters.direction ? { key: "direction", label: `Направление: ${filters.direction}` } : null,
    filters.customer ? { key: "customer", label: `Заказчик: ${filters.customer}` } : null,
    filters.difficulty ? { key: "difficulty", label: `Сложность: ${difficultyLabels[filters.difficulty] ?? filters.difficulty}` } : null,
    filters.workFormat ? { key: "work_format", label: `Формат: ${formatLabels[filters.workFormat] ?? filters.workFormat}` } : null,
    filters.timeframe ? { key: "timeframe", label: `Срок: ${filters.timeframe}` } : null,
    filters.saved ? { key: "saved", label: "Только сохранённые" } : null,
    filters.sort !== "match-default" ? { key: "sort", label: `Сортировка: ${filters.sort}` } : null,
  ].filter((chip): chip is { key: string; label: string } => chip !== null);

  if (catalog.isPending) {
    return <div className="catalog-v2"><StatePanel kind="loading" /></div>;
  }
  if (catalog.isError && catalog.data === undefined) {
    return <div className="catalog-v2"><StatePanel kind={isOfflineError(catalog.error) ? "offline" : "error"} action="Повторить" onAction={() => { void catalog.refetch(); }} /></div>;
  }
  return (
    <div className="catalog-v2" data-reference="R-PAR-03">
      <header className="catalog-v2-heading">
        <div>
          <p className="eyebrow">Каталог задач · актуальные условия</p>
          <h1 id="workspace-title">Задачи для вашего следующего результата</h1>
          <p>Релевантность объясняет соответствие траектории и требованиям. Она не обещает отбор, оффер или найм.</p>
        </div>
        <div className="catalog-v2-totals" aria-live="polite">
          <span title="Количество задач в текущей серверной выборке"><strong>{totals?.total_found ?? 0}</strong><small>найдено по фильтрам</small></span>
          <span title="Количество задач, для которых доступен отклик"><strong>{totals?.total_available ?? 0}</strong><small>доступно для отклика · из {totals?.total_found ?? 0}</small></span>
          <span title="Сохранённые задачи в том же авторитетном снимке"><strong>{totals?.total_saved ?? 0}</strong><small>сохранено · из {totals?.total_found ?? 0}</small></span>
          <span title="Задачи с рассчитанным match; insufficient_data не считается нулём"><strong>{totals?.total_calculated ?? 0}</strong><small>с числовым match · из {totals?.total_found ?? 0}</small></span>
          <small className="catalog-v2-snapshot">
            Снимок: {totals?.snapshot_at ? formatDeadline(totals.snapshot_at) : "время не указано"} · Период: {filters.timeframe ? timeframeLabels[filters.timeframe] ?? filters.timeframe : "без ограничения"}
          </small>
        </div>
      </header>
      <form
        className="catalog-v2-filters"
        aria-label="Фильтры каталога"
        onSubmit={(event) => {
          event.preventDefault();
          updateParams({ q: searchInput.trim() }, true);
        }}
      >
        <label>Поиск<input value={searchInput} onChange={(event) => { setSearchInput(event.target.value); }} placeholder="Название, результат или компетенция" /></label>
        <label>Навык<input value={filters.competency} onChange={(event) => { updateParams({ competency: event.target.value }, true); }} placeholder="Например, python" /></label>
        <label>Направление<input value={filters.direction} onChange={(event) => { updateParams({ direction: event.target.value }, true); }} placeholder="Ключ траектории" /></label>
        <label>Заказчик<input value={filters.customer} onChange={(event) => { updateParams({ customer: event.target.value }, true); }} placeholder="Название заказчика" /></label>
        <label>Сложность<select value={filters.difficulty} onChange={(event) => { updateParams({ difficulty: event.target.value }, true); }}><option value="">Любая</option><option value="beginner">Начальная</option><option value="intermediate">Средняя</option><option value="advanced">Продвинутая</option></select></label>
        <label>Формат<select value={filters.workFormat} onChange={(event) => { updateParams({ work_format: event.target.value }, true); }}><option value="">Любой</option><option value="remote">Удалённо</option><option value="hybrid">Гибрид</option><option value="onsite">На площадке</option></select></label>
        <label>Срок<select value={filters.timeframe} onChange={(event) => { updateParams({ timeframe: event.target.value }, true); }}><option value="">Любой</option><option value="7d">Ближайшие 7 дней</option><option value="30d">Ближайшие 30 дней</option><option value="90d">Ближайшие 90 дней</option></select></label>
        <label>Сортировка<select value={filters.sort} onChange={(event) => { updateParams({ sort: event.target.value }, true); }}><option value="match-default">По релевантности</option><option value="deadline">По сроку</option><option value="duration">По длительности</option><option value="newest">Сначала новые</option><option value="skill-growth">По соответствию росту</option></select></label>
        <label className="catalog-v2-saved-filter"><input type="checkbox" checked={filters.saved} onChange={(event) => { updateParams({ saved: event.target.checked ? "true" : null }, true); }} />Только сохранённые</label>
        <button type="submit">Найти</button>
        <button type="button" onClick={() => { updateParams({ q: null, difficulty: null, work_format: null, customer: null, direction: null, competency: null, timeframe: null, saved: null, sort: null }, true); }}>Сбросить</button>
        <div className="catalog-v2-layout" role="group" aria-label="Вид каталога">
          <button type="button" aria-pressed={layout === "cards"} onClick={() => { changeLayout("cards"); }}>Карточки</button>
          <button type="button" aria-pressed={layout === "list"} onClick={() => { changeLayout("list"); }}>Список</button>
        </div>
      </form>
      {activeFilterChips.length > 0 ? (
        <div className="catalog-v2-chips" aria-label="Активные фильтры">
          {activeFilterChips.map((chip) => (
            <button
              type="button"
              key={chip.key}
              aria-label={`Сбросить фильтр ${chip.label}`}
              onClick={() => { updateParams({ [chip.key]: null }, true); }}
            >
              {chip.label} ×
            </button>
          ))}
          <button type="button" onClick={() => { updateParams({ q: null, difficulty: null, work_format: null, customer: null, direction: null, competency: null, timeframe: null, saved: null, sort: null }, true); }}>Очистить всё</button>
        </div>
      ) : null}
      {catalog.isError ? <StatePanel kind="stale" action="Повторить" onAction={() => { void catalog.refetch(); }} /> : null}
      {notice !== null ? <p className="catalog-v2-notice" role="status">{notice}<button type="button" aria-label="Закрыть уведомление" onClick={() => { setNotice(null); }}>×</button></p> : null}
      {catalog.isRefetching ? <p className="catalog-v2-refresh" role="status">Обновляем авторитетный снимок…</p> : null}
      {items.length === 0 ? (
        <section className="catalog-v2-empty">
          <h2>Подходящих задач не найдено</h2>
          <p>{filters.saved ? "Сохранённых задач с такими фильтрами нет." : "Измените фильтры или проверьте каталог позже. Мы не подставляем демонстрационные задачи в пустой ответ."}</p>
          <button type="button" onClick={() => { updateParams({ q: null, difficulty: null, work_format: null, direction: null, competency: null, timeframe: null, saved: null }, true); }}>Сбросить фильтры</button>
        </section>
      ) : (
        layout === "list" ? (
          <TaskCatalogList
            items={items}
            selectedTaskId={selectedTaskId}
            bookmarkPendingId={bookmark.isPending ? bookmark.variables.taskId : null}
            onOpen={openTask}
            onConditions={openConditions}
            onBookmark={(item) => { bookmark.mutate({ taskId: item.task_id, saved: !item.bookmarked }); }}
            onShare={(item) => { void shareTask(item); }}
            matchBadge={(item) => <MatchBadge item={item} />}
            formatDuration={formatDuration}
            formatDeadline={formatDeadline}
            difficultyLabel={(value) => value === null ? "Не указана" : difficultyLabels[value] ?? value}
            formatLabel={(value) => value === null ? "Не указан" : formatLabels[value] ?? value}
            applicationLabel={(item) => applicationLabels[item.application_state]}
            customerLabel={customerLabel}
          />
        ) : (
          <div className="catalog-v2-results catalog-v2-results--cards" role="list" aria-label="Рекомендованные задачи">
            {items.map((item) => (
              <div role="listitem" key={item.task_id}>
                <TaskSummary
                  item={item}
                  layout="cards"
                  selected={selectedTaskId === item.task_id}
                  bookmarkPending={bookmark.isPending && bookmark.variables.taskId === item.task_id}
                  onOpen={() => { openTask(item); }}
                  onConditions={() => { openConditions(item); }}
                  onBookmark={() => { bookmark.mutate({ taskId: item.task_id, saved: !item.bookmarked }); }}
                  onShare={() => { void shareTask(item); }}
                />
              </div>
            ))}
          </div>
        )
      )}
      {catalog.hasNextPage ? <button type="button" className="catalog-v2-more" disabled={catalog.isFetchingNextPage} onClick={() => { void catalog.fetchNextPage(); }}>{catalog.isFetchingNextPage ? "Загружаем…" : "Показать ещё"}</button> : null}
      {selectedTaskId !== null && detail.isPending && selected === undefined ? <StatePanel kind="loading" /> : null}
      {selectedTaskId !== null && detail.isError && selected === undefined ? <StatePanel kind={isOfflineError(detail.error) ? "offline" : "restricted"} action="Закрыть" onAction={() => { updateParams({ task: null }); }} /> : null}
      {selected !== undefined ? (
        <TaskDetail
          key={selected.task_id}
          item={selected}
          withdrawPending={withdraw.isPending}
          onClose={() => { updateParams({ task: null }); }}
          onConditions={() => { openConditions(selected); }}
          onWorkspace={props.onOpenWorkspace}
          onWithdraw={(applicationId) => { withdraw.mutate(applicationId); }}
          onGrowthExpand={() => { trackCatalogEvent({ eventName: "growth_expand", task: selected }); }}
        />
      ) : null}
      {conditionsTask !== null ? (
        <ConditionsDialog
          key={conditionsTask.task_id}
          task={conditionsTask}
          onClose={() => { setConditionsTask(null); }}
          onApplicationResult={(result) => {
            trackCatalogEvent({ eventName: "application_result", task: conditionsTask, result });
          }}
          onApplied={() => {
            setConditionsTask(null);
            setNotice("Отклик отправлен заказчику. Это ещё не назначение на задачу.");
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
}
