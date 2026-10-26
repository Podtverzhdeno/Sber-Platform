import { useEffect, useMemo, useRef, useState, type FocusEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, CalendarDays, Clock3, Info, X } from "lucide-react";
import { buildActivityDays, type ActivityEvent, type ActivityFeed, type Day } from "./calendar-model";

import "./activity-calendar.scss";

type ActivityCategory = "learning" | "practice" | "projects" | "community" | "certification";
type Props = {
  snapshot: ActivityFeed | undefined;
  weeks: number;
  onOpenCourses: () => void;
  onOpenProjects: () => void;
  onOpenEvents: () => void;
  onOpenCertification: () => void;
};

const weekdayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTH = new Intl.DateTimeFormat("ru-RU", { month: "short", timeZone: "UTC" });
const FULL_DATE = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function categoryOf(event: ActivityEvent): ActivityCategory {
  const kind=event.kind.toLowerCase();
  const source=event.source_kind.toLowerCase();
  // Routing must be based on audited source identity, not arbitrary task titles.
  if (/work_contribution|work_assignment|project|portfolio/.test(source) || /project_submission|revision_accepted|project_review|project_update/.test(kind)) return "projects";
  if (/certificat|badge|credential/.test(source+" "+kind)) return "certification";
  if (/impulse_self_study|bootcamp|course|learning/.test(source) || /lesson|course|checkpoint/.test(kind)) return "learning";
  if (/event|community|webinar/.test(source+" "+kind)) return "community";
  if (/practice|task|submission|review/.test(source+" "+kind)) return "practice";
  return "learning";
}

const categoryLabels: Record<ActivityCategory, string> = {
  learning: "Обучение", practice: "Практика", projects: "Проекты",
  community: "События", certification: "Сертификация",
};

function activityLevel(count: number, observed: boolean, future: boolean): number {
  if (future || !observed || count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

function readableDate(day: Day): string {
  return FULL_DATE.format(new Date(day.timestamp));
}

function safeTimeZone(candidate: string | undefined): string {
  if (!candidate) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return "UTC";
  }
}

function hoursNote(): string {
  // There are no per-session duration records in the growth activity snapshot.
  // Do not infer hours from the gap between events or from course completion.
  return "Длительность не измеряется";
}

export function ActivityCalendar({ snapshot, weeks, onOpenCourses, onOpenProjects, onOpenEvents, onOpenCertification }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hover, setHover] = useState<{ key: string; x: number; y: number } | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const calendarScrollRef = useRef<HTMLDivElement | null>(null);
  const known = snapshot?.freshness.known === true;
  const days = useMemo(() => buildActivityDays(snapshot, weeks), [snapshot, weeks]);
  const selected = days.find(day => day.key === selectedKey) ?? null;
  const hoverDay = days.find(day => day.key === hover?.key) ?? null;
  const total = days.reduce((sum, day) => sum + (day.future ? 0 : day.count), 0);
  const activeDays = days.filter(day => !day.future && day.count > 0).length;
  const months = Array.from({ length: Math.ceil(days.length / 7) }, (_, weekIndex) => {
    const current = days[weekIndex * 7];
    const previous = days[(weekIndex - 1) * 7];
    if (!current) return "";
    return !previous || new Date(previous.timestamp).getUTCMonth() !== new Date(current.timestamp).getUTCMonth()
      ? MONTH.format(new Date(current.timestamp)) : "";
  });

  // The most recent days should be immediately visible on narrow screens.
  // Reposition when the user changes the time range, without moving document scroll.
  useEffect(() => {
    const container = calendarScrollRef.current;
    if (!container) return;
    container.scrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
  }, [weeks]);

  // Dismiss keyboard/mouse-triggered tooltips without opening a day dialog.
  useEffect(() => {
    if (!hover) return;
    const dismissOnEscape=(event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setHover(null);
      }
    };
    document.addEventListener("keydown", dismissOnEscape);
    return () => { document.removeEventListener("keydown", dismissOnEscape); };
  }, [hover]);

  useEffect(() => {
    if (!selectedKey) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedKey(null);
      }
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>(".ac-day-dialog");
      if (!dialog) return;
      const focusables = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      openerRef.current?.focus();
    };
  }, [selectedKey]);

  const showTip = (event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>, day: Day) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHover({ key: day.key, x: Math.min(window.innerWidth - 234, Math.max(8, rect.left - 95)), y: rect.top });
  };
  const openDay = (event: MouseEvent<HTMLButtonElement>, day: Day) => {
    openerRef.current = event.currentTarget;
    setHover(null);
    setSelectedKey(day.key);
  };
  const openRelated = (event: ActivityEvent) => {
    const category = categoryOf(event);
    setSelectedKey(null);
    if (category === "projects" || category === "practice") onOpenProjects();
    else if (category === "community") onOpenEvents();
    else if (category === "certification") onOpenCertification();
    else onOpenCourses();
  };

  return <section className="ac-calendar-card" aria-label="Календарь активности" data-testid="activity-calendar">
    <div className="ac-heading">
      <div><span className="ac-eyebrow">ВАША ИСТОРИЯ</span><h2><CalendarDays size={22}/> Календарь активности</h2>
        <p>Каждый квадрат — один день. Наведите, чтобы увидеть события, или нажмите для подробностей.</p></div>
      <div className="ac-summary" aria-label="Краткая статистика">
        <span><strong>{known ? String(activeDays) : "—"}</strong> дней с событиями</span>
        <span><strong>{known ? String(total) : "—"}</strong> действий за период</span>
      </div>
    </div>
    <div ref={calendarScrollRef} className="ac-calendar-scroll" role="region" aria-label="Дни активности, горизонтальная прокрутка" tabIndex={0}>
      <div className="ac-calendar-layout">
        <div className="ac-weekdays" aria-hidden="true"><i/>{weekdayNames.map((name, index) =>
          <span key={name}>{index % 2 === 0 ? name : ""}</span>)}</div>
        <div className="ac-week-columns" style={{ gridTemplateColumns: "repeat(" + String(weeks) + ", 14px)" }}>
          {months.map((name, index) => <div className="ac-month-name" key={"month-" + String(index)}>{name}</div>)}
          {Array.from({ length: weeks }, (_, index) => <div className="ac-week" key={"week-" + String(index)}>
            {days.slice(index * 7, index * 7 + 7).map(day => {
              const level = activityLevel(day.count, known, day.future);
              return <button key={day.key} type="button" disabled={day.future}
                className={"ac-day ac-level-" + String(level) + (!known ? " ac-unknown" : "")}
                title={readableDate(day) + " — " + (known ? String(day.count) + " зарегистрированных действий" : "данные недоступны")}
                aria-label={readableDate(day) + ": " + (known ? String(day.count) + " зарегистрированных действий, открыть" : "история недоступна, открыть")}
                onMouseEnter={event => { showTip(event, day); }}
                onMouseLeave={() => { setHover(null); }}
                onFocus={event => { showTip(event, day); }}
                onBlur={() => { setHover(null); }}
                onClick={event => { openDay(event, day); }}/>;
            })}
          </div>)}
        </div>
      </div>
    </div>
    <div className="ac-footer">
      <p><Info size={14}/>{known ? "Показаны только зарегистрированные действия. Пустой день не доказывает отсутствие работы." : "История активности недоступна. Пустые дни не считаются нулевой активностью."}</p>
      <div className="ac-legend" aria-label="Интенсивность действий">Меньше {[0,1,2,3,4].map(level => <i key={level} className={"ac-level-" + String(level)}/>)} Больше</div>
    </div>
    {hover && hoverDay && !selected && createPortal(
      <div className="ac-hover-card" role="tooltip" style={{ left: hover.x, top: Math.max(8, hover.y - 112) }}>
        <strong>{readableDate(hoverDay)}</strong>
        <span>{known ? String(hoverDay.count) + " зарегистрированных действий" : "История недоступна"}</span>
        {hoverDay.events.slice(0, 2).map(item => <small key={item.source_kind + item.source_ref + item.occurred_at}>{item.title}</small>)}
        <em>Нажмите, чтобы открыть день</em>
      </div>, document.body)}
    {selected && createPortal(<div className="ac-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) setSelectedKey(null);
    }}>
      <section className="ac-day-dialog" role="dialog" aria-modal="true" aria-label={"Активность " + readableDate(selected)}>
        <header><div><span className="ac-eyebrow">АКТИВНОСТЬ ЗА ДЕНЬ</span><h2>{readableDate(selected)}</h2></div>
          <button type="button" className="ac-close" ref={closeRef} aria-label="Закрыть подробности дня" onClick={() => { setSelectedKey(null); }}><X size={18}/></button></header>
        <div className="ac-day-metrics">
          <div><strong>{known ? String(selected.count) : "—"}</strong><span>зарегистрированных действий</span></div>
          <div><Clock3 size={20}/><strong>—</strong><span>часы: {hoursNote().toLowerCase()}</span></div>
        </div>
        <div className="ac-day-events">
          <h3>Что происходило</h3>
          {selected.events.length > 0 ? selected.events.map((item, index) => {
            const category = categoryOf(item);
            const hour = new Date(item.occurred_at).toLocaleTimeString("ru-RU", {
              hour: "2-digit", minute: "2-digit", timeZone: safeTimeZone(snapshot?.actor_timezone),
            });
            return <article key={item.source_kind + item.source_ref + item.occurred_at + String(index)}>
              <div><span className={"ac-event-kind ac-kind-" + category}>{categoryLabels[category]}</span><time>{hour}</time></div>
              <strong>{item.title}</strong>
              <small>Источник: {item.source_kind}</small>
              <button type="button" onClick={() => { openRelated(item); }}>Перейти в раздел <ArrowRight size={14}/></button>
            </article>;
          }) : <div className="ac-empty-day">{known
            ? "За этот день нет зарегистрированных событий. Завершённые уроки без отметки времени и работа вне платформы здесь не отображаются."
            : "История за этот день недоступна: источник не передал подтверждённых записей."}</div>}
        </div>
        <p className="ac-day-note">Часы и минуты работы нельзя вычислять по промежуткам между событиями. Они появятся здесь только после подключения достоверного учёта времени.</p>
      </section>
    </div>, document.body)}
  </section>;
}
