import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { compareMetrics } from "./client";
import type { RoadmapView, RoleCardView } from "./client";

const PINNED_BADGE = "Закреплена";

export type TrajectoryActionsProps = {
  role: RoleCardView;
  pinned: boolean;
  hiddenUnselected: boolean;
  otherRoles: RoleCardView[];
  compareTarget: string | null;
  feedback: string | null;
  compare: (trackKey: string | null) => void;
  copyLink: () => void;
  internalShare: () => void;
  togglePin: () => void;
  toggleHiddenUnselected: () => void;
  configurePath: () => void;
  clearFeedback: () => void;
};

/** Context menu for trajectory actions (participant-home-trajectory-grades 5.4). */
export function TrajectoryActions(props: TrajectoryActionsProps) {
  const [open, setOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (event.target instanceof Node && menuRef.current !== null) {
        if (!menuRef.current.contains(event.target)) {
          setOpen(false);
          setChooserOpen(false);
        }
      }
    };
    document.addEventListener("click", handler);
    return () => {
      document.removeEventListener("click", handler);
    };
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
    setChooserOpen(false);
  };
  const run = (action: () => void) => {
    action();
    closeMenu();
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      closeMenu();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const container = menuRef.current;
    if (container === null) return;
    const items = [
      ...container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]'),
    ];
    const currentIndex = items.findIndex((item) => item === document.activeElement);
    const count = items.length;
    if (count === 0 || currentIndex < 0) return;
    event.preventDefault();
    const nextIndex =
      event.key === "ArrowDown" ? (currentIndex + 1) % count : (currentIndex - 1 + count) % count;
    items[nextIndex]?.focus();
  };

  return (
    <div
      ref={menuRef}
      className="trajectory-v2-actions"
      data-testid="trajectory-actions"
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
      >
        Действия роли
      </button>
      {open ? (
        !chooserOpen ? (
          <ul role="menu" aria-label="Действия роли" data-testid="trajectory-actions-menu">
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  if (props.otherRoles.length === 0) {
                    props.compare(null);
                    return;
                  }
                  setChooserOpen(true);
                }}
              >
                Сравнить роль…
              </button>
            </li>
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  run(props.togglePin);
                }}
              >
                {props.pinned ? "Открепить" : "Закрепить"}
              </button>
            </li>
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  run(props.copyLink);
                }}
              >
                Скопировать общедоступную ссылку
              </button>
            </li>
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  run(props.internalShare);
                }}
              >
                Внутренняя ссылка…
              </button>
            </li>
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  run(props.toggleHiddenUnselected);
                }}
              >
                {props.hiddenUnselected ? "Показать не выбранные роли" : "Скрыть не выбранные роли"}
              </button>
            </li>
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  run(props.configurePath);
                }}
              >
                Настроить путь
              </button>
            </li>
          </ul>
        ) : (
          <ul
            role="menu"
            aria-label="Выбор роли для сравнения"
            data-testid="trajectory-compare-chooser"
          >
            {props.otherRoles.map((otherRole) => (
              <li key={otherRole.track_key}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    run(() => {
                      props.compare(otherRole.track_key);
                    });
                  }}
                >
                  {otherRole.title}
                </button>
              </li>
            ))}
            <li>
              <button type="button" role="menuitem" onClick={closeMenu}>
                Отменить сравнение
              </button>
            </li>
          </ul>
        )
      ) : null}
      {props.pinned && <span className="trajectory-v2-pin-badge">{PINNED_BADGE}</span>}
    </div>
  );
}

/** Compare panel keeps one shared metric definition for both columns (5.4). */
export function RoleComparePanel(props: {
  roles: RoleCardView[];
  roadmaps: RoadmapView[];
  trackA: string;
  trackB: string;
  onClose: () => void;
}) {
  const roleA = props.roles.find((role) => role.track_key === props.trackA) ?? null;
  const roleB = props.roles.find((role) => role.track_key === props.trackB) ?? null;
  if (roleA === null || roleB === null) return null;
  const metrics = compareMetrics(props.roadmaps, props.trackA, props.trackB);
  return (
    <section
      className="trajectory-v2-compare"
      data-testid="trajectory-compare"
      aria-label={`Сравнение ролей: ${roleA.title} и ${roleB.title}`}
    >
      <header>
        <h4>
          Сравнение: {roleA.title} ↔ {roleB.title}
        </h4>
        <button type="button" onClick={props.onClose}>
          Свернуть сравнение
        </button>
      </header>
      <table>
        <thead>
          <tr>
            <th scope="col">Метрика</th>
            <th scope="col">{roleA.title}</th>
            <th scope="col">{roleB.title}</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric.label}>
              <th scope="row">{metric.label}</th>
              <td>{metric.values[0]}</td>
              <td>{metric.values[1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="trajectory-v2-compare-note">
        Метрики общие для обоих столбцов; серверные политики грейдов не сворачиваются в одну оценку.
      </p>
    </section>
  );
}
