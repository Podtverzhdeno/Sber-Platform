import { Brain, Code2, Database, MessageSquare, Settings2, Users } from "lucide-react";

const metrics = [
  { key: "thinking", title: "Системное мышление", value: 82, icon: Brain },
  { key: "technical", title: "Технические навыки", value: 91, icon: Code2 },
  { key: "data", title: "Работа с данными", value: 86, icon: Database },
  { key: "communication", title: "Коммуникация", value: 78, icon: MessageSquare },
  { key: "team", title: "Работа в команде", value: 84, icon: Users },
  { key: "problem", title: "Решение задач", value: 89, icon: Settings2 },
] as const;

export function SkillMatchWheel({ score = 87 }: { score?: number }) {
  return <section className="skill-wheel-card" aria-label="Совпадение кандидата с задачей">
    <div className="skill-wheel"><div className="skill-wheel__outer"/><div className="skill-wheel__inner"/><div className="skill-wheel__core"><strong>{score}<span>/100</span></strong><small>совпадение<br/>с задачей</small></div></div>
    <div className="skill-wheel-metrics">{metrics.map(({key,title,value,icon:Icon})=><article className={`skill-metric skill-metric--${key}`} key={key}><span><Icon size={22}/></span><div><b>{title}</b><strong>{value}%</strong></div></article>)}</div>
  </section>;
}
