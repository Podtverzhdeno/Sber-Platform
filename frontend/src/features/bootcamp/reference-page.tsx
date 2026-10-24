/**
 * Bootcamp participant view faithfully structured from the five approved
 * 2026-10-22 reference screens. Presentation comes from reference-layout.css;
 * all domain data comes from authenticated APIs, never the demo fixtures.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { apiRequest, retrySafeRead } from "../../api/client";
import { SafeExternalLink, StatePanel } from "../../components/ui";
import "./reference-layout.css";

type MustTake = {
  skill: string;
  current_level: string | null;
  target_level: string | null;
  projected_impact: string;
  explanation: string;
};
type Course = {
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
type Detail = {
  course_key: string;
  title: string;
  source_url: string;
  availability: string;
  access_note: string;
  enrollment_status: string | null;
  verified: boolean;
  specialization: string | null;
  program_version: string | null;
  workload_hours: number | null;
  program_competencies: string[][];
  objective: string | null;
  milestone_title: string | null;
  next_step: string | null;
  artifact: string | null;
  cycle: {
    competency: string;
    current_level: string;
    projected_level: string;
    target_level: string;
    projected_confirmed: boolean;
    evidence: string;
  }[];
};
type Streak = { current_days: number; qualified_dates: string[]; reason: string };
type Certificate = { certificate_id: string; verification_id: string; course_title: string };
const EMPTY_COURSES: Course[] = [];
type Category = "role" | "all" | "in_progress" | "completed";
type Drawer = "detail" | "why" | "required" | "role";
type Tab = "about" | "program" | "skills" | "reviews";

const navLinks = [
  { label: "Главная", target: "/workspace/0", glyph: "home" },
  { label: "Моя траектория", target: "/workspace/1", glyph: "route" },
  { label: "Bootcamp", target: "/workspace/2", glyph: "school" },
  { label: "Задачи", target: "/workspace/3", glyph: "tasks" },
  { label: "Мои проекты", target: "/workspace/4", glyph: "brief" },
  { label: "Сообщения", target: "/workspace/5", glyph: "chat" },
  { label: "Портфолио", target: "/workspace/6", glyph: "folder" },
  { label: "Достижения", target: "/workspace/7", glyph: "trophy" },
  { label: "Аналитика", target: "/workspace/8", glyph: "bars" },
  { label: "AI Buddy", target: "/workspace/9", glyph: "star" },
  { label: "Настройки", target: "/workspace/10", glyph: "settings" },
] as const;

function Glyph({ name, className = "" }: { name: string; className?: string }) {
  return <svg aria-hidden="true" className={`icon ${className}`}><use href={`/bootcamp-reference/icons.svg#i-${name}`} /></svg>;
}
function initials(title: string): string {
  if (/python/i.test(title)) return "Py";
  if (/git|github/i.test(title)) return "◆";
  if (/fastapi/i.test(title)) return "ϟ";
  return "";
}
function visual(title: string): { glyph: string; tone: string } {
  const lower = title.toLocaleLowerCase("ru-RU");
  if (/agent|агент|langchain|llm/i.test(lower)) return { glyph: "star", tone: "agent" };
  if (/python/i.test(lower)) return { glyph: "doc", tone: "python" };
  if (/git|команд/i.test(lower)) return { glyph: "route", tone: "git" };
  if (/fastapi|api/i.test(lower)) return { glyph: "route", tone: "fastapi" };
  if (/security|безопас/i.test(lower)) return { glyph: "lock", tone: "security" };
  if (/product|продукт|аналит/i.test(lower)) return { glyph: "bars", tone: "monitor" };
  return { glyph: "doc", tone: "" };
}
function Tile({ title }: { title: string }) {
  const v = visual(title);
  const letters = initials(title);
  return <span className={`tile-icon ${v.tone}`} aria-hidden="true">{letters ? <b style={{ fontSize: letters === "◆" || letters === "ϟ" ? 29 : 19 }}>{letters}</b> : <Glyph name={v.glyph} />}</span>;
}
function RoleTitle({ track }: { track: string }) {
  return <>{track.replace(/[_-]/g, " ")}</>;
}
function Badge({ course }: { course: Course }) {
  if (course.access_state === "prerequisite_not_met") return <span className="status-chip locked"><Glyph name="lock" /> Заблокирован</span>;
  if (course.completion_state === "verified") return <span className="status-chip completed"><Glyph name="check" /> Подтверждено</span>;
  if (course.completion_state === "reported") return <span className="status-chip pending"><Glyph name="clock" /> На проверке</span>;
  if (course.must_take) return <span className="status-chip needed"><Glyph name="school" /> Нужно для роли</span>;
  if (course.relevant) return <span className="status-chip recommended"><Glyph name="star" /> Рекомендован</span>;
  return <span className="status-chip available"><Glyph name="unlock" /> Доступен</span>;
}
function Skills({ course }: { course: Course }) {
  const skills = [...new Set([course.must_take?.skill, ...course.relevance_reasons.filter((reason) => reason.length < 24)].filter((v): v is string => Boolean(v)))].slice(0, 3);
  return <div className="tag-list">{skills.map((skill) => <span className="tag" key={skill}>{skill}</span>)}{skills.length === 0 && <span className="tag">Навыки уточняются</span>}</div>;
}
function reason(course: Course): string {
  return course.recommendation_reason || course.must_take?.explanation || "Описание курса ещё не опубликовано";
}
function available(course: Course) { return course.access_state === "available"; }
function required(course: Course) { return course.must_take !== null && course.completion_state !== "verified"; }
function isInProgress() {
  // There is no authoritative START/CONTINUE projection yet. Reported completion
  // is *not* evidence of an ongoing learning enrollment.
  return false;
}

export function ReferenceBootcampCatalog(props: { honorBoardEnabled: boolean; honorBoardConsent: boolean }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [drawerTab, setDrawerTab] = useState<Tab>("about");
  const [chosenKey, setChosenKey] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [light, setLight] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLDivElement | null>(null);

  const catalog = useQuery({ queryKey: ["bootcamp-catalog"], queryFn: () => apiRequest<Course[]>("/api/v1/me/bootcamp/catalog"), retry: retrySafeRead });
  const streak = useQuery({ queryKey: ["streak"], queryFn: () => apiRequest<Streak>("/api/v1/me/learning/streak"), retry: retrySafeRead });
  const detail = useQuery({
    queryKey: ["course-detail", chosenKey],
    queryFn: () => apiRequest<Detail>(`/api/v1/me/courses/${encodeURIComponent(chosenKey ?? "")}/detail`),
    enabled: drawer === "detail" && chosenKey !== null,
    retry: retrySafeRead,
  });
  const certificates = useQuery({
    queryKey: ["certificates"],
    queryFn: () => apiRequest<Certificate[]>("/api/v1/me/bootcamp/certificates"),
    enabled: drawer === "detail",
    retry: retrySafeRead,
  });
  const complete = useMutation({
    mutationFn: (key: string) => apiRequest(`/api/v1/me/courses/${encodeURIComponent(key)}/completion`, {
      method: "POST", headers: { "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" },
    }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["bootcamp-catalog"] }); setNotice("Заявка на завершение отправлена на проверку"); },
    onError: () => { setNotice("Не удалось отправить завершение. Повторите запрос позже"); },
  });
  const learningDay = useMutation({
    mutationFn: (key: string) => apiRequest(`/api/v1/me/courses/${encodeURIComponent(key)}/learning-days`, {
      method: "POST", headers: { "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" }, body: JSON.stringify({ occurred_at: new Date().toISOString() }),
    }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["streak"] }); setNotice("Учебный день записан"); },
    onError: () => { setNotice("Не удалось записать учебный день"); },
  });
  const issueCertificate = useMutation({
    mutationFn: (key: string) => apiRequest<Certificate>(`/api/v1/me/bootcamp/certificates/${encodeURIComponent(key)}`, {
      method: "POST", headers: { "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" },
    }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["certificates"] }); setNotice("Сертификат доступен в деталях курса"); },
    onError: () => { setNotice("Не удалось выдать сертификат"); },
  });

  const courses = catalog.data ?? EMPTY_COURSES;
  const tracks = useMemo(() => [...new Set(courses.flatMap((course) => course.track_keys))], [courses]);
  const role = params.get("role") && tracks.includes(params.get("role") ?? "") ? params.get("role") ?? "" : tracks[0] ?? "all";
  const category: Category = (["role", "all", "in_progress", "completed"] as const).includes(params.get("category") as Category)
    ? params.get("category") as Category : "role";
  const view = params.get("view") === "list" ? "list" : "card";
  const direction = params.get("direction") ?? "all";
  const query = params.get("q") ?? "";
  const currentCourse = courses.find((course) => course.relevant && available(course) && course.completion_state === "not_started" && (role === "all" || course.track_keys.includes(role)))
    ?? courses.find((course) => available(course) && course.completion_state === "not_started" && (role === "all" || course.track_keys.includes(role))) ?? null;
  const selectedCourse = courses.find((course) => course.key === chosenKey) ?? null;
  const courseRequired = courses.filter((course) => (role === "all" || course.track_keys.includes(role)) && required(course));
  const roleCourses = courses.filter((course) => (role === "all" || course.track_keys.includes(role)) && course.relevant);
  const filtered = courses.filter((course) => {
    if (category === "role" && !(course.relevant && (role === "all" || course.track_keys.includes(role)))) return false;
    if (category === "in_progress" && !isInProgress(course)) return false;
    if (category === "completed" && course.completion_state !== "verified") return false;
    if (direction !== "all" && !course.track_keys.includes(direction)) return false;
    if (query && ![course.title, reason(course), course.must_take?.skill ?? "", ...course.relevance_reasons].join(" ").toLocaleLowerCase("ru-RU").includes(query.toLocaleLowerCase("ru-RU"))) return false;
    return true;
  });
  const shown = category === "role" && !expanded && !query && direction === "all" ? filtered.slice(0, 5) : filtered;

  function setFilter(key: string, value: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === "" || value === "all" || (key === "view" && value === "card")) next.delete(key);
      else next.set(key, value);
      return next;
    });
    if (key !== "view") setExpanded(false);
  }
  function open(kind: Drawer, key: string | null = null) {
    lastFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setChosenKey(key);
    setDrawerTab("about");
    setDrawer(kind);
  }
  function close() {
    setDrawer(null);
    setChosenKey(null);
    lastFocus.current?.focus();
  }
  useEffect(() => {
    if (!drawer) return;
    drawerRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); close(); } };
    document.addEventListener("keydown", handleEscape, true);
    return () => { document.removeEventListener("keydown", handleEscape, true); };
  }, [drawer]);
  function reset() { setParams((prev) => { const next = new URLSearchParams(prev); ["q", "category", "direction", "level", "view"].forEach((key) => { next.delete(key); }); return next; }); }
  function courseAction(course: Course) {
    if (course.access_state !== "available") {
      const named = course.access_note.trim();
      setNotice(named || "Для открытия курса требуется выполнить условия доступа");
      return;
    }
    open("detail", course.key);
  }
  function switchNav(target: string) { setMenu(false); void navigate(target); }

  if (catalog.isLoading) return <StatePanel kind="loading" />;
  if (!catalog.data) return <StatePanel kind="error" action="Обновить" onAction={() => { void catalog.refetch(); }} />;

  return <div className={`bc-reference-root ${light ? "light-mode" : ""}`} data-reference="BC-R01" ref={mainRef}>
    <a className="bc-skip" href="#bc-reference-content">Перейти к содержимому Bootcamp</a>
    <div className="app">
      <aside className={`sidebar ${menu ? "is-open" : ""}`} aria-label="Основная навигация">
        <button type="button" className="brand bc-navigation-button" aria-label="Impulse, главная" onClick={() => { switchNav("/workspace/0"); }}><span className="brand-shape" aria-hidden="true">▹</span><span>Impulse</span></button>
        <nav>{navLinks.map((entry) => <button type="button" key={entry.label} onClick={() => { switchNav(entry.target); }}
          className={`nav-link bc-navigation-button ${entry.label === "Bootcamp" ? "active" : ""} ${entry.label === "AI Buddy" ? "ai-link" : ""}`}
          aria-current={entry.label === "Bootcamp" ? "page" : undefined}>
          <Glyph name={entry.glyph} /><span>{entry.label}</span>
        </button>)}</nav>
        <div className="sidebar-help"><span className="gift-icon">🎁</span><div><strong>Твой прогресс влияет на возможности</strong><p>Выполняй курсы, задачи и развивай навыки вместе с Impulse.</p></div></div>
      </aside>
      <div className={`mobile-shade ${menu ? "is-open" : ""}`} hidden={!menu} onClick={() => { setMenu(false); }} />
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-start"><button className="icon-button mobile-menu" type="button" aria-label="Открыть меню" onClick={() => { setMenu(true); }}>☰</button>
            <label className="top-search"><Glyph name="search" /><input placeholder="Поиск по курсам, задачам, навыкам..." aria-label="Поиск по курсам" value={query} onChange={(event) => { setFilter("q", event.target.value); }} /><kbd>⌘ K</kbd></label>
          </div>
          <div className="top-actions"><button className="icon-button" type="button" title="Переключить тему" aria-label="Переключить тему" onClick={() => { setLight((v) => !v); }}><Glyph name={light ? "sun" : "moon"}/></button>
            <span className="top-mini" title="Подтверждённые дни обучения">🔥 <b>{streak.data?.current_days ?? "—"}</b></span>
            <button className="top-rank" type="button" onClick={() => { switchNav("/workspace/7"); }}><Glyph name="trophy" /><span><b>Мои достижения</b><small>Подтверждённые результаты</small></span></button>
            <button className="icon-button" type="button" aria-label="Уведомления" onClick={() => { switchNav("/workspace/5"); }}><Glyph name="chat" /></button>
            <button type="button" className="profile bc-navigation-button" onClick={() => { switchNav("/workspace/10"); }}><span className="profile-avatar">У</span><span><b>Участник</b><small>Личный кабинет</small></span><span className="chevron-small">⌄</span></button>
          </div>
        </header>
        <main id="bc-reference-content" className="content">
          <div className="page-heading"><div><h1>Bootcamp</h1><p>Обучение для твоей роли и реальных проектов</p></div><span className="streak-pill">🔥 <b>Серия: {streak.data?.current_days ?? "—"} дней</b></span></div>
          <div className="role-tabs" role="group" aria-label="Выбранная роль">{tracks.length ? tracks.map((track, index) => <button type="button" className="role-tab" key={track} aria-pressed={role === track}
            onClick={() => { setFilter("role", track); }}><Glyph name={index === 0 ? "bot" : "bars"}/><RoleTitle track={track}/></button>) : <span className="role-tab" aria-disabled="true">Траектории пока не опубликованы</span>}</div>
          <section className="top-panels" aria-label="Продолжение обучения и развитие">
            <div className="continue-panel"><div className="section-heading"><h2>Продолжить обучение</h2><Glyph name="chevron" /></div>
              <div className="continue-inner"><div className="continue-info">{currentCourse && <Tile title={currentCourse.title}/>}<div>
                <h3>{currentCourse?.title ?? "Выберите подходящий курс"}{currentCourse && <span className="status-chip available">Доступен</span>}</h3>
                <p>{currentCourse ? reason(currentCourse) : "Когда появится доступный курс, он будет показан здесь"}</p>
                {currentCourse && <Skills course={currentCourse}/>}</div></div>
                <div className="continue-progress"><div className="progress-top"><span>Учебный прогресс</span><b>—</b></div>
                  <span className="track"><i style={{width:0}} /></span><div className="next-lesson"><Glyph name="clock"/><span><em>Следующий шаг</em><br/>{currentCourse ? "Начать изучение курса" : "Выбрать курс из каталога"}<br/><span className="bc-missing-fact">Данные LMS пока не подключены</span></span></div>
                  <button type="button" className="btn" onClick={() => { currentCourse ? courseAction(currentCourse) : document.getElementById("bc-reference-catalog")?.scrollIntoView({behavior:"smooth"}); }}>{currentCourse ? "Начать курс" : "Смотреть курсы"}<Glyph name="arrow" /></button>
                </div>
              </div>
            </div>
            <div className="right-panels">
              <button className="role-summary" type="button" onClick={() => { open("role"); }} aria-label="Открыть мою траекторию"><div className="summary-copy"><h2>Моя роль: <RoleTitle track={role}/></h2><div className="summary-tags"><span>♛ Грейд не определён</span><span>▦ Матрица: нет данных</span></div></div>
                <div className="ring" data-unknown="true" style={{"--pct":0} as CSSProperties}><strong>—</strong><small>Навыков<br/>освоено</small></div></button>
              <section className="grade-highlight" aria-labelledby="bc-grade-title" data-unverified="true"><div className="grade-glow" /><img className="trophy-art" src="/bootcamp-reference/assets/trophy.svg" alt="" aria-hidden="true"/>
                <div className="grade-content"><div className="grade-overline"><span className="crown-glyph">♛</span> До следующего грейда</div>
                  <h2 id="bc-grade-title">Учебные требования</h2><p>Критерии следующего грейда не опубликованы.<br/>Можно изучить отмеченные обязательные курсы.</p>
                  <div className="remaining-mini">{courseRequired.slice(0, 2).map((course) => <button type="button" key={course.key} onClick={() => { open("detail", course.key); }}><span className="mini-icon">◆</span>{course.title}<Glyph name="chevron" /></button>)}</div>
                </div><button type="button" className="btn rainbow-btn" onClick={() => { open("required"); }}>Посмотреть курсы <Glyph name="arrow"/></button>
              </section>
            </div>
          </section>
          <section className="catalog" id="bc-reference-catalog"><div className="catalog-tabs-bar"><div className="catalog-tabs" role="group" aria-label="Категории курсов">
            {([ ["role", "Для моей роли", roleCourses.length], ["all", "Все курсы", courses.length], ["in_progress", "В процессе", courses.filter(isInProgress).length], ["completed", "Завершённые", courses.filter((course) => course.completion_state === "verified").length] ] as const).map(([name, label, count]) =>
              <button className="tab-btn" aria-pressed={category === name} type="button" key={name} onClick={() => { setFilter("category", name); }}>{label}<b>{count}</b></button>)}
          </div><div className="view-toggle" role="group" aria-label="Вид каталога"><button type="button" className="view-button" aria-pressed={view === "card"} onClick={() => { setFilter("view", "card"); }}><Glyph name="grid"/> Карточки</button><button type="button" className="view-button" aria-pressed={view === "list"} onClick={() => { setFilter("view", "list"); }}><Glyph name="list"/> Список</button></div></div>
          <div className="catalog-filters"><label className="course-search"><Glyph name="search"/><input aria-label="Поиск по курсам" placeholder="Поиск по названию курса, навыку или технологии..." value={query} onChange={(event) => { setFilter("q", event.target.value); }}/></label>
            <label className="filter-select"><small>Направление</small><select aria-label="Направление" value={direction} onChange={(event) => { setFilter("direction", event.target.value); }}><option value="all">Все направления</option>{tracks.map((track) => <option value={track} key={track}>{track.replace(/[_-]/g, " ")}</option>)}</select></label>
            <label className="filter-select"><small>Уровень</small><select aria-label="Уровень сложности" disabled title="Уровни сложности появятся после публикации каталога версий"><option>Все уровни</option></select></label>
          </div>
          <div className="catalog-status" role="status">{query || direction !== "all" ? `Найдено курсов: ${String(filtered.length)}` : ""}</div>
          {filtered.length === 0 ? <div className="empty-state"><h3>По выбранным условиям курсов нет</h3><p>Измени запрос или сбрось фильтры.</p><button className="btn" type="button" onClick={reset}>Сбросить фильтры</button></div> : view === "card" ?
            <div className="course-grid">{shown.map((course) => <article className={`course-card bootcamp-course-card ${course.access_state === "prerequisite_not_met" ? "is-locked" : ""} ${course.must_take ? "is-required" : ""}`} data-testid={`course-${course.key}`} data-access={course.access_state} key={course.key}>
              <div className="badge-row"><Badge course={course}/>{course.relevant && available(course) && course.completion_state === "not_started" && <span className="status-chip available"><Glyph name="check"/> Доступен</span>}</div>
              <div className="course-info"><Tile title={course.title}/><div><h3>{course.title}</h3><p>{reason(course)}</p></div></div>
              <Skills course={course}/>
              {course.access_state !== "prerequisite_not_met" && <div className="course-meta"><span data-unknown-hours="true"><Glyph name="clock"/> Часы не указаны</span><span><Glyph name="bars"/> Уровень не указан</span></div>}
              <div className="course-bottom">
                {course.completion_state === "verified" && <span className="status-chip completed">Подтверждённое завершение</span>}
                {course.access_state === "prerequisite_not_met" ? <button type="button" className="locked-explainer" onClick={() => { courseAction(course); }}><Glyph name="lock"/> {course.access_note || "Условия доступа"}<Glyph name="chevron" /></button> :
                  <button type="button" className="btn" onClick={() => { courseAction(course); }}>{course.completion_state === "verified" ? "Посмотреть" : "Открыть курс"}<Glyph name="arrow"/></button>}
                {course.access_state !== "prerequisite_not_met" && <button type="button" className="text-link" onClick={() => { open("why", course.key); }}>Почему рекомендован? <Glyph name="chevron"/></button>}
              </div>
            </article>)}</div> :
            <div className="course-list" role="list" aria-label="Каталог Bootcamp списком">{shown.map((course) => <article className="course-row bootcamp-course-row" role="listitem" data-testid={`course-${course.key}`} data-access={course.access_state} key={course.key}>
              <Tile title={course.title}/><div className="row-title"><h3>{course.title}</h3><p>{reason(course)}</p></div>
              <div className="row-status"><Badge course={course}/><Skills course={course}/></div><div className="row-meta"><span><Glyph name="clock"/> Не указано</span><span><Glyph name="bars"/> —</span></div>
              <div className="row-progress"><div><span>Прогресс LMS</span><b>—</b></div><span className="track"><i style={{width:0}}/></span></div>
              <div className="row-actions"><button type="button" className="btn" onClick={() => { courseAction(course); }}>{course.access_state === "prerequisite_not_met" ? "Условия доступа" : "Открыть курс"} <Glyph name="arrow"/></button></div>
            </article>)}</div>}
          {shown.length < filtered.length && <button type="button" className="show-more" onClick={() => { setExpanded(true); }}>Показать ещё {filtered.length - shown.length} курса <Glyph name="chevron"/></button>}
          </section>
        </main>
      </div>
    </div>
    <div className="overlay" hidden={drawer === null}>
      <div className="overlay-scrim" onClick={close} />
      <section className="drawer" role="dialog" aria-modal="true" aria-label={drawer === "detail" ? "Информация о курсе" : drawer === "why" ? "Почему рекомендован" : drawer === "required" ? "Требования к обучению" : "Моя траектория"} tabIndex={-1} ref={drawerRef}>
        <header className="drawer-header"><span>{drawer === "detail" ? "Детали курса" : drawer === "why" ? "Почему рекомендован" : drawer === "required" ? "Обязательные курсы" : "Моя траектория"}</span><button className="icon-button close-button" type="button" onClick={close} aria-label="Закрыть"><Glyph name="close"/></button></header>
        <div className="drawer-scroll">
          {drawer === "detail" && selectedCourse && <div data-reference="BC-R03">
            <div className="drawer-hero"><span className="hero-emblem">✦</span><div className="badge-row"><Badge course={selectedCourse}/>{available(selectedCourse) && <span className="status-chip available">Доступен</span>}</div>
              <h2>{selectedCourse.title}</h2><p>{detail.data?.objective || reason(selectedCourse)}</p>
              <div className="drawer-facts"><span><Glyph name="clock"/>{detail.data?.workload_hours != null ? `${String(detail.data.workload_hours)} часов` : "Трудоёмкость не опубликована"}</span><span><Glyph name="book"/> Программа курса</span><span><Glyph name="bars"/> Доступ из каталога</span></div>
              <div className="drawer-cta">{available(selectedCourse) && <SafeExternalLink href={selectedCourse.source_url}>Открыть курс ↗</SafeExternalLink>}
                <button type="button" className="btn secondary" onClick={() => { open("why", selectedCourse.key); }}>Почему рекомендован</button></div>
            </div>
            <div className="drawer-tabs" role="tablist" aria-label="Информация о курсе">{([ ["about", "О курсе"], ["program", "Программа"], ["skills", "Навыки"], ["reviews", "Отзывы"] ] as const).map(([key, label]) =>
              <button type="button" className="drawer-tab" role="tab" key={key} aria-selected={drawerTab === key} onClick={() => { setDrawerTab(key); }}>{label}</button>)}</div>
            <div className="drawer-section" role="tabpanel">
              {drawerTab === "about" && <><h3>Почему этот курс важен для твоей роли</h3><div className="drawer-card"><p>{reason(selectedCourse)}</p></div>
                {detail.data?.next_step && <div className="drawer-card"><h4>Следующий этап</h4><p>{detail.data.next_step}</p></div>}
                <div className="proof-note">Прохождение курса не подтверждает уровень навыка автоматически. Итог определяется после проверки результата.</div></>}
              {drawerTab === "program" && <><h3>Программа курса</h3>{detail.isPending ? <p>Загружаем опубликованную программу…</p> :
                detail.data?.program_competencies.length ? detail.data.program_competencies.map((group, i) => <div className="step-line" key={group.join("-")}><span className="step-num">{i + 1}</span><b>{group.join(" · ")}</b></div>) :
                <p>Состав модулей ещё не опубликован в подключённом источнике.</p>}</>}
              {drawerTab === "skills" && <><h3>Какие навыки развивает курс</h3><div className="drawer-card"><Skills course={selectedCourse}/>
                {selectedCourse.must_take && <><p>Навык: {selectedCourse.must_take.skill}</p><p>Текущий уровень: {selectedCourse.must_take.current_level ?? "не подтверждён"}</p><p>Целевой уровень: {selectedCourse.must_take.target_level ?? "не опубликован"}</p></>}</div><div className="proof-note">Прогноз не является подтверждённым Skill Passport.</div></>}
              {drawerTab === "reviews" && <><h3>Отзывы</h3><p>Подтверждённых отзывов пока нет.</p></>}
              <div className="drawer-card"><h4>Подтверждение обучения</h4>
                {selectedCourse.completion_state === "verified" ? <>
                  <p>Курс подтверждён</p>{certificates.data?.find((c) => c.course_title === selectedCourse.title) ?
                    <a href={`/verify/${encodeURIComponent(certificates.data.find((c) => c.course_title === selectedCourse.title)?.verification_id ?? "")}`}>Открыть сертификат →</a> :
                    <button type="button" className="btn secondary" disabled={issueCertificate.isPending} onClick={() => { issueCertificate.mutate(selectedCourse.key); }}>Получить сертификат</button>}
                </> : selectedCourse.completion_state === "reported" ? <p>Завершение отправлено на проверку</p> :
                  <div className="drawer-cta"><button type="button" className="btn secondary" disabled={complete.isPending || !available(selectedCourse)} onClick={() => { complete.mutate(selectedCourse.key); }}>Отметить завершение</button>
                    <button type="button" className="btn secondary" disabled={learningDay.isPending || !available(selectedCourse)} onClick={() => { learningDay.mutate(selectedCourse.key); }}>Записать учебный день</button></div>}
                {selectedCourse.verified_evidence && <p>{selectedCourse.verified_evidence}</p>}
              </div>
            </div>
          </div>}
          {drawer === "why" && selectedCourse && <div className="drawer-section" data-reference="BC-R04"><div className="badge-row"><Badge course={selectedCourse}/></div><h3 style={{fontSize:22,margin:"7px 0 9px"}}>Почему рекомендован курс «{selectedCourse.title}»?</h3>
            <p>Рекомендация основана на текущей траектории и данных каталога. Она не гарантирует присвоения грейда.</p>
            {[reason(selectedCourse), ...selectedCourse.relevance_reasons].slice(0,4).map((item, i) => <div className="why-fact" key={`${String(i)}-${item}`}><span className="why-icon"><Glyph name={i === 0 ? "target" : i === 1 ? "bars" : "book"}/></span><div><h4>{["Связь с ролью", "Причина рекомендации", "Практический результат", "Учебные требования"][i]}</h4><p>{item}</p></div></div>)}
            <div className="drawer-card"><h4>Ожидаемое развитие навыков</h4><p>{selectedCourse.must_take?.projected_impact || "Расчёт влияния на навыки пока не опубликован"}</p>
              {selectedCourse.must_take && <p>{selectedCourse.must_take.current_level ?? "Уровень неизвестен"} → {selectedCourse.must_take.target_level ?? "Цель не опубликована"}</p>}</div>
            <div className="proof-note">Прогноз не равен подтверждённому уровню: только проверенное доказательство влияет на Skill Passport.</div><div style={{paddingTop:15}}><button className="btn" type="button" onClick={() => { open("detail", selectedCourse.key); }}>Открыть курс <Glyph name="arrow"/></button></div>
          </div>}
          {drawer === "required" && <div data-reference="BC-R05"><div className="drawer-hero"><div className="badge-row"><span className="status-chip recommended"><Glyph name="trophy"/> Учебные требования</span></div><h2>Обязательные курсы</h2>
            <p>Отмечены как обязательные в каталоге. Правила кадрового грейда и его присвоение определяются отдельно опубликованной политикой.</p></div>
            <div className="drawer-section"><h3>Что нужно завершить</h3><div className="drawer-card"><h4>Прогресс обязательных курсов каталога</h4><span>{courses.filter((c) => (role === "all" || c.track_keys.includes(role)) && c.must_take && c.completion_state === "verified").length} подтверждено из {courses.filter((c) => (role === "all" || c.track_keys.includes(role)) && c.must_take).length}</span>
              <span className="track"><i style={{width: `${String(courses.filter((c) => (role === "all" || c.track_keys.includes(role)) && c.must_take && c.completion_state === "verified").length / Math.max(1, courses.filter((c) => (role === "all" || c.track_keys.includes(role)) && c.must_take).length) * 100)}%`}} /></span></div>
              {courseRequired.length ? courseRequired.map((course) => <div className="requirement-course" key={course.key}><Tile title={course.title}/><div><strong>{course.title}</strong><small>{course.must_take?.skill}</small><p>{course.must_take?.explanation}</p></div><button type="button" className="btn" onClick={() => { open("detail", course.key); }}>Открыть курс <Glyph name="arrow"/></button></div>) : <p>Нет незавершённых обязательных курсов в текущем каталоге.</p>}
              <div className="proof-note">Завершение всех курсов само по себе не означает присвоение грейда.</div><button type="button" className="btn secondary" onClick={() => { switchNav("/workspace/1"); }}>Открыть мою траекторию <Glyph name="arrow"/></button>
            </div></div>}
          {drawer === "role" && <div className="drawer-hero"><div className="badge-row"><span className="status-chip recommended">Моя траектория</span></div><h2><RoleTitle track={role}/></h2><p>Уровень и подтверждённая матрица компетенций ещё не опубликованы для расчёта.</p><button type="button" className="btn" onClick={() => { switchNav("/workspace/1"); }}>Открыть траекторию <Glyph name="arrow"/></button></div>}
        </div>
      </section>
    </div>
    {props.honorBoardEnabled && props.honorBoardConsent && <div className="bc-missing-fact">Зал славы отображает только участников с отдельным согласием</div>}
    {notice && <div role="status" className="toast" onClick={() => { setNotice(null); }}>{notice}</div>}
  </div>;
}
