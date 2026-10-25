import { useState, type ReactNode } from "react";
import {
  ArrowRight, Award, BriefcaseBusiness, CalendarDays, Check, CheckCircle2,
  ChevronRight, Clock3, Code2, FileCheck2, FileText, Gift, Info,
  MessageCircle, ShieldCheck, Star, Target, Users,
} from "lucide-react";

export type ReferenceCheckpoint = { key: string; title: string; status: string };
export type ReferenceDecision = { id: string; contribution_id: string; decision: string; reason: string; deadline_at: string | null };
export type ReferenceContributor = { id: string; version: number; personal_summary: string; artifact_keys: string[]; status: string };
export type ReferencePerson = { person_id: string; display_name: string; status: string };
const doneStates = new Set(["accepted","completed","done","verified","closed"]);
const statusName: Record<string, string> = {
  completed:"Завершено",accepted:"Принято",verified:"Подтверждено",done:"Завершено",
  closed:"Закрыто",in_progress:"В работе",staffed:"К выполнению",
  revision_requested:"Нужна доработка",submitted:"На проверке",disputed:"На проверке",
};
const statusLabel = (s:string) => statusName[s] ?? (s ? "Статус уточняется" : "Ожидает");
const dateLabel = (s:string) => {
  const value = new Date(s);
  return Number.isNaN(value.getTime()) ? "Не указан" : value.toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"});
};
function StageRing({ value, size = "large" }:{value:number|null;size?:"large"|"small"}) {
  return <div className={`mp-ref-ring mp-ref-ring--${size}`} role="img"
    aria-label={value===null?"Прогресс ещё не рассчитан":`Завершено ${String(value)}%`}
    style={{background:`conic-gradient(#36f5cd 0 ${String(value??0)}%, #183b57 ${String(value??0)}% 100%)`}}>
    <strong>{value===null?"—":`${String(value)}%`}</strong>
  </div>;
}
function Card({children, className=""}:{children:ReactNode;className?:string}) {
  return <section className={`mp-ref-card ${className}`}>{children}</section>;
}
function Title({children,icon:Icon}:{children:ReactNode;icon:typeof Target}) {
  return <h2 className="mp-ref-title"><span className="mp-ref-title-icon"><Icon size={18}/></span>{children}</h2>;
}
type TasksProps={
  checkpoints:ReferenceCheckpoint[];decisions:ReferenceDecision[];
  projectDescription:string;deliverable:string;
  acceptanceCriteria:string[];onWorkspace:()=>void;
};
export function ProjectReferenceTasks({checkpoints,decisions,projectDescription,deliverable,acceptanceCriteria,onWorkspace}:TasksProps){
  const [filter,setFilter]=useState<"all"|"active"|"review"|"done">("all");
  const [selected,setSelected]=useState<string|null>(null);
  const finished=checkpoints.filter(c=>doneStates.has(c.status)).length;
  const review=checkpoints.filter(c=>c.status==="submitted"||c.status==="disputed").length;
  const active=checkpoints.filter(c=>c.status==="in_progress"||c.status==="revision_requested"||c.status==="staffed").length;
  const shown=checkpoints.filter(c=>filter==="all"||filter==="done"&&doneStates.has(c.status)||
    filter==="active"&&(c.status==="in_progress"||c.status==="staffed"||c.status==="revision_requested")||
    filter==="review"&&(c.status==="submitted"||c.status==="disputed"));
  const current=checkpoints.find(c=>c.key===selected)??checkpoints.find(c=>!doneStates.has(c.status))??checkpoints[0];
  const currentIndex=checkpoints.findIndex(c=>c.key===current?.key);
  return <div className="mp-ref-columns" role="tabpanel" aria-label="Задачи">
    <div className="mp-ref-stack">
      <Card className="mp-ref-task-list">
        <header className="mp-ref-card-head"><h2>Задачи проекта <span>({checkpoints.length})</span></h2><small>По этапам проекта</small></header>
        <div className="mp-ref-filters" aria-label="Фильтр задач">
          {([{id:"all",title:"Все задачи",count:checkpoints.length},{id:"active",title:"В работе",count:active},
            {id:"review",title:"На проверке",count:review},{id:"done",title:"Завершено",count:finished}] as const).map(item=>
            <button type="button" key={item.id} className={filter===item.id?"is-active":""} aria-pressed={filter===item.id}
              onClick={()=>{setFilter(item.id);}}>{item.title} · {item.count}</button>)}
        </div>
        {shown.length?shown.map((c)=>{
          const passed=doneStates.has(c.status),isSelected=current?.key===c.key;
          return <button type="button" className={`mp-ref-task-row ${isSelected?"is-selected":""}`} key={c.key}
            aria-pressed={isSelected} onClick={()=>{setSelected(c.key);}}>
              <span className={`mp-ref-index ${passed?"is-done":""}`}>{passed?<Check size={18}/>:String(checkpoints.findIndex(v=>v.key===c.key)+1).padStart(2,"0")}</span>
              <span className="mp-ref-task-copy"><strong>{c.title}</strong><small>{passed?"Контрольный этап подтверждён":statusLabel(c.status)}</small><em>Этап {checkpoints.findIndex(v=>v.key===c.key)+1}</em></span>
              <span className="mp-ref-task-state"><b>{statusLabel(c.status)}</b><i style={{width:passed?"100%":"0%"}}/></span>
            </button>;
        }):<p className="mp-ref-empty">В этой категории пока нет задач</p>}
        {!checkpoints.length&&<div className="mp-ref-empty"><strong>Заказчик ещё не опубликовал этапы</strong><p>Подробная постановка и критерии доступны в проекте</p><button type="button" onClick={onWorkspace}>Открыть рабочую область <ArrowRight size={15}/></button></div>}
      </Card>
      <Card className="mp-ref-tip"><CheckCircle2 size={20}/><span><strong>Работа над этапами</strong><small>Подтверждение результата выполняет заказчик; просмотр страницы сам по себе не засчитывается</small></span></Card>
    </div>
    <div className="mp-ref-stack">
      <Card className="mp-ref-current">
        <header className="mp-ref-card-head"><h2>Сейчас в работе</h2>{current&&<span className="mp-ref-pill">Этап {currentIndex+1} из {checkpoints.length}</span>}</header>
        <div className="mp-ref-feature"><span className="mp-ref-blue-square"><FileText size={21}/></span><div><strong>{current?.title??"Ожидается план этапов"}</strong><p>{current?statusLabel(current.status):projectDescription}</p></div></div>
        <div className="mp-ref-separator"/>
        <div className="mp-ref-card-head"><strong>Прогресс этапа</strong><strong className="mp-ref-accent">{current&&doneStates.has(current.status)?"100%":"—"}</strong></div>
        <div className="mp-ref-bar"><i style={{width:current&&doneStates.has(current.status)?"100%":"0%"}}/></div>
        <p className="mp-ref-muted">{current&&doneStates.has(current.status)?"Результат подтверждён":"Ожидает подтверждения заказчиком"}</p>
        <div className="mp-ref-separator"/>
        <strong className="mp-ref-subtitle">Что нужно передать</strong>
        <div className="mp-ref-requirements">
          {acceptanceCriteria.length?acceptanceCriteria.slice(0,4).map((text,index)=><div key={index}><span className="mp-ref-blue-square"><FileCheck2 size={14}/></span>{text}</div>):
          <div><span className="mp-ref-blue-square"><FileText size={14}/></span>{deliverable}</div>}
        </div>
        <button type="button" onClick={onWorkspace} className="mp-ref-primary">Продолжить задачу <ArrowRight size={16}/></button>
      </Card>
      <Card><Title icon={Clock3}>Последние обновления</Title>
        {decisions.length?decisions.slice(-3).reverse().map(d=><p key={d.id} className="mp-ref-activity"><span>Ревью</span>{d.reason||"Есть новое решение по результату"}</p>):
          <p className="mp-ref-muted">История обновлений появится после проверки отправленных результатов</p>}
      </Card>
    </div>
  </div>;
}
type ProgressProps={checkpoints:ReferenceCheckpoint[];progress:number|null;deadline:string;decisions:ReferenceDecision[];skills:string[];onWorkspace:()=>void;};
export function ProjectReferenceProgress({checkpoints,progress,deadline,decisions,skills,onWorkspace}:ProgressProps){
  const done=checkpoints.filter(c=>doneStates.has(c.status)).length;
  return <div className="mp-ref-columns mp-ref-columns--progress" role="tabpanel" aria-label="Прогресс">
    <div className="mp-ref-stack">
      <Card><header className="mp-ref-card-head"><h2>Прогресс выполнения проекта</h2><small>Подтверждённые этапы</small></header>
        <div className="mp-ref-progress-summary"><StageRing value={progress}/><div className="mp-ref-progress-facts">
          <p><CheckCircle2 size={17}/><strong>{done} из {checkpoints.length}</strong> этапов завершено</p>
          <p><CalendarDays size={17}/> Дедлайн: {dateLabel(deadline)}</p>
          <p><ShieldCheck size={17}/> По результатам проверки</p>
        </div></div>
      </Card>
      <Card><header className="mp-ref-card-head"><h2>Компетенции проекта</h2><small>Подтверждаются отдельно</small></header>
        <div className="mp-ref-skill-grid">{skills.length?skills.map((skill,i)=>
          <div className="mp-ref-skill" key={skill}><span className="mp-ref-blue-square">{[<Code2 size={19}/>,<Target size={19}/>,<LayersFallback/>,<Award size={19}/>][i]}</span><strong>{skill}</strong><small>После оценки результата</small></div>):<p className="mp-ref-muted">Навыки проекта ещё не опубликованы</p>}</div>
      </Card>
      <Card><Title icon={FileText}>Этапы выполнения</Title>
        <div className="mp-ref-timeline">{checkpoints.length?checkpoints.map((cp,index)=><div className="mp-ref-stage" key={cp.key}><span className={doneStates.has(cp.status)?"is-done":""}>{doneStates.has(cp.status)?<Check size={15}/>:index+1}</span><div><strong>{cp.title}</strong><small>{statusLabel(cp.status)}</small></div><em>{doneStates.has(cp.status)?"100%":"—"}</em></div>):<p className="mp-ref-muted">Нет опубликованных этапов</p>}</div>
      </Card>
    </div>
    <div className="mp-ref-stack">
      <Card><Title icon={Target}>Динамика прогресса</Title><div className="mp-ref-chart-empty"><svg viewBox="0 0 400 180" aria-hidden="true"><path d="M20 18H380M20 63H380M20 108H380M20 153H380" stroke="#173f59" strokeWidth="1" fill="none"/><path d="M20 153H380" stroke="#28617a" fill="none" strokeWidth="2"/></svg><span>История изменения прогресса пока недоступна</span></div></Card>
      <Card><Title icon={Target}>Следующее действие</Title><strong className="mp-ref-subtitle">{checkpoints.find(c=>!doneStates.has(c.status))?.title||"Все опубликованные этапы завершены"}</strong><p className="mp-ref-muted">Следующий шаг фиксируется в рабочей области после подтверждения результата</p><button className="mp-ref-primary" type="button" onClick={onWorkspace}>Открыть текущую задачу <ArrowRight size={15}/></button></Card>
      <Card><Title icon={Info}>Как считается прогресс?</Title><p className="mp-ref-muted">По подтверждённым контрольным этапам, без учёта просмотров и кликов; решения по проверкам: {decisions.length}</p></Card>
    </div>
  </div>;
}
function LayersFallback(){return <FileText size={19}/>;}
type TeamProps={team:ReferencePerson[];customer:string;mentor:string|null;onMessage:(id?:string)=>void;onContribution:()=>void;};
export function ProjectReferenceTeam({team,customer,mentor,onMessage,onContribution}:TeamProps){
 return <div className="mp-ref-columns" role="tabpanel" aria-label="Команда">
   <div className="mp-ref-stack"><Card><header className="mp-ref-card-head"><h2>Команда проекта</h2><span className="mp-ref-pill">{team.length} участников</span></header>
     <div className="mp-ref-team-list">{team.map(person=><div className="mp-ref-person" key={person.person_id}>
       <span className="mp-ref-avatar">{person.display_name.trim().charAt(0).toUpperCase()}</span><div><strong>{person.display_name}</strong><small>{statusLabel(person.status)}</small></div>
       <span className="mp-ref-pill">Участник</span>
       <button type="button" aria-label={`Написать ${person.display_name}`} onClick={()=>{onMessage(person.person_id);}}><MessageCircle size={17}/></button>
     </div>)}
     {!team.length&&<p className="mp-ref-empty">Состав команды ещё не опубликован</p>}
     </div></Card>
     <Card><Title icon={Users}>Распределение ответственности</Title>
       <div className="mp-ref-responsibility"><div><span className="mp-ref-blue-square"><Users size={16}/></span><b>Участники</b><small>{team.length?team.map(p=>p.display_name).join(", "):"Пока нет данных"}</small></div>
       <div><span className="mp-ref-blue-square"><Award size={16}/></span><b>Ментор</b><small>{mentor||"Не назначен"}</small></div>
       <div><span className="mp-ref-blue-square"><BriefcaseBusiness size={16}/></span><b>Заказчик</b><small>{customer}</small></div></div>
     </Card>
     <Card className="mp-ref-tip"><MessageCircle size={19}/><span><strong>Рабочее обсуждение</strong><small>Вопросы и решения удобнее обсуждать в сообщениях</small></span><button type="button" onClick={()=>{onMessage();}}>Открыть сообщения <ChevronRight size={15}/></button></Card>
   </div>
   <div className="mp-ref-stack"><Card><Title icon={Users}>Состав команды</Title><div className="mp-ref-team-count"><StageRing value={null} size="small"/><div><strong>{team.length} участников</strong><small>Доступных мест не указано</small><p>Заказчик и ментор — отдельные роли</p></div></div></Card>
     <Card><Title icon={Clock3}>Активность команды</Title><p className="mp-ref-muted">Подтверждённые личные результаты и обратная связь доступны в разделе «Мой вклад»</p><button type="button" className="mp-ref-outline" onClick={onContribution}>Посмотреть мой вклад <ArrowRight size={15}/></button></Card>
     <Card><Title icon={ShieldCheck}>Правила взаимодействия</Title><p className="mp-ref-muted">Материалы закрепляйте за задачей, вопросы обсуждайте в чате, результаты передавайте заказчику на проверку</p></Card>
   </div>
 </div>;
}
type RewardsProps={onContribution:()=>void;onWorkspace:()=>void;selected:string|null;onSelected:(id:string)=>void;};
export function ProjectReferenceRewards({onContribution,onWorkspace,selected,onSelected}:RewardsProps) {
  const items=[
    {id:"portfolio",title:"Результат в портфолио",desc:"Подтверждённый результат может стать частью портфолио",when:"После приёмки",icon:FileText},
    {id:"assessment",title:"Развитие компетенций",desc:"Практические навыки подтверждаются после проверки результата",when:"По итогам проверки",icon:Award},
    {id:"mentor",title:"Менторская поддержка",desc:"Обратная связь и консультации, если назначен ментор",when:"В период участия",icon:Users},
    {id:"case",title:"Реальный кейс",desc:"Практический опыт решения бизнес-задачи с проверяемым результатом",when:"После выполнения",icon:BriefcaseBusiness},
    {id:"team",title:"Командная практика",desc:"Совместная работа, обсуждение и демонстрация решений",when:"При участии в команде",icon:MessageCircle},
    {id:"community",title:"Рекомендации и возможности",desc:"Возможны дополнительные предложения по результатам отбора",when:"По решению заказчика",icon:Star},
  ];
  return <div className="mp-ref-columns" role="tabpanel" aria-label="Бонусы и выгоды">
    <div className="mp-ref-stack"><Card><header className="mp-ref-card-head"><h2>Что даст участие в проекте</h2><small>Возможности и условия</small></header>
      <div className="mp-ref-rewards">{items.map(item=>{const Icon=item.icon;return <button key={item.id} type="button" aria-pressed={selected===item.id} className={selected===item.id?"is-selected":""} onClick={()=>{onSelected(item.id);}}><span className="mp-ref-blue-square"><Icon size={19}/></span><span><strong>{item.title}</strong><small>{item.desc}</small></span><span className="mp-ref-reward-when">{item.when}</span><ChevronRight size={17}/></button>;})}</div>
      {selected&&<p className="mp-ref-reward-note" role="status">Предоставление возможности зависит от подтверждения результата и правил программы; автоматическая выдача не гарантируется</p>}
    </Card>
    <Card><Title icon={Award}>Что формируется по итогам</Title><div className="mp-ref-skill-grid"><div className="mp-ref-skill"><FileText size={20}/><strong>Результат</strong><small>Код и документы после приёмки</small></div><div className="mp-ref-skill"><Award size={20}/><strong>Компетенции</strong><small>После оценки</small></div><div className="mp-ref-skill"><Star size={20}/><strong>Портфолио</strong><small>Подтверждённый кейс</small></div></div></Card>
    </div>
    <div className="mp-ref-stack"><Card><Title icon={Target}>Как получить результат</Title><div className="mp-ref-timeline">
      {["Выполнить работу","Отправить на проверку","Получить решение","Добавить в портфолио"].map((v,i)=><div className="mp-ref-stage" key={v}><span>{i+1}</span><div><strong>{v}</strong><small>{["Подготовить материалы","Передать личный вклад","Дождаться решения заказчика","Сохранить принятый кейс"][i]}</small></div></div>)}</div><button type="button" className="mp-ref-primary" onClick={onWorkspace}>Продолжить работу <ArrowRight size={16}/></button></Card>
      <Card><Title icon={Gift}>Доступно во время работы</Title><div className="mp-ref-requirements"><div><CheckCircle2 size={16}/> Ментор и обратная связь — если назначены</div><div><FileText size={16}/> Рабочие материалы проекта</div></div></Card>
      <Card><Title icon={Info}>Без автоматических гарантий</Title><p className="mp-ref-muted">Сертификат, приглашение и рекомендация не гарантируются фактом участия</p><button type="button" className="mp-ref-outline" onClick={onContribution}>Мои подтверждённые результаты <ArrowRight size={16}/></button></Card>
    </div>
  </div>;
}
