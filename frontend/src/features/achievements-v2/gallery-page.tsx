import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Award, BookOpen, CalendarDays, Check, ChevronDown,
  CircleCheck, Clock3, ExternalLink, FileBadge, FolderOpen, GraduationCap,
  Grid2X2, Medal, Plus, Search, ShieldCheck, Sparkles, Star, Trophy, X,
} from "lucide-react";

import { apiRequest } from "../../api/client";
import { SafeExternalLink } from "../../components/ui";
import {
  achievementCategoryLabels, achievementStatusLabels, achievementSummary, buildAchievements,
  type AchievementCategory, type AchievementClaim, type AchievementEventsPage,
  type AchievementRecord, type AchievementStatus, type AchievementsPortfolio,
} from "./model";
import "./gallery.scss";

type Tab = "all" | AchievementCategory;
type StatusFilter = "all" | AchievementStatus;
type DrawerTab = "description" | "evidence" | "skills" | "related";
type Sort = "new" | "title" | "type";

const tabs: { key: Tab; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "project", label: "Проекты" },
  { key: "certificate", label: "Сертификаты" },
  { key: "trophy", label: "Награды" },
  { key: "event", label: "События" },
];
const icons = {
  project: FolderOpen, certificate: GraduationCap, trophy: Trophy, event: CalendarDays,
};
const names: Record<AchievementCategory,string> = {
  project:"Проект", certificate:"Сертификат", trophy:"Награда", event:"Событие",
};
const drawerTabs: { key: DrawerTab; label: string }[] = [
  { key: "description", label: "Описание" },
  { key: "evidence", label: "Материалы" },
  { key: "skills", label: "Навыки" },
  { key: "related", label: "Связанные" },
];
const validDate = (date?: string): Date | null => {
  if (!date) return null;
  const result = new Date(date);
  return Number.isNaN(result.getTime()) ? null : result;
};
const yearOf = (record: AchievementRecord) => {
  const date = validDate(record.issuedAt);
  return date ? String(date.getFullYear()) : "";
};
const niceDate = (value?: string) => {
  const date = validDate(value);
  return date ? new Intl.DateTimeFormat("ru-RU", { month:"long",year:"numeric" }).format(date) : "Дата не указана";
};
const recordSummary = (record: AchievementRecord): string =>
  record.description.trim() || "Подробные сведения о результате доступны в источнике";

export function ParticipantAchievementsGallery({ navigation = [] }: {navigation?: string[]}) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [year, setYear] = useState("all");
  const [sort, setSort] = useState<Sort>("new");
  const [term, setTerm] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("description");
  const [addDialog, setAddDialog] = useState(false);
  const [addKind, setAddKind] = useState<AchievementCategory>("project");

  const portfolio = useQuery({
    queryKey:["portfolio"],
    queryFn:()=>apiRequest<AchievementsPortfolio>("/api/v1/me/portfolio"),
    refetchOnMount:"always",
  });
  const claims = useQuery({
    queryKey:["event-claims"],
    queryFn:()=>apiRequest<AchievementClaim[]>("/api/v1/me/event-claims"),
    refetchOnMount:"always",
  });
  const events = useQuery({
    queryKey:["ecosystem-events","achievements"],
    queryFn:()=>apiRequest<AchievementEventsPage>("/api/v1/ecosystem/events"),
    enabled:(claims.data?.length ?? 0)>0,
  });
  const records = useMemo(
    ()=>buildAchievements(portfolio.data,claims.data,events.data?.items),
    [portfolio.data,claims.data,events.data],
  );
  const stats = useMemo(()=>achievementSummary(records),[records]);
  const years = useMemo(()=>[...new Set(records.map(yearOf).filter(Boolean))].sort((a,b)=>b.localeCompare(a)),[records]);
  const currentId = params.get("achievement");
  const selected = records.find(record=>record.id===currentId);
  const loading = portfolio.isLoading && claims.isLoading;
  const failed = portfolio.isError || claims.isError;
  const countBy = (kind:Tab) => kind==="all" ? stats.all : records.filter(r=>r.category===kind).length;
  const byStatus = (kind:AchievementCategory) => records.filter(r=>r.category===kind).length;
  const visible = useMemo(()=>{
    const query = term.toLocaleLowerCase("ru-RU").trim();
    return records.filter(record=>
      (tab==="all" || record.category===tab) &&
      (status==="all" || record.status===status) &&
      (year==="all" || yearOf(record)===year) &&
      (!query || [record.title,record.issuer,record.description,...record.evidence].join(" ").toLocaleLowerCase("ru-RU").includes(query)),
    ).sort((a,b)=>{
      if (sort==="title") return a.title.localeCompare(b.title,"ru");
      if (sort==="type") return a.category.localeCompare(b.category) || a.title.localeCompare(b.title,"ru");
      const ad=validDate(a.issuedAt)?.getTime() ?? 0;
      const bd=validDate(b.issuedAt)?.getTime() ?? 0;
      return bd-ad || a.title.localeCompare(b.title,"ru");
    });
  },[records,tab,status,year,term,sort]);
  const open = (record:AchievementRecord) => {
    const next=new URLSearchParams(params);
    next.set("achievement",record.id);
    setDrawerTab("description");
    setParams(next);
  };
  const close = () => {
    const next=new URLSearchParams(params);
    next.delete("achievement");
    setParams(next,{replace:true});
  };
  const goTo=(name:string) => {
    setAddDialog(false);
    close();
    const index=navigation.indexOf(name);
    if(index>=0) void navigate(`/workspace/${String(index)}`);
  };
  const selectFavorite=(id:string) => {
    setFavorites(existing=>existing.includes(id)?existing.filter(key=>key!==id):[...existing,id]);
  };
  const reset = () => {setTab("all");setStatus("all");setYear("all");setSort("new");setTerm("");};
  useEffect(()=>{
    if(!selected && !addDialog) return;
    const onKey=(event:KeyboardEvent) => {
      if(event.key==="Escape") {if(addDialog) setAddDialog(false);else close();}
    };
    document.addEventListener("keydown",onKey);
    return ()=>{document.removeEventListener("keydown",onKey);};
  // Selection is taken from the route; escape closes the active overlay.
  },[selected,addDialog,params,setParams]);

  return <div className="ach-gallery" data-testid="achievements-v2" data-reference="R-PAR-10">
    <section className="ach-gallery-hero" aria-labelledby="workspace-title">
      <div className="ach-gallery-copy">
        <span className="ach-gallery-eyebrow">ДОСТИЖЕНИЯ</span>
        <h1 id="workspace-title">Твои результаты<br/>формируют <span>возможности</span></h1>
        <p>Здесь собраны проекты, сертификаты, награды и другие достижения. Добавляй результаты и укрепляй своё портфолио.</p>
        {portfolio.data?.demo_data && <small className="ach-gallery-demo">Демонстрационный профиль — данные из доступных источников</small>}
      </div>
      <div className="ach-gallery-scene" aria-hidden="true">
        <span className="ach-gallery-holo holo-a"><FolderOpen size={25}/></span>
        <span className="ach-gallery-holo holo-b"><GraduationCap size={24}/></span>
        <span className="ach-gallery-holo holo-c"><Award size={24}/></span>
        <img src="/bootcamp/trophy.svg" alt=""/>
      </div>
      <button type="button" className="ach-gallery-create" onClick={()=>{setAddDialog(true);}}><Plus size={16}/> Добавить достижение</button>
    </section>

    <section className="ach-gallery-stats" aria-label="Статистика достижений">
      <div className="ach-gallery-stat"><span className="stat-icon stat-icon-all"><Trophy size={25}/></span><span><small>Всего достижений</small><strong>{loading?"—":stats.all}</strong><em>из подтверждаемых источников</em></span></div>
      <div className="ach-gallery-stat"><span className="stat-icon stat-icon-project"><FolderOpen size={26}/></span><span><small>Проекты</small><strong>{loading?"—":byStatus("project")}</strong><em>в портфолио</em></span></div>
      <div className="ach-gallery-stat"><span className="stat-icon stat-icon-cert"><FileBadge size={25}/></span><span><small>Сертификаты</small><strong>{loading?"—":byStatus("certificate")}</strong><em>по результатам обучения</em></span></div>
      <div className="ach-gallery-stat"><span className="stat-icon stat-icon-award"><Medal size={26}/></span><span><small>Награды</small><strong>{loading?"—":byStatus("trophy")}</strong><em>победы и призовые места</em></span></div>
    </section>
    {failed&&<div className="ach-gallery-alert" role="status">
      <ShieldCheck size={18}/>
      {portfolio.isError&&claims.isError?"Не удалось загрузить достижения: демонстрационные данные не подставляются.":"Часть данных недоступна, показаны только загруженные достижения."}
      <button type="button" onClick={()=>{void portfolio.refetch();void claims.refetch();}}>Повторить</button>
    </div>}
    <div className="ach-gallery-tools">
      <div className="ach-gallery-tabs" role="group" aria-label="Тип достижений">
        {tabs.map(item=><button type="button" key={item.key} aria-pressed={item.key===tab} className={item.key===tab?"active":""} onClick={()=>{setTab(item.key);}}>{item.label}<span>{countBy(item.key)}</span></button>)}
      </div>
      <div className="ach-gallery-filterbar">
        <label className="ach-gallery-search"><Search size={17}/><input type="search" value={term} onChange={event=>{setTerm(event.target.value);}} aria-label="Поиск по достижениям" placeholder="Поиск по достижениям..."/></label>
        <label className="ach-gallery-select"><span>Статус</span><select aria-label="Статус достижения" value={status} onChange={event=>{setStatus(event.target.value as StatusFilter);}}><option value="all">Все</option><option value="verified">Подтверждено</option><option value="pending">На проверке</option><option value="rejected">Отклонено</option></select><ChevronDown size={12}/></label>
        <label className="ach-gallery-select"><span>Год</span><select aria-label="Год достижения" value={year} onChange={event=>{setYear(event.target.value);}}><option value="all">Все</option>{years.map(value=><option value={value} key={value}>{value}</option>)}</select><ChevronDown size={12}/></label>
        <label className="ach-gallery-select ach-gallery-sort"><span>Сортировка</span><select aria-label="Сортировка достижений" value={sort} onChange={event=>{setSort(event.target.value as Sort);}}><option value="new">Сначала новые</option><option value="title">По названию</option><option value="type">По типу</option></select><ChevronDown size={12}/></label>
        {(tab!=="all"||status!=="all"||year!=="all"||term)&&<button type="button" className="ach-gallery-reset" onClick={reset}>Сбросить</button>}
      </div>
    </div>

    {loading?<div className="ach-gallery-empty" role="status"><Clock3 size={36}/><h2>Загружаем достижения</h2><p>Проверяем данные портфолио и событий</p></div>:
     !visible.length?<div className="ach-gallery-empty" data-testid="achievements-empty">
       <img src="/bootcamp/trophy.svg" alt=""/>
       <h2>{stats.all?"По этим условиям ничего не найдено":"Здесь пока нет достижений"}</h2>
       <p>{stats.all?"Попробуй изменить фильтры или поисковый запрос.":"Добавь свой первый проект, сертификат или награду, чтобы начать формировать портфолио."}</p>
       <button type="button" className="ach-gallery-create" onClick={()=>{if(stats.all)reset();else setAddDialog(true);}}>{stats.all?"Сбросить фильтры":"Добавить достижение"} <Plus size={16}/></button>
       {!stats.all&&<div className="ach-gallery-empty-actions">
         <button type="button" onClick={()=>{goTo("Мои проекты");}}><FolderOpen size={20}/> Добавить проект <ArrowRight size={14}/></button>
         <button type="button" onClick={()=>{goTo("Bootcamp");}}><FileBadge size={20}/> Получить сертификат <ArrowRight size={14}/></button>
         <button type="button" onClick={()=>{goTo("События");}}><Trophy size={20}/> Указать награду <ArrowRight size={14}/></button>
       </div>}
     </div>:<div className="ach-gallery-grid">
       {visible.map(record=>{
         const Icon=icons[record.category];
         return <article className={`ach-gallery-card ach-gallery-card--${record.category}`} key={record.id} data-testid="achievement-card">
           <button type="button" className="ach-gallery-open" onClick={()=>{open(record);}} aria-label={`Подробнее: ${record.title}`}>
             <div className="ach-gallery-art" aria-hidden="true">
               <div className="ach-gallery-art-grid"/><div className="ach-gallery-art-orb"/>
               {record.category==="trophy"?<img src="/bootcamp/trophy.svg" alt=""/>:<Icon size={64} strokeWidth={1.25}/>}
               <span className="ach-gallery-kind">{names[record.category]}</span>
             </div>
             <div className="ach-gallery-card-body">
               <h3>{record.title}</h3>
               <span className="ach-gallery-issuer"><CircleCheck size={13}/>{record.issuer}</span>
               <span className="ach-gallery-date"><CalendarDays size={13}/>{niceDate(record.issuedAt)}</span>
               <div className="ach-gallery-chips"><span>{achievementStatusLabels[record.status]}</span><span>{names[record.category]}</span></div>
             </div>
           </button>
           <button type="button" className={`ach-gallery-star ${favorites.includes(record.id)?"is-starred":""}`} aria-label={favorites.includes(record.id)?"Убрать из избранного":"В избранное"} aria-pressed={favorites.includes(record.id)} onClick={()=>{selectFavorite(record.id);}}><Star size={17} fill={favorites.includes(record.id)?"currentColor":"none"}/></button>
         </article>;
       })}
     </div>}

    {selected&&<div className="ach-gallery-drawer-cover" role="presentation" onMouseDown={event=>{if(event.currentTarget===event.target)close();}}>
      <aside className="ach-gallery-drawer" role="dialog" aria-modal="true" aria-label="Подробности достижения" data-testid="achievement-detail">
        <div className="ach-gallery-drawer-top">
          <button type="button" className="ach-gallery-back" onClick={close}><ArrowLeft size={15}/> Назад</button>
          <div className="ach-gallery-drawer-buttons">
            <button type="button" aria-label={favorites.includes(selected.id)?"Убрать из избранного":"В избранное"} onClick={()=>{selectFavorite(selected.id);}}><Star size={17} fill={favorites.includes(selected.id)?"currentColor":"none"}/></button>
            <button type="button" onClick={close} aria-label="Закрыть подробности"><X size={20}/></button>
          </div>
        </div>
        <div className={`ach-gallery-drawer-art ach-gallery-drawer-art--${selected.category}`}>
          <div className="ach-gallery-drawer-stars" aria-hidden="true"/>
          {selected.category==="trophy"?<img src="/bootcamp/trophy.svg" alt=""/>:<span className="drawer-art-icon">{(()=>{const Icon=icons[selected.category];return <Icon size={100} strokeWidth={1.1}/>;})()}</span>}
          <span className="ach-gallery-detail-badge">{names[selected.category]}</span>
        </div>
        <div className="ach-gallery-drawer-content">
          <h2>{selected.title}</h2>
          <div className="ach-gallery-detail-meta"><span><CircleCheck size={14}/>{selected.issuer}</span><span><CalendarDays size={14}/>{niceDate(selected.issuedAt)}</span></div>
          <div className="ach-gallery-detail-chips"><span>{achievementStatusLabels[selected.status]}</span><span>{names[selected.category]}</span></div>
          <p className="ach-gallery-intro">{recordSummary(selected)}</p>
          <div className="ach-gallery-detail-highlights">
            <div><Trophy size={18}/><strong>{selected.status==="verified"?"Подтверждено":"Ожидает проверки"}</strong><small>Статус результата</small></div>
            <div><ShieldCheck size={18}/><strong>{selected.issuer}</strong><small>Источник</small></div>
          </div>
          <div className="ach-gallery-drawer-tabs" role="tablist" aria-label="Сведения о достижении">
            {drawerTabs.map(item=><button type="button" role="tab" aria-selected={drawerTab===item.key} key={item.key} className={drawerTab===item.key?"active":""} onClick={()=>{setDrawerTab(item.key);}}>{item.label}</button>)}
          </div>
          <div className="ach-gallery-drawer-panel" role="tabpanel">
            {drawerTab==="description"&&<><h3>О достижении</h3><p>{recordSummary(selected)}</p>{selected.verificationId&&<p className="ach-gallery-id">Идентификатор: {selected.verificationId}</p>}</>}
            {drawerTab==="evidence"&&<><h3>Подтверждающие материалы</h3>{selected.evidence.length?selected.evidence.map(item=><div className="ach-gallery-evidence" key={item}><FileBadge size={21}/><span>{item}</span><span>В исходном разделе</span></div>):<p>Прикреплённые материалы не предоставлены. Доступные доказательства можно посмотреть в связанном разделе.</p>}{selected.sourceUrl&&<SafeExternalLink className="ach-gallery-source-link" href={selected.sourceUrl}>Открыть первоисточник <ExternalLink size={15}/></SafeExternalLink>}</>}
            {drawerTab==="skills"&&<><h3>Компетенции</h3><p>Подтверждённые компетенции можно посмотреть в Skill Passport. Они не выводятся здесь без сведений об оценке.</p><button type="button" className="ach-gallery-source-link" onClick={()=>{goTo("Аналитика");}}>Открыть Skill Passport <ArrowRight size={15}/></button></>}
            {drawerTab==="related"&&<><h3>Связанные разделы</h3><p>Перейдите к источнику достижения и изучите документы, результаты и условия проверки.</p><button type="button" className="ach-gallery-source-link" onClick={()=>{goTo(selected.category==="project"?"Мои проекты":selected.category==="certificate"?"Bootcamp":selected.category==="event"?"События":"Портфолио");}}>Открыть связанный раздел <ArrowRight size={15}/></button></>}
          </div>
        </div>
      </aside>
    </div>}

    {addDialog&&<div className="ach-gallery-add-backdrop" role="presentation" onMouseDown={event=>{if(event.currentTarget===event.target)setAddDialog(false);}}>
      <section className="ach-gallery-add" role="dialog" aria-modal="true" aria-label="Добавить достижение" data-testid="achievements-add-dialog">
        <button type="button" className="ach-gallery-add-close" aria-label="Закрыть" onClick={()=>{setAddDialog(false);}}><X size={18}/></button>
        <h2>Добавить достижение</h2><p>Выбери тип результата, чтобы перейти к подтверждению.</p>
        <div className="ach-gallery-add-inner">
          <nav aria-label="Тип результата">
            {(["project","certificate","trophy","event"] as const).map(kind=>{
              const Icon=icons[kind];
              return <button type="button" key={kind} className={addKind===kind?"active":""} onClick={()=>{setAddKind(kind);}}><Icon size={18}/><span>{names[kind]}</span><ChevronDown size={13}/></button>;
            })}
          </nav>
          <div className="ach-gallery-add-preview">
            <span className="ach-gallery-add-icon">{(()=>{const Icon=icons[addKind];return <Icon size={35}/>;})()}</span>
            <h3>Добавить {addKind==="project"?"проект":addKind==="certificate"?"сертификат":addKind==="trophy"?"награду":"результат события"}</h3>
            <p>Укажи информацию и подтверди результат в соответствующем разделе платформы.</p>
            <button type="button" className="ach-gallery-create" onClick={()=>{goTo(addKind==="project"?"Мои проекты":addKind==="certificate"?"Bootcamp":addKind==="trophy"?"Портфолио":"События");}}>Продолжить <ArrowRight size={15}/></button>
          </div>
        </div>
      </section>
    </div>}
  </div>;
}
