import type { ReactNode } from "react";

export function WorkspaceHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <header className="ws-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lead">{subtitle}</p></div>{action}</header>;
}

const metricPatterns=[[22,31,28,44,51,66],[64,57,61,48,53,46],[18,33,29,52,45,73],[46,38,55,49,68,62],[27,48,41,39,58,71],[58,42,47,65,54,76]];

export function MetricCard({ label = "", value = "", delta = "", tone = "cyan", values, icon }: { label?: string; value?: string | number; delta?: string; tone?: "cyan" | "blue" | "violet" | "amber"; values?: number[]; icon?: ReactNode }) {
  const patternIndex=Array.from(label).reduce((sum,char)=>sum+char.charCodeAt(0),0)%metricPatterns.length;
  const chartValues=values??metricPatterns[patternIndex]??[28,42,35,58,51,72];
  const max=Math.max(...chartValues,1);
  return <article className={`ws-metric ws-metric--${tone}`}><span className="ws-metric-icon" aria-hidden="true">{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{delta}</em></div><svg viewBox="0 0 120 34" role="img" aria-label={`Гистограмма показателя ${label}`}>{chartValues.map((item,index)=><rect key={`${String(index)}-${String(item)}`} x={String(index*19)} y={String(34-item/max*31)} width="11" height={String(item/max*31)} rx="2" />)}</svg></article>;
}

export function SectionCard({ title, eyebrow, action, className = "", children }: { title?: string; eyebrow?: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return <section className={`ws-card ${className}`}><header>{<div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}{title && <h2>{title}</h2>}</div>}{action}</header>{children}</section>;
}

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "violet" }) { return <span className={`ws-status ws-status--${tone}`}>{children}</span>; }
export function SkillChip({ children }: { children: ReactNode }) { return <span className="ws-chip">{children}</span>; }
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) { return <span className={`ws-avatar ws-avatar--${size}`} aria-label={name}>{name.split(" ").map((part) => part[0]).join("").slice(0,2)}</span>; }
export function AvatarStack({ names }: { names: string[] }) { return <span className="ws-avatar-stack">{names.map((name) => <Avatar key={name} name={name} size="sm" />)}</span>; }

export function Segmented({ items, value, onChange, label }: { items: string[]; value: string; onChange: (value: string) => void; label: string }) {
  return <div className="ws-segmented" role="group" aria-label={label}>{items.map((item) => <button type="button" className={item === value ? "active" : ""} aria-pressed={item === value} key={item} onClick={() => { onChange(item); }}>{item}</button>)}</div>;
}

export function ProgressSteps({ steps, active }: { steps: string[]; active: number }) {
  return <ol className="ws-steps">{steps.map((step,index) => <li className={index < active ? "done" : index === active ? "active" : ""} key={step}><span>{index < active ? "✓" : index + 1}</span><small>{step}</small></li>)}</ol>;
}

export function ScoreBar({ label, value }: { label: string; value: number }) { return <div className="ws-score"><span>{label}</span><strong>{value}%</strong><i><b style={{ width: `${String(value)}%` }} /></i></div>; }

export function MiniBars({ values, labels }: { values: number[]; labels?: string[] }) {
  const max = Math.max(...values,1); return <div className="ws-bars" role="img" aria-label="Динамика показателей">{values.map((value,index) => <div key={`${String(index)}-${String(value)}`}><i style={{ height: `${String(value/max*100)}%` }} /><small>{labels?.[index] ?? ""}</small></div>)}</div>;
}
