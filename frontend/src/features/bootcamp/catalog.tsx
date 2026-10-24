import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { apiRequest, retrySafeRead, RuntimeApiPath } from "../../api/client";
import { Badge, Card, Drawer, SafeExternalLink, StatePanel } from "../../components/ui";
import "./bootcamp-ux.scss";
import "./bootcamp-approved.scss";

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
type CourseDetail = {
  course_key: string; title: string; source_url: string; availability: string;
  access_note: string; enrollment_status: string | null; verified: boolean;
  specialization: string | null; program_version: string | null;
  workload_hours: number | null; program_competencies: string[][];
  objective: string | null; milestone_title: string | null; next_step: string | null;
  artifact: string | null;
  cycle: { competency: string; current_level: string; projected_level: string; target_level: string; projected_confirmed: boolean; evidence: string }[];
};
type CourseCertificate = { certificate_id: string; verification_id: string; course_title: string };


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
  const target = mustTake.target_level;
  return (
    <p>
      Навык «{mustTake.skill}»: сейчас «{current}», {target ? <>целевой уровень «{target}»</> : "целевой уровень ещё не опубликован"}.
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
      {/* The verification status is displayed outside the collapsed explanation so it stays visible. */}
      {card.verified_evidence && (
        <small className="muted">Подтверждённое доказательство: {card.verified_evidence}</small>
      )}
      <p className="muted">{card.access_note}</p>
    </>
  );
}

function CatalogFilters({
  searchParams,
  updateFilter,
  trackOptions,
  relevantCount,
  totalCount,
  categoryCounts,
  resultCount,
  onReset,
}: {
  searchParams: URLSearchParams;
  updateFilter: (key: string, value: string) => void;
  trackOptions: string[];
  relevantCount: number;
  totalCount: number;
  categoryCounts: { key: string; label: string; count: number }[];
  resultCount: number;
  onReset: () => void;
}) {
  const relevanceFilter = searchParams.get("relevance") ?? "all";
  const trackFilter = searchParams.get("track") ?? "all";
  const view = searchParams.get("view") ?? "card";
  const category = searchParams.get("category") ?? "role";
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
      <div className="bc-category-row" role="group" aria-label="Категории курсов">
        {categoryCounts.map((item) => (
          <button key={item.key} type="button" aria-pressed={category === item.key} onClick={() => { updateFilter("category", item.key); }}>
            {item.label} <span>{item.count}</span>
          </button>
        ))}
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
      <label className="catalog-filter">Уровень
        <select disabled title="Уровни станут доступны после публикации справочника уровней курсов" aria-label="Уровень курса">
          <option>Все уровни</option>
        </select>
      </label>
      <button className="bc-reset" type="button" onClick={onReset}>Сбросить</button>
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
        Найдено: {resultCount} · актуальных {relevantCount} из {totalCount}
      </p>
    </div>
  );
}


type CatalogPanel = "detail" | "reason" | "requirements";

function CourseDetails({
  card, onReason, detail, loading, detailError, certificate, certificatesLoading,
  certificateError, issuing, issueError, onIssue,
}: {
  card: CourseCardState; onReason: () => void; detail: CourseDetail | null;
  loading: boolean; detailError: boolean; certificate: CourseCertificate | null;
  certificatesLoading: boolean; certificateError: boolean; issuing: boolean;
  issueError: boolean; onIssue: (key: string) => void;
}) {
  const [tab, setTab] = useState<"about" | "program" | "skills" | "reviews">("about");
  const tabs = [
    { key: "about", label: "О курсе" },
    { key: "program", label: "Программа" },
    { key: "skills", label: "Навыки" },
    { key: "reviews", label: "Отзывы" },
  ] as const;
  return <div className="bc-panel-content" data-reference="BC-R03">
    <div className="bc-panel-kicker">BOOTCAMP · КУРС</div>
    <h2 className="bc-detail-title">{detail?.title ?? card.title}</h2>
    <CardStates card={card} />
    <div className="bc-detail-tabs" role="tablist" aria-label="Информация о курсе">
      {tabs.map((item) => <button key={item.key} type="button" role="tab" aria-selected={tab === item.key}
        onClick={() => { setTab(item.key); }}>{item.label}</button>)}
    </div>
    <div role="tabpanel" className="bc-detail-tabpanel">
      {tab === "about" && <>
        <h3>Для чего нужен курс</h3>
        <p>{detail?.objective || card.recommendation_reason || "Описание цели пока не опубликовано."}</p>
        {detail?.milestone_title && <p>Этап траектории: {detail.milestone_title}</p>}
        {detail?.next_step && <p>Следующий шаг: {detail.next_step}</p>}
        {detail?.artifact && <p>Проверяемый результат: {detail.artifact}</p>}
        <h3>Результат и подтверждение</h3>
        {card.verified_evidence ? <p>Подтверждённый результат: {card.verified_evidence}</p> :
          <p>{card.pending_verification_note || "Освоение курса и подтверждение компетенции — разные этапы. Основание для подтверждения появится после проверки результата."}</p>}
        <p className="bc-muted">{card.access_note || accessLabels[card.access_state].label}</p>
      </>}
      {tab === "program" && <>
        <h3>Программа курса</h3>
        {loading ? <p role="status">Загружаем опубликованную программу курса…</p> :
          detail ? <>
            {detail.program_version && <p>Версия программы: {detail.program_version}</p>}
            {detail.workload_hours !== null && <p>Объём обучения: {detail.workload_hours} ч</p>}
            {detail.milestone_title && <p>Контрольный этап: {detail.milestone_title}</p>}
            {detail.next_step && <p>Следующий шаг: {detail.next_step}</p>}
            {detail.program_competencies.length > 0 && <ul>{detail.program_competencies.map((group, index) =>
              <li key={index}>{group.join(" · ")}</li>)}</ul>}
            {!detail.milestone_title && !detail.next_step && detail.program_competencies.length === 0 &&
              <p>Подробный состав модулей ещё не опубликован провайдером.</p>}
          </> : <p>{detailError ? "Подтверждённая программа временно недоступна: сведения не переданы источником обучения." : "Сведения не переданы источником обучения."}</p>}
        {card.access_state === "available" && <SafeExternalLink href={card.source_url}>Перейти к программе ↗</SafeExternalLink>}
      </>}
      {tab === "skills" && <>
        <h3>Развитие навыков</h3>
        {detail?.cycle.map((point) =>
          <div className="bc-impact" key={point.competency}>
            <strong>{point.competency}</strong>
            <p>Подтверждено: {point.current_level}; прогноз: {point.projected_level}; цель: {point.target_level}</p>
            <small>{point.projected_confirmed ? "Проверено по результату курса" : "Ожидает подтверждения"} · {point.evidence}</small>
          </div>)}
        {card.must_take ? <>
          <strong>{card.must_take.skill}</strong>
          <p>Текущий уровень: {card.must_take.current_level ?? "не подтверждён"}</p>
          <p>Цель: {card.must_take.target_level ?? "не опубликована"}</p>
          <p>Ожидаемое влияние: {card.must_take.projected_impact}</p>
          <small className="bc-muted">Прогноз не равен подтверждённому уровню Skill Passport.</small>
        </> : <p>Для курса пока нет опубликованной привязки к матрице компетенций.</p>}
      </>}
      {tab === "reviews" && <>
        <h3>Отзывы</h3>
        <p>Подтверждённых отзывов по этому курсу пока нет.</p>
      </>}
    </div>
    <section className="bc-certificate">
      <h3>Сертификат завершения курса</h3>
      {certificate ? <a href={`/verify/${encodeURIComponent(certificate.verification_id)}`}>Открыть выданный сертификат →</a> :
       card.completion_state === "verified" ? (
         certificatesLoading ? <p role="status">Проверяем наличие сертификата…</p> :
         certificateError ? <p role="alert">Не удалось проверить наличие сертификата. Повторите попытку позже.</p> :
         <button type="button" disabled={issuing} onClick={() => { onIssue(card.key); }}>
           {issuing ? "Выдаём сертификат…" : "Получить сертификат"}
         </button>
       ) : <p className="bc-muted">Сертификат можно запросить после подтверждённого завершения курса.</p>}
      {issueError && <p role="alert">Сертификат не выдан. Повторите запрос позже.</p>}
    </section>
    <div className="bc-panel-footer">
      <button type="button" className="secondary-button" onClick={onReason}>Почему рекомендован</button>
      {card.access_state === "available" && <SafeExternalLink href={card.source_url}>Открыть курс ↗</SafeExternalLink>}
      {card.access_state === "prerequisite_not_met" && <p className="bc-muted">Сначала выполните необходимые условия доступа.</p>}
    </div>
  </div>;
}

function RecommendationDetails({ card, track }: { card: CourseCardState; track: string }) {
  return <div className="bc-panel-content" data-reference="BC-R04">
    <p className="bc-panel-kicker">ПОЧЕМУ РЕКОМЕНДОВАН</p>
    <p className="bc-muted">Направление: {track === "all" ? "все активные" : track}</p>
    <h3>{card.title}</h3>
    <p>{card.recommendation_reason || "Персональная рекомендация для курса не опубликована."}</p>
    {card.relevance_reasons.length > 0 && <ul>{card.relevance_reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
    {card.must_take ? <section className="bc-impact">
      <span>Ожидаемое развитие навыка</span>
      <strong>{card.must_take.skill}</strong>
      <p>{card.must_take.current_level ?? "Уровень не определён"} → {card.must_take.target_level ?? "Цель не определена"}</p>
      <p>{card.must_take.explanation}</p>
      <p>{card.must_take.projected_impact}</p>
    </section> : <p className="bc-muted">Персональный пробел навыка для этого курса не установлен.</p>}
    <small className="bc-muted">Предполагаемый эффект не означает подтверждённого результата или смены грейда.</small>
  </div>;
}

function RequirementsDetails({ cards, onSelect }: { cards: CourseCardState[]; onSelect: (key: string) => void }) {
  const pending = cards.filter((card) => card.must_take && card.completion_state !== "verified");
  return <div className="bc-panel-content" data-reference="BC-R05">
    <p className="bc-panel-kicker">ОБЯЗАТЕЛЬНОЕ ОБУЧЕНИЕ</p>
    <p>Здесь показаны курсы, отмеченные как обязательные в текущем каталоге. Полный набор требований к грейду определяется отдельно опубликованной программой и проверкой практических результатов.</p>
    {pending.length === 0 ? <p className="bc-muted">Незавершённых обязательных курсов в текущем каталоге нет. Статус готовности к грейду здесь не рассчитан.</p> :
      <ol className="bc-requirements-list">{pending.map((card) =>
        <li key={card.key}><div><strong>{card.title}</strong><small>{completionLabels[card.completion_state]?.label ?? accessLabels[card.access_state].label}</small>
          <p>{card.must_take?.explanation}</p></div><button type="button" onClick={() => { onSelect(card.key); }}>Посмотреть →</button></li>,
      )}</ol>}
  </div>;
}

export function BootcampCatalog({
  honorBoardEnabled,
  honorBoardConsent,
}: {
  honorBoardEnabled: boolean;
  honorBoardConsent: boolean;
}) {
  const client = useQueryClient();
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
  const selectedCourseKey = searchParams.get("course");
  const activePanel = searchParams.get("panel") ?? "detail";
  const showDetail = selectedCourseKey !== null && activePanel === "detail";
  const detailQuery = useQuery({
    queryKey: ["course-detail", selectedCourseKey],
    queryFn: () => apiRequest<CourseDetail>(`/api/v1/me/courses/${encodeURIComponent(selectedCourseKey ?? "")}/detail`),
    enabled: showDetail,
    retry: retrySafeRead,
  });
  const certificatesQuery = useQuery({
    queryKey: ["certificates"],
    queryFn: () => apiRequest<CourseCertificate[]>("/api/v1/me/bootcamp/certificates"),
    enabled: showDetail,
    retry: retrySafeRead,
  });
  const issueCertificate = useMutation({
    mutationFn: (courseKey: string) =>
      apiRequest<CourseCertificate>(`/api/v1/me/bootcamp/certificates/${encodeURIComponent(courseKey)}`, {
        method: "POST", headers: csrfHeaders(),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["certificates"] });
      await client.invalidateQueries({ queryKey: ["bootcamp-catalog"] });
    },
  });

  function openPanel(panel: CatalogPanel, courseKey?: string) {
    const next = new URLSearchParams(searchParams);
    if (courseKey) next.set("course", courseKey);
    else next.delete("course");
    next.set("panel", panel);
    setSearchParams(next);
  }

  function closePanel() {
    const next = new URLSearchParams(searchParams);
    next.delete("course");
    next.delete("panel");
    setSearchParams(next);
  }

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete(key);
    else next.set(key, value);
    next.delete("course");
    next.delete("panel");
    setSearchParams(next);
  }

  function resetFilters() {
    const next = new URLSearchParams(searchParams);
    for (const key of ["relevance", "category", "q", "level", "course", "panel"]) next.delete(key);
    setSearchParams(next);
  }

  if (catalog.isLoading) return <StatePanel kind="loading" />;
  if (!catalog.data) {
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
  const category = searchParams.get("category") ?? "role";
  const query = (searchParams.get("q") ?? "").trim().toLocaleLowerCase("ru-RU");
  const trackOptions = [...new Set(catalog.data.flatMap((card) => card.track_keys))];
  const setTrack = (track: string) => { updateFilter("track", track); };
  const relevantCount = catalog.data.filter((card) => card.relevant).length;
  const forTrack = (card: CourseCardState) => trackFilter === "all" || card.track_keys.includes(trackFilter);
  const categoryCounts = [
    { key: "role", label: "Для моей роли", count: catalog.data.filter((card) => forTrack(card) && card.relevant).length },
    { key: "all", label: "Все курсы", count: catalog.data.filter(forTrack).length },
    { key: "required", label: "Обязательные", count: catalog.data.filter((card) => forTrack(card) && card.must_take !== null).length },
    { key: "progress", label: "В процессе", count: catalog.data.filter((card) => forTrack(card) && card.completion_state === "reported").length },
    { key: "completed", label: "Завершённые", count: catalog.data.filter((card) => forTrack(card) && card.completion_state === "verified").length },
  ];
  const pendingRequired = catalog.data.filter((card) => forTrack(card) && card.must_take && card.completion_state !== "verified");
  const nextCourse = catalog.data.find((card) => forTrack(card) && card.relevant && card.access_state === "available" && card.completion_state === "reported") ?? catalog.data.find((card) => forTrack(card) && card.relevant && card.access_state === "available" && card.completion_state === "not_started") ?? null;
  const selectedRoleTitle = trackOptions.find((key) => key === trackFilter) ?? (trackFilter === "all" ? "Все активные направления" : trackFilter);
  const visible = catalog.data
    .filter((card) => relevanceFilter !== "relevant" || card.relevant)
    .filter(forTrack)
    .filter((card) => category === "all" || (category === "role" && card.relevant) || (category === "required" && card.must_take !== null) || (category === "progress" && card.completion_state === "reported") || (category === "completed" && card.completion_state === "verified"))
    .filter((card) => !query || [card.title, card.recommendation_reason, card.must_take?.skill ?? ""].some((value) => value.toLocaleLowerCase("ru-RU").includes(query)));
  const relevanceOnly = relevanceFilter === "relevant";
  const deepLinkedKey = searchParams.get("course");
  const deepLinked =
    deepLinkedKey !== null ? (catalog.data.find((card) => card.key === deepLinkedKey) ?? null) : null;
  const passesFilters = (card: CourseCardState) => visible.includes(card);
  const orderedVisible = deepLinked && passesFilters(deepLinked) ? ([deepLinked, ...visible.filter((card) => card !== deepLinked)]) : visible;
  const deepLinkFilteredOut = deepLinked !== null && !passesFilters(deepLinked);
  const panel = searchParams.get("panel") ?? "detail";

  return (
    <div className="feature-stack bootcamp-experience bc-approved" data-reference="BC-R01">
      <header className="bootcamp-hero">
        <div>
          <p className="eyebrow">ВАША ТРАЕКТОРИЯ · ОБУЧЕНИЕ</p>
          <h1 id="workspace-title">Bootcamp</h1>
          <p className="lead">Обучение для твоей роли и реальных проектов</p>
        </div>
        <div className="bootcamp-hero-pulse" aria-label="Состояние обучения">
          <strong>{String(catalog.data.filter((card) => card.completion_state === "verified").length)}</strong>
          <span>подтверждённых курсов</span>
          <h2 className="bootcamp-streak-heading">{streak.data ? `Серия: ${String(streak.data.current_days)} дн.` : "Серия: данные недоступны"}</h2>
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
      {catalog.isError && <p className="notice" role="status">Показаны сохранённые данные каталога. Обновление временно недоступно. <button type="button" onClick={() => { void catalog.refetch(); }}>Повторить</button></p>}
      {streak.isError && <p className="notice" role="status">Серия обучения временно недоступна. Каталог продолжает работать.</p>}
      <div className="bc-role-switch-row" role="group" aria-label="Выбор профессиональной роли">
        {trackOptions.map((key) => <button key={key} type="button" aria-pressed={trackFilter === key || (trackFilter === "all" && key === trackOptions[0])} onClick={() => { setTrack(key); }}>{key}</button>)}
        {trackOptions.length === 0 && <span className="bc-muted">Активные траектории пока не найдены</span>}
      </div>
      <div className="bc-overview-grid">
        <section className="bc-continue ui-card" aria-labelledby="bc-continue-title">
          <p className="bc-panel-kicker">ПРОДОЛЖИТЬ ОБУЧЕНИЕ</p>
          <h2 id="bc-continue-title">{nextCourse?.completion_state === "reported" ? "Продолжить обучение" : nextCourse ? "Начните с подходящего курса" : "Выберите следующий шаг"}</h2>
          <p className="bc-overview-course">{nextCourse?.title ?? "Доступный курс пока не определён"}</p>
          <p className="bc-muted">Прогресс и контрольные точки появятся после подключения подтверждённого источника LMS</p>
          {nextCourse ? <button type="button" onClick={() => { openPanel("detail", nextCourse.key); }}>Перейти к курсу →</button> :
            <button type="button" className="secondary-button" onClick={() => { resetFilters(); document.getElementById("bc-catalog-title")?.scrollIntoView({ behavior: "smooth" }); }}>Смотреть каталог →</button>}
        </section>
        <section className="bc-role-card ui-card" aria-labelledby="bc-role-title">
          <p className="bc-panel-kicker">МОЯ РОЛЬ</p>
          <h2 id="bc-role-title">{selectedRoleTitle}</h2>
          <p className="bc-muted">Карьерный грейд: не определён — требуется опубликованная политика</p>
          <div className="bc-role-metrics">
            <div><strong>{catalog.data.filter(forTrack).length}</strong><span>курсов</span></div>
            <div><strong>{catalog.data.filter((card) => forTrack(card) && card.completion_state === "verified").length}</strong><span>подтверждено</span></div>
            <div><strong>{pendingRequired.length}</strong><span>ожидают прохождения</span></div>
          </div>
          <small className="bc-muted">Число курсов не является процентом готовности к грейду</small>
        </section>
      </div>
      <section className="bc-grade-banner" aria-labelledby="bc-grade-title">
        <div><p className="bc-panel-kicker">ДО СЛЕДУЮЩЕГО ГРЕЙДА</p>
          <h2 id="bc-grade-title">{pendingRequired.length > 0 ? `Осталось ${pendingRequired.length} обязательных курса` : "Требования к грейду"}</h2>
          <p>{pendingRequired.length > 0 ? "Просмотрите ещё не подтверждённые учебные требования. Дополнительно могут потребоваться практика и проверка результатов." : "Полный список требований и степень готовности появятся после публикации политики. Отсутствие курсов здесь не означает присвоение грейда."}</p>
        </div>
        <button type="button" onClick={() => { openPanel("requirements"); }}>Посмотреть курсы →</button>
      </section>
      <h2 className="bc-catalog-title" id="bc-catalog-title">Каталог курсов <span>{catalog.data.length}</span></h2>
      <CatalogFilters
        searchParams={searchParams}
        updateFilter={updateFilter}
        trackOptions={trackOptions}
        relevantCount={relevantCount}
        totalCount={catalog.data.length}
        resultCount={visible.length}
        categoryCounts={categoryCounts}
        onReset={resetFilters}
      />
      {view === "card" ? (
        <div className="course-grid">
          {orderedVisible.map((card) => (
            <article className="ui-card bootcamp-course-card" key={card.key} data-required={card.must_take !== null} data-access={card.access_state} data-testid={`course-${card.key}`}>
              <div className="bc-course-labels"><span>{card.must_take ? "НУЖНО ДЛЯ РОЛИ" : card.relevant ? "РЕКОМЕНДОВАН" : "ОБУЧЕНИЕ"}</span><span aria-hidden="true">{card.access_state === "available" ? "↗" : "🔒"}</span></div>
              <h2>{card.title}</h2>
              {deepLinkedKey === card.key && (
                <p className="notice" data-testid={`deeplink-${card.key}`}>
                  Курс открыт по прямой ссылке
                </p>
              )}
              <p className="bc-course-summary">{card.recommendation_reason || "Описание ещё не опубликовано"}</p>
              <CardStates card={card} />
              {card.pending_verification_note && <p className="notice" role="status">{card.pending_verification_note}</p>}
              <details className="bc-explain"><summary>{card.must_take ? "Навык и требования" : "Обоснование курса"}</summary><CardExplanation card={card} relevanceOnly={relevanceOnly} /></details>
              <div className="bc-open-actions"><button type="button" onClick={() => { openPanel("detail", card.key); }}>{card.access_state === "prerequisite_not_met" ? "Посмотреть условия →" : card.completion_state === "reported" ? "Продолжить →" : "Открыть курс →"}</button><button className="secondary-button" type="button" onClick={() => { openPanel("reason", card.key); }}>Почему рекомендован?</button></div>
            </article>
          ))}
        </div>
      ) : (
        <ul className="course-rows" aria-label="Каталог Bootcamp списком">
          {orderedVisible.map((card) => (
            <li className="course-row bootcamp-course-row" key={card.key} data-required={card.must_take !== null} data-access={card.access_state} data-testid={`course-${card.key}`}>
              <div className="bc-list-heading"><span className="bc-panel-kicker">{card.must_take ? "ОБЯЗАТЕЛЬНЫЙ" : card.relevant ? "ДЛЯ МОЕЙ РОЛИ" : "ОБУЧЕНИЕ"}</span><strong>{card.title}</strong><small>{card.recommendation_reason || "Описание не опубликовано"}</small></div>
              {deepLinkedKey === card.key && (
                <p className="notice" data-testid={`deeplink-${card.key}`}>
                  Курс открыт по прямой ссылке
                </p>
              )}
              <CardStates card={card} />
              {card.pending_verification_note && <p className="notice" role="status">{card.pending_verification_note}</p>}
              <details className="bc-explain"><summary>Основание рекомендации</summary><CardExplanation card={card} relevanceOnly={relevanceOnly} /></details>
              <div className="bc-open-actions"><button type="button" onClick={() => { openPanel("detail", card.key); }}>{card.access_state === "prerequisite_not_met" ? "Посмотреть условия →" : "Открыть курс →"}</button><button type="button" className="secondary-button" onClick={() => { openPanel("reason", card.key); }}>Почему рекомендован?</button></div>
            </li>
          ))}
        </ul>
      )}
      {visible.length === 0 && <div role="status" className="bc-no-results"><p>По выбранным условиям курсы не найдены.</p><button type="button" onClick={resetFilters}>Сбросить фильтры</button></div>}
      <Drawer key={`${panel}:${deepLinked?.key ?? ""}`} title={panel === "reason" ? "Почему рекомендован" : "Информация о курсе"} open={deepLinked !== null && panel !== "requirements"} onClose={closePanel}>
        {deepLinked && (panel === "reason" ? <RecommendationDetails card={deepLinked} track={selectedRoleTitle} /> :
          <CourseDetails key={deepLinked.key} card={deepLinked}
            detail={detailQuery.data ?? null} loading={detailQuery.isPending} detailError={detailQuery.isError}
            certificate={certificatesQuery.data?.find((item) => item.course_title === deepLinked.title) ?? null}
            certificatesLoading={certificatesQuery.isPending} certificateError={certificatesQuery.isError}
            issuing={issueCertificate.isPending} issueError={issueCertificate.isError}
            onIssue={(courseKey) => { issueCertificate.mutate(courseKey); }}
            onReason={() => { openPanel("reason", deepLinked.key); }} />)}
      </Drawer>
      <Drawer title="Требования к обучению" open={panel === "requirements"} onClose={closePanel}>
        <RequirementsDetails cards={catalog.data.filter(forTrack)} onSelect={(key) => { openPanel("detail", key); }} />
      </Drawer>
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
