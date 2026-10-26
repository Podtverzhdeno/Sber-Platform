import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight, BarChart3, BookOpen, Bot, Check,
  Code2, Download, FileDown, FileText, GraduationCap, Lightbulb,
  MessageCircle, Paperclip, Plus, Send, ShieldCheck, Sparkles,
  SquarePen, Trash2, TrendingUp, X,
} from "lucide-react";

import { apiRequest, type RuntimeApiPath } from "../api/client";
import "./buddy-workspace.scss";

type BuddyMessage = { id: string; client_message_id: string; role: "user" | "assistant"; content: string };
type Thread = { id: string; status: string; messages: BuddyMessage[]; content_deleted: boolean };
type ThreadSummary = { id: string; title: string; status: string; updated_at: string | null; message_count: number };
type Profile = { buddy_enabled: boolean; display_name: string };
type Course = { course_key?: string; title?: string; card: { course_key?: string; title: string; completion_state?: string; access_state?: string } };
type Bootcamp = { courses?: Course[]; selected_track_key?: string };
type BuddyMode = "Помощник" | "Наставник" | "Аналитик" | "Проекты";
type QuickPrompt = { label: string; Icon: typeof Sparkles; question: string };

const quickPrompts: QuickPrompt[] = [
  { label: "Что делать дальше?", Icon: Lightbulb, question: "Какой следующий практический шаг мне стоит сделать, исходя из моего текущего прогресса?" },
  { label: "Разбери задачу", Icon: Code2, question: "Помоги разобрать текущую проектную задачу: шаги, риски и критерии готовности." },
  { label: "Подбери курс", Icon: GraduationCap, question: "Посоветуй, какие компетенции и курсы Bootcamp помогут мне в текущей работе." },
  { label: "Покажи аналитику", Icon: BarChart3, question: "Объясни, какие показатели прогресса стоит проверить в моей аналитике." },
  { label: "Сформируй план", Icon: SquarePen, question: "Составь конкретный учебный план на неделю с измеримыми результатами." },
];
const modes: { mode: BuddyMode; description: string; Icon: typeof Sparkles }[] = [
  { mode: "Помощник", description: "Ответы и материалы", Icon: MessageCircle },
  { mode: "Наставник", description: "Обучение и развитие", Icon: GraduationCap },
  { mode: "Аналитик", description: "Прогресс и рекомендации", Icon: BarChart3 },
  { mode: "Проекты", description: "Разбор задач", Icon: Code2 },
];
const csrf = () => ({ "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" });
const route = (path: string) => { window.location.assign(path); };
const time = (value: string | null) => {
  if (!value) return "Новый";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
};
const threadPath = (id: string) => `/api/v1/agents/buddy/threads/${id}` as RuntimeApiPath;
const postPath = (id: string) => `/api/v1/agents/buddy/threads/${id}/reply` as RuntimeApiPath;
function exportMarkdown(text: string) {
  const date = new Date().toISOString().slice(0,10);
  const content = `# AI-Buddy · рекомендации\n\nДата: ${date}\n\n${text}\n\n---\nМатериал создан AI-Buddy. Проверяйте рекомендации перед использованием.\n`;
  const href = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `ai-buddy-${date}.md`;
  anchor.click();
  URL.revokeObjectURL(href);
}
function Robot({ small = false }: { small?: boolean }) {
  return <div className={small ? "buddy4-robot buddy4-robot-small" : "buddy4-robot"} aria-hidden="true">
    <span className="buddy4-robot-aerial" /><span className="buddy4-robot-head">
      <i className="buddy4-robot-eye"/><i className="buddy4-robot-eye"/><i className="buddy4-robot-mouth"/>
    </span>{!small&&<span className="buddy4-robot-body"/>}
  </div>;
}
function BrandEmpty({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  return <section className="buddy4-hero">
    <div className="buddy4-hero-visual"><Robot/></div>
    <div className="buddy4-hero-body">
      <span className="buddy4-hero-kicker"><Sparkles size={15}/> ТВОЙ ПЕРСОНАЛЬНЫЙ AI-НАСТАВНИК</span>
      <h2>Привет, я AI-Buddy! <span aria-hidden="true">👋</span></h2>
      <p>Помогу учиться, разбирать задачи, находить курсы и строить карьерную траекторию. Всё важное — в одном диалоге.</p>
      <div className="buddy4-hero-actions">{quickPrompts.map(({label,Icon,question})=>
        <button key={label} type="button" onClick={()=>{onPrompt(question);}}><Icon size={16}/>{label}</button>)}</div>
    </div>
  </section>;
}
function CoursePanel({ courses }: { courses: Course[] }) {
  if (courses.length===0) return null;
  return <section className="buddy4-resources">
    <header><BookOpen size={17}/><strong>Курсы из Bootcamp</strong><small>Актуальные материалы платформы</small></header>
    <div className="buddy4-course-grid">{courses.slice(0,2).map((course, index)=>{
      const key=course.course_key??course.card.course_key;
      return <article key={key??course.card.title} className="buddy4-course">
        <div className={index===0?"buddy4-course-art buddy4-art-blue":"buddy4-course-art buddy4-art-violet"}>{index===0?<Code2 size={42}/>:<BookOpen size={42}/>}</div>
        <div className="buddy4-course-content">
          <small>{course.card.completion_state==="verified"?"УЖЕ ПОДТВЕРЖДЁН":"КУРС BOOTCAMP"}</small>
          <strong>{course.card.title}</strong>
          <p>{course.card.completion_state==="in_progress"?"Обучение уже начато":"Теория и практика по программе"}</p>
          <button type="button" disabled={!key} onClick={()=>{route(`/workspace/2?course=${encodeURIComponent(key??"")}`);}}>
            Открыть курс <ArrowRight size={15}/>
          </button>
        </div>
      </article>;})}</div>
  </section>;
}
function MessageCard({ message, courses, onAnalytics, onPlan }: {
  message: BuddyMessage; courses: Course[]; onAnalytics: () => void; onPlan: () => void;
}) {
  const isAssistant=message.role==="assistant";
  return <article className={isAssistant?"buddy4-message buddy4-from-agent":"buddy4-message buddy4-from-user"}>
    {isAssistant&&<div className="buddy4-speaker"><Robot small/></div>}
    <div className="buddy4-message-main">
      <div className="buddy4-bubble">{message.content}</div>
      {isAssistant&&<div className="buddy4-reply-content">
        <section className="buddy4-resources">
          <header><FileText size={17}/><strong>Материалы по ответу</strong><small>Сохранить результат</small></header>
          <div className="buddy4-files">
            <button type="button" onClick={()=>{exportMarkdown(message.content);}} className="buddy4-file">
              <span className="buddy4-file-icon"><FileDown size={26}/></span>
              <span><strong>Конспект рекомендаций</strong><small>Файл Markdown · формируется из ответа</small></span><Download size={18}/>
            </button>
            <button type="button" className="buddy4-file buddy4-file-link" onClick={()=>{route("/workspace/8");}}>
              <span className="buddy4-file-icon"><BarChart3 size={25}/></span>
              <span><strong>Твоя аналитика</strong><small>Открыть показатели Impulse</small></span><ArrowRight size={18}/>
            </button>
          </div>
        </section>
        <CoursePanel courses={courses}/>
        <section className="buddy4-insights">
          <header><TrendingUp size={17}/><strong>Полезные следующие действия</strong></header>
          <div className="buddy4-insight-actions">
            <button type="button" onClick={onAnalytics}><BarChart3 size={16}/> Открыть аналитику <ArrowRight size={15}/></button>
            <button type="button" onClick={onPlan}><SquarePen size={16}/> Моя траектория <ArrowRight size={15}/></button>
            <button type="button" onClick={()=>{route("/workspace/3");}}><Code2 size={16}/> Перейти к задачам <ArrowRight size={15}/></button>
          </div>
        </section>
      </div>}
    </div>
    {!isAssistant&&<span className="buddy4-user-icon" aria-label="Вы">Я</span>}
  </article>;
}

export function BuddyWorkspace() {
  const queryClient=useQueryClient();
  const [selected,setSelected]=useState<string|null>(null);
  const [draft,setDraft]=useState("");
  const [mode,setMode]=useState<BuddyMode>("Помощник");
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  const [pendingText,setPendingText]=useState<string|null>(null);
  const [confirmDelete,setConfirmDelete]=useState<string|null>(null);
  const feedEnd=useRef<HTMLDivElement>(null);
  const retryId=useRef<string|null>(null);
  const profile=useQuery({queryKey:["participant-profile"],queryFn:()=>apiRequest<Profile>("/api/v1/me/profile"),refetchOnMount:"always"});
  const threads=useQuery({
    queryKey:["buddy-threads"],queryFn:()=>apiRequest<ThreadSummary[]>("/api/v1/agents/buddy/threads"),
    enabled:profile.data?.buddy_enabled===true,
  });
  const current=useQuery({
    queryKey:["buddy-thread",selected],enabled:Boolean(selected)&&profile.data?.buddy_enabled===true,
    queryFn:()=>apiRequest<Thread>(threadPath(selected??"")),
    refetchOnMount:"always",
  });
  const catalog=useQuery({
    queryKey:["buddy-bootcamp-overview"],
    queryFn:()=>apiRequest<Bootcamp>("/api/v1/me/bootcamp/overview"),
    enabled:profile.data?.buddy_enabled===true,
  });
  const availableCourses=useMemo(()=>catalog.data?.courses?.filter(
    c=>c.card.title && c.card.access_state!=="locked" && c.card.completion_state!=="verified"
  ).slice(0,2)??[],[catalog.data]);
  useEffect(()=>{if (typeof feedEnd.current?.scrollIntoView === "function") feedEnd.current.scrollIntoView({block:"end",behavior:"smooth"});},[current.data?.messages.length,pendingText]);
  const send=async(value?:string)=>{
    const text=(value??draft).trim();if(!text||pending||profile.data?.buddy_enabled!==true)return;
    setPending(true);setError("");setDraft("");setPendingText(text);
    try{
      let threadId=selected;
      if(!threadId){
        const created=await apiRequest<Thread>("/api/v1/agents/buddy/threads",{method:"POST",headers:csrf()});
        threadId=created.id;setSelected(threadId);
      }
      const id=retryId.current??crypto.randomUUID();
      retryId.current=id;
      const instruction=mode==="Помощник"?"":`Режим: ${mode}. `;
      const response=await apiRequest<Thread>(postPath(threadId),{
        method:"POST",headers:csrf(),body:JSON.stringify({client_message_id:id,content:instruction+text}),
      });
      queryClient.setQueryData(["buddy-thread",threadId],response);
      retryId.current=null;
      await queryClient.invalidateQueries({queryKey:["buddy-threads"]});
    }catch{
      setError("Не удалось получить ответ. Проверь подключение OpenRouter и повтори отправку.");
      setDraft(text);
      if(selected)await queryClient.invalidateQueries({queryKey:["buddy-thread",selected]});
    }finally{setPending(false);setPendingText(null);}
  };
  const createChat=()=>{setSelected(null);setDraft("");setError("");setConfirmDelete(null);retryId.current=null;};
  const cancel=async(id:string)=>{
    try{
      await apiRequest<Thread>(`/api/v1/agents/buddy/threads/${id}/cancel` as RuntimeApiPath,{method:"POST",headers:csrf()});
      if(selected===id)createChat();
      await queryClient.invalidateQueries({queryKey:["buddy-threads"]});
    }catch{setError("Не удалось закрыть диалог. Повтори действие.");}
    setConfirmDelete(null);
  };
  const onSubmit=(event:SyntheticEvent<HTMLFormElement>)=>{event.preventDefault();void send();};
  if(profile.isPending)return <div className="buddy4-loading" role="status">Загружаем персонального помощника…</div>;
  if(profile.data?.buddy_enabled===false)return <section className="buddy4-disabled">
    <ShieldCheck size={28}/><h2>AI-Buddy выключен — модельные вызовы не выполняются</h2>
    <p>Помощник не отправляет сообщения модели, пока он выключен в настройках.</p>
    <button type="button" onClick={()=>{route("/workspace/15");}}>Открыть настройки</button>
  </section>;
  return <div className="buddy4" data-reference="R-PAR-11">
    <aside className="buddy4-rail">
      <div className="buddy4-rail-brand"><span><Bot size={23}/></span><div><h1 id="workspace-title">AI-Buddy <em>Бета · AI</em></h1><p>Персональный наставник в обучении и карьере</p></div></div>
      <button className="buddy4-new" type="button" onClick={createChat}><Plus size={18}/> Новый диалог</button>
      <div className="buddy4-rail-heading"><span>Недавние диалоги</span><small>{threads.data?.length??0}</small></div>
      <div className="buddy4-thread-list">
        {threads.isPending&&<p className="buddy4-rail-empty">Загружаем историю…</p>}
        {threads.isError&&<p className="buddy4-rail-empty">История недоступна</p>}
        {threads.data?.length===0&&<p className="buddy4-rail-empty">Пока нет диалогов. Начни новый разговор</p>}
        {threads.data?.map(thread=><div key={thread.id} className={selected===thread.id?"buddy4-thread active":"buddy4-thread"}>
          <button type="button" className="buddy4-thread-title" onClick={()=>{setSelected(thread.id);setError("");}}>
            <MessageCircle size={17}/><span><strong>{thread.title}</strong><small>{time(thread.updated_at)}</small></span>
          </button>
          {confirmDelete===thread.id?
            <span className="buddy4-confirm"><button type="button" onClick={()=>{void cancel(thread.id);}} aria-label="Подтвердить удаление"><Check size={14}/></button><button type="button" onClick={()=>{setConfirmDelete(null);}} aria-label="Отмена"><X size={14}/></button></span>
            :<button className="buddy4-thread-menu" type="button" title="Закрыть диалог" aria-label={`Закрыть диалог: ${thread.title}`} onClick={()=>{setConfirmDelete(thread.id);}}><Trash2 size={15}/></button>}
        </div>)}
      </div>
      <div className="buddy4-rail-heading buddy4-mode-heading">Режимы AI-Buddy</div>
      <div className="buddy4-modes">{modes.map(({mode:label,description,Icon})=><button key={label} type="button" aria-pressed={mode===label} className={mode===label?"active":""} onClick={()=>{setMode(label);}}>
        <span><Icon size={17}/></span><span><strong>{label}</strong><small>{description}</small></span>
      </button>)}</div>
      <div className="buddy4-rail-footer"><Sparkles size={16}/><span>Сверяй рекомендации с критериями курса и наставником</span></div>
    </aside>
    <main className="buddy4-content">
      {(!selected||!current.data?.messages.length)&&<BrandEmpty onPrompt={(v)=>{void send(v);}}/>}
      {selected&&current.data&&current.data.messages.length>0&&<header className="buddy4-conversation-head">
        <div><span className="buddy4-status"><i/> AI-Buddy</span><h2>{threads.data?.find(t=>t.id===selected)?.title??"Диалог"}</h2></div>
        <button type="button" onClick={createChat}><Plus size={17}/> Новый диалог</button>
      </header>}
      <div className="buddy4-feed" role="log" aria-live="polite" aria-label="Сообщения AI-Buddy">
        {current.isPending&&selected&&<span className="buddy4-muted">Загружаем сообщения…</span>}
        {current.data?.messages.map(message=><MessageCard key={message.id} message={message}
          courses={availableCourses} onAnalytics={()=>{route("/workspace/8");}} onPlan={()=>{route("/workspace/1");}}/>)}
        {pendingText&&<div className="buddy4-message buddy4-from-user buddy4-pending"><div className="buddy4-bubble">{pendingText}</div><span className="buddy4-user-icon">Я</span></div>}
        {pending&&<div className="buddy4-typing"><Robot small/><span>AI-Buddy готовит ответ <i/><i/><i/></span></div>}
        <div ref={feedEnd}/>
      </div>
      {error&&<div className="buddy4-error" role="alert">{error}<button type="button" onClick={()=>{void send();}}>Повторить</button></div>}
      <div className="buddy4-compose-zone">
        <div className="buddy4-compose-notice"><ShieldCheck size={14}/> Только разрешённые данные платформы · внешние ссылки проверяйте</div>
        <form className="buddy4-compose" onSubmit={onSubmit}>
          <button className="buddy4-compose-download" type="button" title="Выгрузить последний ответ" aria-label="Выгрузить последний ответ" disabled={!current.data?.messages.some(m=>m.role==="assistant")}
            onClick={()=>{const m=[...(current.data?.messages??[])].reverse().find(x=>x.role==="assistant");if(m)exportMarkdown(m.content);}}><Paperclip size={19}/></button>
          <input aria-label="Сообщение AI-Buddy" maxLength={8000} value={draft} onChange={e=>{setDraft(e.target.value);retryId.current=null;}} placeholder="Напиши сообщение или задай вопрос…" disabled={pending}/>
          <span className="buddy4-char-count">{draft.length>500?draft.length:""}</span>
          <button type="submit" className="buddy4-send" disabled={!draft.trim()||pending} aria-label="Отправить сообщение"><Send size={19}/></button>
        </form>
      </div>
    </main>
  </div>;
}
