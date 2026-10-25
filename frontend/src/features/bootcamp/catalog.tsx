import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight, Bot, Check, Clock3, FileText, GitBranch, GraduationCap, List, LockKeyhole, Search, Sparkles, ChartNoAxesCombined, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";

import { apiRequest, retrySafeRead, RuntimeApiPath } from "../../api/client";
import { Badge, Card, Drawer, SafeExternalLink, StatePanel } from "../../components/ui";
import { CourseLearningContent } from "./learning-content/CourseLearningContent";
import { ImmersiveCourseExperience } from "./learning-content/ImmersiveCourseExperience";
import { aiRoleTitle, bootcampRoleKeys, courseRoleTitles, isCourseInAiRole, orderRoleCourses } from "./trajectory-content";
import "./bootcamp-ux.scss";
import "./bootcamp-approved.scss";
import "./reference-fidelity.scss";

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

export function CardStates({ card }: { card: CourseCardState }) {
  const access = accessLabels[card.access_state];
  const completion = completionLabels[card.completion_state];
  return (
    <div className="course-meta">
      <Badge tone={access.tone}>{access.label}</Badge>
      {completion && <Badge tone={completion.tone}>{completion.label}</Badge>}
    </div>
  );
}

export function CardExplanation({
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

export function CardActions({ card }: { card: CourseCardState }) {
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

export function CatalogFilters({
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
  const trackFilter = searchParams.get("track") ?? (trackOptions[0] ?? "all");
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
  card, onReason, initialLearningView, detail, loading, detailError, certificate, certificatesLoading,
  certificateError, issuing, issueError, onIssue,
}: {
  card: CourseCardState; onReason: () => void; initialLearningView?: "overview" | "program"; detail: CourseDetail | null;
  loading: boolean; detailError: boolean; certificate: CourseCertificate | null;
  certificatesLoading: boolean; certificateError: boolean; issuing: boolean;
  issueError: boolean; onIssue: (key: string) => void;
}) {
  const [tab, setTab] = useState<"about" | "program" | "skills" | "reviews">("about");
  const lessonSection = useRef<HTMLDivElement>(null);
  const jumpToLesson = useRef(false);
  useEffect(() => {
    if (tab !== "program" || !jumpToLesson.current) return;
    jumpToLesson.current = false;
    const lesson = lessonSection.current?.querySelector<HTMLElement>(".bc-learning__body");
    if (lesson && typeof lesson.scrollIntoView === "function") {
      lesson.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [tab]);
  const tabs = [
    { key: "about", label: "О курсе" },
    { key: "program", label: "Программа" },
    { key: "skills", label: "Навыки" },
    { key: "reviews", label: "Отзывы" },
  ] as const;
  // Impulse's self-paced demo content uses the new ten-state immersive reader.
  // External provider courses keep their original verified-program and certificate flow.
  if (/^demo-course-(?:[1-9]|1[0-2])$/.test(card.key)) {
    return <ImmersiveCourseExperience
      courseKey={card.key} courseTitle={card.title}
      recommendation={card.recommendation_reason}
      initialView={initialLearningView}
      accessible={card.access_state === "available"}
      onReason={onReason} />;
  }
  return <div ref={lessonSection} className="bc-panel-content" data-reference="BC-R03">
    <div className="bc-ref-detail-hero">
      <CourseFlags card={card}/>
      <h2 className="bc-detail-title">{detail?.title ?? card.title}</h2>
      <p>{detail?.objective || card.recommendation_reason || "Описание курса пока не опубликовано."}</p>
      <div className="bc-ref-detail-facts"><span><Clock3 />{detail?.workload_hours ? String(detail.workload_hours) + " часов" : "Длительность уточняется"}</span>
        <span><GraduationCap />{detail?.program_competencies.length ? String(detail.program_competencies.length) + " групп навыков" : "Навыки уточняются"}</span></div>
      <div className="bc-ref-detail-actions">
        {card.access_state === "available" ? <SafeExternalLink href={card.source_url}>Открыть курс <ArrowRight /></SafeExternalLink> : <p>{card.access_note || "Требуется выполнение условий доступа"}</p>}
        <button type="button" onClick={onReason}>Почему рекомендован</button>
      </div>
    </div>
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
        <button type="button" className="bc-learning-launch" onClick={() => { jumpToLesson.current = true; setTab("program"); }}>Открыть уроки и практику <ArrowRight aria-hidden="true" /></button>
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
        <CourseLearningContent courseKey={card.key} courseTitle={card.title} sourceUrl={card.source_url} />
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
      <span className="bc-muted">Основание рекомендации доступно в начале панели.</span>
      {card.access_state === "available" && <SafeExternalLink href={card.source_url}>Открыть курс ↗</SafeExternalLink>}
      {card.access_state === "prerequisite_not_met" && <p className="bc-muted">Сначала выполните необходимые условия доступа.</p>}
    </div>
  </div>;
}

function RecommendationDetails({ card, track, onOpenCourse, onOpenProgram }: { card: CourseCardState; track: string; onOpenCourse: () => void; onOpenProgram: () => void }) {
  const courseMatchesRole = courseRoleTitles(card).includes(track);
  return <div className="bc-panel-content bc-ref-why-panel" data-reference="BC-R04">
    <div className="bc-ref-why-hero">
      <h2>Почему вам рекомендован этот курс</h2>
      <p>Рекомендация основана на выбранной профессиональной роли и этапах вашей траектории развития — а не на случайной подборке материалов.</p>
    </div>
    <div className="bc-ref-why-role-banner">
      <span className="bc-ref-why-banner-symbol"><Sparkles aria-hidden="true"/></span>
      <div><strong>{track}</strong><span>Направление развития · навыки для роли</span></div>
      <span><strong>{card.relevant ? "Высокая" : "Уточняется"}</strong><small>релевантность роли</small></span>
    </div>
    <section className="bc-ref-why-item">
      <span className="bc-ref-why-symbol bc-ref-why-symbol--role"><GraduationCap aria-hidden="true"/></span>
      <div><h3>Соответствует AI-роли</h3>
        <p>{courseMatchesRole ? "Курс связан с направлением «" + track + "»." : card.relevance_reasons[0] ?? "Привязка к активной роли уточняется."}</p></div>
    </section>
    <section className="bc-ref-why-item">
      <span className="bc-ref-why-symbol bc-ref-why-symbol--project"><Sparkles aria-hidden="true"/></span>
      <div><h3>Поможет в проектах</h3>
        <p>{card.recommendation_reason || "Практическая применимость для проектов пока уточняется."}</p></div>
    </section>
    <section className="bc-ref-why-item">
      <span className="bc-ref-why-symbol bc-ref-why-symbol--skill"><ChartNoAxesCombined aria-hidden="true"/></span>
      <div><h3>Закрывает пробелы</h3>
        <p>{card.must_take?.explanation ?? "Компетенции будут сопоставлены с матрицей роли после проверки."}</p></div>
    </section>
    <section className="bc-ref-why-item">
      <span className="bc-ref-why-symbol bc-ref-why-symbol--next"><ArrowRight aria-hidden="true"/></span>
      <div><h3>Следующий шаг траектории</h3>
        <p>После прохождения курса закрепите материал практикой, чтобы подтвердить приобретённые навыки.</p></div>
    </section>
    <p className="bc-ref-why-warning">Курс формирует учебную основу. Подтверждение компетенций предполагает отдельную проверку практических навыков.</p>
    <div className="bc-ref-why-actions">
      <button className="bc-ref-why-back" type="button" onClick={onOpenCourse}>Вернуться к курсу</button>
      <button className="bc-ref-why-cta" type="button" onClick={onOpenProgram}>Перейти к программе <ArrowRight aria-hidden="true"/></button>
    </div>
  </div>;
}

function RequirementsDetails({ cards, onSelect, onClose }: { cards: CourseCardState[]; onSelect: (key: string) => void; onClose: () => void }) {
  // A verified course has must_take=null in the authoritative projection.
  // Never derive a misleading completion percentage from the pending-only list.
  const pending = cards.filter(card => card.must_take !== null && card.completion_state !== "verified");
  const requiredWord = new Intl.PluralRules("ru-RU").select(pending.length) === "one"
    ? "курс" : new Intl.PluralRules("ru-RU").select(pending.length) === "few" ? "курса" : "курсов";
  return <div className="bc-panel-content bc-ref-required-panel" data-reference="BC-R05">
    <div className="bc-ref-required-hero">
      <span className="bc-ref-required-kicker">♜ Требования активной траектории</span>
      <h2>{pending.length === 0 ? "Обязательное обучение завершено" :
        `Осталось ${String(pending.length)} ${pending.length === 1 ? "обязательный" : "обязательных"} ${requiredWord}`}</h2>
      <p>Здесь отображаются учебные требования выбранной роли. Для перехода на следующий грейд могут потребоваться практика и подтверждённые результаты по опубликованной программе.</p>
    </div>
    <div className="bc-ref-required-body">
      <h3>Что нужно завершить</h3>
      {pending.length === 0 ? <p className="bc-ref-required-empty">Незавершённых обязательных курсов нет. Это не означает, что все требования к грейду подтверждены.</p> :
        <ol className="bc-ref-required-list">{pending.map(card =>
          <li key={card.key}>
            <CourseArtwork title={card.title}/>
            <div className="bc-ref-required-course-info">
              <h4>{card.title}</h4>
              <small>{completionLabels[card.completion_state]?.label ?? accessLabels[card.access_state].label}</small>
            </div>
            <button type="button" onClick={() => { onSelect(card.key); }}>
              {card.access_state === "available" ? "Открыть" : "Условия"} <ArrowRight/>
            </button>
          </li>)}</ol>}
      <section className="bc-ref-required-about">
        <h3>Что будет после завершения</h3>
        <p>Курсы закрывают учебную часть требований. Следующий грейд назначается только после выполнения остальных условий и проверки результатов.</p>
      </section>
      <button type="button" className="bc-ref-required-close" onClick={onClose}>Вернуться в каталог <ArrowRight /></button>
    </div>
  </div>;
}

function CourseArtwork({ title }: { title: string }) {
  const key = title.toLocaleLowerCase("ru-RU");
  const kind = key.includes("git") ? "git" : key.includes("python") ? "python" :
    key.includes("fastapi") ? "api" : key.includes("агент") || key.includes("agent") ? "agent" :
    key.includes("openspec") || key.includes("sdd") ? "spec" : "default";
  return <span className={"bc-ref-art bc-ref-art--" + kind} aria-hidden="true">
    {kind === "git" ? <GitBranch /> : kind === "python" ? <strong>Py</strong> :
     kind === "agent" ? <Sparkles /> : kind === "api" ? <span>ϟ</span> : <FileText />}
  </span>;
}
function CourseFlags({ card }: { card: CourseCardState }) {
  return <div className="bc-ref-flags">
    {card.must_take && <span className="bc-ref-chip bc-ref-chip--required"><GraduationCap />Нужно для роли</span>}
    {!card.must_take && card.relevant && <span className="bc-ref-chip bc-ref-chip--recommended"><Sparkles />Рекомендован</span>}
    {card.access_state === "available" ? <span className="bc-ref-chip bc-ref-chip--available"><Check />Доступен</span> :
      <span className="bc-ref-chip bc-ref-chip--locked"><LockKeyhole />{card.access_state === "prerequisite_not_met" ? "Заблокирован" : "Недоступен"}</span>}
    {card.completion_state === "verified" && <span className="bc-ref-chip bc-ref-chip--available"><Check />Подтверждено</span>}
    {card.completion_state === "reported" && <span className="bc-ref-chip bc-ref-chip--progress">На проверке</span>}
  </div>;
}
function CoursePrimaryAction({ card, onOpen }: { card: CourseCardState; onOpen: (key: string) => void }) {
  const locked = card.access_state !== "available";
  return <button type="button" className={"bc-ref-primary" + (locked ? " bc-ref-primary--locked" : "")}
    onClick={() => { onOpen(card.key); }}>
    {locked ? <><LockKeyhole />{card.access_state === "prerequisite_not_met" ? "Смотреть условия" : "Недоступен"}</> :
      <>{card.completion_state === "verified" ? "Посмотреть курс" : card.completion_state === "reported" ? "Посмотреть результат" : "Открыть курс"}<ArrowRight /></>}
  </button>;
}

/** Keep all seven trajectory roles reachable without wrapping and moving the
 * approved hero/catalog geometry. Controls appear only when tabs overflow. */
function AiRoleTabs({
  roles, selected, onSelect,
}: { roles: readonly string[]; selected: string; onSelect: (role: string) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ back: false, next: false });

  const updateScrollButtons = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    const back = element.scrollLeft > 2;
    const next = element.scrollLeft + element.clientWidth < element.scrollWidth - 2;
    setCanScroll(previous =>
      previous.back === back && previous.next === next ? previous : { back, next });
  }, []);

  useEffect(() => {
    updateScrollButtons();
    window.addEventListener("resize", updateScrollButtons);
    return () => { window.removeEventListener("resize", updateScrollButtons); };
  }, [roles.length, updateScrollButtons]);

  function scrollRoles(direction: -1 | 1) {
    const element = scroller.current;
    if (!element) return;
    const amount = Math.max(240, Math.floor(element.clientWidth * 0.65));
    element.scrollBy({ left: direction * amount, behavior: "smooth" });
  }

  return (
    <div className="bc-ref-role-switcher">
      <div className="bc-ref-role-tabs" ref={scroller} role="group"
        aria-label="Направление обучения" onScroll={updateScrollButtons}>
        {roles.map((role, index) =>
          <button type="button" key={role} aria-pressed={selected === role}
            onClick={() => { onSelect(role); }}>
            {index === 0 ? <Bot /> : <ChartNoAxesCombined />}{aiRoleTitle(role)}
          </button>)}
      </div>
      {canScroll.back && <button className="bc-ref-role-scroll bc-ref-role-scroll--back"
        type="button" aria-label="Предыдущие AI-роли"
        onClick={() => { scrollRoles(-1); }}><ChevronLeft aria-hidden="true" /></button>}
      {canScroll.next && <button className="bc-ref-role-scroll bc-ref-role-scroll--next"
        type="button" aria-label="Следующие AI-роли"
        onClick={() => { scrollRoles(1); }}><ChevronRight aria-hidden="true" /></button>}
    </div>
  );
}

type MiniStudyProgress = { completed_units: number; total_units: number; finished: boolean };
function CourseContinueStatus({ card, onOpen, onCatalog }: {
  card: CourseCardState | null;
  onOpen: (key: string) => void;
  onCatalog: () => void;
}) {
  const impulse = card !== null && /^demo-course-(?:[1-9]|1[0-2])$/.test(card.key);
  const progress = useQuery({
    queryKey: ["impulse-study", card?.key ?? ""],
    queryFn: () => apiRequest<MiniStudyProgress>(
      (`/api/v1/me/bootcamp/impulse-study/${encodeURIComponent(card?.key ?? "")}`) as RuntimeApiPath,
    ),
    enabled: impulse,
    retry: false,
  });
  const total = progress.data?.total_units ?? 8;
  const completed = progress.data?.completed_units ?? 0;
  const percent = Math.round((completed / Math.max(1, total)) * 100);
  const loaded = impulse && progress.isSuccess;
  return <div className="bc-ref-continue-status">
    <div className="bc-ref-stat-top"><span>{card ? "Обучение" : "Следующий курс"}</span>
      <strong>{loaded ? `${String(percent)}% пройдено` : card ? "Доступен" : "Не выбран"}</strong></div>
    <div className="bc-ref-track" aria-label={loaded ? `Прогресс обучения: ${String(percent)}%` : "Прогресс ещё не определён"}>
      <i style={{ width: loaded ? String(percent) + "%" : "0%" }}/></div>
    <p><Clock3/>{loaded ? `${String(completed)} из ${String(total)} уроков завершено`
      : !card ? "Нет активных учебных шагов"
        : impulse && progress.isError ? "Нет соединения с прогрессом курса"
          : "Прогресс появится после синхронизации"}</p>
    <button type="button" onClick={() => {
      if (card) onOpen(card.key);
      else onCatalog();
    }}>{!card ? "Смотреть каталог" : loaded && completed > 0 ? "Продолжить обучение" : "Открыть курс"} <ArrowRight/></button>
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
  const [expandedRoleCatalog, setExpandedRoleCatalog] = useState(false);
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
    next.delete("study");
    setSearchParams(next);
  }

  function closePanel() {
    const next = new URLSearchParams(searchParams);
    next.delete("course");
    next.delete("panel");
    next.delete("study");
    setSearchParams(next);
  }

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === "all" && key !== "category") next.delete(key);
    else next.set(key, value);
    next.delete("course");
    next.delete("panel");
    setExpandedRoleCatalog(false);
    setSearchParams(next);
  }

  function resetFilters() {
    const next = new URLSearchParams(searchParams);
    for (const key of ["relevance", "track", "category", "q", "level", "course", "panel"]) next.delete(key);
    setExpandedRoleCatalog(false);
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
  const trackOptions = bootcampRoleKeys(catalog.data);
  // Role selection and catalog direction are independent state dimensions.
  // Otherwise 'Все курсы' silently only showed the first role's courses.
  const requestedRole = searchParams.get("role");
  const selectedRole = requestedRole !== null && trackOptions.includes(requestedRole)
    ? requestedRole : (trackOptions[0] ?? "all");
  const trackFilter = searchParams.get("track") ?? "all";
  const view = searchParams.get("view") ?? "card";
  const category = searchParams.get("category") ?? "role";
  const query = (searchParams.get("q") ?? "").trim().toLocaleLowerCase("ru-RU");
  const setTrack = (track: string) => { updateFilter("track", track); };
  const setRole = (role: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("role", role);
    next.delete("track");
    next.delete("course");
    next.delete("panel");
    next.delete("category");
    setExpandedRoleCatalog(false);
    setSearchParams(next);
  };
  const forTrack = (card: CourseCardState) => isCourseInAiRole(card, trackFilter);
  const forRole = (card: CourseCardState) => isCourseInAiRole(card, selectedRole);
  const categoryCounts = [
    { key: "role", label: "Для моей роли", count: catalog.data.filter((card) => forTrack(card) && forRole(card)).length },
    { key: "all", label: "Все курсы", count: catalog.data.filter(forTrack).length },
    { key: "progress", label: "В процессе", count: catalog.data.filter((card) => forTrack(card) && card.completion_state === "reported").length },
    { key: "completed", label: "Завершённые", count: catalog.data.filter((card) => forTrack(card) && card.completion_state === "verified").length },
  ];
  const pendingRequired = catalog.data.filter((card) => forRole(card) && card.must_take && card.completion_state !== "verified");
  const requiredWord = new Intl.PluralRules("ru-RU").select(pendingRequired.length) === "one" ? "курс" :
    new Intl.PluralRules("ru-RU").select(pendingRequired.length) === "few" ? "курса" : "курсов";
  const nextCourse = orderRoleCourses(catalog.data.filter(forRole), selectedRole).find((card) => card.access_state === "available" && card.completion_state === "not_started" && (selectedRole !== "all" || card.relevant)) ?? null;
  const selectedRoleTitle = selectedRole === "all" ? "Все активные направления" : aiRoleTitle(selectedRole);
  const visible = catalog.data
    .filter((card) => relevanceFilter !== "relevant" || card.relevant)
    .filter(forTrack)
    .filter((card) => category === "all" || (category === "role" && forRole(card)) || (category === "required" && forRole(card) && card.must_take !== null) || (category === "progress" && card.completion_state === "reported") || (category === "completed" && card.completion_state === "verified"))
    .filter((card) => !query || [card.title, card.recommendation_reason, card.must_take?.skill ?? ""].some((value) => value.toLocaleLowerCase("ru-RU").includes(query)));
  const deepLinkedKey = searchParams.get("course");
  const deepLinked =
    deepLinkedKey !== null ? (catalog.data.find((card) => card.key === deepLinkedKey) ?? null) : null;
  const passesFilters = (card: CourseCardState) => visible.includes(card);
  const sortedVisible = category === "role" ? orderRoleCourses(visible, selectedRole) : visible;
  const orderedVisible = deepLinked && passesFilters(deepLinked) ? ([deepLinked, ...sortedVisible.filter((card) => card !== deepLinked)]) : sortedVisible;
  // The approved first screen exposes five cards (4 + 1), with the rest on demand.
  // Searching or restricting by direction must show the complete filtered set.
  const foldedRole = category === "role" && !expandedRoleCatalog && query.length === 0 &&
    trackFilter === "all" && relevanceFilter === "all" && searchParams.get("level") === null;
  const displayedCourses = foldedRole ? orderedVisible.slice(0, 5) : orderedVisible;
  const additionalCourses = foldedRole ? Math.max(0, orderedVisible.length - displayedCourses.length) : 0;
  const deepLinkFilteredOut = deepLinked !== null && !passesFilters(deepLinked);
  const panel = searchParams.get("panel") ?? "detail";


  return (
    <div className="feature-stack bootcamp-experience bc-approved bc-reference" data-reference={view === "list" ? "BC-R02" : "BC-R01"}>
      <header className="bc-ref-heading">
        <div><h1 id="workspace-title">Bootcamp</h1><p>Обучение для твоей роли и реальных проектов</p></div>
        <span className="bc-ref-streak" role="status">🔥 {streak.data ? "Серия: " + String(streak.data.current_days) + " дней" : "Серия недоступна"}</span>
      </header>
      {catalog.isError && <p className="notice" role="status">Обновление каталога недоступно. <button type="button" onClick={() => { void catalog.refetch(); }}>Повторить</button></p>}
      <AiRoleTabs roles={trackOptions} selected={selectedRole} onSelect={setRole} />
      <div className="bc-ref-hero-grid">
        <section className="bc-ref-continue" aria-labelledby="bc-continue-title">
          <h2 id="bc-continue-title">{nextCourse ? "Начать обучение" : "Выбрать обучение"} <span aria-hidden="true">›</span></h2>
          <div className="bc-ref-continue-columns">
            <div className="bc-ref-continue-course">
              {nextCourse ? <><CourseArtwork title={nextCourse.title} />
                <div className="bc-ref-continue-text"><h3>{nextCourse.title}</h3>
                  <p>{nextCourse.recommendation_reason || "Курс для развития навыков выбранной роли"}</p>
                  <div className="bc-ref-tags">{courseRoleTitles(nextCourse).slice(0,3).map(title => <span key={title}>{title}</span>)}</div>
                </div></> : <p>Выберите курс в каталоге, чтобы начать обучение.</p>}
            </div>
            <CourseContinueStatus card={nextCourse}
              onOpen={(key) => { openPanel("detail", key); }}
              onCatalog={() => { document.getElementById("bc-catalog-title")?.scrollIntoView({ behavior: "smooth" }); }}/>
          </div>
        </section>
        <div className="bc-ref-right-panels">
          <section className="bc-ref-role-summary" aria-labelledby="bc-role-title">
            <div><h2 id="bc-role-title">Моя роль: {selectedRoleTitle}</h2>
              <div className="bc-ref-summary-tags"><span>♜ Грейд: не установлен</span><span>▦ Курсов: {catalog.data.filter(forRole).length}</span></div>
            </div>
            <div className="bc-ref-ring" aria-label="Число подтверждённых курсов, не оценка освоения навыков"><strong>{catalog.data.filter(card => forRole(card) && card.completion_state === "verified").length}</strong><small>курсов<br/>подтверждено</small></div>
          </section>
          <section className="bc-ref-grade" aria-labelledby="bc-grade-title">
            <img className="bc-ref-trophy" alt="" src="/bootcamp/trophy.svg" />
            <div className="bc-ref-grade-body">
              <div className="bc-ref-grade-kicker">♛ &nbsp; Учебные требования роли</div>
              <h2 id="bc-grade-title">{pendingRequired.length > 0 ? <>{pendingRequired.length === 1 ? "Остался" : "Осталось"} <em>{pendingRequired.length}</em> {pendingRequired.length === 1 ? "обязательный" : "обязательных"} {requiredWord}</> : "Обязательные курсы"}</h2>
              <p>{pendingRequired.length > 0 ? "Заверши учебные требования. Практика и подтверждение проверяются отдельно." : "В текущем каталоге незавершённых обязательных курсов нет."}</p>
              <div className="bc-ref-grade-list">{pendingRequired.slice(0,2).map(card => <button key={card.key} type="button" onClick={() => { openPanel("detail",card.key); }}><span>◆</span>{card.title}<span aria-hidden="true">›</span></button>)}</div>
            </div>
            <button className="bc-ref-grade-button" type="button" onClick={() => { openPanel("requirements"); }}>Посмотреть курсы <ArrowRight /></button>
          </section>
        </div>
      </div>
      {deepLinkedKey !== null && deepLinked === null && <p role="status" className="notice">Курс по ссылке не найден в каталоге.</p>}
      {deepLinkFilteredOut && <p role="status" className="notice">Курс скрыт фильтрами. Выберите «Все курсы».</p>}
      <section className="bc-ref-catalog" aria-labelledby="bc-catalog-title">
        <h2 id="bc-catalog-title" className="bc-ref-sr-only">Каталог курсов</h2>
        <div className="bc-ref-category-tabs" role="group" aria-label="Категории курсов">
          {categoryCounts.map(item => <button type="button" key={item.key} aria-pressed={category === item.key} onClick={() => { updateFilter("category",item.key); }}>{item.label}<span>{item.count}</span></button>)}
        </div>
        <div className="bc-ref-controls">
          <label className="bc-ref-search"><Search aria-hidden="true" /><span className="bc-ref-sr-only">Поиск курсов</span>
            <input type="search" aria-label="Поиск по курсам" value={searchParams.get("q") ?? ""} placeholder="Поиск по названию курса, навыку или технологии…" onChange={event => { updateFilter("q",event.target.value); }} /></label>
          <label className="bc-ref-select">Направление
            <select value={trackFilter} onChange={event => { setTrack(event.target.value); }}><option value="all">Все направления</option>{trackOptions.map(role => <option key={role} value={role}>{aiRoleTitle(role)}</option>)}</select></label>
          <label className="bc-ref-select">Уровень
            <select disabled title="Уровень станет доступен после публикации классификации"><option>Все уровни</option></select></label>
          <div className="bc-ref-views" role="group" aria-label="Вид каталога">
            <button type="button" aria-pressed={view !== "list"} onClick={() => { updateFilter("view","card"); }}><LayoutGrid /> Карточки</button>
            <button type="button" aria-pressed={view === "list"} onClick={() => { updateFilter("view","list"); }}><List /> Список</button>
          </div>
        </div>
        {view !== "list" ? <div className="bc-ref-course-grid">
          {displayedCourses.map(card => <article className="bc-ref-course-card" key={card.key} data-access={card.access_state} data-testid={"course-" + card.key}>
            <CourseFlags card={card}/>
            <div className="bc-ref-card-intro"><CourseArtwork title={card.title}/><div><h3>{card.title}</h3><p>{card.recommendation_reason || "Описание пока не опубликовано"}</p></div></div>
            <div className="bc-ref-tags">{courseRoleTitles(card).slice(0,3).map(title => <span key={title}>{title}</span>)}</div>
            <p className="bc-ref-card-meta"><Clock3/> Длительность уточняется</p>
            <div className="bc-ref-card-bottom">
              <CoursePrimaryAction card={card} onOpen={key => { openPanel("detail",key); }}/>
              {card.relevant && <button className="bc-ref-reason" type="button" onClick={() => { openPanel("reason",card.key); }}>Почему рекомендован? ›</button>}
            </div>
          </article>)}
        </div> : <ul className="bc-ref-course-list" aria-label="Каталог Bootcamp списком">
          {displayedCourses.map(card => <li className="bc-ref-course-row" key={card.key} data-access={card.access_state} data-testid={"course-" + card.key}>
            <div className="bc-ref-row-info"><CourseArtwork title={card.title}/><div><h3>{card.title}</h3><p>{card.recommendation_reason || "Описание пока не опубликовано"}</p></div></div>
            <div className="bc-ref-row-flags"><CourseFlags card={card}/><div className="bc-ref-tags">{courseRoleTitles(card).slice(0,3).map(title => <span key={title}>{title}</span>)}</div></div>
            <div className="bc-ref-row-meta"><Clock3 /> Длительность уточняется</div>
            <div className="bc-ref-row-progress">{card.completion_state === "verified" ? "Подтверждено" : card.completion_state === "reported" ? "На проверке" : "Нет данных о прогрессе"}<div className="bc-ref-track"><i style={{ width: card.completion_state === "verified" ? "100%" : "0%" }}/></div></div>
            <CoursePrimaryAction card={card} onOpen={key => { openPanel("detail",key); }}/>
          </li>)}
        </ul>}
        {additionalCourses > 0 && <button className="bc-ref-show-more" type="button" onClick={() => { setExpandedRoleCatalog(true); }}>Показать ещё {additionalCourses} курсов для роли <ArrowRight /></button>}
        {visible.length === 0 && <div className="bc-ref-empty" role="status">Курсов по условиям не найдено. <button type="button" onClick={resetFilters}>Сбросить фильтры</button></div>}
      </section>
      <Drawer key={`${panel}:${deepLinked?.key ?? ""}`} title={panel === "reason" ? "Почему рекомендован" : "Информация о курсе"} open={deepLinked !== null && panel !== "requirements"} onClose={closePanel}>
        {deepLinked && (panel === "reason" ? <RecommendationDetails card={deepLinked} track={selectedRoleTitle} onOpenCourse={() => { openPanel("detail", deepLinked.key); }} onOpenProgram={() => { const next = new URLSearchParams(searchParams); next.set("course", deepLinked.key); next.set("panel", "detail"); next.set("study", "program"); setSearchParams(next); }} /> :
          <CourseDetails key={deepLinked.key} card={deepLinked} initialLearningView={searchParams.get("study") === "program" ? "program" : "overview"}
            detail={detailQuery.data ?? null} loading={detailQuery.isPending} detailError={detailQuery.isError}
            certificate={certificatesQuery.data?.find((item) => item.course_title === deepLinked.title) ?? null}
            certificatesLoading={certificatesQuery.isPending} certificateError={certificatesQuery.isError}
            issuing={issueCertificate.isPending} issueError={issueCertificate.isError}
            onIssue={(courseKey) => { issueCertificate.mutate(courseKey); }}
            onReason={() => { openPanel("reason", deepLinked.key); }} />)}
      </Drawer>
      <Drawer title="Требования к обучению" open={panel === "requirements"} onClose={closePanel}>
        <RequirementsDetails cards={catalog.data.filter(forRole)} onSelect={(key) => { openPanel("detail", key); }} onClose={closePanel} />
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
