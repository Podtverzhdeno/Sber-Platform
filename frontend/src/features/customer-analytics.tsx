
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, ArrowRight, CalendarDays, Check, CheckCircle2, Clock3,
  Flame, FolderOpen, Info, RefreshCw, Target, Users, Zap,
} from "lucide-react";

import { apiRequest } from "../api/client";
import "./customer-analytics.scss";

type ActivityKind =
  | "project_created" | "participant_assigned" | "result_submitted"
  | "result_accepted" | "revision_requested";
type Event = { id: string; kind: ActivityKind; occurred_at: string; task_id: string; task_title: string };
type ActivityResponse = { generated_at: string; window_days: number; events: Event[] };
type Task = { id: string; title: string; status: string };
type Category = "all" | "projects" | "people" | "results" | "decisions";

const groups: { id: Exclude<Category,"all">; label: string; color: string; kinds: ActivityKind[] }[] = [
  { id:"projects", label:"Проекты", color:"#00dcd0", kinds:["project_created"] },
  { id:"people", label:"Участники", color:"#239ffe", kinds:["participant_assigned"] },
  { id:"results", label:"Результаты", color:"#9a5df1", kinds:["result_submitted"] },
  { id:"decisions", label:"Приёмка", color:"#ffb842", kinds:["result_accepted","revision_requested"] },
];
const labels: Record<ActivityKind,string> = {
  project_created:"Создан проект",
  participant_assigned:"Участник назначен",
  result_submitted:"Отправлен результат",
  result_accepted:"Результат принят",
  revision_requested:"Запрошена доработка",
};
const nfmt = new Intl.NumberFormat("ru-RU");
function dayKey(date: Date) {
  return `${String(date.getFullYear())}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function dayFromKey(key: string) {
  const [y,m,d] = key.split("-").map(Number);
  return new Date(y??2000,(m??1)-1,d??1);
}
function eventDay(event:Event) { return dayKey(new Date(event.occurred_at)); }
function eventCategory(kind:ActivityKind):Exclude<Category,"all"> {
  if (kind==="project_created") return "projects";
  if (kind==="participant_assigned") return "people";
  if (kind==="result_submitted") return "results";
  return "decisions";
}
function eventIcon(kind: ActivityKind) {
  if(kind==="project_created") return FolderOpen;
  if(kind==="participant_assigned") return Users;
  if(kind==="result_submitted") return ArrowRight;
  if(kind==="revision_requested") return RefreshCw;
  return CheckCircle2;
}
function todayLabel(value:string) {
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"—":date.toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"});
}
function timeLabel(value:string) {
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"—":date.toLocaleString("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
}
function recentStreak(events:Event[],today:Date) {
  const days=new Set(events.map(eventDay));
  const date=new Date(today.getFullYear(),today.getMonth(),today.getDate());
  if(!days.has(dayKey(date))) date.setDate(date.getDate()-1);
  let streak=0;
  while(days.has(dayKey(date)) && streak<84){streak+=1;date.setDate(date.getDate()-1);}
  return streak;
}
function monday(date:Date) {
  const value=new Date(date.getFullYear(),date.getMonth(),date.getDate());
  value.setDate(value.getDate()-((value.getDay()+6)%7));
  return value;
}
function makeCalendar(weeks:number,now:Date) {
  const first=monday(now);first.setDate(first.getDate()-(weeks-1)*7);
  return Array.from({length:weeks},(_,week)=>{
    const start=new Date(first);start.setDate(start.getDate()+week*7);
    return Array.from({length:7},(_,weekday)=>{
      const date=new Date(start);date.setDate(start.getDate()+weekday);
      return {key:dayKey(date),date,weekday,week};
    });
  });
}
function Trend({values}:{values:number[]}) {
  const highest=Math.max(1,...values);
  const points=values.map((value,i)=>({
    x:28+(values.length<=1?0:(i/(values.length-1))*500),
    y:127-value/highest*105,
  }));
  const line=points.map((point,index)=>`${index===0?"M":"L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area=`${line} L${String(points.at(-1)?.x??528)},137 L28,137 Z`;
  return <div className="ca3-trend">
    <svg viewBox="0 0 555 158" preserveAspectRatio="none" role="img" aria-label="Количество событий по неделям">
      <defs><linearGradient id="customer-activity-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#05eadf" stopOpacity=".27"/><stop offset="1" stopColor="#05eadf" stopOpacity="0"/>
      </linearGradient></defs>
      {[0,1,2,3].map(i=><line key={i} x1="28" x2="528" y1={22+i*38.3} y2={22+i*38.3} stroke="#204156" strokeWidth="1"/>)}
      <path d={area} fill="url(#customer-activity-fill)"/>
      <path d={line} fill="none" stroke="#05e5e0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      {points.map((point,i)=><circle key={i} cx={point.x} cy={point.y} r="4.5" fill="#1ee9e4" stroke="#092638" strokeWidth="2"/>)}
      <text x="1" y="25" fill="#87a9be" fontSize="11">{highest}</text>
      <text x="4" y="139" fill="#87a9be" fontSize="11">0</text>
    </svg>
    <div className="ca3-trend-labels">{values.map((_,i)=><span key={i}>Нед. {i+1}</span>)}</div>
  </div>;
}
function Card({title,description,extra,children,className=""}:{title:string;description:string;extra?:React.ReactNode;children:React.ReactNode;className?:string}) {
  return <section className={`ca3-card ${className}`}>
    <header className="ca3-card-head"><div><h2>{title}</h2><p>{description}</p></div>{extra}</header>{children}
  </section>;
}

export function CustomerAnalytics({navigation=[]}:{navigation?:string[]}) {
  const navigate=useNavigate();
  const [weeks,setWeeks]=useState(8);
  const [category,setCategory]=useState<Category>("all");
  const [projectId,setProjectId]=useState("all");
  const [selectedDay,setSelectedDay]=useState<string|null>(null);
  const activity=useQuery({queryKey:["customer-activity-events"],queryFn:()=>apiRequest<ActivityResponse>("/api/v1/customer/analytics/activity"),refetchOnMount:"always"});
  const tasks=useQuery({queryKey:["customer-tasks"],queryFn:()=>apiRequest<Task[]>("/api/v1/customer/tasks"),refetchOnMount:"always"});
  const events=activity.data?.events??[];
  const now=new Date();
  const calendar=makeCalendar(weeks,now);
  const start=calendar[0]?.[0]?.date??now;
  const end=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  const windowEvents=events.filter(event=>{
    const at=new Date(event.occurred_at);
    return at>=start&&at<end&&(projectId==="all"||event.task_id===projectId);
  });
  const visible=windowEvents.filter(event=>category==="all"||eventCategory(event.kind)===category);
  const counts=new Map<string,number>();
  for(const event of visible) counts.set(eventDay(event),(counts.get(eventDay(event))??0)+1);
  const maxCount=Math.max(0,...counts.values());
  const activeDays=calendar.flat().filter(day=>(counts.get(day.key)??0)>0).length;
  const projectsAdded=windowEvents.filter(event=>event.kind==="project_created").length;
  const periodStreak=recentStreak(windowEvents,now);
  const weekly=calendar.map(days=>days.reduce((sum,day)=>sum+(counts.get(day.key)??0),0));
  const categoryCounts=groups.map(group=>({...group,count:windowEvents.filter(event=>group.kinds.includes(event.kind)).length}));
  const totalCategories=categoryCounts.reduce((sum,item)=>sum+item.count,0);
  let pos=0;
  const gradientStops=categoryCounts.map(group=>{
    const from=pos;pos+=totalCategories>0?group.count/totalCategories*100:0;
    return `${group.color} ${String(from)}% ${String(pos)}%`;
  });
  const donut=totalCategories? `conic-gradient(${gradientStops.join(",")})`:"conic-gradient(#1c4259 0% 100%)";
  const perProject=new Map<string,{id:string;title:string;count:number}>();
  for(const event of visible){
    const item=perProject.get(event.task_id);
    if(item)item.count+=1;
    else perProject.set(event.task_id,{id:event.task_id,title:event.task_title,count:1});
  }
  const ranked=[...perProject.values()].sort((a,b)=>b.count-a.count||a.title.localeCompare(b.title,"ru")).slice(0,5);
  const list=selectedDay?visible.filter(event=>eventDay(event)===selectedDay):visible;
  const lastEvents=[...list].sort((a,b)=>Date.parse(b.occurred_at)-Date.parse(a.occurred_at)).slice(0,5);
  const peak=Math.max(0,...weekly);
  const busiest=weekly.indexOf(peak);
  const currentProject=tasks.data?.find(task=>task.id===projectId);
  const createdLabel=projectId==="all"?"Создано проектов":"Новых проектов";
  const refDate=activity.data?.generated_at??null;
  const navigateTask=(id:string)=>{
    const index=navigation.indexOf("Мои задачи");
    if(index>=0)void navigate(`/workspace/${String(index)}?task=${encodeURIComponent(id)}`);
  };
  const projectNavigation=navigation.includes("Мои задачи");
  const refresh=()=>{void Promise.all([activity.refetch(),tasks.refetch()]);};
  return <main className="customer-activity-v3" data-testid="customer-activity-v3">
    <header className="ca3-page-head">
      <div className="ca3-titles"><span className="ca3-eyebrow">АНАЛИТИКА / АКТИВНОСТЬ</span>
        <h1 id="workspace-title">Активность заказчика</h1>
        <p>Когда вы создаёте проекты и что происходит внутри них: участники, результаты и приёмка</p>
      </div>
      <div className="ca3-actions">
        <label className="ca3-select"><CalendarDays size={17}/><select aria-label="Период аналитики заказчика" value={weeks} onChange={e=>{setWeeks(Number(e.target.value));setSelectedDay(null);}}>
          <option value={4}>Последние 4 недели</option><option value={8}>Последние 8 недель</option><option value={12}>Последние 12 недель</option>
        </select></label>
        <span className="ca3-fresh">{refDate?"● Данные "+todayLabel(refDate):"● Источник не загружен"}</span>
        <button type="button" className="ca3-refresh" aria-label="Обновить активность" title="Обновить активность" onClick={refresh}><RefreshCw size={17}/></button>
      </div>
    </header>
    {(activity.isError||tasks.isError)&&<div className="ca3-alert" role="alert"><Info size={18}/> Часть данных недоступна. Неизвестные значения не считаются нулём <button type="button" onClick={refresh}>Повторить</button></div>}
    {activity.isPending&&<div className="ca3-loading" role="status">Загружаем историю действий…</div>}
    <section className="ca3-metrics" aria-label="Показатели активности заказчика">
      {[
        {name:"Активные дни",value:activity.isSuccess?String(activeDays):"—",detail:`из ${String(weeks*7)} дней`,Icon:CalendarDays,color:"cyan"},
        {name:createdLabel,value:activity.isSuccess?String(projectsAdded):"—",detail:"за выбранный период",Icon:FolderOpen,color:"blue"},
        {name:"Действия в проектах",value:activity.isSuccess?String(windowEvents.length):"—",detail:"назначения, результаты и решения",Icon:Zap,color:"purple"},
        {name:"Текущий стрик",value:activity.isSuccess?`${String(periodStreak)} дн.`:"—",detail:"дни подряд с событиями",Icon:Flame,color:"gold"},
      ].map(item=>{const Icon=item.Icon;return <article key={item.name} className={`ca3-metric ca3-${item.color}`}>
        <div><span className="ca3-metric-icon"><Icon size={26}/></span><small>{item.name}</small></div>
        <strong>{item.value}</strong><span className="ca3-metric-caption">{item.detail}</span>
      </article>})}
    </section>
    <section className="ca3-primary-grid">
      <Card className="ca3-heatmap-card" title="Ритм активности" description={`${weeks === 4 ? "Последние 4 недели" : `Последние ${String(weeks)} недель`} · чем ярче ячейка, тем больше событий в проектах`}
        extra={<div className="ca3-heatmap-controls">
          <select aria-label="Тип событий" value={category} onChange={e=>{setCategory(e.target.value as Category);setSelectedDay(null);}}>
            <option value="all">Все действия</option>{groups.map(group=><option key={group.id} value={group.id}>{group.label}</option>)}
          </select>
          <div className="ca3-heat-legend">Меньше{[0,1,2,3,4].map(x=><i className={`ca3-heat-${String(x)}`} key={x}/>)}Больше</div>
        </div>}>
        <div className="ca3-heatmap-inner">
          <div className="ca3-weekdays">{["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(x=><span key={x}>{x}</span>)}</div>
          <div className="ca3-heatmap-grid">{calendar.map((days,idx)=><div key={idx} className="ca3-heat-column">{days.map(day=>{
            const count=counts.get(day.key)??0;
            const level=count===0?0:maxCount===0?0:Math.max(1,Math.ceil(count/maxCount*4));
            const future=day.date>now;
            return <button type="button" key={day.key} disabled={future||!activity.isSuccess} aria-label={`${todayLabel(day.date.toISOString())}: ${String(count)} событий`}
              title={`${todayLabel(day.date.toISOString())} · ${String(count)} событий`}
              className={`ca3-heat-cell ca3-heat-${String(level)} ${selectedDay===day.key?"is-selected":""}`}
              onClick={()=>{setSelectedDay(selectedDay===day.key?null:day.key);}}/>;})}</div>)}</div>
        </div>
        <div className="ca3-heatmap-labels" style={{gridTemplateColumns:`24px repeat(${String(weeks)},minmax(0,1fr))`}}><span/>{calendar.map((_,idx)=><span key={idx}>Нед. {idx+1}</span>)}</div>
        {selectedDay&&<div className="ca3-day-selection"><span><Check size={14}/> {todayLabel(dayFromKey(selectedDay).toISOString())} · {String(counts.get(selectedDay)??0)} событий</span><button type="button" onClick={()=>{setSelectedDay(null);}}>Сбросить день</button></div>}
        {activity.isSuccess&&windowEvents.length===0&&<p className="ca3-empty-inline">В выбранном периоде пока нет зарегистрированных событий</p>}
      </Card>
      <Card title="Структура активности" description="Распределение событий по вашим проектам" className="ca3-structure">
        <div className="ca3-donut-row">
          <div className="ca3-donut" style={{background:donut}} role="img" aria-label={`Всего ${String(totalCategories)} действий по проектам`}>
            <div><strong>{activity.isSuccess?nfmt.format(totalCategories):"—"}</strong><span>действий</span></div>
          </div>
          <div className="ca3-structure-legend">{categoryCounts.map(item=><div key={item.id}>
            <i style={{background:item.color}}/><span>{item.label}</span>
            <strong>{totalCategories?Math.round(item.count/totalCategories*100):0}%</strong>
            <small>{nfmt.format(item.count)} событий</small>
          </div>)}</div>
        </div>
        <div className="ca3-structure-foot">
          <div><Clock3 size={18}/><span><small>Пиковая неделя</small><strong>{peak>0?`Неделя ${String(busiest+1)} · ${String(peak)} действий`:"Нет событий"}</strong></span></div>
          <div><Target size={18}/><span><small>Самая активная категория</small><strong>{totalCategories? [...categoryCounts].sort((a,b)=>b.count-a.count)[0]?.label:"Нет данных"}</strong></span></div>
        </div>
      </Card>
    </section>
    <section className="ca3-bottom-grid">
      <Card title="Динамика по неделям" description="Количество зарегистрированных событий за период" extra={<span className="ca3-small-chip"><Activity size={13}/> Все проекты</span>}>
        {activity.isSuccess?<Trend values={weekly}/>:<div className="ca3-placeholder">Данные ещё не загружены</div>}
      </Card>
      <Card title="Активность по проектам" description="В каких проектах было больше всего действий"
        extra={<select className="ca3-mini-select" aria-label="Фильтр проекта" value={projectId} onChange={e=>{setProjectId(e.target.value);setSelectedDay(null);}}>
          <option value="all">Все проекты</option>{(tasks.data??[]).map(task=><option key={task.id} value={task.id}>{task.title}</option>)}
        </select>}>
        {ranked.length?<div className="ca3-rank-list">{ranked.map((item,index)=><button type="button" key={item.id} disabled={!projectNavigation} onClick={()=>{navigateTask(item.id);}}>
          <span className="ca3-rank">{index+1}</span><span className="ca3-rank-name">{item.title}</span>
          <div className="ca3-rank-track"><i style={{width:`${String(ranked[0]?Math.max(8,Math.round(item.count/ranked[0].count*100)):0)}%`}}/></div>
          <span className="ca3-rank-count">{nfmt.format(item.count)}</span>
        </button>)}</div>:<div className="ca3-placeholder">Нет активности по проектам в этом периоде</div>}
        {currentProject&&<p className="ca3-filter-note">Выбран проект: {currentProject.title}</p>}
      </Card>
      <Card title={selectedDay?"События выбранного дня":"Недавние действия"} description="Реальные события в проектах" className="ca3-recent"
        extra={selectedDay?<button type="button" className="ca3-link" onClick={()=>{setSelectedDay(null);}}>Все события</button>:null}>
        {lastEvents.length?<div className="ca3-activity-list">{lastEvents.map(event=>{
          const Icon=eventIcon(event.kind);
          return <button type="button" key={event.id} onClick={()=>{navigateTask(event.task_id);}} disabled={!projectNavigation}>
            <span className={`ca3-event-icon ca3-event-${eventCategory(event.kind)}`}><Icon size={17}/></span>
            <span className="ca3-event-text"><strong>{labels[event.kind]}</strong><small title={event.task_title}>{event.task_title}</small></span>
            <time dateTime={event.occurred_at}>{timeLabel(event.occurred_at)}</time>
          </button>;
        })}</div>:<div className="ca3-placeholder">Пока нет событий за выбранный период</div>}
      </Card>
    </section>
    <footer className="ca3-data-note"><Info size={15}/> История ограничена последними 84 днями · учитываются только события с подтверждённой датой · данные видны только по вашим проектам</footer>
  </main>;
}
