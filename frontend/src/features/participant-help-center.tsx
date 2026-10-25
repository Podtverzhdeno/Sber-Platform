import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpenText, CheckCircle2, CircleHelp, Compass, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { HELP_CATEGORIES, HELP_TOPICS, searchHelpTopics, topicsForSection, type HelpCategory } from "./participant-help-content";

type Props = { section: string; initialTopicId: string | null; onClose: () => void; onOpenTour: () => void; onNavigateSection?: (section: string) => void };
export function ParticipantHelpCenter({ section, initialTopicId, onClose, onOpenTour, onNavigateSection }: Props) {
  const [category, setCategory] = useState<"related" | "all" | HelpCategory>(initialTopicId ? "all" : "related");
  const [query, setQuery] = useState("");
  const [topicId, setTopicId] = useState<string | null>(initialTopicId);
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (searchRef.current) searchRef.current.focus();
    else dialogRef.current?.focus();
    return () => { previousFocus.current?.focus(); };
  }, []);
  const topics = useMemo(() => {
    const matches = searchHelpTopics(query, category === "related" ? section : undefined);
    return category === "all" || category === "related" ? matches : matches.filter((item) => item.category === category);
  }, [category, query, section]);
  const selected = HELP_TOPICS.find((topic) => topic.id === topicId) ?? null;
  const relatedCount = topicsForSection(section).length;
  return <div className="pg-help-layer" data-testid="participant-help-center">
    <div className="pg-help-backdrop" aria-hidden="true" onClick={onClose} />
    <section className="pg-help-shell" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="pg-help-title"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const nodes = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <header className="pg-help-head">
        <div className="pg-help-head-mark"><Sparkles size={20}/></div>
        <div className="pg-help-heading"><span>IMPULSE · БАЗА ЗНАНИЙ</span><h2 id="pg-help-title">Центр помощи</h2><p>Понятные инструкции для каждого этапа работы</p></div>
        <button type="button" className="pg-help-close" aria-label="Закрыть центр помощи" onClick={onClose}><X size={20}/></button>
      </header>
      <div className="pg-help-body">
        <aside className="pg-help-sidebar" aria-label="Темы помощи">
          <p>НАЙТИ ПО ТЕМЕ</p>
          <button type="button" className={category === "related" ? "is-active" : ""} onClick={() => { setCategory("related"); setTopicId(null); setQuery(""); }}><Compass size={16}/> Этот раздел <small>{relatedCount}</small></button>
          <button type="button" className={category === "all" ? "is-active" : ""} onClick={() => { setCategory("all"); setTopicId(null); setQuery(""); }}><BookOpenText size={16}/> Все инструкции <small>{HELP_TOPICS.length}</small></button>
          <div className="pg-help-side-divider"/>
          {HELP_CATEGORIES.map((item) => <button key={item.id} type="button" className={category === item.id ? "is-active" : ""} onClick={() => { setCategory(item.id); setTopicId(null); setQuery(""); }}>{item.title}<small>{HELP_TOPICS.filter((topic) => topic.category === item.id).length}</small></button>)}
          <div className="pg-help-trust"><ShieldCheck size={17}/><span>Помощь не изменяет задачи, оценки и результаты</span></div>
        </aside>
        <main className="pg-help-main">
          {selected ? <>
            <button type="button" className="pg-help-back" onClick={() => { setTopicId(null); }}><ArrowLeft size={15}/> Все инструкции</button>
            <span className="pg-help-article-tag">{HELP_CATEGORIES.find((item) => item.id === selected.category)?.title}</span>
            <h3 className="pg-help-article-title">{selected.title}</h3>
            <p className="pg-help-article-lead">{selected.lead}</p>
            <div className="pg-help-why"><Sparkles size={17}/><div><strong>Зачем это нужно</strong><p>{selected.why}</p></div></div>
            <h4>Что делать — по шагам</h4>
            <ol className="pg-help-instructions">{selected.steps.map((step, index) => <li key={step}><span>{String(index+1).padStart(2,"0")}</span>{step}</li>)}</ol>
            <div className="pg-help-article-bottom"><section><h4><CheckCircle2 size={16}/> Перед следующим шагом проверь</h4>{selected.checklist.map((line) => <p key={line}><CheckCircle2 size={14}/>{line}</p>)}</section><section className="pg-help-watch"><h4><CircleHelp size={16}/> На что обратить внимание</h4><p>{selected.caution}</p></section></div>
            <div className="pg-help-article-actions">
              <button type="button" className="pg-help-main-btn" onClick={() => { setTopicId(null); }}><BookOpenText size={15}/> Другие инструкции</button>
              {selected.section && onNavigateSection && selected.section !== section && <button type="button" onClick={() => { onNavigateSection(selected.section ?? section); onClose(); }}>К разделу «{selected.section}» <ArrowRight size={15}/></button>}
            </div>
          </> : <>
            <div className="pg-help-search"><Search size={19}/><input ref={searchRef} aria-label="Поиск по инструкциям" value={query} onChange={(event) => { setQuery(event.target.value); }} placeholder="Например: как отправить решение, что такое Skill Passport…" /></div>
            <div className="pg-help-lead"><div><span>{query ? "РЕЗУЛЬТАТЫ ПОИСКА" : category === "related" ? "РЕКОМЕНДУЕМ ДЛЯ ЭТОГО РАЗДЕЛА" : "ВЫБЕРИ НУЖНУЮ ТЕМУ"}</span><h3>{query ? "Результаты поиска" : category === "related" ? `Помощь: ${section}` : "Найди нужную инструкцию"}</h3><p>Без длинного обязательного обучения: открой только то, что нужно сейчас.</p></div><span className="pg-help-count">{topics.length} тем</span></div>
            <div className="pg-help-topics">
              {topics.map((topic) => <button type="button" key={topic.id} onClick={() => { setTopicId(topic.id); }}><span className="pg-help-topic-icon"><BookOpenText size={18}/></span><span><strong>{topic.title}</strong><small>{topic.lead}</small></span><ArrowRight size={18}/></button>)}
              {topics.length === 0 && <div className="pg-help-empty"><Search size={24}/><strong>По этому запросу ничего нет</strong><p>Попробуй другие слова или открой все инструкции.</p><button type="button" onClick={() => { setCategory("all"); setQuery(""); }}>Показать все темы</button></div>}
            </div>
          </>}
        </main>
      </div>
      <footer className="pg-help-bottom"><span><ShieldCheck size={15}/> Ты сам решаешь, когда нужна помощь</span><button type="button" onClick={() => { onOpenTour(); }}><Compass size={15}/> Показать подсказки на странице <ArrowRight size={14}/></button></footer>
    </section>
  </div>;
}
