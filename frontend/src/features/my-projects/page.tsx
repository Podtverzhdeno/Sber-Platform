import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Award, Bookmark, BriefcaseBusiness, CalendarDays,
  Check, CheckCircle2, ChevronDown, Code2, Crown, FileText,
  FolderKanban, Gift, Info, Layers3, LayoutGrid, List,
  MessageCircle, Search, Share2, SlidersHorizontal, Star, Users,
} from "lucide-react";
import { apiRequest } from "../../api/client";
import { StatePanel } from "../../components/ui";
import { TaskWorkspacePage } from "../../components/task-workspace-page";
import "./my-projects.scss";

type WorkItem = {
  assignment: { id: string; task_id: string; status: string; person_id: string };
  task: { id: string; title: string; status: string };
  terms: { version: number; deadline_at: string; deliverable: string; acceptance_criteria: string[] };
  contributions: { id: string; version: number; personal_summary: string; artifact_keys: string[]; status: string }[];
  decisions: { id: string; contribution_id: string; decision: string; reason: string; deadline_at: string | null }[];
  allowed_artifacts?: string[];
};
type TaskDetail = {
  customer?: { display_name: string; id: string };
  mentor?: { display_name: string; id: string } | null;
  team?: { person_id: string; display_name: string; status: string }[];
  checkpoints?: { key: string; title: string; status: string }[];
  personal?: { id: string; version: number; personal_summary: string; artifact_keys: string[]; status: string }[];
  feedback?: { contribution_id: string; contribution_version: number; grade: string; explanation: string; status: string }[];
  problem?: string;
  deliverable?: string;
};
type Project = { work: WorkItem; detail?: TaskDetail };
type Filter = "all" | "active" | "review" | "finished";
type View = "cards" | "list";
type Tab = "overview" | "tasks" | "progress" | "contribution" | "team" | "rewards";
const activeStatuses = new Set(["staffed", "in_progress", "revision_requested"]);
const reviewStatuses = new Set(["submitted", "disputed"]);
const finishedStatuses = new Set(["accepted", "closed"]);
const finishedCheckpoint = new Set(["accepted", "completed", "done", "verified", "closed"]);
const statusText: Record<string, string> = {
  staffed: "Можно начинать", in_progress: "В работе",
  revision_requested: "Нужна доработка", submitted: "На ревью",
  disputed: "Оспаривается", accepted: "Принято", closed: "Завершено",
};
const benefits = [
  { id: "gitverse", title: "Токены GitVerse", unlock: "Старт программы", icon: Layers3, color: "teal" },
  { id: "gigacode", title: "Токены GigaCode", unlock: "После 1 проекта", icon: Code2, color: "blue" },
  { id: "gigaagent", title: "Премиум GigaAgent", unlock: "После 2 проектов", icon: Crown, color: "gold" },
  { id: "internship", title: "Стажировка в Сбере", unlock: "После 5 проектов", icon: BriefcaseBusiness, color: "blue" },
  { id: "community", title: "Закрытое сообщество лучших", unlock: "После 10 проектов", icon: Users, color: "purple" },
  { id: "assessment", title: "Оценка личного вклада", unlock: "При сдаче результатов", icon: Award, color: "purple" },
  { id: "portfolio", title: "Пополнение портфолио", unlock: "После подтверждения", icon: Star, color: "teal" },
] as const;
const filterChoices: { key: Filter; title: string }[] = [
  { key: "all", title: "Все проекты" }, { key: "active", title: "В работе" },
  { key: "review", title: "На ревью" }, { key: "finished", title: "Завершённые" },
];
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Срок уточняется" : date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
};
const daysLabel = (value: string) => {
  const difference = Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
  if (!Number.isFinite(difference)) return "";
  return difference < 0 ? "Срок прошёл" : difference === 0 ? "Сегодня" : `${difference} дн.`;
};
function completion(project: Project): number | null {
  const milestones = project.detail?.checkpoints;
  if (milestones?.length) {
    return Math.round(100 * milestones.filter(item => finishedCheckpoint.has(item.status)).length / milestones.length);
  }
  return finishedStatuses.has(project.work.assignment.status) ? 100 : null;
}
function projectCompany(project: Project) {
  return project.detail?.customer?.display_name || "Заказчик";
}
function companyIcon(name: string) {
  const n = name.toLowerCase();
  return n.includes("сбер") ? "✓" : n.includes("т-банк") || n.includes("t-bank") ? "Т" :
    n.includes("яндекс") ? "Я" : n.includes("астр") ? "A" : n.includes("vk") ? "VK" : name.slice(0,1).toUpperCase();
}
function CompanyIcon({ name }: { name: string }) {
  return <span className={`mp-company-mark mp-company-mark--${name.toLowerCase().includes("сбер") ? "sber" : name.toLowerCase().includes("яндекс") ? "yandex" : "other"}`} aria-hidden="true">{companyIcon(name)}</span>;
}
function ProgressBar({ value, compact = false }: { value: number | null; compact?: boolean }) {
  return <div className={`mp-progress ${compact ? "mp-progress--compact" : ""}`}>
    <div className="mp-progress__track"><span style={{ width: value === null ? "0%" : `${value}%` }} /></div>
    <strong>{value === null ? "—" : `${value}%`}</strong>
  </div>;
}
function Status({ status }: { status: string }) {
  const tone = finishedStatuses.has(status) ? "complete" : reviewStatuses.has(status) ? "review" : status === "revision_requested" ? "review" : "active";
  return <span className={`mp-status mp-status--${tone}`}><i />{statusText[status] || status}</span>;
}
function RewardsPath({ completedCount, onSelect }: { completedCount: number; onSelect: (id: string) => void }) {
  const unlocked = (id: string) => id === "gitverse" && completedCount > 0 || id === "gigacode" && completedCount >= 1 ||
    id === "gigaagent" && completedCount >= 2 || id === "internship" && completedCount >= 5 ||
    id === "community" && completedCount >= 10 || id === "portfolio" && completedCount >= 1;
  return <section className="mp-benefit-journey" aria-label="Путь выгод от проектов">
    <div className="mp-benefit-heading"><h2>Твой путь выгоды от проектов</h2><span><Info size={14}/> Программа возможностей · условия уточняются</span></div>
    <div className="mp-benefit-steps">
      {benefits.map((reward,index) => {
        const Icon = reward.icon;
        return <button type="button" onClick={() => onSelect(reward.id)} className={`mp-benefit-step mp-benefit-step--${reward.color}`} key={reward.id} aria-label={`${reward.title}, ${reward.unlock}`}>
          <span className="mp-benefit-step__index">{index + 1}</span><span className="mp-benefit-step__icon"><Icon size={25}/></span>
          <span className="mp-benefit-step__text"><strong>{reward.title}</strong><small>{unlocked(reward.id) ? "Этап достигнут · выдача по условиям" : reward.unlock}</small></span>
          {index < benefits.length-1 && <ArrowRight className="mp-benefit-arrow" size={15}/>}
        </button>;
      })}
    </div>
  </section>;
}
function ProjectSummary({ project, selected, onSelect, onOpen, onBookmark, saved }: {
  project: Project; selected: boolean; onSelect: () => void; onOpen: () => void; onBookmark: () => void; saved: boolean;
}) {
  const company = projectCompany(project);
  return <article className={`mp-project-tile ${selected ? "is-selected" : ""}`}>
    <button type="button" className="mp-project-tile__main" onClick={onSelect} aria-pressed={selected} aria-label={`Выбрать проект ${project.work.task.title}`}>
      <CompanyIcon name={company}/><span className="mp-project-tile__identity">
        <small>{company} · Заказчик</small><strong>{project.work.task.title}</strong>
        <span className="mp-chip-row"><em>Проект</em><em>Команда</em><em>Практика</em></span>
      </span>
    </button>
    <div className="mp-project-tile__right"><Status status={project.work.assignment.status}/>
      <button type="button" className="mp-icon-button" aria-label={saved ? "Убрать из избранного" : "В избранное"} aria-pressed={saved} onClick={onBookmark}><Bookmark size={17} fill={saved ? "currentColor" : "none"}/></button>
    </div>
    <div className="mp-project-tile__bottom"><ProgressBar value={completion(project)}/>
      <span><CalendarDays size={14}/>{dateLabel(project.work.terms.deadline_at)}</span>
      <button className="mp-open-tile" type="button" onClick={onOpen}>Открыть <ArrowRight size={15}/></button>
    </div>
  </article>;
}
function ProjectList({ projects, onOpen }: { projects: Project[]; onOpen: (id: string) => void }) {
  return <div className="mp-table-scroll"><table className="mp-table">
    <thead><tr><th>№</th><th>Проект</th><th>Компания</th><th>Статус</th><th>Прогресс</th><th>Срок</th><th>Выгоды</th><th>Действия</th></tr></thead>
    <tbody>{projects.map((project,index) => <tr key={project.work.assignment.id}>
      <td>{index+1}</td><td><div className="mp-table-project"><CompanyIcon name={projectCompany(project)}/><div><strong>{project.work.task.title}</strong><small>Принятое назначение</small></div></div></td>
      <td>{projectCompany(project)}</td><td><Status status={project.work.assignment.status}/></td>
      <td><ProgressBar value={completion(project)} compact/></td>
      <td><span className="mp-table-date"><CalendarDays size={16}/><span>{dateLabel(project.work.terms.deadline_at)}<small>{daysLabel(project.work.terms.deadline_at)}</small></span></span></td>
      <td><span className="mp-table-benefits" title="Возможности по программе, не факт начисления"><Layers3/><Code2/><Crown/></span></td>
      <td><button type="button" className="mp-table-open" onClick={() => onOpen(project.work.assignment.id)}>Открыть <ArrowRight size={16}/></button></td>
    </tr>)}</tbody>
  </table></div>;
}
function BenefitsPreview({ onDetails }: { onDetails: () => void }) {
  return <section className="mp-surface mp-preview-benefits"><header><h3>Бонусы и выгоды за проект</h3><button type="button" onClick={onDetails}>Подробнее <ArrowRight size={14}/></button></header>
    <div className="mp-preview-benefits__grid">{benefits.slice(0,3).map(reward=>{const Icon=reward.icon;return <button key={reward.id} onClick={onDetails} className={`mp-mini-reward mp-mini-reward--${reward.color}`}><Icon size={22}/><span><strong>{reward.title}</strong><small>{reward.unlock}</small></span></button>;})}</div>
    <p>Дополнительные возможности: стажировка, закрытое сообщество и подтверждение вклада</p>
  </section>;
}
function PanelPreview({ project, onOpen, onRewards }: { project: Project; onOpen: () => void; onRewards: () => void }) {
  const checkpoints = project.detail?.checkpoints ?? [];
  const progress = completion(project);
  const contributions = project.work.contributions.slice(-4);
  return <aside className="mp-preview mp-surface">
    <header className="mp-preview__header"><CompanyIcon name={projectCompany(project)}/><div><small>{projectCompany(project)} · Заказчик</small><h2>{project.work.task.title}</h2><p>{project.work.terms.deliverable}</p></div><Status status={project.work.assignment.status}/></header>
    <div className="mp-preview__tabs"><button type="button" className="is-active" onClick={onOpen}>Обзор</button><button type="button" onClick={onOpen}>Прогресс</button><button type="button" onClick={onOpen}>Мой вклад</button><button type="button" onClick={onOpen}>Команда</button><button type="button" onClick={onRewards}>Бонусы и выгоды</button></div>
    <div className="mp-preview__content">
      <div className="mp-preview__left">
        <section className="mp-surface mp-panel-inset"><header><h3>Прогресс по этапам</h3><strong>{progress === null ? "Нет оценки" : `${progress}%`}</strong></header>
          {checkpoints.length ? checkpoints.slice(0,5).map((cp,index)=><div className="mp-stage" key={cp.key}><span className={finishedCheckpoint.has(cp.status)?"done":""}>{finishedCheckpoint.has(cp.status)?<Check size={15}/>:index+1}</span><div><p>{cp.title}</p><ProgressBar value={finishedCheckpoint.has(cp.status)?100:null} compact/></div></div>) : <p className="mp-muted">План этапов появится после публикации заказчиком</p>}
        </section>
        <section className="mp-surface mp-panel-inset"><header><h3>Команда проекта</h3><small>{project.detail?.team?.length ?? "—"} участников</small></header><p>{project.detail?.mentor?.display_name ? `Ментор: ${project.detail.mentor.display_name}` : "Состав команды уточняется"}</p></section>
      </div>
      <div className="mp-preview__right">
        <section className="mp-surface mp-panel-inset"><header><h3>Мой вклад</h3><small>{contributions.length} версий</small></header>
          {contributions.length ? contributions.map(item=><p className="mp-contrib-line" key={item.id}><FileText size={15}/><span>{item.personal_summary}</span></p>) : <p className="mp-muted">Отправьте свой первый вклад, чтобы он появился здесь</p>}
        </section><BenefitsPreview onDetails={onRewards}/>
      </div>
    </div>
    <div className="mp-preview__actions"><button className="mp-primary" type="button" onClick={onOpen}>Открыть проект <ArrowRight size={17}/></button><span>{dateLabel(project.work.terms.deadline_at)} · {daysLabel(project.work.terms.deadline_at)}</span></div>
  </aside>;
}
function ProjectDetail({ project, onBack, onWorkspace, onMessage, onSubmitContribution, saving, saveError, onStart, starting }: {
  project: Project; onBack: () => void; onWorkspace: () => void; onMessage: () => void;
  onSubmitContribution: (summary: string, url: string) => void; saving: boolean; saveError: boolean; onStart: () => void; starting: boolean;
}) {
  const [tab,setTab] = useState<Tab>("overview");
  const [summary,setSummary] = useState("");
  const [artifact,setArtifact] = useState("");
  const [rewardFocus,setRewardFocus] = useState<string | null>(null);
  const [copied,setCopied] = useState(false);
  const checkpoints = project.detail?.checkpoints ?? [];
  const progress = completion(project);
  const tabs: {id:Tab;title:string}[]=[{id:"overview",title:"Обзор"},{id:"tasks",title:"Задачи"},{id:"progress",title:"Прогресс"},{id:"contribution",title:"Мой вклад"},{id:"team",title:"Команда"},{id:"rewards",title:"Бонусы и выгоды"}];
  return <div className="mp-detail" data-project-screen="detail">
    <nav className="mp-breadcrumb" aria-label="Путь"><button type="button" onClick={onBack}><ArrowLeft size={16}/> Мои проекты</button><span>/</span><span>{project.work.task.title}</span></nav>
    <header className="mp-detail-hero mp-surface">
      <CompanyIcon name={projectCompany(project)}/>
      <div className="mp-detail-hero__name"><small>{projectCompany(project)} · Заказчик</small><h1 id="workspace-title">{project.work.task.title}</h1><div className="mp-chip-row"><em>Практика</em><em>Реальный проект</em><em>Командная работа</em></div></div>
      <div className="mp-detail-hero__progress"><Status status={project.work.assignment.status}/><span>Прогресс проекта</span><ProgressBar value={progress}/><small>Следующий этап · до {dateLabel(project.work.terms.deadline_at)}</small></div>
      <button type="button" className="mp-primary" onClick={onWorkspace}>Продолжить работу <ArrowRight size={18}/></button>
    </header>
    <div className="mp-detail-tabs" role="tablist" aria-label="Разделы проекта">{tabs.map(item=><button key={item.id} type="button" role="tab" aria-selected={tab===item.id} className={tab===item.id?"is-active":""} onClick={()=>setTab(item.id)}>{item.title}</button>)}</div>
    {tab==="overview" && <div className="mp-detail-grid">
      <div className="mp-detail-column">
        <section className="mp-surface mp-detail-panel"><h2><FileText/> Описание проекта</h2><p>{project.detail?.problem || project.work.terms.deliverable}</p><h2><CheckCircle2/> Цели проекта</h2><ul className="mp-checklist">{project.work.terms.acceptance_criteria.map(criterion=><li key={criterion}><CheckCircle2 size={18}/>{criterion}</li>)}</ul></section>
        <section className="mp-surface mp-detail-panel"><h2><Users/> Команда проекта</h2><p>{project.detail?.mentor ? `Ментор: ${project.detail.mentor.display_name}` : "Ментор не назначен"}</p><p>{project.detail?.team?.map(p=>p.display_name).join(" · ") || "Состав команды уточняется"}</p><button className="mp-secondary" onClick={()=>setTab("team")}>Участники <ArrowRight size={16}/></button></section>
      </div>
      <div className="mp-detail-column">
        <section className="mp-surface mp-detail-panel"><header><h2>Прогресс проекта</h2><strong>{progress===null?"Нет оценки":`${progress}%`}</strong></header>{checkpoints.length?checkpoints.map((cp,index)=><div className="mp-stage" key={cp.key}><span className={finishedCheckpoint.has(cp.status)?"done":""}>{finishedCheckpoint.has(cp.status)?<Check size={15}/>:index+1}</span><div><p>{cp.title}</p><ProgressBar compact value={finishedCheckpoint.has(cp.status)?100:null}/></div></div>):<p className="mp-muted">Этапы проекта пока не опубликованы</p>}</section>
        <section className="mp-surface mp-detail-panel"><h2>Мой вклад</h2><p>{project.work.contributions.length>0?`Версий результата: ${project.work.contributions.length}`:"Личный вклад ещё не отправлен"}</p><button className="mp-secondary" onClick={()=>setTab("contribution")}>Открыть вклад <ArrowRight size={16}/></button></section>
        <BenefitsPreview onDetails={()=>setTab("rewards")}/>
      </div>
    </div>}
    {tab==="tasks" && <section className="mp-surface mp-detail-panel"><h2>Задачи и критерии результата</h2><p className="mp-muted">Здесь представлены проверяемые критерии заказчика. Их выполнение нельзя подтверждать простым нажатием галочки.</p><ul className="mp-checklist">{project.work.terms.acceptance_criteria.map(criterion=><li key={criterion}><CheckCircle2/>{criterion}</li>)}</ul><button className="mp-primary" type="button" onClick={onWorkspace}>Перейти в рабочую область <ArrowRight size={16}/></button></section>}
    {tab==="progress" && <section className="mp-surface mp-detail-panel"><h2>Прогресс по этапам</h2>{checkpoints.length?checkpoints.map((cp,index)=><div className="mp-stage" key={cp.key}><span className={finishedCheckpoint.has(cp.status)?"done":""}>{index+1}</span><div><p>{cp.title} · {cp.status}</p><ProgressBar value={finishedCheckpoint.has(cp.status)?100:null}/></div></div>):<p>Заказчик пока не опубликовал этапы. Прогресс появится по подтверждённым результатам.</p>}</section>}
    {tab==="contribution" && <section className="mp-surface mp-detail-panel"><h2>Мой личный вклад</h2>{project.work.contributions.map(item=><article className="mp-history-item" key={item.id}><strong>Версия {item.version} · {item.status}</strong><p>{item.personal_summary}</p></article>)}{project.work.assignment.status==="staffed"||project.work.assignment.status==="revision_requested"?<button type="button" className="mp-primary" disabled={starting} onClick={onStart}>{starting?"Сохраняем…":"Начать работу"} <ArrowRight size={16}/></button>:project.work.assignment.status==="in_progress"?<form className="mp-contribute-form" onSubmit={e=>{e.preventDefault();onSubmitContribution(summary,artifact);}}><label>Что сделали лично<textarea required minLength={20} value={summary} onChange={e=>setSummary(e.target.value)} placeholder="Опишите проверяемый личный результат…"/></label><label>Ссылка на доказательство<input type="url" value={artifact} onChange={e=>setArtifact(e.target.value)} placeholder="https://…"/></label><button type="submit" disabled={saving} className="mp-primary">{saving?"Отправляем…":"Отправить вклад"} <ArrowRight size={16}/></button>{saveError&&<p role="alert">Не удалось отправить вклад. Проверьте поля и соединение.</p>}</form>:<p>Проект на стадии проверки или завершён. История вклада доступна для просмотра.</p>}</section>}
    {tab==="team" && <section className="mp-surface mp-detail-panel"><h2>Команда проекта</h2>{project.detail?.team?.length?project.detail.team.map(person=><div className="mp-team-member" key={person.person_id}><span>{person.display_name.slice(0,1)}</span><div><strong>{person.display_name}</strong><small>{person.status}</small></div><button className="mp-secondary" type="button" onClick={onMessage}><MessageCircle size={16}/> Написать</button></div>):<p className="mp-muted">Данные команды пока не опубликованы</p>}</section>}
    {tab==="rewards" && <section className="mp-surface mp-detail-panel"><h2><Gift/> Бонусы и выгоды</h2><p>Возможности открываются последовательно. Точные условия выдачи определяются программой поощрений.</p><div className="mp-rewards-full">{benefits.map(item=>{const Icon=item.icon;return <button type="button" key={item.id} className={rewardFocus===item.id?"is-active":""} onClick={()=>setRewardFocus(item.id)}><Icon size={25}/><strong>{item.title}</strong><span>{item.unlock}</span><ChevronDown size={16}/></button>})}</div>{rewardFocus&&<p className="mp-reward-notice" role="status">«{benefits.find(x=>x.id===rewardFocus)?.title}»: конкретный размер и право на получение подтверждаются организаторами. Достижение порога проектов само по себе не начисляет бонус.</p>}</section>}
    <footer className="mp-detail-footer"><button type="button" className="mp-secondary" onClick={onBack}><ArrowLeft size={15}/> Все проекты</button><button type="button" className="mp-secondary" onClick={onMessage}><MessageCircle size={15}/> Обсуждение</button><button className="mp-secondary" type="button" onClick={()=>{void navigator.clipboard?.writeText(window.location.href).then(()=>{setCopied(true);}).catch(()=>{setCopied(false);});}}><Share2 size={15}/>{copied?"Ссылка скопирована":"Поделиться"}</button><button className="mp-primary" type="button" onClick={onWorkspace}>Перейти к задачам <ArrowRight size={16}/></button></footer>
  </div>;
}
export function ParticipantProjectsV2() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [params,setParams] = useSearchParams();
  const [focus,setFocus] = useState<string|null>(null);
  const [saved,setSaved] = useState<string[]>([]);
  const [rewardFocus,setRewardFocus] = useState<string|null>(null);
  const layout:View=params.get("layout")==="list"?"list":"cards";
  const filter:Filter=filterChoices.some(c=>c.key===params.get("filter"))?params.get("filter") as Filter:"all";
  const selectedId=params.get("project");
  const [text,setText]=useState("");
  const [company,setCompany]=useState("all");
  const [sort,setSort]=useState("deadline");
  const [workspaceTab,setWorkspaceTab]=useState(false);
  const work=useQuery({queryKey:["my-work"],queryFn:()=>apiRequest<WorkItem[]>("/api/v1/me/work"),refetchOnMount:"always"});
  const details=useQueries({queries:(work.data??[]).slice(0,30).map(item=>({
    queryKey:["workspace-task-detail",item.task.id],
    queryFn:()=>apiRequest<TaskDetail>(`/api/v1/me/tasks/${item.task.id}`),
    retry:false,staleTime:60000,
  }))});
  const projects:Project[]=(work.data??[]).map((item,index)=>({work:item,detail:details[index]?.data}));
  const selected=projects.find(x=>x.work.assignment.id===selectedId);
  const focused=projects.find(x=>x.work.assignment.id===focus)||projects[0];
  const open=(id:string)=>{setWorkspaceTab(false);setParams(previous=>{const next=new URLSearchParams(previous);next.set("project",id);return next;});};
  const back=()=>{setWorkspaceTab(false);setParams(previous=>{const next=new URLSearchParams(previous);next.delete("project");return next;});};
  const setLayout=(value:View)=>setParams(previous=>{const next=new URLSearchParams(previous);next.set("layout",value);return next;});
  const setFilter=(value:Filter)=>setParams(previous=>{const next=new URLSearchParams(previous);if(value==="all")next.delete("filter");else next.set("filter",value);return next;});
  const start=useMutation({mutationFn:(id:string)=>apiRequest(`/api/v1/me/assignments/${id}/start`,{method:"POST",headers:{"X-CSRF-Token":sessionStorage.getItem("impulse_csrf")??""}}),onSuccess:()=>client.invalidateQueries({queryKey:["my-work"]})});
  const contribute=useMutation({mutationFn:({id,summary,url}:{id:string;summary:string;url:string})=>apiRequest(`/api/v1/me/assignments/${id}/contributions`,{method:"POST",headers:{"X-CSRF-Token":sessionStorage.getItem("impulse_csrf")??""},body:JSON.stringify({personal_summary:summary,artifacts:url?[{key:"personal-proof",uri:url}]:[]})}),onSuccess:()=>client.invalidateQueries({queryKey:["my-work"]})});
  const companies=useMemo(()=>[...new Set(projects.map(projectCompany))].sort(),[work.data,details.map(query=>query.dataUpdatedAt).join(":")]);
  const visible=projects.filter(project=>{
    const status=project.work.assignment.status;
    if(filter==="active"&&!activeStatuses.has(status)||filter==="review"&&!reviewStatuses.has(status)||filter==="finished"&&!finishedStatuses.has(status))return false;
    if(company!=="all"&&projectCompany(project)!==company)return false;
    return !text||[project.work.task.title,project.work.terms.deliverable,projectCompany(project)].some(x=>x.toLowerCase().includes(text.toLowerCase()));
  }).sort((a,b)=>sort==="title"?a.work.task.title.localeCompare(b.work.task.title,"ru"):sort==="progress"?(completion(b)??-1)-(completion(a)??-1):new Date(a.work.terms.deadline_at).getTime()-new Date(b.work.terms.deadline_at).getTime());
  const finished=projects.filter(p=>finishedStatuses.has(p.work.assignment.status)).length;
  if(work.isPending) return <StatePanel kind="loading"/>;
  if(work.isError||!work.data)return <StatePanel kind="error" action="Повторить" onAction={()=>{void work.refetch();}}/>;
  if(selected&&workspaceTab)return <div className="mpv2 mpv2--workspace"><button type="button" className="mp-secondary" onClick={()=>setWorkspaceTab(false)}><ArrowLeft size={16}/> К странице проекта</button><TaskWorkspacePage mode="participant" title={selected.work.task.title} taskId={selected.work.task.id} projectId={selected.work.task.id} description={selected.work.terms.deliverable} deadline={dateLabel(selected.work.terms.deadline_at)} tags={["Практика","Командный проект"]} workspace={selected.detail?{team:selected.detail.team??[],checkpoints:selected.detail.checkpoints??[],contributions:selected.detail.personal??[],feedback:(selected.detail.feedback??[]).map(f=>({...f,review_version:1})),freshness:`Условия версии ${selected.work.terms.version}`}:undefined} onMessage={()=>void navigate(`/workspace/10?task=${encodeURIComponent(selected.work.task.id)}`)} onPrimaryAction={()=>{setWorkspaceTab(false);}}/></div>;
  if(selected)return <div className="mpv2"><ProjectDetail key={selected.work.assignment.id} project={selected} onBack={back} onWorkspace={()=>setWorkspaceTab(true)} onMessage={()=>void navigate(`/workspace/10?task=${encodeURIComponent(selected.work.task.id)}`)} onSubmitContribution={(summary,url)=>contribute.mutate({id:selected.work.assignment.id,summary,url})} saving={contribute.isPending} saveError={contribute.isError} onStart={()=>start.mutate(selected.work.assignment.id)} starting={start.isPending}/></div>;
  return <div className="mpv2" data-project-screen={layout}>
    <header className="mp-page-title"><p className="mp-eyebrow">ПРАКТИКА И ЛИЧНЫЙ ВКЛАД</p><h1 id="workspace-title">Мои проекты</h1><p>Активно работай над проектами, развивай навыки в команде, отслеживай свой вклад и получай реальные выгоды.</p></header>
    <RewardsPath completedCount={finished} onSelect={setRewardFocus}/>
    {rewardFocus&&<div className="mp-reward-popup" role="status"><div><Gift size={17}/><span><strong>{benefits.find(x=>x.id===rewardFocus)?.title}</strong> — {benefits.find(x=>x.id===rewardFocus)?.unlock}. Условия участия и выдачи подтверждаются организатором.</span></div><button type="button" onClick={()=>setRewardFocus(null)} aria-label="Закрыть информацию о бонусе">×</button></div>}
    <section className="mp-toolbar" aria-label="Управление проектами">
      <div className="mp-filters" role="group" aria-label="Статус проектов">{filterChoices.map(item=><button type="button" aria-pressed={filter===item.key} className={filter===item.key?"is-active":""} onClick={()=>setFilter(item.key)} key={item.key}>{item.title} ({filter==="all"?projects.length:item.key==="active"?projects.filter(p=>activeStatuses.has(p.work.assignment.status)).length:item.key==="review"?projects.filter(p=>reviewStatuses.has(p.work.assignment.status)).length:finished})</button>)}</div>
      <label className="mp-select"><span className="mp-visually-hidden">Компания</span><select aria-label="Компания" value={company} onChange={e=>setCompany(e.target.value)}><option value="all">Все компании</option>{companies.map(name=><option value={name} key={name}>{name}</option>)}</select><ChevronDown size={14}/></label>
      <label className="mp-select"><span className="mp-visually-hidden">Сортировка</span><select aria-label="Сортировка" value={sort} onChange={e=>setSort(e.target.value)}><option value="deadline">По сроку</option><option value="progress">По прогрессу</option><option value="title">По названию</option></select><ChevronDown size={14}/></label>
      <div className="mp-toolbar-spacer"/>
      <div className="mp-layout" role="group" aria-label="Режим проектов"><button type="button" onClick={()=>setLayout("cards")} aria-pressed={layout==="cards"} className={layout==="cards"?"is-active":""}><LayoutGrid size={15}/> Карточки</button><button type="button" onClick={()=>setLayout("list")} aria-pressed={layout==="list"} className={layout==="list"?"is-active":""}><List size={16}/> Список</button></div>
    </section>
    {work.data.length===0?<div className="mp-empty mp-surface"><FolderKanban size={34}/><h2>Пока нет принятых проектов</h2><p>После принятия назначения проект появится здесь. Откликнуться на новые задачи можно в каталоге.</p><button className="mp-primary" onClick={()=>void navigate("/workspace/3")}>Перейти к задачам <ArrowRight size={16}/></button></div>:
      <>
      {layout==="cards"?<div className="mp-card-layout">
        <div className="mp-card-list"><div className="mp-card-list__header"><h2>Мои проекты</h2><label><Search size={17}/><input aria-label="Поиск проектов" placeholder="Поиск по проектам" value={text} onChange={e=>setText(e.target.value)}/></label></div>
          {visible.map(project=><ProjectSummary key={project.work.assignment.id} project={project} selected={focused?.work.assignment.id===project.work.assignment.id} onSelect={()=>setFocus(project.work.assignment.id)} onOpen={()=>open(project.work.assignment.id)} saved={saved.includes(project.work.assignment.id)} onBookmark={()=>setSaved(prev=>prev.includes(project.work.assignment.id)?prev.filter(i=>i!==project.work.assignment.id):[...prev,project.work.assignment.id])}/>)}
          {!visible.length&&<p className="mp-muted mp-empty-row">Подходящих проектов нет. Измените фильтры.</p>}
        </div>
        {visible.map(project=>project.work.assignment.id===(visible.find(p=>p.work.assignment.id===focus)?.work.assignment.id ?? visible[0]?.work.assignment.id) ? <PanelPreview key={project.work.assignment.id} project={project} onOpen={()=>open(project.work.assignment.id)} onRewards={()=>{setRewardFocus("gigacode");window.scrollTo({top:0,behavior:"smooth"});}}/> : null)}
      </div>:<div className="mp-list-layout"><div className="mp-list-search"><Search size={17}/><input aria-label="Поиск проектов" value={text} onChange={e=>setText(e.target.value)} placeholder="Поиск по проектам, компаниям и результатам"/><SlidersHorizontal size={17}/></div>{visible.length?<ProjectList projects={visible} onOpen={open}/>:<div className="mp-empty-row">По заданным условиям проекты не найдены</div>}</div>}
      </>}
  </div>;
}
