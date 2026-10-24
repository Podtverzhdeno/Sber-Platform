import type { ReactNode } from "react";
import { Award, Bookmark, CalendarDays, ChevronRight, Share2 } from "lucide-react";
import type { CatalogItem } from "./types";
import { CustomerMark } from "./customer-mark";

export function TaskCatalogList(props: {
  items: CatalogItem[];
  selectedTaskId: string | null;
  bookmarkPendingId: string | null;
  onOpen: (item: CatalogItem) => void;
  onConditions: (item: CatalogItem) => void;
  onBookmark: (item: CatalogItem) => void;
  onShare: (item: CatalogItem) => void;
  matchBadge: (item: CatalogItem) => ReactNode;
  formatDuration: (minutes: number | null) => string;
  formatDeadline: (value: string | null) => string;
  difficultyLabel: (value: string | null) => string;
  formatLabel: (value: string | null) => string;
  applicationLabel: (item: CatalogItem) => string;
  customerLabel: (item: CatalogItem) => string;
}) {
  return (
    <div className="catalog-v2-results catalog-v2-results--list catalog-v2-table" role="table" aria-label="Список рекомендованных задач">
      <div className="catalog-v2-table-head" role="row">
        <span role="columnheader">#</span>
        <span role="columnheader">Задача</span>
        <span role="columnheader">Компания</span>
        <span role="columnheader">Направление</span>
        <span role="columnheader">Соответствие</span>
        <span role="columnheader">Срок</span>
        <span role="columnheader">Что ты получишь</span>
        <span role="columnheader">Почему подходит</span>
        <span role="columnheader">Действия</span>
      </div>
      {props.items.map((item, index) => {
        const canApply = item.allowed_actions.includes("apply") && item.eligibility.status === "eligible" && item.application_state === "none";
        const benefit = item.benefits.find((value) => value.state !== "unavailable");
        const reason = item.match.reasons[0];
        return (
          <div
            className="catalog-v2-table-row"
            role="row"
            key={item.task_id}
            tabIndex={0}
            aria-selected={props.selectedTaskId === item.task_id}
            onClick={(event) => {
              if (event.target instanceof Element && event.target.closest("button")) return;
              props.onOpen(item);
            }}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                const rows = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(".catalog-v2-table-row") ?? []);
                const currentIndex = rows.indexOf(event.currentTarget);
                const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1
                  : Math.max(0, Math.min(rows.length - 1, currentIndex + (event.key === "ArrowDown" ? 1 : -1)));
                rows[nextIndex]?.focus();
                event.preventDefault();
                return;
              }
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                props.onOpen(item);
              }
            }}
          >
            <span role="cell" className="catalog-v2-table-number" data-label="№">{index + 1}</span>
            <span role="cell" className="catalog-v2-table-task" data-label="Задача">
              <span className="catalog-v2-table-avatar" aria-hidden="true"><CustomerMark customer={item.customer} size={20} /></span>
              <span className="catalog-v2-table-task-text"><strong>{item.title}</strong>
                <small>{props.applicationLabel(item)}</small></span>
            </span>
            <span role="cell" className="catalog-v2-table-company" data-label="Компания">
              <strong>{item.customer.display_name}</strong>
              <small>{item.customer.verification === "verified" ? "Проверенный заказчик" : props.customerLabel(item)}</small>
            </span>
            <span role="cell" className="catalog-v2-table-directions" data-label="Направление">
              {(item.direction_keys.length ? item.direction_keys : item.competency_tags).slice(0, 3).map((tag) => <small key={tag}>{tag}</small>)}
              {item.direction_keys.length === 0 && item.competency_tags.length === 0 ? "Не указано" : null}
            </span>
            <span role="cell" className="catalog-v2-table-match" data-label="Соответствие">{props.matchBadge(item)}</span>
            <span role="cell" className="catalog-v2-table-deadline" data-label="Срок">
              <CalendarDays size={18} aria-hidden="true" />
              <span><strong>{props.formatDuration(item.duration_minutes)}</strong><small>{props.difficultyLabel(item.difficulty)} · отклик до {props.formatDeadline(item.deadline_at)}</small></span>
            </span>
            <span role="cell" className="catalog-v2-table-benefit" data-label="Что ты получишь">
              <Award size={20} aria-hidden="true" />
              <span><strong>{benefit?.label ?? "Не опубликовано"}</strong><small>{benefit?.state === "potential" ? "При выполнении условия" : benefit?.condition ?? "Выгоды не указаны"}</small></span>
            </span>
            <span role="cell" className="catalog-v2-table-reason" data-label="Почему подходит">
              <strong>{reason?.label ?? "Недостаточно данных"}</strong>
              <small>Соответствие траектории, не вероятность отбора</small>
            </span>
            <span role="cell" className="catalog-v2-table-actions" data-label="Действия">
              <button type="button" aria-label="Подробнее" title="Подробнее" onClick={() => { props.onOpen(item); }}><ChevronRight size={19} aria-hidden="true" /></button>
              {canApply ? <button type="button" className="catalog-v2-list-apply" onClick={() => { props.onConditions(item); }}>Отклик</button> : null}
              <button type="button" className="catalog-v2-icon-action" aria-label={item.bookmarked ? "Сохранено" : "Сохранить"}
                title={item.bookmarked ? "Удалить из сохранённых" : "Сохранить задачу"} aria-pressed={item.bookmarked}
                disabled={props.bookmarkPendingId === item.task_id || !item.allowed_actions.includes("bookmark")} onClick={() => { props.onBookmark(item); }}>
                <Bookmark size={17} fill={item.bookmarked ? "currentColor" : "none"} aria-hidden="true" />
              </button>
              {item.allowed_actions.includes("share") ? <button type="button" className="catalog-v2-icon-action" aria-label="Поделиться" title="Скопировать ссылку" onClick={() => { props.onShare(item); }}><Share2 size={17} aria-hidden="true" /></button> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
