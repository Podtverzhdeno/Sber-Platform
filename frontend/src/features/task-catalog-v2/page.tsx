import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Award, Bookmark, ChartNoAxesColumnIncreasing, ChevronDown, ClipboardList, Clock3, Info, Laptop2, LayoutGrid, List, Search, Share2, SlidersHorizontal, Sparkles, Users } from "lucide-react";

import { ApiClientError } from "../../api/client";
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
import { CustomerMark } from "./customer-mark";
import { BenefitMark } from "./benefit-mark";
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
const supportLabels: Record<string, string> = {
  mentor_review: "Проверка результата ментором",
  mentor: "Поддержка ментора",
  team_review: "Проверка результата командой",
  self_service: "Самостоятельная работа",
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

function MatchBadge({ item, showRing = false, ringOnly = false }: { item: CatalogItem; showRing?: boolean; ringOnly?: boolean }) {
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
    <span className={`catalog-v2-match-visual${ringOnly ? " catalog-v2-match-visual--ring-only" : ""}`}>
      <span className="catalog-v2-match-ring">
        <svg viewBox="0 0 44 44" aria-hidden="true" focusable="false">
          <circle className="catalog-v2-match-ring-track" cx="22" cy="22" r="18" pathLength="100" />
          <circle className="catalog-v2-match-ring-value" cx="22" cy="22" r="18" pathLength="100" strokeDasharray={`${String(ringPercent)} 100`} />
        </svg>
        <strong aria-hidden="true">{percent}%</strong>
      </span>
      {badge}
    </span>
  );
}

function TaskSummary(props: {
  item: CatalogItem;
  layout: CatalogLayout;
  selected: boolean;
  topRanked?: boolean;
  bookmarkPending: boolean;
  onOpen: () => void;
  onConditions: () => void;
  onBookmark: () => void;
  onShare: () => void;
}) {
  const { item } = props;
  const canApply = item.allowed_actions.includes("apply") && item.eligibility.status === "eligible";
  const canSeeConditions = item.allowed_actions.includes("open_conditions") || canApply;
  return (
    <article
      className="catalog-v2-card catalog-v2-card--cards"
      tabIndex={0}
      aria-label={"Задача: " + item.title}
      data-selected={props.selected}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("button")) return;
        props.onOpen();
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); props.onOpen(); }
      }}
    >
      <header className="catalog-v2-card-top">
        <span className="catalog-v2-customer-avatar" aria-hidden="true"><CustomerMark customer={item.customer} size={21} /></span>
        <div className="catalog-v2-card-identity">
          {props.topRanked ? <span className="catalog-v2-top-match"><Sparkles size={12} aria-hidden="true" /> Топ-совпадение</span> : null}
          <small title={customerLabel(item)}>{customerLabel(item)}</small>
          <h2>{item.title}</h2>
        </div>
        <div className="catalog-v2-card-match"><MatchBadge item={item} /></div>
        <button type="button" className="catalog-v2-card-bookmark" disabled={props.bookmarkPending}
          aria-label={item.bookmarked ? "Сохранено" : "Сохранить"}
          aria-pressed={item.bookmarked} onClick={props.onBookmark}>
          <Bookmark size={19} fill={item.bookmarked ? "currentColor" : "none"} aria-hidden="true" />
        </button>
      </header>
      <ul className="catalog-v2-tags" aria-label="Компетенции">
        {item.competency_tags.slice(0, 3).map((tag) => <li key={tag}>{tag}</li>)}
      </ul>
      <dl className="catalog-v2-card-quickfacts">
        <div><dt><ChartNoAxesColumnIncreasing size={15} aria-hidden="true" /> Сложность</dt><dd>{item.difficulty === null ? "Не указана" : difficultyLabels[item.difficulty] ?? item.difficulty}</dd></div>
        <div><dt><Clock3 size={15} aria-hidden="true" /> Срок</dt><dd>{formatDuration(item.duration_minutes)}</dd></div>
        <div><dt><Laptop2 size={15} aria-hidden="true" /> Формат</dt><dd>{item.work_format === null ? "Не указан" : formatLabels[item.work_format] ?? item.work_format}</dd></div>
      </dl>
      {item.application_state !== "none" ? <p className="catalog-v2-card-status">{applicationLabels[item.application_state]}</p> : null}
      {item.eligibility.missing_prerequisites.length > 0 ? (
        <p className="catalog-v2-eligibility">Нужны подтверждения: {item.eligibility.missing_prerequisites.join(", ")}</p>
      ) : null}
      <footer className="catalog-v2-card-actions">
        <button type="button" onClick={props.onOpen}>Подробнее <ChevronDown size={14} aria-hidden="true" /></button>
        {canSeeConditions ? <button type="button" className="catalog-v2-primary" disabled={!canApply}
          onClick={(event) => { event.currentTarget.focus(); props.onConditions(); }}>Условия и отклик</button> : null}
        {item.allowed_actions.includes("share") ? <button type="button" aria-label="Поделиться"
          className="catalog-v2-card-share" onClick={props.onShare}><Share2 size={16} aria-hidden="true" /></button> : null}
      </footer>
    </article>
  );
}

function skillPercent(level: string | null): number | null {
  if (level === null || !/^\d+(?:[.,]\d+)?%$/.test(level.trim())) return null;
  const value = Number(level.replace("%", "").replace(",", "."));
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
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
  const canSeeConditions = item.allowed_actions.includes("open_conditions") || canApply;
  const shownBenefits = item.benefits.filter((benefit) => benefit.state !== "unavailable");
  return (
    <section className="catalog-v2-detail" aria-labelledby="catalog-detail-title">
      <header className="catalog-v2-detail-header">
        <span className="catalog-v2-detail-avatar" aria-hidden="true"><CustomerMark customer={item.customer} size={25} /></span>
        <div className="catalog-v2-detail-identity">
          <p className="catalog-v2-detail-customer">
            {item.customer.display_name}
            <span className="catalog-v2-customer-verified">{customerVerificationLabels[item.customer.verification]}</span>
          </p>
          <h2 id="catalog-detail-title">{item.title}</h2>
          <p className="catalog-v2-detail-description">{item.brief_summary}</p>
          <ul className="catalog-v2-tags" aria-label="Компетенции">
            {item.competency_tags.map((tag) => <li key={tag}>{tag}</li>)}
          </ul>
        </div>
        <div className="catalog-v2-detail-score"><MatchBadge item={item} showRing /><small>Соответствие твоей траектории</small></div>
        <button type="button" className="catalog-v2-detail-close" aria-label="Закрыть детали" onClick={props.onClose}>×</button>
      </header>

      <dl className="catalog-v2-detail-factrail">
        <div><dt><ChartNoAxesColumnIncreasing size={23} aria-hidden="true" /> Уровень</dt><dd>{item.difficulty === null ? "Не указана" : difficultyLabels[item.difficulty] ?? item.difficulty}</dd></div>
        <div><dt><Clock3 size={23} aria-hidden="true" /> Срок</dt><dd>{formatDuration(item.duration_minutes)}</dd></div>
        <div><dt><Laptop2 size={23} aria-hidden="true" /> Формат</dt><dd>{item.work_format === null ? "Не указан" : formatLabels[item.work_format] ?? item.work_format}</dd></div>
        <div><dt><Users size={23} aria-hidden="true" /> Команда</dt><dd>{item.places_available ?? "—"} свободных из {item.places_total}</dd></div>
      </dl>

      <div className="catalog-v2-detail-grid">
        <section className="catalog-v2-growth-section">
          <div className="catalog-v2-section-heading">
            <h3>Развитие твоих навыков</h3>
            <button type="button" aria-expanded={growthExpanded} onClick={() => {
              if (!growthExpanded) props.onGrowthExpand();
              setGrowthExpanded((value) => !value);
            }}>{growthExpanded ? "Скрыть сравнение уровней" : "Показать сравнение уровней"}</button>
          </div>
          {growthExpanded ? item.skill_impact.length > 0 ? (
            <div className="catalog-v2-growth-table">
              <div className="catalog-v2-growth-head"><span>Навык</span><span>Сейчас</span><span>Прогноз после проверки</span><span>Прирост</span></div>
              <ul className="catalog-v2-growth-list" aria-label="Сравнение текущего и потенциального уровня">
                {item.skill_impact.map((impact) => {
                  const current = skillPercent(impact.current_level);
                  const projected = impact.status === "calculated" ? skillPercent(impact.projected_level) : null;
                  const delta = current !== null && projected !== null ? projected - current : null;
                  return (
                    <li key={impact.skill_id}>
                      <strong>{impact.title}</strong>
                      <div className="catalog-v2-skill-transition">
                        <span><small>Текущий уровень</small><b>{impact.current_level ?? "Нет подтверждённого уровня"}</b>{current !== null ? <span className="catalog-v2-skill-bar"><i style={{ width: String(current) + "%" }} /></span> : null}</span>
                        <span className="catalog-v2-skill-arrow" aria-hidden="true">→</span>
                        <span><small>После задачи · прогноз</small><b>{impact.projected_level ?? "Без числового прогноза"}</b>{projected !== null ? <span className="catalog-v2-skill-bar catalog-v2-skill-bar--forecast"><i style={{ width: String(projected) + "%" }} /></span> : null}</span>
                      </div>
                      <span className="catalog-v2-growth-delta">{delta === null ? "Не рассчитан" : (delta > 0 ? "+" : "") + String(delta) + "%"}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="catalog-v2-growth-caveat">Прогноз не подтверждает навык автоматически. Итоговый результат проверяется после выполнения задачи.</p>
              <details className="catalog-v2-growth-explanations">
                <summary>Пояснения к прогнозу навыков</summary>
                <ul>{item.skill_impact.map((impact) => (
                  <li key={impact.skill_id}>
                    <strong>{impact.title}</strong>
                    <p>{impact.explanation}</p>
                    <small>{impact.status === "calculated" ? "Потенциальный рост рассчитан; необходима верификация." : "Потенциальный рост пока не рассчитан."} {impact.verification_required ? "Навык не подтверждается автоматически." : "Статус проверки не указан."}</small>
                  </li>
                ))}</ul>
              </details>
            </div>
          ) : <p>Компетенции для прогноза не опубликованы; числовой рост не рассчитывается.</p> : null}
        </section>

        <section className="catalog-v2-benefits-section">
          <h3>Что ты получишь</h3>
          {shownBenefits.length > 0 ? (
            <ul>{shownBenefits.map((benefit) => (
              <li key={benefit.code}><BenefitMark type={benefit.benefit_type} /><div><strong>{benefit.label}</strong><p>{benefit.condition}</p><small>{benefit.state === "potential" ? "При выполнении условия" : "Подтверждённое условие"}</small></div></li>
            ))}</ul>
          ) : <p>Дополнительные преимущества не опубликованы.</p>}
        </section>

        <section className="catalog-v2-stage-section">
          <div className="catalog-v2-section-heading"><h3>Этапы задачи</h3><span>План до начала работы</span></div>
          {item.stage_plan.stages.length > 0 ? (
            <>
              <ol className="catalog-v2-stage-track">{item.stage_plan.stages.map((stage, index) => (
                <li key={stage.key} data-state={stage.state}>
                  <span className="catalog-v2-stage-index" aria-hidden="true">{index + 1}</span>
                  <div className="catalog-v2-stage-content">
                    <strong>{stage.title}</strong>
                    <p>{stage.summary}</p>
                    <small><span className="catalog-v2-stage-state">{stage.state === "locked" ? "Пока недоступен" : "Запланировано"} · {formatDuration(stage.estimated_minutes)}</span><span className="catalog-v2-stage-duration" aria-hidden="true">{formatDuration(stage.estimated_minutes)}</span></small>
                  </div>
                </li>
              ))}</ol>
              <p className="catalog-v2-plan-note">Это план, а не прогресс. Выполнение этапов будет учитываться только после назначения на задачу.</p>
            </>
          ) : <p>Заказчик не опубликовал ориентировочный план. Прогресс появляется только после назначения.</p>}
        </section>

      </div>
      <footer className="catalog-v2-detail-footer">
        <section className="catalog-v2-support-section">
          <Users size={24} aria-hidden="true" />
          <div><strong>Поддержка и ментор</strong><p>{item.support_model === "none" || item.support_model === "self_service" ? "Сопровождение не предусмотрено" : item.support_model && item.support_model !== "not_provided" ? supportLabels[item.support_model] ?? item.support_model : "Ментор и формат поддержки пока не опубликованы"}</p></div>
        </section>
        <div className="catalog-v2-detail-footer-controls">
        <small>Условия v{item.terms_version} · Отклик не означает назначение</small>
        <div className="catalog-v2-detail-actions">
          {canSeeConditions ? <button type="button" onClick={props.onConditions}>Посмотреть условия</button> : null}
          {canApply ? <button type="button" className="catalog-v2-primary" aria-label="Посмотреть условия и откликнуться" onClick={(event) => { event.currentTarget.focus(); props.onConditions(); }}>Откликнуться</button> : null}
          {item.assignment_id !== null && item.allowed_actions.includes("open_workspace") ? (
            <button type="button" className="catalog-v2-primary" onClick={() => { props.onWorkspace(item.assignment_id as string); }}>Перейти в рабочую область</button>
          ) : null}
          {item.application_id !== null && item.allowed_actions.includes("withdraw") ? (
            confirmWithdraw ? (
              <span className="catalog-v2-withdraw-confirm" role="group" aria-label="Подтверждение отзыва">
                <span>Отозвать отправленный отклик?</span>
                <button type="button" disabled={props.withdrawPending} onClick={() => { props.onWithdraw(item.application_id as string); }}>Да, отозвать</button>
                <button type="button" disabled={props.withdrawPending} onClick={() => { setConfirmWithdraw(false); }}>Оставить</button>
              </span>
            ) : <button type="button" onClick={() => { setConfirmWithdraw(true); }}>Отозвать отклик</button>
          ) : null}
        </div>
        </div>
      </footer>
        <section className="catalog-v2-reasons-section">
          <details className="catalog-v2-reasons-disclosure">
            <summary><h3>Почему подходит</h3><ChevronDown size={15} aria-hidden="true" /></summary>
            {item.match.reasons.length > 0 ? (
              <ul>{item.match.reasons.map((reason) => <li key={reason.code}>{reason.label}</li>)}</ul>
            ) : <p>Причины появятся после накопления достаточного coverage.</p>}
            <details className="catalog-v2-provenance">
              <summary>Как рассчитана релевантность</summary>
              <p>Алгоритм: {item.match.algorithm_version ?? "не рассчитан"} · расчёт: {formatCalculatedAt(item.match.calculated_at)}. Это не вероятность отбора или найма.</p>
              <p className="catalog-v2-match-snapshot">Снимок входных данных: <code>{item.match.source_snapshot_version}</code></p>
            </details>
            {item.eligibility.missing_prerequisites.length > 0 ? <p>Нужны подтверждения: {item.eligibility.missing_prerequisites.join(", ")}</p> : null}
          </details>
        </section>
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
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const inspectorRef = useRef<HTMLElement>(null);
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
  // A read-only preview uses the first authorized catalog projection, without
  // creating a URL selection, requesting private detail or recording task progress.
  const previewItem = selectedTaskId === null && layout === "cards" && !previewDismissed
    ? items[0]
    : undefined;
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
  const detailAccessDenied =
    detail.error instanceof ApiClientError && [403, 404].includes(detail.error.status);
  // A denied refetch revokes the cached projection immediately; transient
  // offline/server failures may still render explicitly stale catalog data.
  const selected = detailAccessDenied ? undefined : (selectedFromCatalog ?? detail.data);
  const displayedDetail = selected ?? previewItem;
  const totals = catalog.data?.pages[0];
  const scoredItems = items.filter((item) => item.match.status === "calculated" && item.match.percent !== null);
  const averageMatch = scoredItems.length
    ? Math.round(scoredItems.reduce((sum, item) => sum + Number(item.match.percent), 0) / scoredItems.length)
    : null;
  const mentoredCount = items.filter((item) => item.support_model === "mentor" || item.support_model === "mentor_review" || item.support_model === "team_review").length;
  const portfolioCount = items.filter((item) => item.benefits.some((benefit) => benefit.state !== "unavailable" && (benefit.benefit_type.toLowerCase().includes("portfolio") || benefit.code.toLowerCase().includes("portfolio")))).length;

  useEffect(() => {
    setSearchInput(filters.q);
  }, [filters.q]);
  useEffect(() => {
    if (
      selectedTaskId === null ||
      catalog.isPending ||
      typeof window.matchMedia !== "function"
    ) return;
    const isStacked = window.matchMedia("(max-width: 1050px)").matches;
    if (!isStacked && layout !== "list") return;
    // On a stacked layout the inspector is below every card, so opening a card
    // must reveal its detail instead of leaving the participant above the fold.
    inspectorRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }, [selectedTaskId, catalog.isPending, layout]);

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
          <p className="eyebrow">ЗАДАЧИ</p>
          <h1 id="workspace-title">Задачи для твоего развития</h1>
          <p>Реальные задачи от команд и заказчиков под твою траекторию. Развивай навыки, получай опыт и собирай портфолио.</p>
        </div>
        <details className="catalog-v2-help">
          <summary><Info size={15} aria-hidden="true" /> Как это работает?</summary>
          <p>Выбери задачу, изучи план и условия, затем подтверди согласие перед откликом. Релевантность не означает вероятность отбора; навыки подтверждаются только после проверки результата.</p>
        </details>
      </header>
      <div className="catalog-v2-kpis" aria-label="Показатели каталога">
        <div className="catalog-v2-kpi">
          <span className="catalog-v2-kpi-icon"><ClipboardList size={23} aria-hidden="true" /></span>
          <div><strong>{totals?.total_available ?? 0}</strong><b>доступных задач</b><small>Для отклика · из {totals?.total_found ?? 0} найденных</small></div>
        </div>
        <div className="catalog-v2-kpi">
          <span className="catalog-v2-kpi-ring" aria-hidden="true">{averageMatch === null ? "—" : `${String(averageMatch)}%`}</span>
          <div><strong>{averageMatch === null ? "—" : `${String(averageMatch)}%`}</strong><b>среднее соответствие</b><small>По {scoredItems.length} из {items.length} загруженных</small></div>
        </div>
        <div className="catalog-v2-kpi">
          <span className="catalog-v2-kpi-icon catalog-v2-kpi-icon--blue"><Users size={23} aria-hidden="true" /></span>
          <div><strong>{mentoredCount}</strong><b>с поддержкой</b><small>Из {items.length} загруженных задач</small></div>
        </div>
        <div className="catalog-v2-kpi">
          <span className="catalog-v2-kpi-icon catalog-v2-kpi-icon--gold"><Award size={23} aria-hidden="true" /></span>
          <div><strong>{portfolioCount}</strong><b>с потенциалом портфолио</b><small>По опубликованным выгодам · из {items.length}</small></div>
        </div>
      </div>
      <form className="catalog-v2-filters" aria-label="Фильтры каталога"
        onSubmit={(event) => { event.preventDefault(); updateParams({ q: searchInput.trim() }, true); }}>
        <div className="catalog-v2-filter-rail">
          <button type="button" className="catalog-v2-all-tasks" onClick={() => {
            updateParams({ q: null, difficulty: null, work_format: null, customer: null, direction: null, competency: null, timeframe: null, saved: null, sort: null }, true);
          }}><SlidersHorizontal size={15} aria-hidden="true" /> Все задачи ({totals?.total_found ?? 0})</button>
          <div id="catalog-v2-advanced-filters" className="catalog-v2-advanced-filters" data-open={advancedFiltersOpen}>
            <label>Направление<input value={filters.direction} onChange={(event) => { updateParams({ direction: event.target.value }, true); }} placeholder="Направление" /></label>
            <label>Навык<input value={filters.competency} onChange={(event) => { updateParams({ competency: event.target.value }, true); }} placeholder="Навыки" /></label>
            <label>Сложность<select value={filters.difficulty} onChange={(event) => { updateParams({ difficulty: event.target.value }, true); }}><option value="">Сложность</option><option value="beginner">Начальная</option><option value="intermediate">Средняя</option><option value="advanced">Продвинутая</option></select></label>
            <label>Заказчик<input value={filters.customer} onChange={(event) => { updateParams({ customer: event.target.value }, true); }} placeholder="Компании" /></label>
            <label>Формат<select value={filters.workFormat} onChange={(event) => { updateParams({ work_format: event.target.value }, true); }}><option value="">Формат</option><option value="remote">Удалённо</option><option value="hybrid">Гибрид</option><option value="onsite">На площадке</option></select></label>
            <label>Срок<select value={filters.timeframe} onChange={(event) => { updateParams({ timeframe: event.target.value }, true); }}><option value="">Сроки</option><option value="7d">Ближайшие 7 дней</option><option value="30d">Ближайшие 30 дней</option><option value="90d">Ближайшие 90 дней</option></select></label>
            <label>Сортировка<select value={filters.sort} onChange={(event) => { updateParams({ sort: event.target.value }, true); }}><option value="match-default">По соответствию</option><option value="deadline">По сроку</option><option value="duration">По длительности</option><option value="newest">Сначала новые</option><option value="skill-growth">По соответствию росту</option></select></label>
          </div>
          <div className="catalog-v2-layout" role="group" aria-label="Вид каталога">
            <button type="button" aria-pressed={layout === "cards"} onClick={() => { changeLayout("cards"); }}><LayoutGrid size={15} aria-hidden="true" /> Карточки</button>
            <button type="button" aria-pressed={layout === "list"} onClick={() => { changeLayout("list"); }}><List size={15} aria-hidden="true" /> Список</button>
          </div>
          <button type="button" className="catalog-v2-filter-expander" aria-expanded={advancedFiltersOpen}
            aria-controls="catalog-v2-advanced-filters catalog-v2-secondary-filters"
            onClick={() => { setAdvancedFiltersOpen((value) => !value); }}>
            <Search size={15} aria-hidden="true" /> {advancedFiltersOpen ? "Скрыть фильтры" : "Все фильтры"}
          </button>
        </div>
        <div id="catalog-v2-secondary-filters" className="catalog-v2-secondary-filters" data-open={advancedFiltersOpen}>
          <label className="catalog-v2-search-field">Поиск<input value={searchInput}
            onChange={(event) => { setSearchInput(event.target.value); }}
            placeholder="Название задачи, результат или навык" /></label>
          <button type="submit" className="catalog-v2-primary catalog-v2-find">Найти</button>
          <label className="catalog-v2-saved-filter"><input type="checkbox" checked={filters.saved} onChange={(event) => {
            updateParams({ saved: event.target.checked ? "true" : null }, true);
          }} />Только сохранённые</label>
          <button type="button" className="catalog-v2-reset" onClick={() => {
            updateParams({ q: null, difficulty: null, work_format: null, customer: null, direction: null, competency: null, timeframe: null, saved: null, sort: null }, true);
          }}>Сбросить фильтры</button>
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
      <div className="catalog-v2-workspace" data-layout={layout} data-has-selection={selectedTaskId !== null}>
        <div className="catalog-v2-discovery">
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
            matchBadge={(item) => <MatchBadge item={item} showRing ringOnly />}
            formatDuration={formatDuration}
            formatDeadline={formatDeadline}
            difficultyLabel={(value) => value === null ? "Не указана" : difficultyLabels[value] ?? value}
            formatLabel={(value) => value === null ? "Не указан" : formatLabels[value] ?? value}
            applicationLabel={(item) => applicationLabels[item.application_state]}
            customerLabel={customerLabel}
          />
        ) : (
          <div className="catalog-v2-results catalog-v2-results--cards" role="list" aria-label="Рекомендованные задачи">
            {items.map((item, index) => (
              <div role="listitem" key={item.task_id}>
                <TaskSummary
                  item={item}
                  layout="cards"
                  topRanked={index === 0 && filters.sort === "match-default" && item.match.status === "calculated"}
                  selected={selectedTaskId === item.task_id || previewItem?.task_id === item.task_id}
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
        </div>
        <aside ref={inspectorRef} className="catalog-v2-inspector" aria-label={selectedTaskId === null && previewItem !== undefined ? "Предпросмотр рекомендованной задачи" : "Панель выбранной задачи"}>
      {selectedTaskId !== null && detail.isPending && selected === undefined ? <StatePanel kind="loading" /> : null}
      {selectedTaskId !== null && detail.isError && selected === undefined ? <StatePanel kind={isOfflineError(detail.error) ? "offline" : "restricted"} action="Закрыть" onAction={() => { updateParams({ task: null }); }} /> : null}
      {displayedDetail !== undefined ? (
        <TaskDetail
          key={displayedDetail.task_id}
          item={displayedDetail}
          withdrawPending={withdraw.isPending}
          onClose={() => { setPreviewDismissed(true); updateParams({ task: null }); }}
          onConditions={() => { openConditions(displayedDetail); }}
          onWorkspace={props.onOpenWorkspace}
          onWithdraw={(applicationId) => { withdraw.mutate(applicationId); }}
          onGrowthExpand={() => { trackCatalogEvent({ eventName: "growth_expand", task: displayedDetail }); }}
        />
      ) : selectedTaskId === null && items.length > 0 ? (
        <div className="catalog-v2-inspector-empty">
          <span className="catalog-v2-inspector-empty-mark" aria-hidden="true">↗</span>
          <h2>Выберите задачу</h2>
          <p>Посмотрите условия, требования и навыки, которые сможете развить после выполнения и проверки результата.</p>
          <p className="catalog-v2-inspector-empty-tip">Начните с подходящей карточки слева — отклик не будет отправлен без вашего согласия.</p>
        </div>
      ) : null}
        </aside>
      </div>
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
