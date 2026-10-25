import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight, BookOpenText, BriefcaseBusiness, CircleHelp,
  Compass, GraduationCap, Layers3, MessageCircle, Rocket, Sparkles, Star, X,
} from "lucide-react";
import { shouldAutomaticallySuggest, type PersistedGuide } from "./participant-guide-data";
import { HELP_TOPICS } from "./participant-help-content";
import { ParticipantHelpCenter } from "./participant-help-center";
import { PROJECT_DETAIL_TOUR, SECTION_TOURS, TASK_DETAIL_TOUR, locatePopover, type GuideStep } from "./participant-tour-steps";
import "./participant-guide.scss";

type View = "closed" | "welcome" | "hint" | "walkthrough" | "complete" | "library";
type Place = { left: number; top: number; side: "left" | "right" | "top" | "bottom"; rect: { left: number; top: number; width: number; height: number } };
type Props = { personId: string; section: string; navigation: string[]; onNavigate: (index: number) => void };
const prefKey = (personId: string) => `impulse:guide:v1:${personId}`;
const sessionKey = (personId: string) => `impulse:guide:session:v1:${personId}`;
const welcomeKey = (personId: string) => `impulse:guide:welcome:v2:${personId}`;
const initialPrefs = (): PersistedGuide => ({ seen: [], lastAutoAt: 0, autoDisabled: false });
const fallbackStep: GuideStep = {
  title: "Осваивай Impulse в своём темпе",
  description: "Исследуй раздел и выбирай следующий полезный шаг. Необязательно изучать всё сразу.",
  anchor: ".workspace-content h1", accent: "cyan", symbol: "sparkles",
};

function readPrefs(personId: string): PersistedGuide {
  try {
    const value = JSON.parse(localStorage.getItem(prefKey(personId)) ?? "null") as Partial<PersistedGuide> | null;
    return {
      seen: Array.isArray(value?.seen) ? value.seen.filter((item): item is string => typeof item === "string") : [],
      lastAutoAt: typeof value?.lastAutoAt === "number" && Number.isFinite(value.lastAutoAt) ? value.lastAutoAt : 0,
      autoDisabled: value?.autoDisabled === true,
    };
  } catch { return initialPrefs(); }
}
function savePrefs(personId: string, value: PersistedGuide) {
  try { localStorage.setItem(prefKey(personId), JSON.stringify(value)); } catch { /* Optional local preference. */ }
}
function sessionShown(personId: string) {
  try { return sessionStorage.getItem(sessionKey(personId)) === "1"; } catch { return false; }
}
function markShown(personId: string) {
  try { sessionStorage.setItem(sessionKey(personId), "1"); } catch { /* Optional session preference. */ }
}
function hasSeenWelcome(personId: string) {
  try { return localStorage.getItem(welcomeKey(personId)) === "1"; } catch { return true; }
}
function markWelcome(personId: string) {
  try { localStorage.setItem(welcomeKey(personId), "1"); } catch { /* Optional local preference. */ }
}
function getStepAnchor(anchor: string, navigation: string[]): HTMLElement | null {
  const selectors = anchor.split(",").map((value) => value.trim());
  for (const selector of selectors) {
    if (selector.startsWith("nav:")) {
      const target = selector.slice(4);
      const index = navigation.indexOf(target);
      if (index < 0) continue;
      const node = document.querySelector<HTMLElement>(`.sidebar nav[aria-label="Навигация роли"] a[href="/workspace/${String(index)}"]`);
      if (node && node.getBoundingClientRect().width > 0) return node;
    } else {
      const node = document.querySelector<HTMLElement>(selector);
      if (node && node.getBoundingClientRect().width > 0) return node;
    }
  }
  return null;
}

function GuideIcon({ step }: { step: GuideStep }) {
  if (step.symbol === "rocket") return <Rocket size={20} />;
  if (step.symbol === "briefcase") return <BriefcaseBusiness size={20} />;
  if (step.symbol === "message") return <MessageCircle size={20} />;
  if (step.symbol === "star") return <Star size={20} />;
  if (step.symbol === "book") return <GraduationCap size={20} />;
  if (step.symbol === "compass") return <Compass size={20} />;
  if (step.symbol === "layers") return <Layers3 size={20} />;
  return <Sparkles size={20} />;
}
function Mascot() {
  return <div className="pg-mascot" aria-hidden="true">
    <div className="pg-mascot-halo" />
    <div className="pg-mascot-antenna" />
    <div className="pg-mascot-ear pg-mascot-ear--left" />
    <div className="pg-mascot-ear pg-mascot-ear--right" />
    <div className="pg-mascot-head">
      <div className="pg-mascot-face"><i /><i /><span /></div>
    </div>
    <div className="pg-mascot-neck" />
    <div className="pg-mascot-body"><span>◆</span></div>
    <div className="pg-mascot-hand">✦</div>
    <div className="pg-mascot-spark pg-mascot-spark--one">✦</div>
    <div className="pg-mascot-spark pg-mascot-spark--two">✧</div>
  </div>;
}

export function ParticipantGuide({ personId, section, navigation, onNavigate }: Props) {
  const [view, setView] = useState<View>("closed");
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedHelpTopic, setSelectedHelpTopic] = useState<string | null>(null);
  const [context, setContext] = useState<"default" | "task-detail" | "project-detail">("default");
  const [preferences, setPreferences] = useState<PersistedGuide>(() => readPrefs(personId));
  const [place, setPlace] = useState<Place | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const list = context === "task-detail" && section === "Задачи" ? TASK_DETAIL_TOUR : context === "project-detail" && section === "Мои проекты" ? PROJECT_DETAIL_TOUR : SECTION_TOURS[section] ?? [fallbackStep];
  const step = list[Math.min(stepIndex, list.length - 1)] ?? fallbackStep;
  const showTip = view === "hint" || view === "walkthrough";
  const destinationIndex = navigation.indexOf("Задачи");
  const isHome = section === "Главная";

  const close = useCallback(() => { setView("closed"); setPlace(null); setSelectedHelpTopic(null); }, []);
  const openLibrary = useCallback((topicId: string | null = null) => { setSelectedHelpTopic(topicId); setPlace(null); setView("library"); }, []);
  const pickContext = useCallback(() => {
    if (section === "Задачи" && document.querySelector(".catalog-v2-detail")) return "task-detail";
    if (section === "Мои проекты" && document.querySelector(".mp-detail")) return "project-detail";
    return "default";
  }, [section]);
  const rememberAuto = useCallback((name: string) => {
    const old = readPrefs(personId);
    const next = { ...old, seen: [...new Set([...old.seen, name])], lastAutoAt: Date.now() };
    savePrefs(personId, next);
    markShown(personId);
    setPreferences(next);
  }, [personId]);

  useEffect(() => {
    setPreferences(readPrefs(personId));
    close();
  }, [personId, close]);
  useEffect(() => {
    close();
    setStepIndex(0);
    setContext("default");
    const timeout = window.setTimeout(() => {
      if (!shouldAutomaticallySuggest(readPrefs(personId), section, Date.now(), sessionShown(personId))) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      rememberAuto(section);
      setContext(pickContext());
      if (isHome && !hasSeenWelcome(personId)) {
        markWelcome(personId);
        setView("welcome");
      } else {
        setView("hint");
      }
    }, 2000);
    return () => { window.clearTimeout(timeout); };
  }, [section, personId, isHome, close, rememberAuto, pickContext]);

  const startManually = () => {
    if (view !== "closed") { close(); return; }
    const old = readPrefs(personId);
    const next = { ...old, seen: [...new Set([...old.seen, section])] };
    savePrefs(personId, next);
    setPreferences(next);
    setStepIndex(0);
    setContext(pickContext());
    if (isHome && !hasSeenWelcome(personId)) {
      markWelcome(personId);
      setView("welcome");
    } else {
      setView("walkthrough");
    }
  };
  useEffect(() => {
    const toggle = () => { startManually(); };
    const openFull = () => { openLibrary(); };
    const openTopic = (event: Event) => {
      const detail = (event as CustomEvent<{ topicId?: string }>).detail;
      const id = detail?.topicId;
      if (id && HELP_TOPICS.some((topic) => topic.id === id)) openLibrary(id);
    };
    window.addEventListener("impulse:guide:toggle", toggle);
    window.addEventListener("impulse:guide:library", openFull);
    window.addEventListener("impulse:guide:topic", openTopic);
    return () => {
      window.removeEventListener("impulse:guide:toggle", toggle);
      window.removeEventListener("impulse:guide:library", openFull);
      window.removeEventListener("impulse:guide:topic", openTopic);
    };
  });
  const disableAuto = () => {
    const next = { ...readPrefs(personId), autoDisabled: true };
    savePrefs(personId, next);
    setPreferences(next);
    close();
  };
  const enableAuto = () => {
    const next = { ...readPrefs(personId), autoDisabled: false };
    savePrefs(personId, next);
    setPreferences(next);
  };
  const next = () => {
    if (view === "welcome") {
      setStepIndex(1);
      setView("walkthrough");
      return;
    }
    if (view === "hint") {
      if (list.length > 1) { setStepIndex(1); setView("walkthrough"); }
      else close();
      return;
    }
    if (stepIndex < list.length - 1) { setStepIndex((old) => old + 1); }
    else { setPlace(null); setView("complete"); }
  };
  const previous = () => {
    if (stepIndex > 0) setStepIndex((old) => old - 1);
    else if (isHome && view === "walkthrough") setView("welcome");
    else close();
  };

  // Do not capture or block clicks on the underlying page: the outline is purely visual.
  useEffect(() => {
    if (!showTip) { setPlace(null); return; }
    const anchor = getStepAnchor(step.anchor, navigation);
    if (!anchor) { setPlace(null); return; }
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(290, window.innerWidth - 24);
      const height = Math.max(170, cardRef.current?.getBoundingClientRect().height ?? 207);
      const coords = locatePopover(rect, { width, height }, { width: window.innerWidth, height: window.innerHeight });
      setPlace({ ...coords, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } });
    };
    update();
    const frame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [showTip, step.anchor, section, stepIndex, navigation]);

  useEffect(() => {
    if (view === "closed") return;
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const outside = (event: PointerEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) close();
    };
    document.addEventListener("keydown", keyDown);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", keyDown); document.removeEventListener("pointerdown", outside); };
  }, [view, close]);

  return <div className="participant-guide" ref={rootRef} data-testid="participant-guide">
    {view === "welcome" && <div className="pg-modal-layer">
      <div className="pg-modal-scrim" onClick={close} aria-hidden="true" />
      <section className="pg-welcome" role="dialog" aria-modal="true" aria-labelledby="pg-welcome-title">
        <button type="button" className="pg-welcome-x" aria-label="Закрыть подсказку" onClick={close}><X size={19} /></button>
        <span className="pg-welcome-brand">Impulse <Sparkles size={14} /></span>
        <Mascot />
        <h2 id="pg-welcome-title">Добро пожаловать<br />в Impulse!</h2>
        <p>Здесь ты развиваешь навыки, решаешь реальные задачи от компаний и собираешь портфолио своих работ.</p>
        <div className="pg-welcome-benefits">
          <div><span className="is-turquoise"><BriefcaseBusiness size={20}/></span><strong>Реальные задачи</strong></div>
          <div><span className="is-gold"><GraduationCap size={20}/></span><strong>Обучение и развитие</strong></div>
          <div><span className="is-blue"><Layers3 size={20}/></span><strong>Портфолио и навыки</strong></div>
          <div><span className="is-purple"><Sparkles size={20}/></span><strong>Новые возможности</strong></div>
        </div>
        <footer className="pg-welcome-footer">
          <button type="button" className="pg-quiet-button" onClick={close}>Пропустить</button>
          <div className="pg-dots" aria-label="Шаг 1 из 4"><i className="is-active"/><i/><i/><i/></div>
          <button type="button" className="pg-primary-button" onClick={next}>Далее <ArrowRight size={16}/></button>
        </footer>
      </section>
    </div>}
    {showTip && <>
      {place && <div className="pg-highlight" aria-hidden="true" style={{
        left: place.rect.left - 4, top: place.rect.top - 4,
        width: place.rect.width + 8, height: place.rect.height + 8,
      }} />}
      <section
        id="participant-guide-panel" ref={cardRef}
        className={`participant-guide-card pg-coachmark pg-coachmark--${step.accent} pg-coachmark--${place?.side ?? "floating"}`}
        style={place ? { left: place.left, top: place.top } : undefined}
        aria-labelledby="participant-guide-title" aria-describedby="participant-guide-description"
      >
        <div className="pg-tip-top">
          <span className="pg-tip-icon"><GuideIcon step={step}/></span>
          <span className="pg-tip-eyebrow">ПОДСКАЗКА IMPULSE</span>
          <button type="button" className="participant-guide-close" aria-label="Закрыть подсказку" onClick={close}><X size={15}/></button>
        </div>
        <h2 id="participant-guide-title">{step.title}</h2>
        <p id="participant-guide-description">{step.description}</p>
        <div className="pg-tip-bottom">
          <span className="pg-tip-count">{stepIndex + 1} / {list.length}</span>
          <div className="pg-tip-controls">
            {view === "walkthrough" && stepIndex > 0 && <button type="button" className="pg-back" onClick={previous}>Назад</button>}
            <button type="button" className="pg-next" onClick={view === "hint" && list.length === 1 ? close : next}>
              {view === "hint" && list.length === 1 ? "Понятно" : stepIndex === list.length - 1 && view === "walkthrough" ? "Готово" : "Далее"} <ArrowRight size={14}/>
            </button>
          </div>
        </div>
        <div className="pg-tip-footer">
          <button type="button" className="pg-tip-library" onClick={() => { openLibrary(step.topicId ?? null); }}><BookOpenText size={13}/> Подробная помощь</button>
          <button type="button" onClick={close}>Не сейчас</button>
          <button type="button" onClick={preferences.autoDisabled ? enableAuto : disableAuto}>
            {preferences.autoDisabled ? "Включить автоподсказки" : "Не показывать автоматически"}
          </button>
        </div>
      </section>
    </>}
    {view === "complete" && <div className="pg-modal-layer">
      <div className="pg-modal-scrim" onClick={close} aria-hidden="true"/>
      <section className="pg-complete" role="dialog" aria-modal="true" aria-labelledby="pg-complete-title">
        <button type="button" className="pg-welcome-x" aria-label="Закрыть подсказку" onClick={close}><X size={18}/></button>
        <Mascot />
        <h2 id="pg-complete-title">Ты готов к старту!</h2>
        <p>Теперь ты знаешь, как устроен этот раздел. Выбирай следующий шаг — вернуться к подсказкам можно в любой момент.</p>
        <button type="button" className="pg-primary-button" onClick={() => { close(); if (isHome && destinationIndex >= 0) onNavigate(destinationIndex); }}>{isHome ? "К интересным задачам" : "Вернуться к работе"} <ArrowRight size={15}/></button>
        <button type="button" className="pg-quiet-button" onClick={() => { setStepIndex(0); setView("walkthrough"); }}>Показать подсказки ещё раз</button>
      </section>
    </div>}
    {view === "library" && <ParticipantHelpCenter section={section} initialTopicId={selectedHelpTopic} onClose={close}
      onOpenTour={() => { setView("walkthrough"); setStepIndex(0); setContext(pickContext()); }}
      onNavigateSection={(name) => { const target = navigation.indexOf(name); if (target >= 0) onNavigate(target); }} />}
    <button type="button" className="participant-guide-trigger" aria-expanded={view !== "closed"}
      aria-controls={showTip ? "participant-guide-panel" : undefined}
      aria-label={view === "closed" ? "Как здесь всё устроено?" : "Скрыть помощь"}
      title="Как здесь всё устроено?" onClick={startManually}>
      {view === "closed" ? <CircleHelp size={21}/> : <BookOpenText size={19}/>}
      <span>{view === "closed" ? "Как здесь всё устроено?" : "Скрыть помощь"}</span>
    </button>
  </div>;
}
