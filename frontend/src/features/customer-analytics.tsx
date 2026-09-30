import { useState } from "react";
import "./customer-analytics.css";

const funnel = [
  { label: "Регистрация", value: "1 840", width: 100 }, { label: "Квалификация", value: "720", width: 82 },
  { label: "Talent Cohort", value: "286", width: 64 }, { label: "Реальные задачи", value: "164", width: 49 },
  { label: "Talent Pool", value: "74", width: 35 }, { label: "Интервью", value: "31", width: 23 },
];
const universities = [
  { name: "МГТУ им. Н. Э. Баумана", value: 88 }, { name: "МФТИ", value: 76 }, { name: "ИТМО", value: 68 },
  { name: "НИУ ВШЭ", value: 58 }, { name: "СПбГУ", value: 51 }, { name: "УрФУ", value: 44 },
];
const periods = ["Последние 90 дней", "Последние 30 дней", "Последний год"];

export function CustomerAnalytics() {
  const [period, setPeriod] = useState(0);
  const [allUniversities, setAllUniversities] = useState(false);
  const exportReport = () => {
    const report = "Impulse — Talent Intelligence\nАктивные участники: 1 840\nQualified Talent: 286\nПринято проектов: 164\nTalent Pool: 74\nИнтервью: 31";
    const url = URL.createObjectURL(new Blob([report], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "impulse-talent-report.txt"; link.click(); URL.revokeObjectURL(url);
  };
  return <div className="customer-talent-analytics">
    <header className="cta-page-header"><div><p className="cta-eyebrow">TALENT INTELLIGENCE</p><h1 id="workspace-title">Аналитика</h1><p>Отслеживаем путь кандидатов от входа в платформу до реальных задач, Talent Pool и интервью.</p></div><div className="cta-page-actions"><button type="button" className="cta-period" onClick={() => { setPeriod(value => (value + 1) % periods.length); }}>{periods[period]}⌄</button><button type="button" className="cta-export" onClick={exportReport}>Экспорт отчёта</button></div></header>
    <section className="cta-kpi-grid" aria-label="Ключевые показатели"><KpiCard label="АКТИВНЫЕ УЧАСТНИКИ" value="1 840" delta="+12%" caption="за выбранный период" icon="◎"/><KpiCard label="ПОДТВЕРДИЛИ КОМПЕТЕНЦИИ" value="286" delta="+18%" caption="Qualified Talent" icon="✓"/><KpiCard label="ПРОЕКТОВ ПРИНЯТО" value="164" delta="+9%" caption="реальные задачи" icon="▣"/><KpiCard label="TALENT POOL" value="74" delta="+21%" caption="интерес бизнеса" icon="✦"/></section>
    <section className="cta-main-grid">
      <article className="cta-card cta-funnel-card"><CardHeader eyebrow="TALENT FUNNEL" title="Воронка отбора" meta="Россия · все направления"/><div className="cta-funnel">{funnel.map(item=><div className="cta-funnel-row" key={item.label}><div><span>{item.label}</span><b>{item.value}</b></div><div className="cta-funnel-track"><i style={{width:`${String(item.width)}%`}}/></div></div>)}</div><div className="cta-insight"><span>✦</span><div><b>Основной фильтр начинается до экспертной оценки</b><p>В Talent Cohort попадает только часть кандидатов — эксперты подключаются уже к более сильной выборке.</p></div></div></article>
      <article className="cta-card cta-source-card"><CardHeader eyebrow="TALENT SOURCES" title="Где находим лучших" meta="Talent Pool"/><div className="cta-donut"><div><strong>74</strong><span>кандидата</span></div></div><div className="cta-legend"><Legend color="green" label="Хакатоны" value="28%"/><Legend color="cyan" label="Wildcard" value="24%"/><Legend color="blue" label="Олимпиады" value="19%"/><Legend color="purple" label="Научные работы" value="15%"/><Legend color="muted" label="Прочие" value="14%"/></div></article>
      <article className="cta-card cta-line-card"><CardHeader eyebrow="QUALIFIED TALENT" title="Динамика подтверждённых кандидатов" meta="+18%" positive/><div className="cta-chart"><svg viewBox="0 0 600 220" role="img" aria-label="Рост числа подтверждённых кандидатов"><defs><linearGradient id="cta-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#3de0b6" stopOpacity=".28"/><stop offset="100%" stopColor="#3de0b6" stopOpacity="0"/></linearGradient><linearGradient id="cta-line" x1="0" x2="1"><stop offset="0%" stopColor="#38bdf8"/><stop offset="100%" stopColor="#43e0b2"/></linearGradient></defs><g className="cta-grid-lines"><line x1="25" y1="40" x2="575" y2="40"/><line x1="25" y1="90" x2="575" y2="90"/><line x1="25" y1="140" x2="575" y2="140"/><line x1="25" y1="190" x2="575" y2="190"/></g><path className="cta-area" d="M30,178 C80,170 110,160 145,151 C190,138 220,145 260,124 C305,102 342,110 385,88 C430,65 475,80 520,54 C542,42 558,37 575,30 L575,205 L30,205 Z"/><path className="cta-trend" d="M30,178 C80,170 110,160 145,151 C190,138 220,145 260,124 C305,102 342,110 385,88 C430,65 475,80 520,54 C542,42 558,37 575,30"/>{[[30,178],[145,151],[260,124],[385,88],[520,54],[575,30]].map(([x,y])=><circle key={x} cx={x} cy={y} r="4"/>)}</svg><div><span>Июнь</span><span>Июль</span><span>Август</span><span>Сентябрь</span></div></div></article>
      <article className="cta-card cta-universities"><CardHeader eyebrow="UNIVERSITIES" title="Вузы с подтверждёнными талантами" action={<button type="button" onClick={() => { setAllUniversities(value=>!value); }}>{allUniversities?"Свернуть":"Все вузы"}</button>}/><div>{universities.slice(0,allUniversities?universities.length:4).map((university,index)=><div className="cta-university-row" key={university.name}><div><span><i>{String(index+1).padStart(2,"0")}</i>{university.name}</span><b>{university.value}</b></div><div><i style={{width:`${String(university.value)}%`}}/></div></div>)}</div></article>
      <article className="cta-card cta-business"><CardHeader eyebrow="BUSINESS VALUE" title="Эффект для бизнеса" meta="за период"/><div><BusinessMetric value="74" label="профиля" text="приняты к рассмотрению руководителями"/><BusinessMetric value="31" label="интервью" text="назначено после просмотра verified-профиля"/><BusinessMetric value="−27%" label="повторных проверок" text="базовые навыки уже подтверждены практикой"/><BusinessMetric value="2,4" label="дня" text="среднее время формирования shortlist"/></div></article>
    </section>
  </div>;
}

function KpiCard({label,value,delta,caption,icon}:{label:string;value:string;delta:string;caption:string;icon:string}) { return <article className="cta-kpi"><div><span>{icon}</span><em>{delta}</em></div><small>{label}</small><strong>{value}</strong><p>{caption}</p></article>; }
function CardHeader({eyebrow,title,meta,positive=false,action}:{eyebrow:string;title:string;meta?:string;positive?:boolean;action?:React.ReactNode}) { return <header className="cta-card-header"><div><p className="cta-eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action??<span className={positive?"positive":""}>{meta}</span>}</header>; }
function Legend({color,label,value}:{color:string;label:string;value:string}) { return <div><span><i className={color}/>{label}</span><b>{value}</b></div>; }
function BusinessMetric({value,label,text}:{value:string;label:string;text:string}) { return <section><div><strong>{value}</strong><span>{label}</span></div><p>{text}</p></section>; }
