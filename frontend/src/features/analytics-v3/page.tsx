import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, ArrowRight, BookOpen, Clock3, Code2, FileBadge2, LockKeyhole, ShieldCheck, Sparkles, Target, TrendingUp, Trophy, X } from "lucide-react";
import { apiRequest } from "../../api/client";
import { AnalyticsReference } from "../analytics-reference";
import { ParticipantHelpTrigger } from "../participant-help-trigger";
import { LearningProgressPanel } from "../learning-progress-panel";
import { learningSummaryQueryKey, loadLearningSummary, type LearningSummary } from "../learning-progress";
import { ActivityCalendar } from "../activity-calendar/calendar";
import "./analytics-v3.scss";

type Tab = "activity" | "passport" | "certification";
type SourceEvent = { occurred_at:string; kind:string; title:string; source_kind:string; source_ref:string };
type Snapshot = { generated_at:string; actor_timezone?:string; freshness:{known:boolean;latest_observed_at:string|null}; events?:SourceEvent[] };
type Certificate = { certificate_id:string; course_title:string; issued_at:string; verification_id:string; holder_name:string };
const tabNames:Record<Tab,string>={activity:"Активность",passport:"Skill Passport",certification:"Сертификация"};
const dateNum=(v:string)=>{const x=Date.parse(v);return Number.isFinite(x)?x:null;};
const dateText=(v:string)=>{const n=dateNum(v);return n===null?"—":new Date(n).toLocaleDateString("ru-RU");};
function Metric({label,value,detail,Icon,tone}:{label:string;value:string;detail:string;Icon:typeof Activity;tone?:string}){return <article className={"av3-metric "+(tone??"")}><span>{label}</span><Icon size={27} aria-hidden="true"/><strong>{value}</strong><small>{detail}</small></article>;}
function Panel({title,caption,children,action,cls=""}:{title:string;caption?:string;children:ReactNode;action?:ReactNode;cls?:string}){return <section className={"av3-panel "+cls}><header><div><h2>{title}</h2>{caption&&<p>{caption}</p>}</div>{action}</header>{children}</section>;}
const steps=[{title:"Foundation",sub:"Базовые навыки",Icon:BookOpen},{title:"Practitioner",sub:"Практика",Icon:Code2},{title:"Advanced",sub:"Продвинутые практики",Icon:TrendingUp},{title:"Expert",sub:"Экспертный уровень",Icon:Trophy}];
function CertificationTab({certificates,openDetail,openSection}:{certificates:Certificate[]|undefined;openDetail:(s:string)=>void;openSection:(s:string)=>void}) {
 const latest=certificates?.[0];
 return <><div className="av3-metrics"><Metric label="Выданные сертификаты" value={certificates?String(certificates.length):"—"} detail="Проверяемый реестр курсов" Icon={FileBadge2}/><Metric label="Прогресс к следующему" value="—" detail="Критерии не загружены" Icon={Activity}/><Metric label="Проверенные бейджи" value="—" detail="Реестр бейджей недоступен" Icon={ShieldCheck}/><Metric label="Открытые попытки" value="—" detail="Источник попыток не подключён" Icon={Clock3} tone="warm"/></div>
 <div className="av3-cert-layout"><div className="av3-cert-main"><Panel title="Траектория сертификации" caption="Путь развития компетенций Agentic Coding" cls="av3-trajectory"><div className="av3-milestones">{steps.map((s,i)=><button key={s.title} type="button" onClick={()=>{openDetail(s.title);}}><i className={i===0?"first":""}><s.Icon size={29}/></i><strong>{s.title}</strong><small>{s.sub}</small><em>{i===0?"Условия уровня":"Не подтверждён"}</em></button>)}</div><small className="av3-footnote">Этапы — концепция методологии, а не уже выданные уровни</small></Panel>
 <div className="av3-cert-pair"><Panel title="Требования к текущей сертификации" caption="Проверяемые статусы выполнения"><div className="av3-requirements">{["Теоретический модуль","Практический проект","Проверка сообщества","Согласование с ментором","Финальная оценка"].map((v,i)=><button key={v} type="button" onClick={()=>{openDetail(v);}}><span>{i+1}</span><b>{v}</b><i/><strong>—</strong><em>Нет данных</em></button>)}</div></Panel><Panel title="Динамика успешности" caption="Процент успешных экзаменационных попыток"><div className="av3-missing-chart"><TrendingUp size={44}/><strong>Нет данных</strong><small>Реестр попыток пока не подключён</small></div></Panel></div>
 <div className="av3-cert-pair"><Panel title="Доступные награды" action={<button type="button" className="av3-small-btn" onClick={()=>{openDetail("Все награды");}}>Все награды ↗</button>}><div className="av3-awards">{steps.map(s=><button key={s.title} type="button" onClick={()=>{openDetail(s.title);}}><s.Icon size={32}/><strong>{s.title}</strong><small>Agentic Coding</small><em><LockKeyhole size={12}/>Не выдан</em></button>)}</div></Panel><Panel title="История попыток / экзаменов" action={<button className="av3-small-btn" type="button" onClick={()=>{openDetail("История попыток");}}>Все попытки ↗</button>}><p className="av3-empty">Данных об экзаменационных попытках пока нет. Это не означает провал экзамена.</p></Panel></div>
 </div><div className="av3-cert-sidebar"><Panel title="Текущая сертификация" cls="av3-credential"><div className="av3-credential-main"><span className="av3-badge"><Code2 size={42}/></span><div><strong>{latest?.course_title||"Agentic Coding · Practitioner"}</strong><p>{latest?"Сертификат курса из реестра":"Пример возможного уровня"}</p></div></div><div className="av3-cert-progress"><span>Статус документа</span><strong>{latest?"Выдан":"Не выдан"}</strong></div><div className="av3-progress"><i style={{width:latest?"100%":"0%"}}/></div><dl><div><dt>Статус проверки</dt><dd>{latest?"Доступна публичная проверка":"Нет подтверждения"}</dd></div><div><dt>ID сертификата</dt><dd>{latest?.certificate_id||"Не присвоен"}</dd></div><div><dt>Дата выдачи</dt><dd>{latest?dateText(latest.issued_at):"—"}</dd></div></dl>{latest?.verification_id?<Link className="av3-primary" to={"/verify/"+encodeURIComponent(latest.verification_id)}>Открыть сертификат <ArrowRight size={16}/></Link>:<button type="button" className="av3-primary" onClick={()=>{openDetail("Условия получения сертификата");}}>Условия получения <ArrowRight size={16}/></button>}</Panel><Panel title="Следующий шаг" cls="av3-next av3-cert-next"><div className="av3-next-body"><Target size={37}/><b>Подготовить практический проект</b><p>Изучить критерии, выполнить задачу и представить проверяемый результат</p><button type="button" className="av3-primary" onClick={()=>{openSection("Задачи");}}>Перейти к заданию <ArrowRight size={16}/></button></div><div className="av3-todo">{["Изучи критерии оценки","Подготовь решение","Передай на проверку"].map(x=><label key={x}><input type="checkbox"/>{x}</label>)}</div></Panel></div></div></>;
}
/** Impulse self-study evidence is intentionally separate from provider-verified credentials. */
function StudyResults({summary,view}:{summary:LearningSummary|undefined;view:"activity"|"certification"}) {
  if (!summary) return null;
  const courses = summary.courses;
  const finished = courses.filter(course=>course.finished && course.certificate_id!==null);
  const totalUnits = courses.reduce((sum,c)=>sum+c.total_units,0);
  const completeUnits = courses.reduce((sum,c)=>sum+c.completed_units,0);
  return <section className="av3-study-results" data-testid="analytics-study-results" aria-label="Сохранённый прогресс Bootcamp">
    <header><div><span>BOOTCAMP · СИНХРОНИЗИРОВАНО</span><h2>{view==="activity"?"Учебный прогресс":"Сертификаты обучения Impulse"}</h2></div><small>Отдельно от подтверждения профессиональных компетенций</small></header>
    <div className="av3-study-metrics">
      <div><b>{summary.completed_lessons}</b><span>уроков завершено</span></div>
      <div><b>{summary.finished_courses}</b><span>курсов пройдено</span></div>
      <div><b>{summary.approved_practices}</b><span>практик одобрено</span></div>
      <div><b>{totalUnits ? String(Math.round(100*completeUnits/totalUnits))+"%" : "—"}</b><span>прогресс начатых курсов</span></div>
    </div>
    {courses.length>0 && <div className="av3-study-list">{courses.slice(0,view==="activity"?3:20).map(course=><div key={course.course_key} className="av3-study-course">
      <span><strong>{course.title}</strong><small>{course.finished?"Завершён":"В изучении"} · {course.completed_units} из {course.total_units} уроков{view==="certification"&&course.certificate_id?" · Учебный сертификат № "+course.certificate_id:""}</small></span>
      <progress max={course.total_units} value={course.completed_units} aria-label={"Учебный прогресс "+course.title}/>
    </div>)}</div>}
    {view==="certification" && <p className="av3-study-note">{finished.length} учебных сертификатов Impulse. Для подтверждения практической компетенции нужна отдельная проверка работы.</p>}
  </section>;
}
export function AnalyticsDashboardV3({navigation=[]}:{navigation?:string[]}) {
 const [params,setParams]=useSearchParams();const requested=params.get("analyticsTab");const tab:Tab=requested==="passport"||requested==="certification"?requested:"activity";
 const [weeks,setWeeks]=useState(52);const [detail,setDetail]=useState<string|null>(null);
 const snapshot=useQuery({queryKey:["participant-growth-analytics"],queryFn:()=>apiRequest<Snapshot>("/api/v1/me/growth/snapshot")});
 const certificates=useQuery({queryKey:["bootcamp-certificates"],queryFn:()=>apiRequest<Certificate[]>("/api/v1/me/bootcamp/certificates")});
 const learning=useQuery({queryKey:learningSummaryQueryKey,queryFn:loadLearningSummary});
 const learningEvents:SourceEvent[]=(learning.data?.courses??[]).filter(course=>course.finished&&course.finished_at!==null).map(course=>({
  occurred_at:course.finished_at as string,kind:"impulse_course_finished",
  title:"Пройден курс Impulse: "+course.title,source_kind:"impulse_self_study",source_ref:course.course_key,
 }));
 const allEvents=[...(snapshot.data?.events??[]),...learningEvents];
 const latestDates=allEvents.map(e=>dateNum(e.occurred_at)).filter((v):v is number=>v!==null);
 const activitySnapshot:Snapshot|undefined=snapshot.data||learning.data?{
  generated_at:snapshot.data?.generated_at??new Date().toISOString(),
  actor_timezone:snapshot.data?.actor_timezone,
  freshness:{
   known:Boolean(snapshot.data?.freshness.known||learningEvents.length),
   latest_observed_at:latestDates.length?new Date(Math.max(...latestDates)).toISOString():snapshot.data?.freshness.latest_observed_at??null,
  },
  events:allEvents,
 }:undefined;
 const choose=(value:Tab)=>{setParams(previous=>{const next=new URLSearchParams(previous);if(value==="activity")next.delete("analyticsTab");else next.set("analyticsTab",value);return next;});};
 const openSection=(name:string)=>{const idx=navigation.indexOf(name);if(idx>=0)window.location.assign("/workspace/"+String(idx));else setDetail("Раздел "+name+" недоступен");};
 const title=tab==="activity"?"Твоя активность":tab==="passport"?"Ваш Skill Passport":"Твоя сертификация";
 const desc=tab==="activity"?"Год развития в одном календаре. Подробности каждого дня — по нажатию.":tab==="passport"?"Подтверждённые навыки, реальные доказательства и путь к следующему уровню роли.":"Статус сертификации, прогресс к новым бейджам и подтверждённые достижения.";
 const fresh=tab==="activity"?activitySnapshot?.freshness.latest_observed_at:certificates.data?.[0]?.issued_at;
 return <main className="analytics-v3" data-testid="analytics-v3" data-tab={tab}><header className="av3-top"><div className="av3-headline"><span>АНАЛИТИКА / {tabNames[tab].toUpperCase()}</span><h1 id="workspace-title">{title}</h1><p>{desc}</p></div><nav className="av3-tabs" aria-label="Подразделы аналитики">{(Object.keys(tabNames) as Tab[]).map(k=><button key={k} className={k===tab?"selected":""} aria-current={k===tab?"page":undefined} type="button" onClick={()=>{choose(k);}}>{tabNames[k]}</button>)}</nav><div className="av3-help-inline"><ParticipantHelpTrigger topicId={tab==="activity"?"analytics-activity":tab==="passport"?"passport":"certification"} label="Как это читать" /></div><div className="av3-global-filters"><label>Период<select aria-label="Период аналитики" value={weeks} onChange={e=>{setWeeks(Number(e.target.value));}}><option value={12}>3 месяца</option><option value={26}>6 месяцев</option><option value={52}>Год</option></select></label><span className="av3-fresh">● {fresh?"Данные "+dateText(fresh):"Источник недоступен"}</span></div></header>
 {tab==="activity"&&<>{learning.isError&&<div className="av3-alert" role="alert">Учебный прогресс недоступен <button type="button" onClick={()=>{void learning.refetch();}}>Повторить</button></div>}{snapshot.isError&&<div className="av3-alert" role="alert">История активности недоступна <button type="button" onClick={()=>{void snapshot.refetch();}}>Повторить</button></div>}<ActivityCalendar snapshot={activitySnapshot} weeks={weeks} onOpenCourses={()=>{openSection(navigation.find(v=>/bootcamp|обучение/i.test(v))??"Bootcamp");}} onOpenProjects={()=>{openSection(navigation.find(v=>/мои проекты/i.test(v))??"Мои проекты");}} onOpenEvents={()=>{openSection(navigation.find(v=>/событ/i.test(v))??"События");}} onOpenCertification={()=>{choose("certification");}}/></>}
 {tab==="passport"&&<div className="av3-embedded-passport"><AnalyticsReference navigation={navigation}/></div>}
 {tab==="certification"&&<>{certificates.isError&&<div className="av3-alert" role="alert">Реестр сертификатов недоступен <button type="button" onClick={()=>{void certificates.refetch();}}>Повторить</button></div>}<CertificationTab certificates={certificates.data} openDetail={setDetail} openSection={openSection}/><StudyResults summary={learning.data} view="certification"/></>}
 {tab==="certification"&&<LearningProgressPanel bootcampIndex={Math.max(0,navigation.indexOf("Bootcamp"))}/>}
 <p className="av3-data-foot">Аналитика опирается на текущие источники Impulse. Отсутствующие данные не заменяются нулём; статус корпоративного L1 не присваивается автоматически.</p>
 {detail&&<div className="av3-overlay" role="presentation" onClick={()=>{setDetail(null);}}><section className="av3-dialog" role="dialog" aria-modal="true" aria-label={detail} onClick={e=>{e.stopPropagation();}}><button type="button" aria-label="Закрыть" onClick={()=>{setDetail(null);}}><X size={22}/></button><Sparkles size={36}/><h2>{detail}</h2><p>Для присвоения уровня необходимы утверждённые требования, проверяемые цифровые следы и решение уполномоченной стороны. Пока данные об этом шаге не поступили, статус не считается выполненным.</p><button className="av3-primary" type="button" onClick={()=>{setDetail(null);}}>Понятно <ArrowRight size={16}/></button></section></div>}
 </main>;
}
