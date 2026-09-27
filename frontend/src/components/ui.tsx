import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" }) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return <article className="ui-card"><h2>{title}</h2>{children}</article>;
}

export function DataTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: string[][] }) {
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label={caption}>
      <table><caption>{caption}</caption><thead><tr>{headers.map((item) => <th scope="col" key={item}>{item}</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((item, index) => <td key={`${String(rowIndex)}-${String(index)}`}>{item}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Overlay({ title, open, onClose, kind, children }: { title: string; open: boolean; onClose: () => void; kind: "dialog" | "drawer"; children: ReactNode }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`overlay-panel overlay-panel--${kind}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
        <header><h2 id={titleId}>{title}</h2><button ref={closeRef} type="button" aria-label="Закрыть" onClick={onClose}>×</button></header>
        {children}
      </section>
    </div>
  );
}

export function Modal(props: Omit<Parameters<typeof Overlay>[0], "kind">) { return <Overlay {...props} kind="dialog" />; }
export function Drawer(props: Omit<Parameters<typeof Overlay>[0], "kind">) { return <Overlay {...props} kind="drawer" />; }

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return <span className="tooltip" tabIndex={0} aria-label={label}>{children}<span role="tooltip">{label}</span></span>;
}

export function Timeline({ items }: { items: { title: string; detail: string }[] }) {
  return <ol className="timeline">{items.map((item) => <li key={item.title}><strong>{item.title}</strong><span>{item.detail}</span></li>)}</ol>;
}

export function Funnel({ label, steps }: { label: string; steps: { label: string; value: number }[] }) {
  const max = Math.max(...steps.map((step) => step.value), 1);
  return <div className="funnel" role="img" aria-label={label}>{steps.map((step) => <div key={step.label} style={{ width: `${String((step.value / max) * 100)}%` }}><span>{step.label}: {step.value}</span></div>)}</div>;
}

type StateKind = "loading" | "empty" | "restricted" | "stale" | "error" | "offline";

const stateCopy: Record<StateKind, { title: string; detail: string }> = {
  loading: { title: "Загружаем данные", detail: "Это займёт несколько секунд." },
  empty: { title: "Здесь пока пусто", detail: "Начните первый шаг, и результат появится здесь." },
  restricted: { title: "Раздел недоступен", detail: "Переключитесь на назначенную роль или вернитесь в рабочее пространство." },
  stale: { title: "Данные могли устареть", detail: "Обновите страницу перед принятием решения." },
  error: { title: "Не удалось загрузить", detail: "Повторите запрос или продолжите вручную." },
  offline: { title: "Нет соединения", detail: "Проверьте интернет. Несохранённые действия не отправлены." },
};

export function StatePanel({ kind, action, onAction }: { kind: StateKind; action?: string; onAction?: () => void }) {
  const copy = stateCopy[kind];
  return <section className={`state-panel state-panel--${kind}`} aria-live={kind === "loading" ? "polite" : "assertive"} aria-busy={kind === "loading"}><h2>{copy.title}</h2><p>{copy.detail}</p>{action && <button type="button" onClick={onAction}>{action}</button>}</section>;
}

export function SafeExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}<span className="sr-only"> (откроется в новой вкладке)</span></a>;
}
