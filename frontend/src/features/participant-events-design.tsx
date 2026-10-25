import { useState, type CSSProperties, type SyntheticEvent, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, Award, Bookmark, BookOpen, CalendarDays,
  CheckCircle2, ChevronDown, Code2, ExternalLink, GraduationCap,
  Landmark, Lightbulb, MapPin, Medal, ShieldCheck, Sparkles, BriefcaseBusiness,
Star, Target, Trophy, Users, X,
} from "lucide-react";
import { SafeExternalLink } from "../components/ui";
import type { EventDetail, RegistrationAggregate } from "./participant-events";

export type EventViewItem = {
  key: string; title: string; event_type: string; organizer: string;
  conditions: string; source_url: string; deadline_at: string | null;
  status: string; track_keys: string[]; recommendation_reason: string;
};
export type EventTab = "about" | "program" | "prizes" | "requirements" | "organizers" | "faq";
const tabs: { key: EventTab; label: string }[] = [
  { key: "program", label: "Программа" },
  { key: "prizes", label: "Призы и возможности" },
  { key: "requirements", label: "Требования" }, { key: "organizers", label: "Организаторы" },
  { key: "faq", label: "FAQ" },
];
const interests = ["python", "product", "ai", "ml", "data"];
function formatDate(value: string | null | undefined): string {
  if (!value) return "Уточняется";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Уточняется" : date.toLocaleDateString("ru-RU");
}
function isSber(value: string): boolean { return /сбер|sber/i.test(value); }
function matchPercent(item: EventViewItem, focus: string[]): number | null {
  if (item.track_keys.length === 0 || focus.length === 0) return null;
  const matches = item.track_keys.filter((key) => focus.some((f) => f.toLowerCase() === key.toLowerCase())).length;
  return Math.round(matches / item.track_keys.length * 100);
}
function currentStatus(item: EventViewItem): string {
  if (item.status !== "open") return "Завершено";
  if (item.deadline_at && new Date(item.deadline_at).getTime() < Date.now()) return "Дедлайн прошёл";
  return "Актуальное";
}
export function EventsHero({ events, onChoose }: { events: EventViewItem[]; onChoose: () => void }) {
  const sberEvents = events.filter(item => isSber(item.organizer));
  return <>
    <section className="ev-hero">
      <div className="ev-hero-copy">
        <div className="ev-kicker"><span className="ev-sber-emblem">✓ СБЕР</span> События от Сбера и партнёров</div>
        <h1 id="workspace-title">События, которые дают <em>практику, баллы и карьерные возможности</em></h1>
        <p>Участвуйте в хакатонах, конкурсах и образовательных программах, чтобы развиваться, получать опыт и попадать в проекты Сбера.</p>
        <button className="ev-primary ev-hero-action" type="button" onClick={onChoose}>Посмотреть подборку <ArrowRight size={16}/></button>
      </div>
      <div className="ev-hero-art" aria-hidden="true">
        <div className="ev-mock-orb"/><span className="ev-floating-chip ev-chip-practice">ϟ&nbsp; Практика</span><span className="ev-floating-chip ev-chip-network">♧&nbsp; Нетворк</span><span className="ev-floating-chip ev-chip-points">🏆&nbsp; Баллы</span><span className="ev-floating-chip ev-chip-career">▰&nbsp; Карьера</span>
      </div>
    </section>
    <div className="ev-metrics">
      <div><CalendarDays/><strong>{events.length}</strong><span><b>событий подходят вам</b><small>На основе интересов и траектории</small></span></div>
      <div><Landmark/><strong>{sberEvents.length}</strong><span><b>событий от Сбера</b><small>Эксклюзивные возможности</small></span></div>
      <div className="ev-metric-alignment"><div className="ev-average-ring"><strong>{events.length ? Math.round(events.reduce((sum,item) => sum + (matchPercent(item,interests) ?? 0),0)/events.length) : 0}%</strong></div><span><b>Среднее совпадение</b><small>Насколько события соответствуют вашим навыкам</small></span></div>
    </div>
  </>;
}
export function EventsCard({ item, focus, index, frozen, saved, onDetails, onRegister, onSave }: {
  item: EventViewItem; focus: string[]; index: number; frozen: boolean; saved: boolean;
  onDetails: () => void; onRegister: () => void; onSave: () => void;
}) {
  const match = matchPercent(item,focus);
  const labels = [item.event_type, ...item.track_keys.slice(0,4)];
  const sber = isSber(item.organizer);
  const status = currentStatus(item);
  return <article className="ev-event-card" data-testid="event-reference-card" data-event-key={item.key}>
    <div className={`ev-event-thumb ev-event-thumb-${String(index%3)}`} aria-hidden="true">
      {index%3===0?<Code2 size={58}/>:index%3===1?<BookOpen size={58}/>:<Trophy size={58}/>}
    </div>
    <div className="ev-event-main">
      <div className="ev-event-title-line"><h3>{item.title}</h3>{sber && <strong className="ev-sber-label"><img src="/task-catalog/brands/sber.svg" alt=""/> Сбер</strong>}</div>
      <div className="ev-event-meta"><span><Landmark size={14}/>{item.organizer}</span><span><CalendarDays size={14}/>{formatDate(item.deadline_at)}</span><span><MapPin size={14}/>Формат в деталях</span></div>
      <div className="ev-event-tags">{labels.map(tag => <span key={tag}>{tag}</span>)}</div>
      <div className="ev-event-reason"><Lightbulb size={17}/><strong>Почему подходит:</strong> {item.recommendation_reason || "Соответствует выбранным направлениям"}</div>
    </div>
    <aside className="ev-event-match">
      <button className={`ev-save ${saved?"is-saved":""}`} type="button" onClick={onSave} aria-label={saved?"Убрать из избранного":"В избранное"} aria-pressed={saved}><Star size={20} fill={saved?"currentColor":"none"}/></button>
      {match !== null ? <>
        <span className="ev-match-chip">{match}% по направлениям</span>
        <div className="ev-radar" role="img" aria-label={`Совпадение направлений ${String(match)}%`}><span>{match}%</span></div>
      </>:<span className="ev-match-chip">Ознакомьтесь с событием</span>}
      <div className="ev-match-bars">{item.track_keys.slice(0,4).map(t => <div key={t}><span>{t}</span><i style={{"--ev-fill":focus.includes(t)?"100%":"30%"} as CSSProperties}/></div>)}</div>
      <div className="ev-card-actions"><button type="button" className="ev-primary" onClick={onDetails}>Подробнее <ArrowRight size={16}/></button></div>
    </aside>
    <div className="ev-card-footer"><SafeExternalLink href={item.source_url} className="ev-source-link">{item.status==="open"?"Перейти к событию":"Открыть первоисточник"} <ExternalLink size={12}/></SafeExternalLink>
      <span className={`ev-status ${status==="Актуальное"?"ev-status-open":""}`}>{status}</span>
      {frozen && <><span className="ev-points-frozen"><b>+5 frozen</b></span><span className="ev-frozen-message">5 баллов заморожены до окончания события и проверки результата.</span></>}
      {item.status==="open" && !frozen && <button type="button" className="ev-quick-register" onClick={onRegister}>Зарегистрироваться · +5</button>}
    </div>
  </article>;
}

function InformationPanel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <section className="ev-panel"><h3>{title}</h3>{subtitle&&<p className="ev-subtitle">{subtitle}</p>}{children}</section>;
}
const facts = [
  {icon:Code2,title:"Практический опыт",text:"Кейсы и решение задач"},
  {icon:Users,title:"Новые контакты",text:"Общение с участниками"},
  {icon:GraduationCap,title:"Развитие компетенций",text:"Опыт для портфолио"},
  {icon:Trophy,title:"Новый результат",text:"После подтверждения участия"},
];
export function EventExperienceDetail({detail,aggregate,tab,onTabChange,onClose,onRegister,isSaved,onSave}:{
 detail:EventDetail; aggregate:RegistrationAggregate; tab:EventTab; onTabChange:(tab:EventTab)=>void;
 onClose:()=>void; onRegister:()=>void; isSaved:boolean; onSave:()=>void;
}) {
  const [day,setDay]=useState(0);
  const program=detail.program ?? [];
  const days=[...new Set(program.map(stage=>stage.day))];
  const shown=program.filter(stage=>stage.day===days[day]);
  const isOpen=detail.status==="open";
  return <div className={`ev-detail-v2 ev-detail--${tab}`} data-testid="event-detail">
    <div className="ev-detail-top"><button type="button" onClick={onClose}><ArrowLeft size={16}/> К списку событий</button><button type="button" onClick={onClose} aria-label="Закрыть подробности"><X size={21}/></button></div>
    <section className="ev-detail-hero">
      <div className="ev-detail-hero-top"><span>{detail.event_type}</span><span className="ev-hero-tag"><CheckCircle2 size={14}/> Совпадает с вашей траекторией</span><span className="ev-demo-stamp">{detail.organizer}</span></div>
      <h2>{detail.title}</h2>
      <p>{detail.description || detail.recommendation_reason || "Информация о событии уточняется организатором"}</p>
      <div className="ev-detail-hero-meta"><span><Landmark size={17}/>{detail.organizer}</span><span><MapPin size={17}/>{detail.venue_format || "Формат уточняется"}</span><span><CalendarDays size={17}/>{formatDate(detail.deadline_at)}</span></div>
    </section>
    <nav className="ev-tabs" aria-label="Разделы события">{tabs.map(item => <button type="button" key={item.key} className={tab===item.key?"active":""} aria-current={tab===item.key?"page":undefined} onClick={()=> { onTabChange(item.key); }}>{item.label}</button>)}<button type="button" className="ev-primary ev-registration-cta" onClick={onRegister} disabled={!isOpen}>Зарегистрироваться <ArrowRight size={16}/></button><button type="button" className={`ev-save ${isSaved?"is-saved":""}`} aria-label="Сохранить событие" aria-pressed={isSaved} onClick={onSave}><Bookmark size={18} fill={isSaved?"currentColor":"none"}/></button></nav>
    <div className="ev-detail-columns">
      <main className="ev-detail-main">
        {tab==="about"&&<>
          <InformationPanel title="О событии"><p className="ev-paragraph">{detail.description || "Описание ещё не опубликовано"}</p><div className="ev-benefit-grid">{facts.map(({icon:Icon,title,text})=><div key={title}><Icon/><b>{title}</b><small>{text}</small></div>)}</div></InformationPanel>
          <InformationPanel title="Для кого"><p className="ev-paragraph">{detail.target_audience || "Аудиторию уточняйте у организатора"}</p><div className="ev-tags">{detail.track_keys.map(tag=><span key={tag}>{tag}</span>)}</div></InformationPanel>
          <InformationPanel title="Направления и кейсы"><p className="ev-paragraph">{detail.expected_result || "Результаты участия уточняются"}</p><p className="ev-paragraph">{detail.conditions}</p></InformationPanel>
        </>}
        {tab==="program"&&<InformationPanel title="Программа мероприятия" subtitle="Этапы из программы, опубликованной организатором">
          {days.length ? <><div className="ev-day-tabs">{days.map((name,i)=><button key={name} type="button" className={day===i?"active":""} onClick={()=> { setDay(i); }}>{name}</button>)}</div><ol className="ev-program-timeline">{shown.map((stage,i)=><li key={`${stage.title}-${String(i)}`}><time>Этап {String(i+1)}</time><span className="ev-timeline-node" aria-hidden="true"/><div><b>{stage.title}</b><small>{stage.detail}</small></div></li>)}</ol></>:<p className="ev-paragraph">Программа пока не опубликована. Актуальные этапы доступны у организатора.</p>}
        </InformationPanel>}
        {tab==="prizes"&&<>
          <InformationPanel title="Призы и возможности" subtitle="Награды, опыт и новые карьерные контакты — подробные условия уточняются у организатора"><div className="ev-prize-grid"><div><Trophy/><b>1 место</b><small>Награда победителю</small><p>Условия уточняются у организатора</p></div><div><Medal/><b>2 место</b><small>Награда финалистам</small><p>По правилам события</p></div><div><Award/><b>3 место</b><small>Награда финалистам</small><p>По правилам события</p></div></div></InformationPanel>
          <InformationPanel title="Что останется после события"><div className="ev-benefit-grid">{facts.map(({icon:Icon,title,text})=><div key={title}><Icon/><b>{title}</b><small>{text}</small></div>)}</div><p className="ev-paragraph">Денежные призы, стажировки и сертификаты показываются только после подтверждения организатором.</p></InformationPanel>
        </>}
        {tab==="requirements"&&<>
          <InformationPanel title="Требования к участникам" subtitle="Проверьте условия перед подачей заявки"><div className="ev-requirements-grid">
          <div><Users/><b>Кто может участвовать</b><p>{detail.target_audience || "Уточняется"}</p></div>
          <div><Code2/><b>Необходимые навыки</b><ul>{detail.prerequisites?.length?detail.prerequisites.map(t=><li key={t}>{t}</li>):<li>Уточняются организатором</li>}</ul></div>
          <div><ShieldCheck/><b>Условия участия</b><p>{detail.participation_rules || detail.conditions}</p></div></div></InformationPanel>
          <InformationPanel title="Формат"><div className="ev-info-row"><span>Формат проведения</span><b>{detail.venue_format||"Уточняется"}</b></div><div className="ev-info-row"><span>Дедлайн</span><b>{formatDate(detail.deadline_at)}</b></div></InformationPanel>
        </>}
        {tab==="organizers"&&<>
          <InformationPanel title="Организаторы и партнёры" subtitle="Информация, подтверждённая источником события"><div className="ev-organizer-feature"><div className="ev-org-icon"><Landmark size={42}/></div><div><h4>{detail.organizer}</h4><p>Организатор мероприятия</p><SafeExternalLink href={detail.source_url}>Официальная страница <ExternalLink size={13}/></SafeExternalLink></div></div></InformationPanel>
          <InformationPanel title="К кому обращаться"><p className="ev-paragraph">Контакты оргкомитета и список менторов смотрите на официальной странице. Неподтверждённые имена и партнёры здесь не публикуются.</p></InformationPanel>
        </>}
        {tab==="faq"&&<InformationPanel title="Частые вопросы" subtitle="Коротко о формате и участии">
          <div className="ev-faq">{[
           ["Кто может участвовать?",detail.target_audience||"Аудитория пока уточняется"],
           ["Как зарегистрироваться?","Нажмите «Зарегистрироваться» и перейдите на официальную страницу организатора."],
           ["Нужна ли команда заранее?",detail.conditions||"Условия команды не опубликованы"],
           ["Какой формат мероприятия?",detail.venue_format||"Уточняется"],
           ["Какие навыки потребуются?",detail.prerequisites?.join(", ")||"Список уточняется"],
           ["Где посмотреть программу?",program.length?"Программа доступна на вкладке «Программа».":"Программа ещё не опубликована"],
           ["Как подтвердить участие?","После события отправьте подтверждение результата через платформу."],
          ].map(([q,a])=><details key={q}><summary>{q}<ChevronDown size={16}/></summary><p>{a}</p></details>)}</div></InformationPanel>}
      </main>
      <aside className="ev-detail-side">
        <InformationPanel title={tab==="program" ? "Что вас ждёт" : tab==="prizes" ? "Карьерные возможности" : tab==="about" ? "Ваше совпадение" : "Ваши направления"}>
          {tab==="program" && <div className="ev-side-features">
            {facts.slice(0,3).map(({icon:Icon,title,text}) => <div className="ev-side-feature" key={title}><Icon size={21}/><span><b>{title}</b><small>{text}</small></span></div>)}
            <div className="ev-side-feature"><Sparkles size={21}/><span><b>Результат для портфолио</b><small>После подтверждения результата</small></span></div>
          </div>}
          {tab==="prizes" && <div className="ev-side-features"><div className="ev-side-feature"><BriefcaseBusiness size={21}/><span><b>Возможность быть замеченным</b><small>При наличии программы отбора у организатора</small></span></div><div className="ev-side-feature"><Target size={21}/><span><b>Следующий шаг в траектории</b><small>Опыт решения задач и работы в команде</small></span></div></div>}
          <div className={tab==="program"||tab==="prizes"?"ev-side-secondary":""}><div className="ev-match-overview"><div className="ev-match-circle"><Target size={33}/></div><p>Событие связано с направлениями <strong>{detail.track_keys.join(", ") || "развития"}</strong></p></div><div className="ev-tags">{detail.track_keys.map(t=><span key={t}>{t}</span>)}</div></div></InformationPanel>
        <InformationPanel title="Формат"><div className="ev-info-row"><span>Организатор</span><b>{detail.organizer}</b></div><div className="ev-info-row"><span>Формат</span><b>{detail.venue_format||"Уточняется"}</b></div><div className="ev-info-row"><span>Дедлайн</span><b>{formatDate(detail.deadline_at)}</b></div><div className="ev-info-row"><span>Регистраций</span><b>{aggregate.counter_state==="unknown"?"Нет данных":aggregate.confirmed_registrations??"Нет данных"}</b></div><div className="ev-info-row"><span>Участий</span><b>{aggregate.counter_state==="unknown"?"Нет данных":aggregate.participations??"Нет данных"}</b></div><p className="ev-side-note">{aggregate.definition_text}</p></InformationPanel>
        <InformationPanel title="Полезные ссылки"><SafeExternalLink href={detail.source_url}>Сайт события <ExternalLink size={14}/></SafeExternalLink><p className="ev-side-note">Источник проверен: {formatDate(detail.source_checked_at)}</p></InformationPanel>
      </aside>
    </div>
  </div>;
}

export function EventRegistrationForm({event,onClose,onInterest}:{
 event:EventDetail;onClose:()=>void;onInterest:()=>void;
}) {
 const [step,setStep]=useState(0);
 const [name,setName]=useState("");
 const [email,setEmail]=useState("");
 const [university,setUniversity]=useState("");
 const [level,setLevel]=useState("beginner");
 const [track,setTrack]=useState(event.track_keys[0]||"python");
 const [notes,setNotes]=useState("");
 const [consent,setConsent]=useState(false);
 const [finished,setFinished]=useState(false);
 const next=(e:SyntheticEvent<HTMLFormElement>)=>{e.preventDefault();if(step<2)setStep(step+1);else {setStep(3);setFinished(true);onInterest();}};
 return <div className="ev-registration-cover" data-testid="event-registration">
   <section className="ev-registration-card" aria-label="Регистрация на событие">
     <div className="ev-reg-top"><div><h3>Подготовка заявки</h3><p>{event.title} · Демонстрационная анкета, данные не отправляются организатору</p></div><button type="button" aria-label="Закрыть регистрацию" onClick={onClose}><X size={20}/></button></div>
     <div className="ev-reg-steps">{["Личные данные","Опыт и навыки","Дополнительно","Подтверждение"].map((s,i)=><div className={i<=step?"active":""} key={s}><span>{i+1}</span><small>{s}</small></div>)}</div>
     {finished?<div className="ev-reg-finish"><CheckCircle2 size={42}/><h4>Анкета подготовлена</h4><p>Данные анкеты не отправлялись организатору и не сохранялись в базе. Для реальной регистрации перейдите на официальный сайт события.</p><SafeExternalLink className="ev-primary" href={event.source_url}>Перейти к регистрации <ExternalLink size={17}/></SafeExternalLink></div>
      :<form onSubmit={next}>
       {step===0&&<div className="ev-reg-fields"><label>ФИО *<input required value={name} onChange={e=> { setName(e.target.value); }} placeholder="Иван Иванов"/></label><label>Email *<input type="email" required value={email} onChange={e=> { setEmail(e.target.value); }} placeholder="example@mail.ru"/></label><label>Учебное заведение<input value={university} onChange={e=> { setUniversity(e.target.value); }} placeholder="Название университета"/></label><label>Уровень подготовки<select value={level} onChange={e=> { setLevel(e.target.value); }}><option value="beginner">Начинающий</option><option value="intermediate">Средний</option><option value="advanced">Продвинутый</option></select></label></div>}
       {step===1&&<div className="ev-reg-fields"><label>Ваше направление<select value={track} onChange={e=> { setTrack(e.target.value); }}>{(event.track_keys.length?event.track_keys:interests).map(t=><option key={t}>{t}</option>)}</select></label><label>Опыт участия<select><option>Первое событие</option><option>Уже участвовал(а)</option></select></label><label className="ev-wide">Что хотите получить от участия?<textarea value={notes} onChange={e=> { setNotes(e.target.value); }} placeholder="Практика, команда, навыки..."/></label></div>}
       {step===2&&<><p className="ev-paragraph">Это предварительная анкета для демонстрации интерфейса. Реальная заявка подаётся на сайте организатора.</p><label className="ev-reg-consent"><input type="checkbox" required checked={consent} onChange={e=> { setConsent(e.target.checked); }}/> Понимаю, что эта форма не отправляет заявку организатору</label></>}
       <div className="ev-reg-actions">{step>0&&<button className="ev-outline" type="button" onClick={()=> { setStep(step-1); }}>Назад</button>}<button className="ev-primary" type="submit">{step===2?"Подготовить заявку":"Далее"} <ArrowRight size={16}/></button></div>
      </form>}
   </section>
 </div>;
}
