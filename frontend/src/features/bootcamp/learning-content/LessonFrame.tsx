import { useState, type ReactNode } from "react";
import { BookOpen, CheckCircle2, ChevronDown, ClipboardCheck, Code2, Target } from "lucide-react";
import "./lesson-frame.scss";

export type LessonBlockKind = "theory" | "example" | "practice" | "check";
const meta: Record<LessonBlockKind, { title: string; description: string; index: string; Icon: typeof BookOpen }> = {
  theory: { title: "Теория", description: "Поймите принцип, ограничения и способ применения", index: "01", Icon: BookOpen },
  example: { title: "Разобранный пример", description: "Посмотрите, как принцип работает в реальной задаче", index: "02", Icon: Code2 },
  practice: { title: "Практическое задание", description: "Выполните самостоятельно и подготовьте проверяемый результат", index: "03", Icon: Target },
  check: { title: "Самопроверка", description: "Откройте только после собственной попытки решения", index: "04", Icon: ClipboardCheck },
};

/** Course sections are not tabs: the lesson is a single continuous reading surface.
 * Self-check contents are not mounted until the learner explicitly reveals them. */
export function LessonFrame({
  kind, children, initiallyOpen = kind !== "check", unitId,
}: {
  kind: LessonBlockKind;
  children: ReactNode | (() => ReactNode);
  initiallyOpen?: boolean;
  unitId: string;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const { title, description, index, Icon } = meta[kind];
  const panelId = `lesson-frame-${unitId}-${kind}`;
  return <section className={`lesson-frame lesson-frame--${kind}${open ? " is-open" : ""}`} data-learning-block={kind}>
    <button type="button" className="lesson-frame__toggle" aria-expanded={open}
      aria-controls={panelId}
      onClick={() => { setOpen(previous => !previous); }}>
      <span className="lesson-frame__index">{index}</span>
      <span className="lesson-frame__icon"><Icon size={20} aria-hidden="true" /></span>
      <span className="lesson-frame__label"><strong>{title}</strong><small>{description}</small></span>
      {kind === "check" && !open && <span className="lesson-frame__locked"><CheckCircle2 size={15} aria-hidden="true" /> Проверь себя</span>}
      <ChevronDown size={19} className="lesson-frame__chevron" aria-hidden="true" />
    </button>
    {open && <div id={panelId} className="lesson-frame__body" role="region" aria-label={title}>
      {typeof children === "function" ? children() : children}
    </div>}
  </section>;
}
