import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ParticipantHelpTrigger } from "../participant-help-trigger";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Bot, Check, Clock3, FileText, GitBranch, GraduationCap, List, LockKeyhole, Search, Sparkles, ChartNoAxesCombined, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";

import { apiRequest, retrySafeRead, RuntimeApiPath } from "../../api/client";
import { Badge, Card, Drawer, SafeExternalLink, StatePanel } from "../../components/ui";
import { CourseLearningContent } from "./learning-content/CourseLearningContent";
import { ImmersiveCourseExperience } from "./learning-content/ImmersiveCourseExperience";
import { LearningProgressPanel } from "../learning-progress-panel";
import { learningSummaryQueryKey, loadLearningSummary, type LearningCourse } from "../learning-progress";
import { aiRoleTitle, bootcampRoleKeys, courseRoleTitles, isCourseInAiRole, orderRoleCourses } from "./trajectory-content";
import { projectRoleStudy, satisfiesStudyRequirement, type StudyRecord } from "./role-study-progression";
import { GradeMilestoneCelebration } from "./grade-milestone-celebration";
import type { BootcampOverview } from "./page";
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
      <ParticipantHelpTrigger topicId="course-complete" label="Когда курс засчитается" />
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
  certificateError, issuing, issueError, onIssue, onCelebrationChange,
}: {
  card: CourseCardState; onReason: () => void; initialLearningView?: "overview" | "program"; detail: CourseDetail | null;
  loading: boolean; detailError: boolean; certificate: CourseCertificate | null;
  certificatesLoading: boolean; certificateError: boolean; issuing: boolean;
  issueError: boolean; onIssue: (key: string) => void;
  onCelebrationChange?: (active: boolean) => void;
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
      onReason={onReason} onCelebrationChange={onCelebrationChange} />;
  }
  return <div ref={lessonSection} className="bc-panel-content" data-reference="BC-R03">
    <div className="bc-ref-detail-hero">
      <CourseFlags card={card}/>
      <h2 className="bc-detail-title">{detail?.title ?? card.title}</h2>
      <p>{detail?.objective || card.recommendation_reason || "Описание курса пока не опубликовано."}</p>
      <div className="bc-ref-detail-facts"><span><Clock3 />{detail?.workload_hours ? String(detail.workload_hours) + " часов" : "Длительность уточняется"}</span>
        <span><GraduationCap />{detail?.program_competencies.length ? String(detail.program_competencies.length) + " групп навыков" : "Навыки уточняются"}</span></div>
      <div className="bc-ref-detail-actions">
      <ParticipantHelpTrigger topicId="course-choose" label="Что даст курс" />
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
      <ParticipantHelpTrigger topicId="certification" label="Условия сертификата" />
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

function RequirementsDetails({ cards, studyRecords, onSelect, onClose, onStartPractice, policyCurriculum }: { cards: CourseCardState[]; studyRecords: readonly StudyRecord[]; onSelect: (key: string) => void; onClose: () => void; onStartPractice:()=>void; policyCurriculum?: BootcampOverview["curriculum"] | null }) {
  // Published career-grade requirements supersede educational demo suggestions.
  // Verified study alone never fulfills independently reviewed project evidence.
  if (policyCurriculum?.state==="known") {
    const outstanding=policyCurriculum.requirements.filter(req=>req.state!=="verified");
    const courses=outstanding.filter(req=>req.kind==="course");
    return <div className="bc-panel-content bc-ref-required-panel" data-reference="BC-R05" data-policy-version={policyCurriculum.policy_version??""}>
      <div className="bc-ref-required-hero">
        <span className="bc-ref-required-kicker">♛ Опубликованная программа грейда</span>
        <h2>{outstanding.length===0?"Все условия подтверждены":
          courses.length>0?`Осталось учебных требований: ${String(courses.length)}`:"Учебная часть завершена"}</h2>
        <p>{outstanding.length===0
          ?"Все требования подтверждены. Система оформляет разрешённый переход на следующий грейд по опубликованным правилам."
          :"Для перехода на новый грейд необходимо выполнить и подтвердить все требования программы. Закрытие одного курса не заменяет практику и проверку."}</p>
      </div>
      <div className="bc-ref-required-body">
        <h3>{outstanding.length>0?"Следующие требования":"Проверка завершена"}</h3>
        {outstanding.length>0?<ol className="bc-ref-required-list">
          {outstanding.map(req=>{
            const linked=cards.find(card=>card.key===req.source_key);
            return <li key={req.key} data-requirement-kind={req.kind}>
              <span className="bc-ref-policy-icon" aria-hidden="true">{req.kind==="course"?"◈":"◆"}</span>
              <div className="bc-ref-required-course-info"><h4>{req.title}</h4>
                <small>{req.kind==="course"?"Обучение":req.kind==="project"?"Практический проект":"Подтверждение"} · {req.state==="reported"?"На проверке":"Ожидает выполнения"}</small></div>
              {linked&&<button type="button" onClick={()=>{onSelect(linked.key);}}>Открыть <ArrowRight/></button>}
            </li>;
          })}
        </ol>:<p className="bc-ref-required-empty">Ожидайте официального обновления грейда. Дублировать выполнение или отправлять доказательства повторно не требуется.</p>}
        {outstanding.some(req=>req.kind!=="course")&&<button type="button" className="bc-ref-required-start-practice" onClick={onStartPractice}>Перейти к практике <ArrowRight/></button>}
        <button type="button" className="bc-ref-required-close" onClick={onClose}>Вернуться в Bootcamp <ArrowRight/></button>
      </div>
    </div>;
  }
  // A verified course has must_take=null in the authoritative projection.
  // Never derive a misleading completion percentage from the pending-only list.
  const pending = projectRoleStudy(cards, studyRecords).pending;
  const requiredWord = new Intl.PluralRules("ru-RU").select(pending.length) === "one"
    ? "курс" : new Intl.PluralRules("ru-RU").select(pending.length) === "few" ? "курса" : "курсов";
  return <div className="bc-panel-content bc-ref-required-panel" data-reference="BC-R05">
    <div className="bc-ref-required-hero">
      <span className="bc-ref-required-kicker">♜ Требования активной траектории</span>
      <h2>{pending.length === 0 ? "Обязательное обучение завершено" :
        `Осталось ${String(pending.length)} ${pending.length === 1 ? "обязательный" : "обязательных"} ${requiredWord}`}</h2>
      <p>{pending.length === 0 ? "Учебные требования выполнены. Далее — практика, проверка результатов и требования опубликованной программы грейдов." : "Завершённые курсы Impulse засчитываются в учебной части автоматически. Профессиональный грейд зависит от подтверждения всех условий программы."}</p>
    </div>
    <div className="bc-ref-required-body">
      <h3>{pending.length===0?"Следующий этап развития":"Что нужно завершить"}</h3>
      {pending.length === 0 ? <p className="bc-ref-required-empty">Учебные требования текущей роли закрыты. Следующий шаг — выполнение практических задач и получение проверенных доказательств компетенций. Новый профессиональный грейд отображается только после серверного подтверждения.</p> :
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
      {pending.length===0 && <button type="button" className="bc-ref-required-start-practice" onClick={onStartPractice}>Перейти к практическим задачам <ArrowRight/></button>}
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

export function StudyCourseProgress({course,compact=false}:{course?:LearningCourse;compact?:boolean}) {
  if (!course) return null;
  const units=Math.max(1,course.total_units);
  const completed=Math.min(units,course.completed_units);
  return <div className={"bc-study-progress"+(compact?" bc-study-progress--compact":"")} data-testid="bootcamp-study-progress" data-course-key={course.course_key}>
    <span>{course.finished?"Учебный курс пройден":`Уроки: ${String(completed)} из ${String(units)}`}</span>
    <progress max={units} value={completed} aria-label={`Учебный прогресс: ${course.title}`}/>
    <small>{course.finished?"Сертификат обучения выдан · практические навыки подтверждаются отдельно":`${String(Math.round(completed/units*100))}% изучено · не оценка навыков`}</small>
  </div>;
}

type MilestoneCelebration = { mode: "stage-unlocked" | "official-grade-up"; roleTitle: string; fromGrade?:string; toGrade?:string };

export function BootcampCatalog({
  honorBoardEnabled,
  honorBoardConsent,
}: {
  honorBoardEnabled: boolean;
  honorBoardConsent: boolean;
}) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [milestoneCelebration, setMilestoneCelebration] = useState<MilestoneCelebration | null>(null);
  const [courseCelebrationOpen, setCourseCelebrationOpen] = useState(false);
  const previousServerGrades = useRef(new Map<string, { key:string; title:string }>());
  const catalog = useQuery({
    queryKey: ["bootcamp-catalog"],
    queryFn: () => apiRequest<CourseCardState[]>(CATALOG_PATH),
    retry: retrySafeRead,
  });
  const study = useQuery({ queryKey: learningSummaryQueryKey, queryFn: loadLearningSummary, retry: retrySafeRead });
  // The versioned role-grade projection is the only allowed source for a
  // professional grade. Never infer a corporate grade from finished lessons.
  const [gradeRequestParams] = useSearchParams();
  const gradeRoleOptions = bootcampRoleKeys(catalog.data ?? []);
  const gradeRequestedRole = gradeRequestParams.get("role");
  const gradeRole = gradeRequestedRole!==null&&gradeRoleOptions.includes(gradeRequestedRole)
    ? gradeRequestedRole : gradeRoleOptions[0]??null;
  const gradeOverview = useQuery({
    queryKey:["bootcamp-v2-overview",gradeRole],
    queryFn:()=>apiRequest<BootcampOverview>(
      ("/api/v1/me/bootcamp/overview?track="+encodeURIComponent(gradeRole??"")) as RuntimeApiPath
    ),
    enabled:gradeRole!==null,
    retry:false,
    refetchInterval:(query)=>query.state.data?.role_summary.grade_state==="known"?20000:false,
  });
  const serverGradeState = gradeOverview.data?.role_summary;
  useEffect(() => {
    if (!gradeRole || serverGradeState?.grade_state!=="known" || !serverGradeState.current_grade_key || !serverGradeState.current_grade_title) return;
    const before = previousServerGrades.current.get(gradeRole);
    const current = {key:serverGradeState.current_grade_key,title:serverGradeState.current_grade_title};
    previousServerGrades.current.set(gradeRole,current);
    if (before && before.key!==current.key) {
      setMilestoneCelebration({ mode:"official-grade-up",roleTitle:aiRoleTitle(gradeRole),fromGrade:before.title,toGrade:current.title });
    }
  },[gradeRole,serverGradeState?.grade_state,serverGradeState?.current_grade_key,serverGradeState?.current_grade_title]);
  const studyFor = (key: string): LearningCourse | undefined => study.data?.courses.find(item => item.course_key === key);
  const studyStarted = (key: string) => (studyFor(key)?.completed_units ?? 0) > 0;
  const studyFinished = (key: string) => studyFor(key)?.finished === true;
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
    { key: "progress", label: "В процессе", count: catalog.data.filter((card) => forTrack(card) && (card.completion_state === "reported" || (studyStarted(card.key) && !studyFinished(card.key)))).length },
    { key: "completed", label: "Завершённые", count: catalog.data.filter((card) => forTrack(card) && (card.completion_state === "verified" || studyFinished(card.key))).length },
  ];
  const roleCourses = catalog.data.filter(forRole);
  const roleStudy = projectRoleStudy(roleCourses,study.data?.courses ?? []);
  const pendingRequired = roleStudy.pending;
  const gradeCurriculum=gradeOverview.data?.selected_track_key===selectedRole
    && gradeOverview.data.curriculum.state==="known" ? gradeOverview.data.curriculum : null;
  const policyRemaining=gradeCurriculum?.requirements.filter(req=>req.state!=="verified")??[];
  const policyCourses=policyRemaining.filter(req=>req.kind==="course");
  const remainingStudyCount=gradeCurriculum?policyCourses.length:pendingRequired.length;
  const studyNeedsAction=gradeCurriculum?policyRemaining.length>0:pendingRequired.length>0;
  const officialGrade = gradeOverview.data?.role_summary.track_key===selectedRole && gradeOverview.data.role_summary.grade_state==="known"
    ? gradeOverview.data.role_summary.current_grade_title : null;
  const gradeStatusLabel = gradeOverview.isError
    ? "Грейд: данные недоступны"
    : gradeOverview.isPending
      ? "Грейд: загружается"
      : officialGrade ? "Грейд: "+officialGrade
        : gradeOverview.data.role_summary.grade_state === "not_evaluable"
          ? "Грейд: правила не опубликованы"
          : "Грейд: не присвоен";
  const progressionComplete = gradeCurriculum?policyRemaining.length===0:roleStudy.required.length>0 && pendingRequired.length===0;
  const requiredWord = new Intl.PluralRules("ru-RU").select(remainingStudyCount) === "one" ? "курс" :
    new Intl.PluralRules("ru-RU").select(remainingStudyCount) === "few" ? "курса" : "курсов";
  const suggestedCourses = orderRoleCourses(catalog.data.filter(forRole), selectedRole).filter((card) => card.access_state === "available" && card.completion_state === "not_started" && !studyFinished(card.key) && (selectedRole !== "all" || card.relevant));
  const nextCourse = suggestedCourses.find(card => studyStarted(card.key)) ?? suggestedCourses[0] ?? null;
  const selectedRoleTitle = selectedRole === "all" ? "Все активные направления" : aiRoleTitle(selectedRole);
  const visible = catalog.data
    .filter((card) => relevanceFilter !== "relevant" || card.relevant)
    .filter(forTrack)
    .filter((card) => category === "all" || (category === "role" && forRole(card)) || (category === "required" && forRole(card) && card.must_take !== null && !satisfiesStudyRequirement(card,study.data?.courses ?? [])) || (category === "progress" && (card.completion_state === "reported" || (studyStarted(card.key) && !studyFinished(card.key)))) || (category === "completed" && (card.completion_state === "verified" || studyFinished(card.key))))
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
              <div className="bc-ref-summary-tags"><span data-testid="bootcamp-official-grade">♜ {gradeStatusLabel}</span><span>▦ Курсов: {roleStudy.totalRoleCourses}</span><span data-testid="bootcamp-study-level">Учебный этап: {roleStudy.studied.length} из {roleStudy.totalRoleCourses}</span></div>
            </div>
            <div className="bc-ref-ring" aria-label="Завершённые учебные курсы роли, не профессиональный грейд"><strong data-testid="bootcamp-study-count">{roleStudy.studied.length}</strong><small>курсов<br/>пройдено</small></div>
          </section>
          <section className={"bc-ref-grade"+(progressionComplete?" bc-ref-grade--ready":"")} aria-labelledby="bc-grade-title" data-study-ready={progressionComplete}>
            <img className="bc-ref-trophy" alt="" src="/bootcamp/trophy.svg" />
            <div className="bc-ref-grade-body">
              <div className="bc-ref-grade-kicker">♛ &nbsp; Учебные требования роли</div>
              <h2 id="bc-grade-title" aria-live="polite">{remainingStudyCount > 0 ? <>{remainingStudyCount === 1 ? "Остался" : "Осталось"} <em>{remainingStudyCount}</em> {remainingStudyCount === 1 ? "обязательный" : "обязательных"} {requiredWord}</> : progressionComplete ? "Учебная часть завершена" : "Обязательные курсы"}</h2>
              <p>{studyNeedsAction ? gradeCurriculum ? "Следующие требования опубликованной программы. Для повышения нужно подтвердить каждый пункт." : "Оставшиеся учебные требования обновляются после завершения курса. Практика и подтверждение проверяются отдельно." : progressionComplete ? "Все необходимые требования завершены. Профессиональный грейд обновится после серверного подтверждения перехода." : "Обязательные курсы пока не указаны. Дальнейшие требования смотри в траектории."}</p>
              <div className="bc-ref-grade-list">{progressionComplete ? <span className="bc-ref-grade-next" data-testid="bootcamp-next-stage">◆ Следующий этап: практика и проверка результатов</span> : gradeCurriculum ? policyRemaining.slice(0,2).map(req=><button key={req.key} type="button" onClick={()=>{const card=catalog.data.find(item=>item.key===req.source_key);if(card){openPanel("detail",card.key);}else{openPanel("requirements");}}}><span>◆</span>{req.title}<span aria-hidden="true">›</span></button>) : pendingRequired.slice(0,2).map(card => <button key={card.key} type="button" onClick={() => { openPanel("detail",card.key); }}><span>◆</span>{card.title}<span aria-hidden="true">›</span></button>)}</div>
            </div>
            <button className={"bc-ref-grade-button"+(progressionComplete?" bc-ref-grade-button--unlock":"")} type="button" onClick={() => { if(progressionComplete){setMilestoneCelebration({mode:"stage-unlocked",roleTitle:selectedRoleTitle});}else{openPanel("requirements");} }} aria-label={progressionComplete?"Следующий этап — открыть новую ступень развития":"Посмотреть курсы"}>{progressionComplete ? <><Sparkles size={17} aria-hidden="true"/>Следующий этап</> : "Посмотреть курсы"} <ArrowRight /></button>
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
            <StudyCourseProgress course={studyFor(card.key)} />
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
            <div className="bc-ref-row-progress"><StudyCourseProgress course={studyFor(card.key)} compact />{!studyFor(card.key) && <><span>{card.completion_state === "verified" ? "Подтверждено" : card.completion_state === "reported" ? "На проверке" : "Учебный прогресс не начат"}</span><div className="bc-ref-track"><i style={{width:card.completion_state==="verified"?"100%":"0%"}}/></div></>}</div>
            <CoursePrimaryAction card={card} onOpen={key => { openPanel("detail",key); }}/>
          </li>)}
        </ul>}
        {additionalCourses > 0 && <button className="bc-ref-show-more" type="button" onClick={() => { setExpandedRoleCatalog(true); }}>Показать ещё {additionalCourses} курсов для роли <ArrowRight /></button>}
        {visible.length === 0 && <div className="bc-ref-empty" role="status">Курсов по условиям не найдено. <button type="button" onClick={resetFilters}>Сбросить фильтры</button></div>}
      </section>
      <LearningProgressPanel bootcampIndex={2} compact />
      <Drawer key={`${panel}:${deepLinked?.key ?? ""}`} title={panel === "reason" ? "Почему рекомендован" : "Информация о курсе"} preciseCloseIcon={panel === "reason"} open={deepLinked !== null && panel !== "requirements"} onClose={closePanel}>
        {deepLinked && (panel === "reason" ? <RecommendationDetails card={deepLinked} track={selectedRoleTitle} onOpenCourse={() => { openPanel("detail", deepLinked.key); }} onOpenProgram={() => { const next = new URLSearchParams(searchParams); next.set("course", deepLinked.key); next.set("panel", "detail"); next.set("study", "program"); setSearchParams(next); }} /> :
          <CourseDetails key={deepLinked.key} card={deepLinked} initialLearningView={searchParams.get("study") === "program" ? "program" : "overview"}
            detail={detailQuery.data ?? null} loading={detailQuery.isPending} detailError={detailQuery.isError}
            certificate={certificatesQuery.data?.find((item) => item.course_title === deepLinked.title) ?? null}
            certificatesLoading={certificatesQuery.isPending} certificateError={certificatesQuery.isError}
            issuing={issueCertificate.isPending} issueError={issueCertificate.isError}
            onIssue={(courseKey) => { issueCertificate.mutate(courseKey); }}
            onReason={() => { openPanel("reason", deepLinked.key); }}
            onCelebrationChange={setCourseCelebrationOpen} />)}
      </Drawer>
      <Drawer title="Требования к обучению" open={panel === "requirements"} onClose={closePanel}>
        <RequirementsDetails cards={roleCourses} studyRecords={study.data?.courses ?? []} policyCurriculum={gradeCurriculum} onSelect={(key) => { openPanel("detail", key); }} onClose={closePanel} onStartPractice={() => { void navigate(`/workspace/1?role=${encodeURIComponent(selectedRole)}`); }} />
      </Drawer>
      {milestoneCelebration && !courseCelebrationOpen && <GradeMilestoneCelebration mode={milestoneCelebration.mode}
        roleTitle={milestoneCelebration.roleTitle} fromGrade={milestoneCelebration.fromGrade} toGrade={milestoneCelebration.toGrade}
        onClose={() => { setMilestoneCelebration(null); }}
        onContinue={() => {
          setMilestoneCelebration(null);
          // Continue in the SAME role, not an unrelated default trajectory.
          // Fresh server projections own stage/grade status; learning certificates
          // remain a separate signal until the roadmap owner verifies milestones.
          void Promise.all([
            client.invalidateQueries({queryKey:["development-overview"]}),
            client.invalidateQueries({queryKey:["trajectory-roadmaps"]}),
            client.invalidateQueries({queryKey:["trajectory-roadmap-catalog"]}),
            client.invalidateQueries({queryKey:learningSummaryQueryKey}),
            client.invalidateQueries({queryKey:["bootcamp-v2-overview",selectedRole]}),
          ]).then(() => navigate(`/workspace/1?role=${encodeURIComponent(selectedRole)}`));
        }}
      />}
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
