import { useState } from "react";
import "./customer-analytics.css";

const funnelLabels = ["Регистрация", "Квалификация", "Talent Cohort", "Реальные задачи", "Talent Pool", "Интервью"];
const universities = [
  { name: "МГТУ им. Н. Э. Баумана", value: 88 }, { name: "МФТИ", value: 76 }, { name: "ИТМО", value: 68 },
  { name: "НИУ ВШЭ", value: 58 }, { name: "СПбГУ", value: 51 }, { name: "УрФУ", value: 44 },
];
const periods = ["Последние 90 дней", "Последние 30 дней", "Последний год"] as const;
const analyticsByPeriod = [
  { kpis:[["1 840","+12%"],["286","+18%"],["164","+9%"],["74","+21%"]], funnel:[1840,720,286,164,74,31], business:[["18","+5"],["29","+7"],["123","+19"],["67","+14"]], trend:"+18%" },
  { kpis:[["612","+5%"],["94","+7%"],["52","+4%"],["23","+6%"]], funnel:[612,238,94,52,23,11], business:[["8","+2"],["12","+3"],["47","+8"],["24","+5"]], trend:"+7%" },
  { kpis:[["6 920","+34%"],["1 148","+41%"],["638","+29%"],["312","+46%"]], funnel:[6920,2810,1148,638,312,126], business:[["64","+18"],["91","+24"],["418","+76"],["186","+42"]], trend:"+41%" },
] as const;
const businessLabels = [["Активные задачи","задач сейчас в работе"],["Команды в работе","активных команд"],["Участники","в текущих проектах"],["Завершено задач","за всё время"]] as const;

export function CustomerAnalytics() {
  const [period, setPeriod] = useState(0);
  const [allUniversities, setAllUniversities] = useState(false);
  const data=analyticsByPeriod[period]??analyticsByPeriod[0];
  const periodLabel=periods[period]??periods[0];
  const funnel=data.funnel.map((value,index)=>({label:funnelLabels[index],value:value.toLocaleString("ru-RU"),width:index===0?100:Math.max(18,Math.round(value/data.funnel[0]*100))}));
  const exportReport = () => {
    const report = `Impulse — Talent Intelligence\nПериод: ${periodLabel}\nАктивные участники: ${data.kpis[0][0]}\nQualified Talent: ${data.kpis[1][0]}\nПринято проектов: ${data.kpis[2][0]}\nTalent Pool: ${data.kpis[3][0]}\nИнтервью: ${String(data.funnel[5])}`;
    const url = URL.createObjectURL(new Blob([report], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "impulse-talent-report.txt"; link.click(); URL.revokeObjectURL(url);
  };
  return <div className="customer-talent-analytics">
    <header className="cta-page-header"><div><p className="cta-eyebrow">TALENT INTELLIGENCE</p><h1 id="workspace-title">Аналитика</h1><p>Отслеживаем путь кандидатов от входа в платформу до реальных задач, Talent Pool и интервью.</p></div><div className="cta-page-actions"><button type="button" className="cta-period" onClick={() => { setPeriod(value => (value + 1) % periods.length); }}>{periodLabel}⌄</button><button type="button" className="cta-export" onClick={exportReport}>Экспорт отчёта</button></div></header>
    <section className="cta-kpi-grid" aria-label="Ключевые показатели"><KpiCard label="АКТИВНЫЕ УЧАСТНИКИ" value={data.kpis[0][0]} delta={data.kpis[0][1]} caption="за выбранный период" icon="◎"/><KpiCard label="ПОДТВЕРДИЛИ КОМПЕТЕНЦИИ" value={data.kpis[1][0]} delta={data.kpis[1][1]} caption="Qualified Talent" icon="✓"/><KpiCard label="ПРОЕКТОВ ПРИНЯТО" value={data.kpis[2][0]} delta={data.kpis[2][1]} caption="реальные задачи" icon="▣"/><KpiCard label="TALENT POOL" value={data.kpis[3][0]} delta={data.kpis[3][1]} caption="интерес бизнеса" icon="✦"/></section>
    <section className="cta-main-grid">
      <article className="cta-card cta-funnel-card"><CardHeader eyebrow="TALENT FUNNEL" title="Воронка отбора" meta="Россия · все направления"/><div className="cta-funnel">{funnel.map(item=><div className="cta-funnel-row" key={item.label}><div><span>{item.label}</span><b>{item.value}</b></div><div className="cta-funnel-track"><i style={{width:`${String(item.width)}%`}}/></div></div>)}</div><div className="cta-insight"><span>✦</span><div><b>Основной фильтр начинается до экспертной оценки</b><p>В Talent Cohort попадает только часть кандидатов — эксперты подключаются уже к более сильной выборке.</p></div></div></article>
      <article className="cta-card cta-source-card"><CardHeader eyebrow="TALENT SOURCES" title="Где находим лучших" meta="Talent Pool"/><div className="cta-donut"><div><strong>{data.kpis[3][0]}</strong><span>кандидата</span></div></div><div className="cta-legend"><Legend color="green" label="Хакатоны" value="28%"/><Legend color="cyan" label="Wildcard" value="24%"/><Legend color="blue" label="Олимпиады" value="19%"/><Legend color="purple" label="Научные работы" value="15%"/><Legend color="muted" label="Прочие" value="14%"/></div></article>
      <article className="cta-card cta-line-card"><CardHeader eyebrow="QUALIFIED TALENT" title="Динамика подтверждённых кандидатов" meta="+18%" positive/><div className="cta-chart"><svg viewBox="0 0 600 220" role="img" aria-label="Рост числа подтверждённых кандидатов"><defs><linearGradient id="cta-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#3de0b6" stopOpacity=".28"/><stop offset="100%" stopColor="#3de0b6" stopOpacity="0"/></linearGradient><linearGradient id="cta-line" x1="0" x2="1"><stop offset="0%" stopColor="#38bdf8"/><stop offset="100%" stopColor="#43e0b2"/></linearGradient></defs><g className="cta-grid-lines"><line x1="25" y1="40" x2="575" y2="40"/><line x1="25" y1="90" x2="575" y2="90"/><line x1="25" y1="140" x2="575" y2="140"/><line x1="25" y1="190" x2="575" y2="190"/></g><path className="cta-area" d="M30,178 C80,170 110,160 145,151 C190,138 220,145 260,124 C305,102 342,110 385,88 C430,65 475,80 520,54 C542,42 558,37 575,30 L575,205 L30,205 Z"/><path className="cta-trend" d="M30,178 C80,170 110,160 145,151 C190,138 220,145 260,124 C305,102 342,110 385,88 C430,65 475,80 520,54 C542,42 558,37 575,30"/>{[[30,178],[145,151],[260,124],[385,88],[520,54],[575,30]].map(([x,y])=><circle key={x} cx={x} cy={y} r="4"/>)}</svg><div><span>Июнь</span><span>Июль</span><span>Август</span><span>Сентябрь</span></div></div></article>
      <article className="cta-card cta-universities"><CardHeader eyebrow="UNIVERSITIES" title="Вузы с подтверждёнными талантами" action={<button type="button" onClick={() => { setAllUniversities(value=>!value); }}>{allUniversities?"Свернуть":"Все вузы"}</button>}/><div>{universities.slice(0,allUniversities?universities.length:4).map((university,index)=><div className="cta-university-row" key={university.name}><div><span><i>{String(index+1).padStart(2,"0")}</i>{university.name}</span><b>{university.value}</b></div><div><i style={{width:`${String(university.value)}%`}}/></div></div>)}</div></article>
      <article className="cta-card cta-business"><CardHeader eyebrow="BUSINESS VALUE" title="Эффект для бизнеса" meta={periodLabel}/><div>{data.business.map(([value,delta],index)=>{const [label,text]=businessLabels[index]??businessLabels[0];return <BusinessMetric key={label} value={value} delta={delta} label={label} text={text}/>;})}</div></article>
    </section>
  </div>;
}

function KpiCard({label,value,delta,caption,icon}:{label:string;value:string;delta:string;caption:string;icon:string}) { return <article className="cta-kpi"><div><span>{icon}</span><em>{delta}</em></div><small>{label}</small><strong>{value}</strong><p>{caption}</p></article>; }
function CardHeader({eyebrow,title,meta,positive=false,action}:{eyebrow:string;title:string;meta?:string;positive?:boolean;action?:React.ReactNode}) { return <header className="cta-card-header"><div><p className="cta-eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action??<span className={positive?"positive":""}>{meta}</span>}</header>; }
function Legend({color,label,value}:{color:string;label:string;value:string}) { return <div><span><i className={color}/>{label}</span><b>{value}</b></div>; }
function BusinessMetric({value,delta,label,text}:{value:string;delta:string;label:string;text:string}) { return <section><header><span>{label}</span><em>{delta}</em></header><div><strong>{value}</strong></div><p>{text}</p></section>; }
