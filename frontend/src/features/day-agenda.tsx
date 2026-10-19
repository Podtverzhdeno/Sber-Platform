import type { components } from "../api/schema";

import {
  agendaItems,
  dayStamp,
  formatAgendaDate,
  shiftDate,
  todayISO,
  type AgendaState,
} from "./agenda-data";

type GrowthSnapshotView = components["schemas"]["GrowthSnapshotView"];
type WorkItemView = components["schemas"]["WorkItemView"];

export function DayAgendaBody(props: {
  state: AgendaState;
  snapshot?: GrowthSnapshotView;
  work?: WorkItemView[];
  selectedDate: string;
  onDateChange: (next: string | null) => void;
  onClose: () => void;
}) {
  const today = todayISO();
  const isToday = props.selectedDate === today;
  const isFuture = props.selectedDate > today;
  if (props.state === "pending") {
    return (
      <p className="kpi-state" data-testid="agenda-loading">
        Загружаем повестку дня…
      </p>
    );
  }
  if (props.state === "error" || !props.snapshot) {
    return (
      <p className="kpi-state" data-testid="agenda-unavailable">
        Повестка недоступна: источник истории не отвечает. Платформа не показывает выдуманные числа —
        вернитесь, когда данные восстановятся.
      </p>
    );
  }
  const items = agendaItems(
    props.snapshot,
    Array.isArray(props.work) ? props.work : [],
    props.selectedDate,
  );
  return (
    <div className={`agenda${isFuture ? " agenda--plan" : ""}`} data-testid="agenda-body">
      <div className="agenda-nav">
        <button
          type="button"
          onClick={() => {
            props.onDateChange(shiftDate(props.selectedDate, -1));
          }}
          data-testid="agenda-prev"
        >
          ← Предыдущий день
        </button>
        <span>{formatAgendaDate(props.selectedDate)}</span>
        <button
          type="button"
          onClick={() => {
            props.onDateChange(shiftDate(props.selectedDate, 1));
          }}
          disabled={isToday}
          data-testid="agenda-next"
        >
          Следующий день →
        </button>
      </div>
      {!isToday ? (
        <button
          type="button"
          className="agenda-today-button"
          onClick={() => {
            props.onDateChange(null);
          }}
          data-testid="agenda-today"
        >
          Вернуться к сегодня
        </button>
      ) : null}
      {isFuture ? (
        <p className="agenda-note agenda-note--plan" data-testid="agenda-plan-note">
          Будущий день — план: показаны только запланированные позиции. Прошлые действия нельзя
          пересчитать повторно.
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="kpi-state" data-testid="agenda-empty">
          За {formatAgendaDate(props.selectedDate)} квалифицированных действий нет. Пустой день не
          наследует данные соседних дат.
        </p>
      ) : (
        <ul className="agenda-item-list" data-testid="agenda-items">
          {items.map((item) => (
            <li key={item.key} data-testid={`agenda-item-${item.key}`} className={item.planned ? "agenda-item--plan" : "agenda-item--done"}>
              <span className="agenda-item-time">{item.time ?? "срок"}</span>
              <div>
                <strong>{item.title}</strong>
                <small>
                  {item.label} · источник: {item.origin}
                </small>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!isFuture && items.length > 0 ? (
        <p className="agenda-note" data-testid="agenda-history-note">
          История дня: выполненные действия уже зафиксированы в KPI и не требуют повторного участия.
        </p>
      ) : null}
      {props.work !== undefined && props.work.some((item) => dayStamp(item.terms.deadline_at) === props.selectedDate) ? (
        <p className="agenda-note" data-testid="agenda-deadlines-note">
          Дедлайн показывается по времени платформенной workspace-очереди.
        </p>
      ) : null}
      <button type="button" className="agenda-close" onClick={props.onClose} data-testid="agenda-close">
        Закрыть повестку
      </button>
    </div>
  );
}
