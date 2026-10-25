import { useEffect, useRef, useState } from "react";
import {
  Activity, ArrowLeft, ArrowRight, CalendarDays, Check,
  ChevronRight, CircleDot, ClipboardCheck, Code2, Database,
  FileCode2, FileText, GitBranch, Info, Layers3, Link2,
  ListTodo, MessageCircle, Plus, ShieldCheck, Sparkles,
  Target, UploadCloud, Users, X,
} from "lucide-react";
import "./project-dashboard.scss";

export type DashboardProject = {
  title: string;
  customer: string;
  status: string;
  deadline: string;
  deliverable: string;
  problem?: string;
  version: number;
  competencyTags: string[];
  criteria: string[];
  allowedArtifacts: string[];
  team: { person_id: string; display_name: string; status: string }[];
  mentor?: string;
  checkpoints: { key: string; title: string; status: string }[];
  contributions: { id: string; version: number; personal_summary: string; artifact_keys: string[]; status: string }[];
  feedback: { contribution_id: string; explanation: string; status: string }[];
};
type Section = "overview" | "stages" | "artifacts" | "team" | "integrations" | "activity";
const passed = new Set(["completed", "done", "accepted", "closed", "verified"]);
const sectionTabs: { id: Section; text: string; icon: typeof Target }[] = [
  { id: "overview", text: "Обзор", icon: Target },
  { id: "stages", text: "Этапы", icon: ListTodo },
  { id: "artifacts", text: "Артефакты", icon: FileText },
  { id: "team", text: "Команда", icon: Users },
  { id: "integrations", text: "Интеграции", icon: Link2 },
  { id: "activity", text: "Активность", icon: Activity },
];
const dateRU = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Дата уточняется" : date.toLocaleDateString("ru-RU", {day:"numeric",month:"short",year:"numeric"});
};
const readableStatus: Record<string,string> = {
  in_progress: "В работе", staffed: "Назначен", submitted: "На проверке",
  accepted: "Принято", closed: "Завершено", revision_requested: "На доработке",
  disputed: "На рассмотрении",
};
function ProjectInfoModal({ project, close }: { project: DashboardProject; close: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const prior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    heading.current?.focus();
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab") return;
      const dialog = heading.current?.closest('[role="dialog"]');
      const focusable = [...(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled])') ?? [])];
      if (focusable.length === 0) return;
      const first = focusable[0], last = focusable[focusable.length-1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown",keyHandler);
      prior?.focus();
    };
  }, [close]);
  return <div className="mpd-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}>
    <section className="mpd-info-modal" role="dialog" aria-modal="true" aria-labelledby="mpd-info-title" data-testid="project-info-popup">
      <header className="mpd-modal-head">
        <div><span className="mpd-overline">ИНФОРМАЦИЯ О ПРОЕКТЕ · УСЛОВИЯ ВЕРСИИ {String(project.version)}</span>
          <h2 id="mpd-info-title" ref={heading} tabIndex={-1}>Подробнее о проекте</h2>
          <p>{project.title}</p></div>
        <button className="mpd-close" aria-label="Закрыть подробности о проекте" type="button" onClick={close}><X size={21}/></button>
      </header>
      <div className="mpd-modal-body">
        <section className="mpd-info-lead">
          <span className="mpd-mini-icon"><Target size={22}/></span>
          <div><h3>Какую проблему решаем</h3><p>{project.problem?.trim() || "Заказчик пока не опубликовал отдельную формулировку проблемы. Текущая постановка задачи приведена ниже в разделе ожидаемого результата."}</p></div>
        </section>
        <div className="mpd-info-columns">
          <section><h3><ClipboardCheck size={18}/> Что заказчик хочет получить</h3>
            <p>{project.deliverable}</p><h4>Как проверят решение</h4>
            {project.criteria.length ? <ul className="mpd-criteria">{project.criteria.map(criterion=><li key={criterion}><Check size={15}/>{criterion}</li>)}</ul> : <p className="mpd-muted">Критерии приёмки пока не опубликованы.</p>}
          </section>
          <section><h3><Info size={18}/> Дополнительная информация</h3>
            <dl className="mpd-facts">
              <div><dt>Заказчик</dt><dd>{project.customer}</dd></div>
              <div><dt>Статус</dt><dd>{readableStatus[project.status]??project.status}</dd></div>
              <div><dt>Срок</dt><dd>{dateRU(project.deadline)}</dd></div>
              <div><dt>Версия условий</dt><dd>{String(project.version)}</dd></div>
              <div><dt>Участники</dt><dd>{String(project.team.length)}</dd></div>
              {project.mentor&&<div><dt>Ментор</dt><dd>{project.mentor}</dd></div>}
            </dl>
          </section>
        </div>
        <section className="mpd-info-bottom"><h3><Code2 size={18}/> Требуемые навыки и форматы</h3>
          <div className="mpd-tags">{project.competencyTags.length?project.competencyTags.map(skill=><span key={skill}>{skill}</span>):<span>Навыки уточняются</span>}</div>
          <p><strong>Подтверждение результата:</strong> {project.allowedArtifacts.length?project.allowedArtifacts.join(", "):"формат доказательств уточняется"}</p>
        </section>
      </div>
      <footer className="mpd-modal-footer"><span><ShieldCheck size={15}/> Информация основана на опубликованных условиях проекта</span><button type="button" className="mpd-primary" onClick={close}>Вернуться к работе <ArrowRight size={16}/></button></footer>
    </section>
  </div>;
}
function DocumentIllustration() {
  return <div className="mpd-illustration" aria-hidden="true">
    <span className="mpd-paper mpd-paper--back"><i/><i/><i/><i/></span>
    <span className="mpd-paper mpd-paper--front"><i/><i/><i/><i/><svg viewBox="0 0 110 110" fill="none"><path d="M23 47L52 21 79 42 58 82 23 47M79 42l17 24-38 16" stroke="#02e6e1" strokeWidth="2"/>{[[23,47],[52,21],[79,42],[58,82],[96,66]].map(([x,y])=><circle key={x} cx={x} cy={y} r="6" fill="#09e9d9"/>)}</svg></span>
    <span className="mpd-paper mpd-paper--foot"><i/><i/></span>
  </div>;
}
export function ProjectDashboard({ project, onBack, onChat, onUpload, onOpenMember }: {
  project: DashboardProject;
  onBack: () => void;
  onChat: () => void;
  onUpload: () => void;
  onOpenMember: (personId: string) => void;
}) {
  const [activeTab,setActiveTab] = useState<Section>("overview");
  const [showInfo,setShowInfo] = useState(false);
  const [selectedStage,setSelectedStage] = useState<string|null>(null);
  const checkpoints = project.checkpoints;
  const done = checkpoints.filter(item=>passed.has(item.status)).length;
  const percent = checkpoints.length?Math.round(done/checkpoints.length*100):null;
  const artifacts = project.contributions.flatMap(entry=>entry.artifact_keys.map(key=>({key,version:entry.version,id:entry.id,status:entry.status})));
  const nextStage = checkpoints.find(item=>!passed.has(item.status));
  const latestContribution = project.contributions.at(-1);
  const openInfo = () => { setShowInfo(true); };
  const current = (id:Section) => () => {setActiveTab(id);};
  const SummaryCard = ({icon:Icon,value,title,caption}: {icon:typeof Target;value:string;title:string;caption:string}) =>
    <section className="mpd-metric"><div className="mpd-metric-icon"><Icon size={27}/></div><div><strong>{value}</strong><b>{title}</b><small>{caption}</small></div></section>;
  const StagePanel = () => <section className="mpd-panel mpd-stages">
    <div className="mpd-panel-head"><h2><CircleDot/> Этапы проекта</h2><span>{checkpoints.length? `Завершено ${String(done)} из ${String(checkpoints.length)}`:"План ожидается"} {percent!==null&&<strong>{String(percent)}%</strong>}</span></div>
    {checkpoints.length?<div className="mpd-stage-line">{checkpoints.map((stage,i)=>{
      const doneStage=passed.has(stage.status);
      const isCurrent=!doneStage&&nextStage?.key===stage.key;
      return <button key={stage.key} type="button" className={`mpd-stage ${doneStage?"is-done":isCurrent?"is-current":""}`} aria-pressed={selectedStage===stage.key} onClick={()=>{setSelectedStage(selectedStage===stage.key?null:stage.key);}}>
        <span className="mpd-stage-node">{doneStage?<Check size={17}/>:String(i+1)}</span>
        <b>{stage.title}</b><small>{doneStage?"Завершён":isCurrent?"Текущий этап":stage.status}</small>
      </button>;
    })}</div>:<p className="mpd-empty">Этапы появятся после публикации плана заказчиком.</p>}
    {selectedStage&&<p role="status" className="mpd-stage-note">{checkpoints.find(item=>item.key===selectedStage)?.title}: {checkpoints.find(item=>item.key===selectedStage)?.status}. Подтверждение этапов выполняется по данным заказчика.</p>}
  </section>;
  const ContributionPanel = () => <section className="mpd-panel mpd-artifacts">
    <div className="mpd-panel-head"><h2><Layers3/> Последние артефакты</h2><button type="button" onClick={current("artifacts")}>Все артефакты <ChevronRight size={15}/></button></div>
    <div className="mpd-artifact-grid">{artifacts.length?artifacts.slice(0,3).map((item,i)=><article key={`${item.id}-${item.key}`}><span className="mpd-artifact-symbol">{i===0?<FileCode2 size={22}/>:i===1?<Code2 size={22}/>:<Database size={22}/>}</span><div><b>{item.key}</b><small>Версия {String(item.version)} · {item.status}</small></div><span className="mpd-artifact-state">В составе вклада</span></article>):<p className="mpd-empty">Артефактов пока нет. Отправьте первую версию результата.</p>}</div>
  </section>;
  const TeamPanel = () => <section className="mpd-panel mpd-team">
    <div className="mpd-panel-head"><h2><Users/> Команда</h2><button type="button" onClick={current("team")}>Участники <ChevronRight size={15}/></button></div>
    {project.team.length?project.team.slice(0,2).map(member=><button type="button" key={member.person_id} onClick={()=>{onOpenMember(member.person_id);}} className="mpd-team-person"><span>{member.display_name.trim().slice(0,1).toUpperCase()}</span><div><b>{member.display_name}</b><small>{member.status}</small></div><ChevronRight size={17}/></button>):<p className="mpd-empty">Состав команды уточняется.</p>}
  </section>;
  return <div className="mpd-page" data-project-screen="dashboard">
    <div className="mpd-hero">
      <button type="button" className="mpd-back" onClick={onBack}><ArrowLeft size={16}/> К странице проекта</button>
      <div className="mpd-heading">
        <div className="mpd-head-copy"><div className="mpd-state"><i/>{readableStatus[project.status]??project.status}</div>
          <h1 id="workspace-title">{project.title}</h1>
          <p>{project.deliverable}</p>
          <div className="mpd-head-meta"><span><CalendarDays size={15}/> Срок: {dateRU(project.deadline)}</span><span><Users size={15}/> Команда: {String(project.team.length)}</span></div>
        </div>
        <DocumentIllustration/>
        <div className="mpd-hero-side"><div><button type="button" className="mpd-secondary" onClick={onChat}><MessageCircle size={16}/> Открыть командный чат</button><button type="button" className="mpd-primary" onClick={onUpload}><UploadCloud size={18}/> Загрузить новую версию</button></div>
          <div className="mpd-hero-tags"><small>Навыки:</small>{project.competencyTags.length?project.competencyTags.slice(0,5).map(tag=><span key={tag}>{tag}</span>):<span>Уточняются</span>}</div>
        </div>
      </div>
      <nav className="mpd-tabs" aria-label="Разделы рабочего пространства">{sectionTabs.map(({id,text,icon:Icon})=><button key={id} className={activeTab===id?"is-active":""} onClick={current(id)} type="button" aria-current={activeTab===id?"page":undefined}><Icon size={17}/>{text}</button>)}</nav>
    </div>
    {activeTab==="overview"?<div className="mpd-content">
      <main className="mpd-main">
        <div className="mpd-metrics">
          <SummaryCard icon={Target} value={percent===null?"—":`${String(percent)}%`} title="Прогресс проекта" caption={checkpoints.length?`${String(done)} из ${String(checkpoints.length)} этапов завершено`:"Этапы пока не опубликованы"}/>
          <SummaryCard icon={FileText} value={String(artifacts.length)} title="Артефактов" caption={project.contributions.length?`Версий вклада: ${String(project.contributions.length)}`:"Результаты ещё не отправлены"}/>
          <SummaryCard icon={Users} value={String(project.team.length)} title="Участников" caption="Команда проекта"/>
        </div>
        <StagePanel/>
        <section className="mpd-panel mpd-tasks">
          <div className="mpd-panel-head"><h2><ClipboardCheck/> Текущие задачи</h2><button type="button" onClick={current("stages")}>Все этапы <ChevronRight size={15}/></button></div>
          <div className="mpd-task-list">{checkpoints.filter(item=>!passed.has(item.status)).length?checkpoints.filter(item=>!passed.has(item.status)).slice(0,3).map((item,i)=><button type="button" key={item.key} onClick={()=>{setActiveTab("stages");setSelectedStage(item.key);}}><span className="mpd-task-ring"/><b>{item.title}</b><small>{i===0?"Текущий этап":"По плану"}</small><ChevronRight size={16}/></button>):<p className="mpd-empty">Нет незавершённых этапов.</p>}</div>
        </section>
        <ContributionPanel/>
        <section className="mpd-panel mpd-activity">
          <div className="mpd-panel-head"><h2><Activity/> Последняя активность</h2><button type="button" onClick={current("activity")}>Вся активность <ChevronRight size={15}/></button></div>
          {latestContribution?<div className="mpd-activity-line"><span className="mpd-activity-dot"/><p><strong>Отправлена версия {String(latestContribution.version)}</strong><small>{latestContribution.personal_summary}</small></p></div>:<p className="mpd-empty">Действия появятся после первого опубликованного вклада.</p>}
        </section>
      </main>
      <aside className="mpd-aside">
        <section className="mpd-panel mpd-about">
          <div className="mpd-panel-head"><h2><FileText/> О проекте</h2><button type="button" className="mpd-more" onClick={openInfo}>Подробнее <ArrowRight size={14}/></button></div>
          <p>{project.problem?.trim() || project.deliverable}</p>
          <div className="mpd-about-facts">
            <span><ClipboardCheck size={16}/> <b>Формат</b> <small>{project.allowedArtifacts.length?project.allowedArtifacts.join(", "):"Уточняется"}</small></span>
            <span><Target size={16}/> <b>Результат</b> <small>{project.deliverable}</small></span>
          </div>
        </section>
        <TeamPanel/>
        <section className="mpd-panel mpd-next"><div className="mpd-panel-head"><h2><CalendarDays/> Ближайший срок</h2><button type="button" onClick={current("stages")}>Все этапы</button></div><div><strong>{dateRU(project.deadline)}</strong><p>{nextStage?.title??"Срок сдачи результата по проекту"}</p></div></section>
        <section className="mpd-panel mpd-why"><Sparkles size={23}/><div><h3>Зачем этот проект?</h3><p>Работа над проверяемым результатом и подтверждённым личным вкладом для портфолио</p></div></section>
      </aside>
    </div>:<div className="mpd-section">
      <button type="button" className="mpd-section-back" onClick={current("overview")}><ArrowLeft size={16}/> Назад к обзору</button>
      {activeTab==="stages"&&<StagePanel/>}
      {activeTab==="artifacts"&&<><ContributionPanel/><button className="mpd-primary mpd-section-cta" type="button" onClick={onUpload}><Plus size={16}/> Отправить новую версию</button></>}
      {activeTab==="team"&&<TeamPanel/>}
      {activeTab==="integrations"&&<section className="mpd-panel"><div className="mpd-panel-head"><h2><GitBranch/> Интеграции проекта</h2></div><p className="mpd-empty">Подключения проекта отображаются после настройки организатором. Для подключения доступны сервисы, указанные в условиях программы; реквизиты доступа здесь не публикуются.</p></section>}
      {activeTab==="activity"&&<section className="mpd-panel"><div className="mpd-panel-head"><h2><Activity/> История результатов</h2></div>{project.contributions.length?project.contributions.map(item=><article key={item.id} className="mpd-history"><b>Версия {String(item.version)} · {item.status}</b><p>{item.personal_summary}</p><span>{item.artifact_keys.join(", ")}</span></article>):<p className="mpd-empty">История пока пуста.</p>}{project.feedback.map(item=><article key={item.contribution_id} className="mpd-history"><b>Ревью · {item.status}</b><p>{item.explanation}</p></article>)}</section>}
    </div>}
    {showInfo&&<ProjectInfoModal project={project} close={()=>{setShowInfo(false);}}/>}
  </div>;
}
