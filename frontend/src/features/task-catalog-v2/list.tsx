import type { ReactNode } from "react";
import type { CatalogItem } from "./types";

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
}) {
  return (
    <div className="catalog-v2-results catalog-v2-results--list catalog-v2-table" role="table" aria-label="Список рекомендованных задач">
      <div className="catalog-v2-table-head" role="row">
        <span role="columnheader">Задача и заказчик</span>
        <span role="columnheader">Match</span>
        <span role="columnheader">Факты</span>
        <span role="columnheader">Срок</span>
        <span role="columnheader">Действия</span>
      </div>
      {props.items.map((item) => {
        const canApply = item.allowed_actions.includes("apply") && item.eligibility.status === "eligible";
        return (
          <div
            className="catalog-v2-table-row"
            role="row"
            key={item.task_id}
            tabIndex={0}
            aria-selected={props.selectedTaskId === item.task_id}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                const rows = Array.from(
                  event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
                    ".catalog-v2-table-row",
                  ) ?? [],
                );
                const currentIndex = rows.indexOf(event.currentTarget);
                const nextIndex = event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? rows.length - 1
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
            <span role="cell" className="catalog-v2-table-task">
              <strong>{item.title}</strong>
              <small>{item.customer.display_name} · {props.applicationLabel(item)}</small>
              <small>{item.competency_tags.join(" · ") || "Компетенции не указаны"}</small>
            </span>
            <span role="cell">{props.matchBadge(item)}</span>
            <span role="cell" className="catalog-v2-table-facts">
              <span>{props.difficultyLabel(item.difficulty)}</span>
              <span>{props.formatDuration(item.duration_minutes)}</span>
              <span>{props.formatLabel(item.work_format)}</span>
            </span>
            <span role="cell">{props.formatDeadline(item.deadline_at)}</span>
            <span role="cell" className="catalog-v2-table-actions">
              <button type="button" onClick={() => { props.onOpen(item); }}>Подробнее</button>
              {item.allowed_actions.includes("open_conditions") || canApply ? <button type="button" className="catalog-v2-primary" disabled={!canApply} onClick={(event) => { event.currentTarget.focus(); props.onConditions(item); }}>Отклик</button> : null}
              <button type="button" aria-pressed={item.bookmarked} disabled={props.bookmarkPendingId === item.task_id} onClick={() => { props.onBookmark(item); }}>{item.bookmarked ? "Сохранено" : "Сохранить"}</button>
              {item.allowed_actions.includes("share") ? <button type="button" onClick={() => { props.onShare(item); }}>Поделиться</button> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
