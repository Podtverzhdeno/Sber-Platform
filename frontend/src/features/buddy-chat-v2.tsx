
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, BarChart3, BookOpen, Bot, Check, CheckCircle2, ChevronRight,
  ClipboardList, Code2, Download, FileDown, FileText, FolderKanban,
  GraduationCap, Info, Lightbulb, MessageCircle, Paperclip, Plus, Send,
  ShieldCheck, Sparkles, Trash2, WandSparkles, X,
} from "lucide-react";

import { apiRequest, type RuntimeApiPath } from "../api/client";
import { selectOwnPublishedStanding, useOwnPublishedStandings, type PublishedSeasonRef } from "./rating-v2/own-standing";
import {
  activeBuddyProjects, completedStudyCourses, countConfirmedSkills,
  loadBuddyAnalytics, loadBuddyJourney, loadBuddyPassport,
  normalizeNextAction,
} from "./buddy-live-data";
import "./buddy-chat-v2.scss";

type BuddyProfile = { person_id: string; display_name: string; primary_track: string };
type ServerMessage = { id: string; client_message_id: string; role: string; content: string };
type Thread = { id: string; status: string; messages: ServerMessage[]; content_deleted: boolean };
type Dialogue = { id: string; title: string; updated: string };
type Course = {
  key: string; title: string; recommendation_reason: string;
  availability: string; source_url: string; access_note: string;
  completion_status: string | null;
};
type Suggestion = {
  suggestion: {
    observation: string; gap: string; benefit: string; explanation: string;
    action: { title: string; canonical_path: string; available: boolean; target_kind: string } | null;
  } | null;
};
type Props = { profile: BuddyProfile; navigation?: string[] };

const promptActions = [
  { icon: Lightbulb, title: "Что делать дальше?", text: "Что делать дальше по моей траектории?" },
  { icon: Code2, title: "Разбери задачу", text: "Помоги разобраться с моей текущей задачей" },
  { icon: BookOpen, title: "Подбери курс", text: "Подбери курс по моему направлению" },
  { icon: BarChart3, title: "Моя аналитика", text: "Как оценить мой прогресс?" },
  { icon: ClipboardList, title: "Составь план", text: "Помоги составить план на неделю" },
];
const csrf = () => ({ "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" });
const threadPath = (id: string) => ("/api/v1/agents/buddy/threads/" + id) as RuntimeApiPath;
const isDialogue = (value: unknown): value is Dialogue => {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === "string" && /^[a-f0-9-]{36}$/i.test(entry.id)
    && typeof entry.title === "string" && typeof entry.updated === "string";
};
const readDialogues = (person: string): Dialogue[] => {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem("impulse-buddy-dialogues:" + person) ?? "[]");
    if (!Array.isArray(raw)) return [];
    const entries: unknown[] = raw as unknown[];
    return entries.filter(isDialogue).slice(0, 30);
  } catch { return []; }
};
const saveDialogues = (person: string, next: Dialogue[]) => {
  try { localStorage.setItem("impulse-buddy-dialogues:" + person, JSON.stringify(next.slice(0, 30))); }
  catch { /* Browsers may block optional local history. Server thread is authoritative. */ }
};
function downloadChecklist(course: Course | null) {
  const heading = course ? course.title : "План работы с API";
  const lines = [
    "# Чек-лист: " + heading,
    "",
    "Шаблон, созданный в интерфейсе Impulse. Это не загруженный файл пользователя.",
    "",
    "- [ ] Сформулировать ожидаемый результат",
    "- [ ] Описать входные данные и ограничения",
    "- [ ] Разбить задачу на проверяемые шаги",
    "- [ ] Реализовать первый работающий сценарий",
    "- [ ] Проверить ошибки и пограничные случаи",
    "- [ ] Сохранить артефакт и инструкцию запуска",
    "- [ ] Подготовить результат для проверки",
    "",
    course ? "Рекомендованный материал: " + course.title : "",
    course ? "Ссылка: " + course.source_url : "",
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" }));
  const node = document.createElement("a");
  node.href = url;
  node.download = "impulse-checklist.md";
  document.body.appendChild(node);
  node.click();
  node.remove();
  URL.revokeObjectURL(url);
}
function formattedDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
export function BuddyChatV2({ profile, navigation = [] }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogues, setDialogues] = useState<Dialogue[]>(() => readDialogues(profile.person_id));
  const [activeId, setActiveId] = useState<string | null>(() => readDialogues(profile.person_id)[0]?.id ?? null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [heroDismissed, setHeroDismissed] = useState(() => {
    try { return sessionStorage.getItem("impulse-buddy-hero-dismissed:" + profile.person_id) === "1"; }
    catch { return false; }
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);
  const thread = useQuery({
    queryKey: ["buddy-thread", profile.person_id, activeId],
    queryFn: () => apiRequest<Thread>(threadPath(activeId ?? "")),
    enabled: Boolean(activeId),
    retry: false,
    refetchOnMount: "always",
  });
  const courses = useQuery({
    queryKey: ["buddy-course-recommendations"],
    queryFn: () => apiRequest<Course[]>("/api/v1/development/courses"),
    retry: false,
  });
  const suggestion = useQuery({
    queryKey: ["buddy-next-suggestion"],
    queryFn: () => apiRequest<Suggestion>("/api/v1/agents/buddy/suggestion"),
    retry: false,
  });
  // These read models are all owner-scoped, kept separate from public leaderboards.
  // Every query key includes person_id, so switching personas never reuses a
  // private projection. Existing progress mutations invalidate these prefixes.
  const journey = useQuery({
    queryKey: ["development-overview", "buddy-journey", profile.person_id],
    queryFn: loadBuddyJourney,
    retry: false,
  });
  const passport = useQuery({
    queryKey: ["talent-passport", "buddy", profile.person_id],
    queryFn: loadBuddyPassport,
    retry: false,
  });
  const publishedSeasons = useQuery({
    queryKey: ["rating-seasons"],
    queryFn: () => apiRequest<PublishedSeasonRef[]>("/api/v1/rating-seasons", { cache: "no-store" }),
    retry: false,
  });
  // Reuse the exact owner-scoped cache and version guard of the TopbarRank.
  const personalRank = useOwnPublishedStandings(profile.person_id);
  const analytics = useQuery({
    queryKey: ["participant-analytics", "buddy", profile.person_id],
    queryFn: loadBuddyAnalytics,
    retry: false,
  });
  const visibleCourses = useMemo(() =>
    (courses.data ?? []).filter(course => course.availability === "available").slice(0, 2),
  [courses.data]);
  const learningFacts = journey.data && journey.data.person_id === profile.person_id
    ? journey.data
    : null;
  const finishedCourses = learningFacts ? completedStudyCourses(learningFacts) : [];
  const activeProjects = learningFacts ? activeBuddyProjects(learningFacts) : [];
  const verifiedSkills = passport.data?.person_id === profile.person_id
    ? countConfirmedSkills(passport.data)
    : null;
  const ownPlace = selectOwnPublishedStanding(personalRank.data, publishedSeasons.data?.[0])?.place ?? null;
  const nextAction = normalizeNextAction(analytics.data);
  const selected = visibleCourses[0] ?? null;
  const messages = thread.data?.messages ?? [];
  const hasChat = messages.length > 0;
  const canSend = Boolean(draft.trim()) && !busy && (!activeId || thread.data?.status !== "cancelled");
  useEffect(() => {
    if (!activeId || !thread.isError) return;
    setNotice("Не удалось загрузить диалог. Можно открыть другой или начать новый.");
  }, [thread.isError, activeId]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, activeId]);

  const saveIndex = (items: Dialogue[]) => {
    const next = items.slice(0, 30);
    setDialogues(next);
    saveDialogues(profile.person_id, next);
  };
  const navigateSection = (name: string, search = "") => {
    const index = navigation.indexOf(name);
    if (index < 0) { setNotice("Раздел «" + name + "» не доступен для этой роли."); return; }
    void navigate("/workspace/" + String(index) + search);
  };
  const dismissHero = () => {
    setHeroDismissed(true);
    try { sessionStorage.setItem("impulse-buddy-hero-dismissed:" + profile.person_id, "1"); }
    catch { /* The banner remains closed for this component even if storage is blocked. */ }
  };
  const newChat = async () => {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      // Create the server-authoritative thread now, not only after the first message.
      const created = await apiRequest<Thread>("/api/v1/agents/buddy/threads", {
        method: "POST", headers: csrf(),
      });
      if (!created.id || created.status !== "active") throw new Error("Invalid new Buddy thread");
      queryClient.setQueryData(["buddy-thread", profile.person_id, created.id], created);
      saveIndex([
        { id: created.id, title: "Новый диалог", updated: new Date().toISOString() },
        ...dialogues.filter(item => item.id !== created.id),
      ]);
      setActiveId(created.id);
      setDraft("");
      composerRef.current?.focus();
    } catch {
      setNotice("Не удалось создать новый диалог. Повторите попытку.");
    } finally {
      setBusy(false);
    }
  };
  const send = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;
    setBusy(true);
    setNotice("");
    try {
      let id = activeId;
      if (!id || thread.data?.status === "cancelled") {
        const created = await apiRequest<Thread>("/api/v1/agents/buddy/threads", {
          method: "POST", headers: csrf(),
        });
        id = created.id;
        setActiveId(id);
      }
      await apiRequest<ServerMessage>(threadPath(id) .concat("/messages") as RuntimeApiPath, {
        method: "POST",
        headers: csrf(),
        body: JSON.stringify({ client_message_id: crypto.randomUUID(), content }),
      });
      const next = [
        { id, title: content.slice(0, 44), updated: new Date().toISOString() },
        ...dialogues.filter(dialogue => dialogue.id !== id),
      ];
      saveIndex(next);
      setDraft("");
      await queryClient.invalidateQueries({ queryKey: ["buddy-thread", profile.person_id, id] });
      setNotice("Сообщение сохранено. Автоматическая генерация ответов пока не подключена; ниже доступны материалы из каталога платформы.");
    } catch {
      setNotice("Сообщение не отправлено. Текст сохранён в поле ввода — повторите попытку.");
    } finally { setBusy(false); }
  };
  const cancelDialog = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await apiRequest<Thread>(threadPath(id).concat("/cancel") as RuntimeApiPath, { method: "POST", headers: csrf() });
      saveIndex(dialogues.filter(item => item.id !== id));
      if (activeId === id) setActiveId(null);
      await queryClient.invalidateQueries({ queryKey: ["buddy-thread", profile.person_id, id] });
      setNotice("Диалог завершён. Сообщения остаются на сервере согласно настройкам хранения.");
    } catch { setNotice("Не удалось завершить диалог."); }
    finally { setBusy(false); }
  };
  const quickSend = (value: string) => {
    setDraft(value);
    setNotice("");
  };

  return <div className="buddy2" data-testid="buddy-chat-v2">
    <aside className="buddy2-sidebar" aria-label="Диалоги AI-Buddy">
      <div className="buddy2-sidehead">
        <div className="buddy2-bot-logo"><Bot size={24}/></div>
        <div><h2>AI-Buddy <span>Бета</span></h2><p>Твой помощник в Impulse</p></div>
      </div>
      <button type="button" className="buddy2-new" disabled={busy} onClick={() => { void newChat(); }}><Plus size={19}/> Новый диалог</button>
      <div className="buddy2-history-head"><span>Недавние диалоги</span><small>{dialogues.length}</small></div>
      <div className="buddy2-dialogs">
        {dialogues.slice(0, showMore ? 30 : 7).map(item =>
          <div key={item.id} className={"buddy2-dialog " + (activeId === item.id ? "active" : "")}>
            <button type="button" className="buddy2-dialog-open" onClick={() => {setActiveId(item.id);setNotice("");}}>
              <MessageCircle size={17}/><span><strong>{item.title}</strong><small>{formattedDate(item.updated)}</small></span>
            </button>
            <button type="button" className="buddy2-dialog-remove" aria-label={"Завершить диалог: " + item.title} title="Завершить диалог" onClick={() => {void cancelDialog(item.id);}}><Trash2 size={15}/></button>
          </div>
        )}
        {dialogues.length===0&&<p className="buddy2-history-empty">После первого сообщения здесь появится история переписки</p>}
      </div>
      {dialogues.length>7&&<button type="button" className="buddy2-show-more" onClick={() => {setShowMore(!showMore);}}>{showMore?"Свернуть":"Показать все диалоги"} <ChevronRight size={16}/></button>}
      <div className="buddy2-sidebottom">
        <div className="buddy2-sideicon"><ShieldCheck size={19}/></div>
        <strong>Ваши данные под контролем</strong>
        <p>История сохраняется в профиле на сервере. AI-Buddy не меняет оценку и не записывает вас на курсы без согласия.</p>
      </div>
    </aside>
    <div className="buddy2-main">
      {!heroDismissed && <header className="buddy2-hero">
        <button type="button" className="buddy2-hero-close" aria-label="Закрыть баннер AI-Buddy" title="Закрыть баннер" onClick={dismissHero}><X size={16}/></button>
        <div className="buddy2-robot" aria-hidden="true"><div className="buddy2-antenna"/><div className="buddy2-robot-face"><i/><i/></div><div className="buddy2-robot-body"><Sparkles size={24}/></div></div>
        <div className="buddy2-hero-content">
          <span className="buddy2-overline">ПЕРСОНАЛЬНЫЙ ПОМОЩНИК · IMPULSE</span>
          <h1 id="workspace-title">Привет, я AI-Buddy! <span>✦</span></h1>
          <p>Помогаю разбираться в задачах, находить курсы и строить траекторию развития. Все ссылки ведут к материалам платформы.</p>
          <div className="buddy2-prompt-row">{promptActions.map(action=>{const Icon=action.icon;return <button type="button" key={action.title} onClick={()=>{quickSend(action.text);}}><Icon size={15}/>{action.title}</button>;})}</div>
        </div>
      </header>}
      <div className="buddy2-scroll" ref={scrollRef}>
        {activeId && !hasChat ? <div className="buddy2-empty-chat" role="status">
          <span className="buddy2-empty-chat-icon"><MessageCircle size={24}/></span>
          <strong>Новый диалог</strong>
          <p>Начните разговор: напишите вопрос или выберите подсказку выше. Сообщения этого диалога сохраняются отдельно.</p>
        </div> : !hasChat ? <div className="buddy2-demo" aria-label="Пример взаимодействия">
          <div className="buddy2-demo-tag"><WandSparkles size={14}/> Пример возможностей · не реальный ответ модели</div>
          <div className="buddy2-example-user"><span>Как научиться интеграции с API и что изучать дальше?</span><div className="buddy2-avatar-user">Вы</div></div>
          <div className="buddy2-message buddy2-message-ai"><span className="buddy2-avatar"><Bot size={20}/></span><div className="buddy2-bubble">
            <strong>Материалы, с которыми можно начать</strong>
            <p>Разбей интеграцию на этапы: запросы, авторизация, обработка ошибок, повторные попытки и тесты. Ниже — доступные материалы, шаблон чек-листа и переходы к твоей аналитике.</p>
          </div></div>
        </div> : <div className="buddy2-real-messages">{messages.map(message=>
          <article key={message.id} className={"buddy2-message " + (message.role === "user"?"buddy2-message-user":"buddy2-message-ai")}>
            <span className={"buddy2-avatar " + (message.role === "user"?"buddy2-avatar-person":"")} >{message.role === "user" ? "Вы" : <Bot size={20}/>}</span>
            <div className="buddy2-bubble"><p>{message.content}</p></div>
          </article>
        )}</div>}
        <div className="buddy2-assets">
          <section className="buddy2-live" aria-label="Данные моего прогресса" data-testid="buddy-live-context">
            <div className="buddy2-section-label"><ShieldCheck size={17}/> Мой прогресс <small>Сохранённые результаты платформы</small></div>
            {journey.isPending && <p className="buddy2-live-note" role="status">Загружаем реальные результаты…</p>}
            {!journey.isPending && !learningFacts && <div className="buddy2-live-unavailable" role="status">
              Не удалось получить общий снимок прогресса. Результаты не заменяются демонстрационными данными.
              <button type="button" onClick={() => { void journey.refetch(); }}>Повторить</button>
            </div>}
            {learningFacts && <>
              <div className="buddy2-live-metrics">
                <div><strong data-testid="buddy-finished-count">{finishedCourses.length}</strong><span>Курсов завершено самостоятельно</span></div>
                <div><strong data-testid="buddy-accepted-count">{learningFacts.accepted_case_count}</strong><span>Принятых личных кейсов</span></div>
                <div><strong data-testid="buddy-skills-count">{verifiedSkills ?? "—"}</strong><span>Практически подтверждённых навыков</span></div>
                <div><strong data-testid="buddy-rank">{ownPlace ?? "—"}</strong><span>Место в опубликованном рейтинге</span></div>
              </div>
              <div className="buddy2-live-results">
                <div className="buddy2-live-result">
                  <span className="buddy2-live-heading"><BookOpen size={15}/> Обучение</span>
                  {finishedCourses.length > 0 ? finishedCourses.slice(0, 2).map(course =>
                    <div className="buddy2-live-record" key={course.course_key}>
                      <span><strong>{course.title}</strong><small>Самостоятельно пройден · не подтверждённый навык</small></span>
                      <button type="button" aria-label={"Открыть курс " + course.title} onClick={() => { navigateSection("Bootcamp", "?course=" + encodeURIComponent(course.course_key)); }}><ArrowRight size={15}/></button>
                    </div>,
                  ) : <p className="buddy2-live-empty">Завершённых курсов пока нет</p>}
                </div>
                <div className="buddy2-live-result">
                  <span className="buddy2-live-heading"><FolderKanban size={15}/> Мои проекты</span>
                  {activeProjects.length > 0 ? activeProjects.slice(0, 2).map(project =>
                    <div className="buddy2-live-record" key={project.assignment_id}>
                      <span><strong>{project.title}</strong><small>{project.accepted_contribution_ids.length > 0 ? "Принятых вкладов: " + String(project.accepted_contribution_ids.length) : "В работе · вклад ещё не подтверждён"}</small></span>
                      <button type="button" aria-label={"Открыть проект " + project.title} onClick={() => { navigateSection(navigation.includes("Мои проекты") ? "Мои проекты" : "Проекты"); }}><ArrowRight size={15}/></button>
                    </div>,
                  ) : <p className="buddy2-live-empty">Назначенных активных проектов пока нет</p>}
                </div>
              </div>
              {nextAction && <p className="buddy2-live-note">Следующее действие из аналитики: <strong>{nextAction}</strong></p>}
              {(passport.isError || personalRank.isError || publishedSeasons.isError || analytics.isError) && <p className="buddy2-live-note" role="status">Некоторые связанные данные временно недоступны. Показаны только полученные подтверждённые значения.</p>}
            </>}
          </section>
          <div className="buddy2-section-label"><FileText size={17}/> Полезные материалы <small>Из каталога Impulse</small></div>
          <div className="buddy2-file-grid">
            <article className="buddy2-file"><span className="buddy2-file-icon"><FileDown size={26}/></span><div><strong>Чек-лист разработки</strong><small>Шаблон · Markdown</small></div><button type="button" aria-label="Скачать чек-лист" title="Скачать чек-лист" onClick={()=>{downloadChecklist(selected);}}><Download size={20}/></button></article>
            <article className="buddy2-file"><span className="buddy2-file-icon buddy2-file-blue"><BookOpen size={26}/></span><div><strong>Курсы и практикумы</strong><small>Внутренний каталог Bootcamp</small></div><button type="button" title="Перейти в Bootcamp" aria-label="Открыть каталог Bootcamp" onClick={()=>{navigateSection("Bootcamp");}}><ArrowRight size={20}/></button></article>
          </div>
          <div className="buddy2-section-label"><GraduationCap size={17}/> Рекомендованные курсы <small>По доступным данным</small></div>
          <div className="buddy2-course-grid">
            {visibleCourses.map((course,index)=><article key={course.key} className="buddy2-course">
              <div className={"buddy2-course-visual buddy2-course-visual-"+String(index)}><Code2 size={35}/></div>
              <div className="buddy2-course-copy"><small>{course.completion_status==="verified"?"Пройден":"Доступен в Bootcamp"}</small><strong>{course.title}</strong><p>{course.recommendation_reason}</p>
                <button type="button" onClick={()=>{navigateSection("Bootcamp","?course="+encodeURIComponent(course.key));}}>Открыть курс <ArrowRight size={15}/></button></div>
            </article>)}
            {visibleCourses.length===0&&<div className="buddy2-no-courses">{courses.isPending?"Загружаем курсы…":"Доступные курсы не найдены. Можно открыть полный каталог Bootcamp."}<button type="button" onClick={()=>{navigateSection("Bootcamp");}}>Каталог курсов <ArrowRight size={15}/></button></div>}
          </div>
          <div className="buddy2-section-label"><BarChart3 size={17}/> Траектория и аналитика <small>Реальные данные профиля</small></div>
          <div className="buddy2-analysis-grid">
            <button type="button" onClick={()=>{navigateSection("Аналитика");}}><span className="buddy2-analysis-icon"><BarChart3 size={21}/></span><span><strong>Моя аналитика</strong><small>Активность, навыки и сертификаты</small></span><ArrowRight size={17}/></button>
            <button type="button" onClick={()=>{navigateSection("Моя траектория");}}><span className="buddy2-analysis-icon"><FolderKanban size={21}/></span><span><strong>Следующий шаг</strong><small>{suggestion.data?.suggestion?.action?.title ?? "Открой маршрут и задачи"}</small></span><ArrowRight size={17}/></button>
          </div>
          {suggestion.data?.suggestion?.observation&&<div className="buddy2-grounding"><CheckCircle2 size={17}/><span>По данным маршрута: {suggestion.data.suggestion.observation}</span></div>}
        </div>
      </div>
      <div className="buddy2-bottom">
        {notice&&<p className="buddy2-notice" role="status"><Info size={15}/>{notice}</p>}
        {thread.isPending&&activeId&&<p className="buddy2-notice">Загружаем сохранённую переписку…</p>}
        <form onSubmit={(event)=>{void send(event);}} className="buddy2-composer">
          <button type="button" className="buddy2-attach" title="Скачать шаблон чек-листа" aria-label="Скачать шаблон" onClick={()=>{downloadChecklist(selected);}}><Paperclip size={20}/></button>
          <input ref={composerRef} value={draft} onChange={event=>{setDraft(event.target.value);}} maxLength={8000} aria-label="Сообщение AI-Buddy" placeholder="Напишите сообщение или задайте вопрос…" />
          <button type="submit" className="buddy2-send" disabled={!canSend} aria-label="Отправить сообщение">{busy?"…":<Send size={19}/>}</button>
        </form>
        <div className="buddy2-composer-note"><span><Check size={12}/> Переписка сохраняется</span><span>Подборки формируются из материалов платформы; генерация ответов ещё не активна</span></div>
      </div>
    </div>
  </div>;
}
