import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Award, Bookmark, BriefcaseBusiness, CalendarDays,
  Check, CheckCircle2, ChevronDown, Code2, Crown, FileText,
  FolderKanban, Gift, Info, Layers3, LayoutGrid, List,
  MessageCircle, Search, Share2, SlidersHorizontal, Star, Users,
} from "lucide-react";
import { apiRequest } from "../../api/client";
import { StatePanel } from "../../components/ui";
import { ProjectDashboard } from "./project-dashboard";
import "./my-projects.scss";

type WorkItem = {
  assignment: { id: string; task_id: string; status: string; person_id: string };
  task: { id: string; title: string; status: string; competency_tags?: string[] };
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
  feedback?: { contribution_id: string; contribution_version: number; review_version: number; grade: string; explanation: string; status: string }[];
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
  { id: "mentor", title: "Возможность стать ментором", unlock: "После 20 проектов", icon: Award, color: "gold" },
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
  return difference < 0 ? "Срок прошёл" : difference === 0 ? "Сегодня" : `${String(difference)} дн.`;
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
  const normalized = name.trim().toLocaleLowerCase("ru-RU").replace(/[\\s_.–—-]+/g, " ").trim();
  const logos: Record<string,string> = {
    "сбер":"sber", "сбербанк":"sber", "sber":"sber",
    "т банк":"t-bank", "тбанк":"t-bank", "тинькофф":"tinkoff",
    "astra":"astra", "астра":"astra", "группа астра":"astra",
    "яндекс":"yandex", "газпром нефть":"gazprom-neft",
    "vk":"vk", "вконтакте":"vk", "red mad robot":"red-mad-robot",
  };
  const mark = logos[normalized];
  return <span className={`mp-company-mark ${mark ? "mp-company-mark--logo" : ""}`} aria-hidden="true">
    {mark ? <img src={`/task-catalog/brands/${mark}.svg`} alt="" width="42" height="42"/> : companyIcon(name)}
  </span>;
}
function ProgressBar({ value, compact = false }: { value: number | null; compact?: boolean }) {
  return <div className={`mp-progress ${compact ? "mp-progress--compact" : ""}`}>
    <div className="mp-progress__track"><span style={{ width: value === null ? "0%" : `${String(value)}%` }} /></div>
    <strong>{value === null ? "—" : `${String(value)}%`}</strong>
  </div>;
}
function Status({ status }: { status: string }) {
  const tone = finishedStatuses.has(status) ? "complete" : reviewStatuses.has(status) ? "review" : status === "revision_requested" ? "review" : "active";
  return <span className={`mp-status mp-status--${tone}`}><i />{statusText[status] || status}</span>;
}
function RewardsPath({ completedCount, onSelect }: { completedCount: number; onSelect: (id: string) => void }) {
  const milestones = benefits.filter(item=>item.id!=="assessment"&&item.id!=="portfolio");
  const always = benefits.filter(item=>item.id==="assessment"||item.id==="portfolio");
  const unlocked = (id: string) => id === "gitverse" || id === "gigacode" && completedCount>=1 ||
    id === "gigaagent" && completedCount>=2 || id === "internship" && completedCount>=5 ||
    id === "community" && completedCount>=10 || id === "mentor" && completedCount>=20;
  return <section className="mp-benefit-journey" aria-label="Возможности и результаты участия">
    <div className="mp-benefit-heading"><h2>Возможности за выполненные проекты</h2><span><Info size={14}/> Пороги участия, выдача по условиям программы</span></div>
    <div className="mp-benefit-steps">
      {milestones.map((reward,index)=>{
        const Icon=reward.icon;
        return <button type="button" onClick={()=>onSelect(reward.id)} className={"mp-benefit-step mp-benefit-step--"+reward.color} key={reward.id} aria-label={reward.title+", "+reward.unlock}>
          <span className="mp-benefit-step__index">{index+1}</span><span className="mp-benefit-step__icon"><Icon size={25}/></span>
          <span className="mp-benefit-step__text"><strong>{reward.title}</strong><small>{unlocked(reward.id)?"Порог достигнут · выдача по условиям":reward.unlock}</small></span>
          {index<milestones.length-1&&<ArrowRight className="mp-benefit-arrow" size={15}/>}
        </button>;
      })}
    </div>
    <div className="mp-benefit-always"><span>На каждом проекте</span>{always.map(reward=>{const Icon=reward.icon;return <button type="button" key={reward.id} onClick={()=>onSelect(reward.id)}><Icon size={15}/><strong>{reward.title}</strong><small>{reward.unlock}</small></button>})}</div>
  </section>;
}
function ProjectSidebarRow({ project, selected, onSelect, onOpen, onBookmark, saved }: {
  project: Project; selected: boolean; onSelect: () => void; onOpen: () => void; onBookmark: () => void; saved: boolean;
}) {
  const company = projectCompany(project);
  return <article className={`mp-project-tile mp-project-tile--sidebar ${selected ? "is-selected" : ""}`} data-testid={`my-project-${project.work.assignment.id}`}>
    <button type="button" className="mp-project-tile__main" onClick={onSelect} aria-pressed={selected} aria-label={`Выбрать проект ${project.work.task.title}`}>
      <CompanyIcon name={company}/>
      <span className="mp-project-tile__identity">
        <small>{company} · Заказчик</small>
        <strong>{project.work.task.title}</strong>
        <span className="mp-chip-row">{(project.work.task.competency_tags?.length ? project.work.task.competency_tags.slice(0,3) : ["Практика", "Командная работа"]).map(tag=><em key={tag}>{tag}</em>)}</span>
      </span>
    </button>
    <div className="mp-project-tile__right">
      <Status status={project.work.assignment.status}/>
      <button type="button" className="mp-icon-button" aria-label={saved ? "Убрать из избранного" : "В избранное"} aria-pressed={saved} onClick={onBookmark}><Bookmark size={16} fill={saved ? "currentColor" : "none"}/></button>
    </div>
    <div className="mp-project-tile__bottom">
      <ProgressBar value={completion(project)} compact/>
      <span className="mp-project-sidebar-team" aria-label="Команда проекта">
        {(project.detail?.team?.length ?? 0)>0?<span className="mp-team-avatars" aria-hidden="true">{(project.detail?.team ?? []).slice(0,3).map(person=><i key={person.person_id} title={person.display_name}>{person.display_name.trim().slice(0,1).toUpperCase()}</i>)}</span>:<Users size={14}/>}
        <small>{project.detail?.team?.length ?? "—"}</small>
      </span>
      <span className="mp-project-sidebar-deadline"><CalendarDays size={14}/>{dateLabel(project.work.terms.deadline_at)}</span>
      <button className="mp-open-tile" type="button" onClick={onOpen}>{activeStatuses.has(project.work.assignment.status) ? "Продолжить" : "Открыть"} <ArrowRight size={14}/></button>
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
      <td><button type="button" className="mp-table-open" onClick={() =>{ onOpen(project.work.assignment.id); }}>Открыть <ArrowRight size={16}/></button></td>
    </tr>)}</tbody>
  </table></div>;
}
function BenefitsPreview({ onDetails }: { onDetails: () => void }) {
  return <section className="mp-surface mp-preview-benefits"><header><h3>Бонусы и выгоды за проект</h3><button type="button" onClick={onDetails}>Подробнее <ArrowRight size={14}/></button></header>
    <div className="mp-preview-benefits__grid">{benefits.slice(0,3).map(reward=>{const Icon=reward.icon;return <button key={reward.id} onClick={onDetails} className={`mp-mini-reward mp-mini-reward--${reward.color}`}><Icon size={22}/><span><strong>{reward.title}</strong><small>{reward.unlock}</small></span></button>;})}</div>
    <p>Дополнительные возможности: стажировка, закрытое сообщество и подтверждение вклада</p>
  </section>;
}
function PanelPreview({ project, onOpen, onRewards }: { project: Project; onOpen: (tab?: Tab) => void; onRewards: () => void }) {
  const checkpoints = project.detail?.checkpoints ?? [];
  const progress = completion(project);
  const contributions = project.work.contributions.slice(-4);
  return <aside className="mp-preview mp-surface">
    <header className="mp-preview__header"><CompanyIcon name={projectCompany(project)}/><div className="mp-preview__intro"><small>{projectCompany(project)} · Заказчик</small><h2>{project.work.task.title}</h2>{(project.work.task.competency_tags?.length ?? 0)>0&&<div className="mp-chip-row">{project.work.task.competency_tags?.slice(0,3).map(skill=><em key={skill}>{skill}</em>)}</div>}<p>{project.work.terms.deliverable}</p></div><div className="mp-preview__aside"><Status status={project.work.assignment.status}/><span className="mp-preview__deadline"><CalendarDays size={15}/> {dateLabel(project.work.terms.deadline_at)}<small>{daysLabel(project.work.terms.deadline_at)}</small></span></div></header>
    <div className="mp-preview__tabs"><button type="button" className="is-active" onClick={()=>{onOpen("overview");}}>Обзор</button><button type="button" onClick={()=>{onOpen("progress");}}>Прогресс</button><button type="button" onClick={()=>{onOpen("contribution");}}>Мой вклад</button><button type="button" onClick={()=>{onOpen("team");}}>Команда</button><button type="button" onClick={onRewards}>Бонусы и выгоды</button></div>
    <div className="mp-preview__content">
      <div className="mp-preview__left">
        <section className="mp-surface mp-panel-inset"><header><h3>Прогресс по этапам</h3><strong>{progress === null ? "Нет оценки" : `${String(progress)}%`}</strong></header>
          {checkpoints.length ? checkpoints.slice(0,5).map((cp,index)=><div className="mp-stage" key={cp.key}><span className={finishedCheckpoint.has(cp.status)?"done":""}>{finishedCheckpoint.has(cp.status)?<Check size={15}/>:index+1}</span><div><p>{cp.title}</p><ProgressBar value={finishedCheckpoint.has(cp.status)?100:null} compact/></div></div>) : <p className="mp-muted">План этапов появится после публикации заказчиком</p>}
        </section>
        <section className="mp-surface mp-panel-inset mp-preview-team"><header><h3>Команда проекта</h3><small>{project.detail?.team?.length ?? "—"} участников</small></header>{(project.detail?.team?.length ?? 0)>0?<div className="mp-preview-team__members">{(project.detail?.team ?? []).slice(0,3).map(person=><div key={person.person_id} className="mp-preview-team__person"><span aria-hidden="true">{person.display_name.trim().slice(0,1).toUpperCase()}</span><div><strong>{person.display_name}</strong><small>{person.status}</small></div></div>)}</div>:<p className="mp-muted">Состав команды уточняется</p>}{project.detail?.mentor?.display_name&&<p className="mp-preview-team__mentor">Ментор · {project.detail.mentor.display_name}</p>}</section>
      </div>
      <div className="mp-preview__right">
        <section className="mp-surface mp-panel-inset"><header><h3>Мой вклад</h3><small>{contributions.length} версий</small></header>
          {contributions.length ? contributions.map(item=><div className="mp-contrib-line" key={item.id}><FileText size={15}/><span><strong>Версия {String(item.version)} · {item.status}</strong><small>{item.personal_summary}</small></span></div>) : <p className="mp-muted">Отправьте свой первый вклад, чтобы он появился здесь</p>}
        </section><BenefitsPreview onDetails={onRewards}/>
      </div>
    </div>
    <div className="mp-preview__actions"><button className="mp-primary" type="button" onClick={()=>{onOpen("overview");}}>Открыть проект <ArrowRight size={17}/></button><span>{dateLabel(project.work.terms.deadline_at)} · {daysLabel(project.work.terms.deadline_at)}</span></div>
  </aside>;
}
function ProjectDetail({ project, initialTab, onBack, onWorkspace, onMessage, onSubmitContribution, saving, saveError, onStart, starting, startError }: {
  project: Project; initialTab: Tab; onBack: () => void; onWorkspace: () => void; onMessage: (personId?: string) => void;
  onSubmitContribution: (summary: string, url: string, artifactKey: string) => void; saving: boolean; saveError: boolean; onStart: () => void; starting: boolean; startError: boolean;
}) {
  const [tab,setTab] = useState<Tab>(initialTab);
  useEffect(()=>{setTab(initialTab);},[initialTab]);
  const [summary,setSummary] = useState("");
  const [artifact,setArtifact] = useState("");
  const [artifactKey,setArtifactKey] = useState(project.work.allowed_artifacts?.[0] || "personal-proof");
  const [rewardFocus,setRewardFocus] = useState<string | null>(null);
  const [copied,setCopied] = useState(false);
  const checkpoints = project.detail?.checkpoints ?? [];
  const progress = completion(project);
  const tabs: {id:Tab;title:string}[]=[{id:"overview",title:"Обзор"},{id:"tasks",title:"Задачи"},{id:"progress",title:"Прогресс"},{id:"contribution",title:"Мой вклад"},{id:"team",title:"Команда"},{id:"rewards",title:"Бонусы и выгоды"}];
  return <div className="mp-detail" data-project-screen="detail">
    <nav className="mp-breadcrumb" aria-label="Путь"><button type="button" onClick={onBack}><ArrowLeft size={16}/> Мои проекты</button><span>/</span><span>{project.work.task.title}</span></nav>
    <div className="mp-detail-top">
      <header className="mp-detail-hero mp-surface">
        <div className="mp-detail-hero__upper">
          <CompanyIcon name={projectCompany(project)}/>
          <div className="mp-detail-hero__name"><small>{projectCompany(project)} · Заказчик</small><h1 id="workspace-title">{project.work.task.title}</h1><div className="mp-chip-row"><em>Практика</em><em>Реальный проект</em><em>Командная работа</em></div></div>
          <Status status={project.work.assignment.status}/>
        </div>
        <div className="mp-detail-hero__lower">
          <div className="mp-detail-hero__progress"><span>Твой прогресс</span><ProgressBar value={progress}/><small>Срок · {dateLabel(project.work.terms.deadline_at)}</small></div>
          <button type="button" className="mp-primary" onClick={onWorkspace}>Продолжить работу <ArrowRight size={18}/></button>
        </div>
      </header>
      <section className="mp-detail-earnings mp-surface" aria-label="Возможные награды за проект">
        <h2>Твои выгоды за этот проект</h2>
        <div className="mp-detail-earnings__grid">
          {benefits.slice(0,3).map(reward=>{
            const Icon=reward.icon;
            return <button key={reward.id} type="button" onClick={()=>{setTab("rewards");setRewardFocus(reward.id);}}>
              <Icon size={23}/><span><strong>{reward.title}</strong><small>{reward.unlock}</small></span>
            </button>;
          })}
        </div>
        <p>Начисления и условия подтверждаются организаторами</p>
      </section>
    </div>
    <div className="mp-detail-opportunities">
      <button type="button" onClick={()=>{setTab("rewards");setRewardFocus("internship");}}><BriefcaseBusiness size={19}/><span><strong>Возможность стажировки</strong><small>После выполнения условий программы</small></span><ArrowRight size={15}/></button>
      <button type="button" onClick={()=>{setTab("rewards");setRewardFocus("community");}}><Users size={19}/><span><strong>Закрытое комьюнити лучших</strong><small>После 10 подтверждённых проектов</small></span><ArrowRight size={15}/></button>
    </div>
    <div className="mp-detail-tabs" role="tablist" aria-label="Разделы проекта">{tabs.map(item=><button key={item.id} type="button" role="tab" aria-selected={tab===item.id} className={tab===item.id?"is-active":""} onClick={()=>{ setTab(item.id); }}>{item.title}</button>)}</div>

    {tab==="overview" && <div className="mp-overview-layout" role="tabpanel" aria-label="Обзор проекта">
      <div className="mp-detail-stack mp-detail-stack--main">
        <section className="mp-surface mp-detail-panel mp-summary-panel">
          <h2><FileText/> О проекте</h2>
          <p className="mp-summary-lead">{project.detail?.problem || project.work.terms.deliverable}</p>
          <div className="mp-outcome-band"><span>Что нужно получить в результате</span><strong>{project.detail?.deliverable || project.work.terms.deliverable}</strong></div>
          {(project.work.task.competency_tags?.length ?? 0)>0 && <div className="mp-skill-tags"><span>Навыки проекта</span>{(project.work.task.competency_tags ?? []).map(tag=><em key={tag}>{tag}</em>)}</div>}
        </section>
        <section className="mp-surface mp-detail-panel">
          <header><h2><CheckCircle2/> Критерии приёмки</h2><button className="mp-inline-action" type="button" onClick={()=>setTab("tasks")}>Все требования <ArrowRight size={15}/></button></header>
          <p className="mp-panel-caption">Именно по этим пунктам заказчик проверяет результат. Галочки здесь не означают автоматического зачёта.</p>
          <ul className="mp-criteria-list">{project.work.terms.acceptance_criteria.slice(0,5).map((criterion,index)=><li key={index}><span>{index+1}</span><p>{criterion}</p></li>)}</ul>
          {project.work.terms.acceptance_criteria.length===0 && <p className="mp-muted">Критерии приёмки пока не опубликованы</p>}
          {project.work.terms.acceptance_criteria.length>5&&<button className="mp-inline-action" type="button" onClick={()=>setTab("tasks")}>Ещё критерии: {project.work.terms.acceptance_criteria.length-5} <ArrowRight size={15}/></button>}
        </section>
        <section className="mp-surface mp-detail-panel">
          <header><h2><Layers3/> Ближайшие этапы</h2><button className="mp-inline-action" type="button" onClick={()=>setTab("progress")}>Весь прогресс <ArrowRight size={15}/></button></header>
          {checkpoints.length>0?<div className="mp-overview-checkpoints">{checkpoints.slice(0,4).map((cp,index)=><div className="mp-overview-checkpoint" key={cp.key}><span className={finishedCheckpoint.has(cp.status)?"is-done":""}>{finishedCheckpoint.has(cp.status)?<Check size={14}/>:index+1}</span><div><strong>{cp.title}</strong><small>{finishedCheckpoint.has(cp.status)?"Подтверждено":statusText[cp.status] || cp.status}</small></div></div>)}</div>:<p className="mp-muted">План этапов пока не опубликован заказчиком</p>}
        </section>
      </div>
      <div className="mp-detail-stack mp-detail-stack--side">
        <section className="mp-surface mp-detail-panel">
          <h2><Info/> Ключевая информация</h2>
          <div className="mp-key-facts">
            <span><BriefcaseBusiness size={17}/> Заказчик <strong>{projectCompany(project)}</strong></span>
            <span><CalendarDays size={17}/> Дедлайн <strong>{dateLabel(project.work.terms.deadline_at)}</strong></span>
            <span><FileText size={17}/> Условия <strong>Версия {project.work.terms.version}</strong></span>
            <span><Users size={17}/> Участники <strong>{project.detail?.team?.length ?? "Не указано"}</strong></span>
          </div>
        </section>
        <section className="mp-surface mp-detail-panel mp-compact-progress">
          <header><h2>Прогресс проекта</h2><strong>{progress===null?"—":String(progress)+"%"}</strong></header>
          <ProgressBar value={progress}/>
          <p>{checkpoints.length>0?String(checkpoints.filter(cp=>finishedCheckpoint.has(cp.status)).length)+" из "+String(checkpoints.length)+" этапов подтверждено":"Прогресс появится после подтверждения этапов"}</p>
          <button className="mp-inline-action" type="button" onClick={()=>setTab("progress")}>Подробнее о ходе работы <ArrowRight size={15}/></button>
        </section>
        <section className="mp-surface mp-detail-panel">
          <header><h2><Users/> Команда</h2><button className="mp-inline-action" type="button" onClick={()=>setTab("team")}>Все участники <ArrowRight size={15}/></button></header>
          {(project.detail?.team ?? []).slice(0,3).map(person=><div className="mp-team-member" key={person.person_id}><span>{person.display_name.slice(0,1)}</span><div><strong>{person.display_name}</strong><small>{person.status}</small></div><button type="button" className="mp-secondary" onClick={()=>onMessage(person.person_id)} aria-label={"Написать "+person.display_name}><MessageCircle size={15}/></button></div>)}
          {(project.detail?.team?.length ?? 0)===0&&<p className="mp-muted">Состав команды пока не опубликован</p>}
        </section>
        <section className="mp-surface mp-detail-panel mp-summary-contribution">
          <header><h2><FileText/> Мой вклад</h2><button className="mp-inline-action" type="button" onClick={()=>setTab("contribution")}>Открыть <ArrowRight size={15}/></button></header>
          <div className="mp-mini-stat"><strong>{project.work.contributions.length}</strong><span>отправленных версий</span></div>
          {project.work.contributions.length>0?<p>{project.work.contributions[project.work.contributions.length-1]?.personal_summary}</p>:<p>Опиши сделанную работу и приложи доказательство, чтобы заказчик мог оценить твой результат.</p>}
        </section>
      </div>
    </div>}
    {tab==="tasks" && <div className="mp-detail-tab-layout" role="tabpanel" aria-label="Задачи">
      <div className="mp-detail-stack">
        <section className="mp-surface mp-detail-panel mp-task-intro">
          <header><h2><FileText/> Что нужно сделать</h2><Status status={project.work.assignment.status}/></header>
          <p>{project.detail?.problem || project.work.terms.deliverable}</p>
          <div className="mp-outcome-band"><span>Результат для заказчика</span><strong>{project.detail?.deliverable || project.work.terms.deliverable}</strong></div>
        </section>
        <section className="mp-surface mp-detail-panel">
          <header><h2><CheckCircle2/> Требования к результату</h2><span className="mp-muted">{project.work.terms.acceptance_criteria.length} критериев</span></header>
          <p className="mp-panel-caption">Требования версии {project.work.terms.version}. Только проверка заказчика подтверждает выполнение.</p>
          <ul className="mp-criteria-list mp-criteria-list--large">{project.work.terms.acceptance_criteria.map((criterion,index)=><li key={index}><span>{index+1}</span><p>{criterion}</p></li>)}</ul>
          {project.work.terms.acceptance_criteria.length===0&&<p className="mp-muted">Критерии пока не опубликованы</p>}
        </section>
      </div>
      <div className="mp-detail-stack">
        <section className="mp-surface mp-detail-panel">
          <h2><Layers3/> Как проходит работа</h2>
          <ol className="mp-explain-steps"><li><strong>Изучи условия</strong><p>Проверь ожидаемый результат и критерии приёмки</p></li><li><strong>Подготовь решение</strong><p>Работай над артефактами в рабочей области проекта</p></li><li><strong>Передай результат</strong><p>Опиши личный вклад и приложи проверяемое доказательство</p></li><li><strong>Получай обратную связь</strong><p>Заказчик оценит результат или запросит доработку</p></li></ol>
        </section>
        <section className="mp-surface mp-detail-panel mp-action-panel">
          <h2><CalendarDays/> Сроки и условия</h2>
          <div className="mp-key-facts"><span><CalendarDays size={16}/> Дедлайн <strong>{dateLabel(project.work.terms.deadline_at)}</strong></span><span><FileText size={16}/> Условия <strong>Версия {project.work.terms.version}</strong></span></div>
          <button className="mp-primary" type="button" onClick={onWorkspace}>Открыть рабочую область <ArrowRight size={16}/></button>
          <button className="mp-secondary" type="button" onClick={()=>setTab("contribution")}>Мой вклад и сдача результата</button>
        </section>
      </div>
    </div>}
    {tab==="progress" && <div className="mp-detail-tab-layout" role="tabpanel" aria-label="Прогресс">
      <div className="mp-detail-stack">
        <section className="mp-surface mp-detail-panel">
          <header><h2><Layers3/> Этапы проекта</h2><strong className="mp-accent-number">{progress===null?"Нет оценки":String(progress)+"%"}</strong></header>
          <p className="mp-panel-caption">Прогресс рассчитывается по подтверждённым этапам, а не по просмотрам страницы или отметкам пользователя.</p>
          {checkpoints.length>0?checkpoints.map((cp,index)=><div className="mp-progress-stage" key={cp.key}><span className={finishedCheckpoint.has(cp.status)?"is-done":""}>{finishedCheckpoint.has(cp.status)?<Check size={16}/>:index+1}</span><div><strong>{cp.title}</strong><small>{finishedCheckpoint.has(cp.status)?"Подтверждён":statusText[cp.status] || cp.status}</small><ProgressBar compact value={finishedCheckpoint.has(cp.status)?100:null}/></div></div>):<p className="mp-muted">Заказчик пока не опубликовал этапы. Когда они появятся, здесь будет виден ход подтверждения.</p>}
        </section>
        <section className="mp-surface mp-detail-panel">
          <header><h2><MessageCircle/> Решения по проверкам</h2><span className="mp-muted">{project.work.decisions.length}</span></header>
          {project.work.decisions.length>0?project.work.decisions.map(decision=><article className="mp-history-item" key={decision.id}><strong>{decision.decision}</strong><p>{decision.reason || "Комментарий не добавлен"}</p>{decision.deadline_at&&<small>Срок доработки: {dateLabel(decision.deadline_at)}</small>}</article>):<p className="mp-muted">Решений по проверкам пока нет</p>}
        </section>
      </div>
      <div className="mp-detail-stack">
        <section className="mp-surface mp-detail-panel mp-progress-aside">
          <h2><Info/> Сводка</h2>
          <div className="mp-mini-stat"><strong>{checkpoints.filter(cp=>finishedCheckpoint.has(cp.status)).length} / {checkpoints.length}</strong><span>подтверждённых этапов</span></div>
          <div className="mp-key-facts"><span><CalendarDays size={16}/> Дедлайн <strong>{dateLabel(project.work.terms.deadline_at)}</strong></span><span><FileText size={16}/> Версии вклада <strong>{project.work.contributions.length}</strong></span></div>
          <button className="mp-secondary" type="button" onClick={onWorkspace}>Продолжить работу <ArrowRight size={16}/></button>
        </section>
        <section className="mp-surface mp-detail-panel"><h2><CheckCircle2/> Что считается завершением</h2><p>Подтверждение контрольных этапов и приёмка результата заказчиком. При запросе доработки замечания остаются в истории проверок.</p><Status status={project.work.assignment.status}/></section>
      </div>
    </div>}
    {tab==="contribution" && <div className="mp-detail-tab-layout" role="tabpanel" aria-label="Мой вклад">
      <div className="mp-detail-stack">
        <section className="mp-surface mp-detail-panel">
          <h2><FileText/> Мой личный вклад</h2>
          <p className="mp-panel-caption">Вклад — это конкретная выполненная работа, которую можно проверить по материалам. Отправка версии не означает её принятие.</p>
          {(project.work.assignment.status==="staffed"||project.work.assignment.status==="revision_requested")?<div className="mp-action-panel"><p>{project.work.assignment.status==="revision_requested"?"Заказчик запросил доработку. Начни новую итерацию и подготовь исправления.":"Начни работу над проектом, затем появится возможность отправить результат."}</p><button className="mp-primary" type="button" disabled={starting} onClick={onStart}>{starting?"Сохраняем…":project.work.assignment.status==="revision_requested"?"Начать доработку":"Начать работу"} <ArrowRight size={16}/></button></div>:project.work.assignment.status==="in_progress"?<form className="mp-contribute-form" onSubmit={e=>{e.preventDefault();onSubmitContribution(summary,artifact,artifactKey);}}><label>Что сделано лично<textarea required minLength={20} value={summary} onChange={e=>setSummary(e.target.value)} placeholder="Опиши выполненную работу, свою роль и полученный результат…"/></label><label>Ссылка на доказательство<input type="url" value={artifact} onChange={e=>setArtifact(e.target.value)} placeholder="https://…"/></label>{(project.work.allowed_artifacts?.length ?? 0)>0&&<label>Тип доказательства<select aria-label="Тип доказательства" value={artifactKey} onChange={e=>setArtifactKey(e.target.value)}>{(project.work.allowed_artifacts ?? []).map(key=><option key={key} value={key}>{key}</option>)}</select></label>}<button type="submit" disabled={saving} className="mp-primary">{saving?"Отправляем…":"Отправить вклад"} <ArrowRight size={16}/></button>{saveError&&<p role="alert">Не удалось отправить вклад. Проверь поля и соединение.</p>}</form>:<div className="mp-action-panel"><Status status={project.work.assignment.status}/><p>Сейчас история доступна для просмотра. Отправка новой версии зависит от состояния проекта.</p></div>}
        </section>
        <section className="mp-surface mp-detail-panel">
          <header><h2><FileText/> История версий</h2><span className="mp-muted">{project.work.contributions.length}</span></header>
          {project.work.contributions.length>0?project.work.contributions.map(item=><article className="mp-history-item" key={item.id}><strong>Версия {item.version}</strong><small>{item.status}</small><p>{item.personal_summary}</p>{item.artifact_keys.length>0&&<span className="mp-muted">Материалы: {item.artifact_keys.join(", ")}</span>}</article>):<p className="mp-muted">Отправленных версий пока нет</p>}
        </section>
      </div>
      <div className="mp-detail-stack">
        <section className="mp-surface mp-detail-panel">
          <header><h2><Award/> Обратная связь</h2><span className="mp-muted">{project.detail?.feedback?.length ?? 0}</span></header>
          {(project.detail?.feedback?.length ?? 0)>0?(project.detail?.feedback ?? []).map(item=><article className="mp-history-item" key={item.contribution_id+"-"+item.review_version}><strong>Версия {item.contribution_version} · {item.grade}</strong><small>{item.status}</small><p>{item.explanation || "Комментарий отсутствует"}</p></article>):<p className="mp-muted">Оценка появится здесь после проверки отправленного результата</p>}
        </section>
        <section className="mp-surface mp-detail-panel"><h2><Info/> Как подтвердить вклад</h2><ol className="mp-explain-steps"><li><strong>Опиши результат</strong><p>Что сделал именно ты и почему это важно для задачи</p></li><li><strong>Приложи доказательство</strong><p>Ссылку на артефакт, по которому можно проверить работу</p></li><li><strong>Дождись проверки</strong><p>Решение и комментарии сохранятся в истории</p></li></ol></section>
      </div>
    </div>}
    {startError&&<p className="mp-action-error" role="alert">Не удалось начать работу. Обнови проект и повтори попытку.</p>}
    {tab==="team" && <div className="mp-detail-tab-layout" role="tabpanel" aria-label="Команда">
      <div className="mp-detail-stack">
        <section className="mp-surface mp-detail-panel">
          <header><h2><Users/> Участники проекта</h2><span className="mp-muted">{project.detail?.team?.length ?? 0} участников</span></header>
          {(project.detail?.team?.length ?? 0)>0?(project.detail?.team ?? []).map(person=><div className="mp-team-member mp-team-member--full" key={person.person_id}><span>{person.display_name.slice(0,1).toUpperCase()}</span><div><strong>{person.display_name}</strong><small>{person.status}</small></div><button className="mp-secondary" type="button" onClick={()=>onMessage(person.person_id)}><MessageCircle size={16}/> Написать</button></div>):<p className="mp-muted">Состав участников ещё не опубликован</p>}
        </section>
      </div>
      <div className="mp-detail-stack">
        <section className="mp-surface mp-detail-panel">
          <h2><BriefcaseBusiness/> Контакты по проекту</h2>
          <div className="mp-contact-card"><small>Заказчик</small><strong>{project.detail?.customer?.display_name || projectCompany(project)}</strong></div>
          <div className="mp-contact-card"><small>Ментор</small><strong>{project.detail?.mentor?.display_name || "Пока не назначен"}</strong></div>
          <button className="mp-secondary" type="button" onClick={()=>onMessage()}>Обсуждение проекта <MessageCircle size={16}/></button>
        </section>
        <section className="mp-surface mp-detail-panel"><h2><Info/> Совместная работа</h2><p>Обсуждайте решения в сообщениях, а персональные результаты фиксируйте во вкладке «Мой вклад». Так оценка не теряется внутри общей работы команды.</p><button className="mp-inline-action" type="button" onClick={()=>setTab("contribution")}>Посмотреть мой вклад <ArrowRight size={15}/></button></section>
      </div>
    </div>}
    {tab==="rewards" && <div className="mp-rewards-layout" role="tabpanel" aria-label="Бонусы и выгоды">
      <section className="mp-surface mp-detail-panel">
        <header><h2><Gift/> Возможности по мере выполнения проектов</h2><span className="mp-muted">Условия программы</span></header>
        <p className="mp-panel-caption">Указаны пороги участия в программе. Достижение порога открывает возможность, но не гарантирует выдачу бонуса или трудоустройство.</p>
        <div className="mp-rewards-full">{benefits.filter(item=>item.id!=="assessment"&&item.id!=="portfolio").map(item=>{const Icon=item.icon;return <button type="button" key={item.id} className={rewardFocus===item.id?"is-active":""} aria-pressed={rewardFocus===item.id} onClick={()=>setRewardFocus(item.id)}><Icon size={24}/><strong>{item.title}</strong><span>{item.unlock}</span><ArrowRight size={16}/></button>})}</div>
        {rewardFocus&&<div className="mp-reward-notice" role="status"><strong>{benefits.find(item=>item.id===rewardFocus)?.title}</strong><p>Возможность рассматривается по правилам программы. Подтверждение права на получение и условия выдачи зависят от организаторов.</p></div>}
      </section>
      <div className="mp-detail-stack">
        <section className="mp-surface mp-detail-panel">
          <h2><Star/> Результаты каждого проекта</h2>
          <div className="mp-permanent-benefit"><FileText size={20}/><div><strong>Пополнение портфолио</strong><p>После подтверждения результата данные о проекте и личном вкладе становятся частью портфолио.</p></div></div>
          <div className="mp-permanent-benefit"><Award size={20}/><div><strong>Оценка личного вклада</strong><p>При сдаче результата заказчик может проверить работу и предоставить обратную связь.</p></div></div>
        </section>
        <section className="mp-surface mp-detail-panel"><h2><Info/> Что важно знать</h2><p>Бонусы программы и подтверждение компетенций — разные вещи. Версии решений, оценки и результаты проверок хранятся в разделе «Мой вклад».</p><button className="mp-secondary" type="button" onClick={()=>setTab("contribution")}>Перейти к моему вкладу <ArrowRight size={16}/></button></section>
      </div>
    </div>}
    <footer className="mp-detail-footer"><button type="button" className="mp-secondary" onClick={onBack}><ArrowLeft size={15}/> Все проекты</button><button type="button" className="mp-secondary" onClick={()=>{onMessage();}}><MessageCircle size={15}/> Обсуждение</button><button className="mp-secondary" type="button" onClick={()=>{void navigator.clipboard.writeText(window.location.href).then(()=>{setCopied(true);}).catch(()=>{setCopied(false);});}}><Share2 size={15}/>{copied?"Ссылка скопирована":"Поделиться"}</button><button className="mp-primary" type="button" onClick={onWorkspace}>Перейти к задачам <ArrowRight size={16}/></button></footer>
  </div>;
}
export function ParticipantProjectsV2() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [params,setParams] = useSearchParams();
  const [focus,setFocus] = useState<string|null>(null);
  const [saved,setSaved] = useState<string[]>(()=>{
    try {
      const stored=JSON.parse(localStorage.getItem("impulse_favorite_projects")??"[]") as unknown;
      return Array.isArray(stored)?stored.filter((value):value is string=>typeof value==="string"):[];
    } catch { return []; }
  });
  useEffect(()=>{localStorage.setItem("impulse_favorite_projects",JSON.stringify(saved));},[saved]);
  const [rewardFocus,setRewardFocus] = useState<string|null>(null);
  const layout:View=params.get("layout")==="cards"?"cards":"list";
  const filter:Filter=filterChoices.some(c=>c.key===params.get("filter"))?params.get("filter") as Filter:"all";
  const selectedId=params.get("project");
  const [text,setText]=useState("");
  const [company,setCompany]=useState("all");
  const [deadlineFilter,setDeadlineFilter]=useState("all");
  const [sort,setSort]=useState("deadline");
  const [workspaceTab,setWorkspaceTab]=useState(false);
  const [showHelp,setShowHelp]=useState(false);
  const work=useQuery({queryKey:["my-work"],queryFn:()=>apiRequest<WorkItem[]>("/api/v1/me/work"),refetchOnMount:"always"});
  const details=useQueries({queries:(work.data??[]).slice(0,30).map(item=>({
    queryKey:["workspace-task-detail",item.task.id],
    queryFn:()=>apiRequest<TaskDetail>(`/api/v1/me/tasks/${item.task.id}`),
    retry:false,staleTime:60000,
  }))});
  const projects:Project[]=(work.data??[]).map((item,index)=>({work:item,detail:details[index]?.data}));
  const selected=projects.find(x=>x.work.assignment.id===selectedId);

  const open=(id:string,tab:Tab="overview")=>{setWorkspaceTab(false);setParams(previous=>{const next=new URLSearchParams(previous);next.set("project",id);next.set("tab",tab);return next;});};
  const back=()=>{setWorkspaceTab(false);setParams(previous=>{const next=new URLSearchParams(previous);next.delete("project");next.delete("tab");return next;});};
  const setLayout=(value:View)=>{setParams(previous=>{const next=new URLSearchParams(previous);next.set("layout",value);return next;});};
  const setFilter=(value:Filter)=>{setParams(previous=>{const next=new URLSearchParams(previous);if(value==="all")next.delete("filter");else next.set("filter",value);return next;});};
  const start=useMutation({mutationFn:(id:string)=>apiRequest(`/api/v1/me/assignments/${id}/start`,{method:"POST",headers:{"X-CSRF-Token":sessionStorage.getItem("impulse_csrf")??""}}),onSuccess:()=>client.invalidateQueries({queryKey:["my-work"]})});
  const contribute=useMutation({mutationFn:({id,summary,url,artifactKey}:{id:string;summary:string;url:string;artifactKey:string})=>apiRequest(`/api/v1/me/assignments/${id}/contributions`,{method:"POST",headers:{"X-CSRF-Token":sessionStorage.getItem("impulse_csrf")??""},body:JSON.stringify({personal_summary:summary,artifacts:url?[{key:artifactKey,uri:url}]:[]})}),onSuccess:()=>client.invalidateQueries({queryKey:["my-work"]})});
  const companies=[...new Set(projects.map(projectCompany))].sort();
  const visible=projects.filter(project=>{
    const status=project.work.assignment.status;
    if(filter==="active"&&!activeStatuses.has(status)||filter==="review"&&!reviewStatuses.has(status)||filter==="finished"&&!finishedStatuses.has(status))return false;
    if(company!=="all"&&projectCompany(project)!==company)return false;
    if(deadlineFilter!=="all"){
      const remaining=new Date(project.work.terms.deadline_at).getTime()-Date.now();
      if(!Number.isFinite(remaining))return false;
      if(deadlineFilter==="overdue" && remaining>=0)return false;
      if(deadlineFilter==="week" && (remaining<0 || remaining>7*86400000))return false;
      if(deadlineFilter==="month" && (remaining<0 || remaining>30*86400000))return false;
    }
    return !text||[project.work.task.title,project.work.terms.deliverable,projectCompany(project)].some(x=>x.toLowerCase().includes(text.toLowerCase()));
  }).sort((a,b)=>sort==="title"?a.work.task.title.localeCompare(b.work.task.title,"ru"):sort==="progress"?(completion(b)??-1)-(completion(a)??-1):new Date(a.work.terms.deadline_at).getTime()-new Date(b.work.terms.deadline_at).getTime());
  const finished=projects.filter(p=>finishedStatuses.has(p.work.assignment.status)).length;
  if(work.isPending) return <StatePanel kind="loading"/>;
  if(work.isError)return <StatePanel kind="error" action="Повторить" onAction={()=>{void work.refetch();}}/>;
  if(selected&&workspaceTab)return <div className="mpv2 mpv2--workspace">
    <ProjectDashboard
      project={{
        title:selected.work.task.title,
        customer:projectCompany(selected),
        status:selected.work.assignment.status,
        deadline:selected.work.terms.deadline_at,
        deliverable:selected.detail?.deliverable || selected.work.terms.deliverable,
        problem:selected.detail?.problem,
        version:selected.work.terms.version,
        competencyTags:selected.work.task.competency_tags ?? [],
        criteria:selected.work.terms.acceptance_criteria,
        allowedArtifacts:selected.work.allowed_artifacts ?? [],
        team:selected.detail?.team ?? [],
        mentor:selected.detail?.mentor?.display_name,
        checkpoints:selected.detail?.checkpoints ?? [],
        contributions:selected.work.contributions,
        feedback:selected.detail?.feedback ?? [],
      }}
      onBack={()=>{setWorkspaceTab(false);}}
      onChat={()=>{void navigate(`/workspace/10?task=${encodeURIComponent(selected.work.task.id)}`);}}
      onOpenMember={personId=>{void navigate(`/workspace/10?task=${encodeURIComponent(selected.work.task.id)}&participant=${encodeURIComponent(personId)}`);}}
      onUpload={()=>{
        setWorkspaceTab(false);
        setParams(previous=>{
          const next=new URLSearchParams(previous);
          next.set("tab","contribution");
          return next;
        });
      }}
    />
  </div>;
  if(selected)return <div className="mpv2"><ProjectDetail key={selected.work.assignment.id} initialTab={(["overview","tasks","progress","contribution","team","rewards"] as const).find(tab=>tab===params.get("tab"))??"overview"} project={selected} onBack={back} onWorkspace={()=>{ setWorkspaceTab(true); }} onMessage={(personId)=>{ void navigate(`/workspace/10?task=${encodeURIComponent(selected.work.task.id)}${personId?`&participant=${encodeURIComponent(personId)}`:""}`); }} onSubmitContribution={(summary,url,artifactKey)=>{contribute.mutate({id:selected.work.assignment.id,summary,url,artifactKey});}} saving={contribute.isPending} saveError={contribute.isError} onStart={()=>{ start.mutate(selected.work.assignment.id); }} starting={start.isPending} startError={start.isError}/></div>;
  return <div className="mpv2" data-project-screen={layout}>
    <header className="mp-page-title"><div className="mp-page-title__row"><div><p className="mp-eyebrow">ПРАКТИКА И ЛИЧНЫЙ ВКЛАД</p><h1 id="workspace-title">Мои проекты</h1><p>Активно работай над проектами, развивай навыки в команде, отслеживай свой вклад и получай реальные выгоды.</p></div><button type="button" className="mp-help" onClick={()=>{setShowHelp(value=>!value);}} aria-expanded={showHelp} aria-controls="mp-help-panel"><Info size={15}/> Как это работает?</button></div></header>
    {showHelp&&<div id="mp-help-panel" className="mp-help-banner" role="region" aria-label="Как работают мои проекты"><span><strong>1.</strong> Проекты появляются после принятия назначения</span><span><strong>2.</strong> Работайте с командой и отправляйте личный вклад</span><span><strong>3.</strong> Заказчик проверяет результат, а возможности и награды зависят от условий программы</span></div>}
    <RewardsPath completedCount={finished} onSelect={setRewardFocus}/>
    {rewardFocus&&<div className="mp-reward-popup" role="status"><div><Gift size={17}/><span><strong>{benefits.find(x=>x.id===rewardFocus)?.title}</strong> — {benefits.find(x=>x.id===rewardFocus)?.unlock}. Условия участия и выдачи подтверждаются организатором.</span></div><button type="button" onClick={()=>{ setRewardFocus(null); }} aria-label="Закрыть информацию о бонусе">×</button></div>}
    <section className="mp-toolbar" aria-label="Управление проектами">
      <div className="mp-filters" role="group" aria-label="Статус проектов">{filterChoices.map(item=><button type="button" aria-pressed={filter===item.key} className={filter===item.key?"is-active":""} onClick={()=>{ setFilter(item.key); }} key={item.key}>{item.title} ({item.key==="all"?projects.length:item.key==="active"?projects.filter(p=>activeStatuses.has(p.work.assignment.status)).length:item.key==="review"?projects.filter(p=>reviewStatuses.has(p.work.assignment.status)).length:finished})</button>)}</div>
      <label className="mp-select"><span className="mp-visually-hidden">Компания</span><select aria-label="Компания" value={company} onChange={e=>{ setCompany(e.target.value); }}><option value="all">Все компании</option>{companies.map(name=><option value={name} key={name}>{name}</option>)}</select><ChevronDown size={14}/></label>
      <label className="mp-select"><span className="mp-visually-hidden">Сроки</span><select aria-label="Сроки" value={deadlineFilter} onChange={e=>{setDeadlineFilter(e.target.value);}}><option value="all">Все сроки</option><option value="week">Ближайшие 7 дней</option><option value="month">Ближайшие 30 дней</option><option value="overdue">Просрочено</option></select><ChevronDown size={14}/></label>
      <label className="mp-select"><span className="mp-visually-hidden">Сортировка</span><select aria-label="Сортировка" value={sort} onChange={e=>{ setSort(e.target.value); }}><option value="deadline">По сроку</option><option value="progress">По прогрессу</option><option value="title">По названию</option></select><ChevronDown size={14}/></label>
      <div className="mp-toolbar-spacer"/>
      <div className="mp-layout" role="group" aria-label="Режим проектов"><button type="button" onClick={()=>{ setLayout("cards"); }} aria-pressed={layout==="cards"} className={layout==="cards"?"is-active":""}><LayoutGrid size={15}/> Карточки</button><button type="button" onClick={()=>{ setLayout("list"); }} aria-pressed={layout==="list"} className={layout==="list"?"is-active":""}><List size={16}/> Список</button></div>
    </section>
    {work.data.length===0?<div className="mp-empty mp-surface"><FolderKanban size={34}/><h2>Пока нет принятых проектов</h2><p>После принятия назначения проект появится здесь. Откликнуться на новые задачи можно в каталоге.</p><button className="mp-primary" onClick={()=>{ void navigate("/workspace/3"); }}>Перейти к задачам <ArrowRight size={16}/></button></div>:
      <>
      {layout==="cards"?<div className="mp-card-layout" data-reference="my-projects-approved-cards">
        <div className="mp-card-list">
          <div className="mp-card-list__header"><h2>Мои проекты</h2>
            <label><Search size={17}/><input aria-label="Поиск проектов" placeholder="Поиск проектов" value={text} onChange={e=>{setText(e.target.value);}}/></label>
          </div>
          {visible.map(project=><ProjectSidebarRow key={project.work.assignment.id} project={project}
            selected={(focus??visible[0]?.work.assignment.id)===project.work.assignment.id}
            onSelect={()=>{setFocus(project.work.assignment.id);}}
            onOpen={()=>{open(project.work.assignment.id);}}
            saved={saved.includes(project.work.assignment.id)}
            onBookmark={()=>{setSaved(prev=>prev.includes(project.work.assignment.id)?prev.filter(id=>id!==project.work.assignment.id):[...prev,project.work.assignment.id]);}}
          />)}
          {visible.length===0&&<p className="mp-muted mp-empty-row">Подходящих проектов нет. Измените фильтры.</p>}
        </div>
        {visible.length>0&&visible.filter(project=>project.work.assignment.id===(visible.find(item=>item.work.assignment.id===focus)?.work.assignment.id??visible[0]?.work.assignment.id)).map(project=>
          <PanelPreview key={project.work.assignment.id} project={project}
            onOpen={(tab)=>{open(project.work.assignment.id,tab);}}
            onRewards={()=>{open(project.work.assignment.id,"rewards");}}
          />
        )}
      </div>:<div className="mp-list-layout"><div className="mp-list-search"><Search size={17}/><input aria-label="Поиск проектов" value={text} onChange={e=>{ setText(e.target.value); }} placeholder="Поиск по проектам, компаниям и результатам"/><SlidersHorizontal size={17}/></div>{visible.length?<ProjectList projects={visible} onOpen={open}/>:<div className="mp-empty-row">По заданным условиям проекты не найдены</div>}</div>}
      </>}
  </div>;
}
