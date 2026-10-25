import { useMemo, type ReactNode } from "react";
import { Activity, ArrowRight, BarChart3, BookOpen, CalendarDays, CheckCircle2, Clock3, Code2, Flame, GraduationCap, Layers3, Sparkles, Target } from "lucide-react";
import type { LearningSummary } from "../learning-progress";
import type { EngagementOverview } from "../engagement-client";
import "./activity-premium.scss";

export type ActivitySourceEvent = { occurred_at: string; kind: string; title: string; source_kind: string; source_ref: string };
export type ActivitySnapshot = { generated_at: string; freshness:{ known:boolean; latest_observed_at:string|null }; events?:ActivitySourceEvent[] };
type Props = {
  summary: LearningSummary | undefined;
  snapshot: ActivitySnapshot | undefined;
  streak: EngagementOverview | undefined;
  weeks: number;
  onTraining: () => void;
  onHistory: () => void;
  onWeeksChange: (weeks:number) => void;
};
const dayMs = 86400000;
const dateValue = (value:string):number|null => { const parsed=Date.parse(value);return Number.isFinite(parsed)?parsed:null; };
const kindOf = (e:ActivitySourceEvent):"learning"|"practice"|"projects"|"community"|"certification" => {
  const text=(e.kind+" "+e.source_kind+" "+e.title).toLowerCase();
  if(/сертифик|certificat|badge/.test(text))return "certification";
  if(/проект|project|portfolio|портф/.test(text))return "projects";
  if(/событ|сообщест|event|community|вебинар/.test(text))return "community";
  if(/practice|практик|task|задач|провер|review|submission/.test(text))return "practice";
  return "learning";
};
const activityKinds=[
  { key:"learning",label:"Обучение",color:"#05e2d8" },
  { key:"practice",label:"Практика",color:"#865ef2" },
  { key:"projects",label:"Проекты",color:"#168ff5" },
  { key:"community",label:"Сообщество",color:"#eb6abd" },
  { key:"certification",label:"Сертификация",color:"#8394af" },
] as const;
function IconPanel({children,tone}:{children:ReactNode;tone?:string}){
  return <span className={"avp-icon "+(tone??"")}>{children}</span>;
}
function MiniBars({values,tone="cyan"}:{values:number[];tone?:string}){
  const max=Math.max(1,...values);
  return <div className={"avp-mini-bars avp-mini-bars--"+tone} aria-hidden="true">{values.map((x,i)=><i key={i} style={{height:String(12+Math.round(85*x/max))+"%"}}/>)}</div>;
}
function LearningOverview({summary,onTraining}:{summary:LearningSummary|undefined;onTraining:()=>void}){
  const courses=summary?.courses??[];
  const completed=summary?.completed_lessons;
  const totalCourses=summary?.finished_courses;
  const approved=summary?.approved_practices;
  const started=courses.filter(c=>c.completed_units>0||c.finished);
  const totalUnits=started.reduce((s,c)=>s+c.total_units,0);
  const completeUnits=started.reduce((s,c)=>s+c.completed_units,0);
  const progress=totalUnits>0?Math.round(100*completeUnits/totalUnits):null;
  const featured=[...started].sort((a,b)=>Number(a.finished)-Number(b.finished)).slice(0,3);
  return <section className="avp-learning av3-study-results" data-testid="analytics-study-results" aria-label="Сохранённый прогресс Bootcamp">
    <header className="avp-learning__head"><div className="avp-heading">
      <IconPanel><BarChart3 size={27}/></IconPanel><div><h2>Учебный прогресс</h2><p>Твой путь обучения в цифрах. Следи за прогрессом и сохраняй темп.</p></div>
    </div><span className="avp-learning__tip"><Sparkles size={21}/>Постоянное развитие —<br/>больше возможностей завтра</span></header>
    <div className="avp-study-numbers av3-study-metrics">
      {[
        {name:"уроков завершено",value:completed===undefined?"—":String(completed),Icon:BookOpen,tone:"mint",note:"По данным Bootcamp"},
        {name:"курсов пройдено",value:totalCourses===undefined?"—":String(totalCourses),Icon:Layers3,tone:"purple",note:"Завершённые курсы"},
        {name:"практик одобрено",value:approved===undefined?"—":String(approved),Icon:CheckCircle2,tone:"blue",note:"Подтверждённые работы"},
        {name:"прогресс начатых курсов",value:progress===null?"—":String(progress)+"%",Icon:Target,tone:"cyan",note:"Завершённые уроки"},
      ].map(item=><article key={item.name} className={"avp-study-number avp-study-number--"+item.tone}>
        <IconPanel tone={item.tone}><item.Icon size={24}/></IconPanel>
        <div><strong>{item.value}</strong><small>{item.name}</small><em>{item.note}</em></div>
      </article>)}
    </div>
    <div className="avp-course-header"><div className="avp-heading avp-heading--small"><Layers3 size={23}/>
      <div><h3>Текущие курсы</h3><p>Продолжай обучение с того места, на котором остановился</p></div></div>
      <button type="button" onClick={onTraining}>Все курсы <ArrowRight size={17}/></button>
    </div>
    <div className="avp-courses av3-study-list">
    {featured.length?featured.map((course,index)=>{
      const pct=course.total_units>0?Math.round(100*course.completed_units/course.total_units):0;
      const finished=course.finished;
      const Icon=index===0?Code2:index===1?BarChart3:Layers3;
      return <article className="avp-course av3-study-course" key={course.course_key}>
        <IconPanel tone={index===0?"blue":index===1?"purple":"cyan"}><Icon size={30}/></IconPanel>
        <div className="avp-course__copy"><div className="avp-course__title"><strong>{course.title}</strong><span className={finished?"is-done":"is-progress"}>{finished?"Завершён":"В процессе"}</span></div>
        <p>{finished?"Завершено":"В изучении"} · {course.completed_units} из {course.total_units} уроков</p>
        <div className="avp-course__bar"><i style={{width:String(Math.max(0,Math.min(100,pct)))+"%"}}/></div>
        <div className="avp-course__foot"><small>{pct}%</small>
          <button type="button" onClick={onTraining}>{finished?"Повторить":"Продолжить"} <ArrowRight size={14}/></button>
        </div></div>
      </article>;
    }):<div className="avp-learning-empty">Начатых курсов пока нет. Выбери направление в Bootcamp, чтобы увидеть здесь прогресс.<button type="button" onClick={onTraining}>Перейти к курсам <ArrowRight size={15}/></button></div>}
    </div>
    <small className="avp-learning__disclaimer">Учебный прогресс не означает автоматическое подтверждение профессиональной квалификации</small>
  </section>;
}
export function PremiumActivity({summary,snapshot,streak,weeks,onTraining,onHistory,onWeeksChange}:Props){
  const {events,days,byWeek,counts,observed,activeDays}=useMemo(()=>{
    const hasData=Boolean(snapshot?.freshness.known);
    const current=new Date();
    const todayUTC=Date.UTC(current.getUTCFullYear(),current.getUTCMonth(),current.getUTCDate());
    const first=todayUTC-(weeks*7-1)*dayMs;
    const all=(snapshot?.events??[]).filter(e=>e.source_ref&&e.source_kind&&dateValue(e.occurred_at)!==null);
    const valid=all.filter(e=>{const t=dateValue(e.occurred_at)??0;return t>=first&&t<todayUTC+dayMs;});
    const dateCounts=Array.from({length:weeks*7},(_,i)=>valid.filter(e=>{const ts=dateValue(e.occurred_at)??0;return ts>=first+i*dayMs&&ts<first+(i+1)*dayMs;}).length);
    const weekly=Array.from({length:weeks},(_,i)=>dateCounts.slice(i*7,i*7+7).reduce((a,b)=>a+b,0));
    return {events:valid,days:dateCounts,byWeek:weekly,counts:activityKinds.map(k=>valid.filter(e=>kindOf(e)===k.key).length),observed:hasData,activeDays:dateCounts.filter(n=>n>0).length};
  },[snapshot,weeks]);
  const total=events.length;
  const categories=activityKinds.map((category,i)=>({...category,count:counts[i]??0}));
  const segments=categories.map((category,i)=>{
    const begin=categories.slice(0,i).reduce((sum,v)=>sum+v.count,0)/Math.max(1,total)*100;
    return category.color+" "+begin+"% "+(begin+category.count/Math.max(1,total)*100)+"%";
  });
  const max=Math.max(1,...days);
  return <div className="avp-activity" data-testid="premium-activity">
    <LearningOverview summary={summary} onTraining={onTraining}/>
    <section className="avp-activity-numbers av3-metrics" aria-label="Активность за период">
      {[
        {label:"Активные дни",value:observed?String(activeDays):"—",hint:observed?"из "+String(weeks*7)+" дней":"Нет истории",Icon:CalendarDays,tone:"cyan"},
        {label:"Часы на платформе",value:"—",hint:"Длительность сессий не измеряется",Icon:Clock3,tone:"cyan"},
        {label:"Выполненные действия",value:observed?String(total):"—",hint:observed?"Сохранённые события":"Нет истории",Icon:CheckCircle2,tone:"purple"},
        {label:"Текущий стрик",value:streak?String(streak.current_days)+" "+(streak.current_days===1?"день":streak.current_days%10>=2&&streak.current_days%10<=4&&!(streak.current_days%100>=12&&streak.current_days%100<=14)?"дня":"дней"):"—",hint:streak?"Квалифицированные дни":"Показатель временно недоступен",Icon:Flame,tone:"amber"},
      ].map((m,i)=><article key={m.label} className={"avp-activity-number avp-activity-number--"+m.tone+" av3-metric"}>
        <IconPanel tone={m.tone}><m.Icon size={24}/></IconPanel><div><small>{m.label}</small><strong>{m.value}</strong><span>{m.hint}</span></div>
        {i!==1&&<MiniBars tone={m.tone} values={i===0?byWeek:i===2?byWeek:streak?[streak.current_days]:[]}/>}
      </article>)}
    </section>
    <div className="avp-visuals">
      <section className="avp-heat av3-panel av3-heat-panel">
        <header><div className="avp-visuals__label"><CalendarDays size={25}/><div><h2>Ритм активности</h2>
        <p>Последние {weeks} недель · чем ярче ячейка, тем больше действий</p></div></div>
        <label className="avp-period-select">Период<select aria-label="Период тепловой карты" value={weeks} onChange={e=>{onWeeksChange(Number(e.target.value));}}>
          <option value={4}>4 недели</option><option value={8}>8 недель</option><option value={12}>12 недель</option>
        </select></label></header>
        <div className="avp-heat-scroll"><div className="avp-heat-grid av3-heat">
          <div className="avp-heat-labels av3-day-names">{["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(s=><span key={s}>{s}</span>)}</div>
          <div className="avp-heat-weeks av3-week-columns" style={{gridTemplateColumns:"repeat("+String(weeks)+",minmax(0,1fr))"}}>
          {byWeek.map((_,i)=><div key={i}>{days.slice(i*7,i*7+7).map((n,j)=><span key={j} className={"av3-heat-cell level-"+String(observed?Math.min(4,Math.ceil(n/max*4)):0)} role="img" aria-label={observed?String(n)+" действий":"История недоступна"} title={observed?String(n)+" действий":"Нет истории"}/>)}</div>)}
          </div></div>
          <div className="avp-heat-weeks-label">{byWeek.map((_,i)=><small key={i}>{i+1} нед.</small>)}</div>
        </div>
        {!observed&&<p className="avp-missing">Нет истории активности. Отсутствие данных не означает нулевую активность.</p>}
      </section>
      <section className="avp-profile av3-panel av3-activity-profile"><header><div className="avp-visuals__label"><BarChart3 size={25}/><div>
        <h2>Профиль активности</h2><p>Распределение сохранённых действий</p></div></div>
        <button type="button" onClick={onHistory}>Все действия <ArrowRight size={16}/></button></header>
        <div className="avp-profile__content av3-profile-distribution"><div className="avp-donut av3-donut" style={{background:observed&&total>0?"conic-gradient("+segments.join(",")+")":"conic-gradient(#18445a 0 100%)"}}>
          <div><strong>{observed?String(total):"—"}</strong><small>действий</small></div></div>
          <div className="avp-profile__legend av3-donut-list">
            {categories.map(c=><div key={c.key}><i style={{background:c.color}}/><span>{c.label}</span><b>{observed&&total?String(Math.round(c.count/total*100))+"%":"—"}</b><small>{observed?c.count:"—"}</small></div>)}
          </div></div>
      </section>
    </div>
  </div>;
}
