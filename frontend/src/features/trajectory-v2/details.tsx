import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../api/client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import { useNavigate } from "react-router-dom";

import { roleStateLabel } from "./client";
import type { MilestoneView, RoadmapView, RoleCardView } from "./client";
import { MILESTONE_STATE_LABELS } from "./client";

const UNKNOWN_PUBLISHED =
  "Раздел не публикуется в снимке дорожной карты; данные появятся только через сервер.";

/* Canonical participant deep links used elsewhere in the workspace. */
const TARGET_SECTIONS = { task: "Задачи", course: "Bootcamp" } as const;

function stageTargetLabel(milestone: MilestoneView): string {
  if (milestone.target_kind === "course") return `Курс · ${milestone.target_key}`;
  if (milestone.target_kind === "task") return `Задача · ${milestone.target_key}`;
  return milestone.target_kind;
}

function getFocusables(root: HTMLElement): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ];
}

function useOverlayKeyboard(
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
): (event: ReactKeyboardEvent<HTMLElement>) => void {
  return (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const container = containerRef.current;
    if (container === null) return;
    const focusables = getFocusables(container);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (first === undefined || last === undefined) return;
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  };
}

/** Task/evidence drawer (participant-home-trajectory-grades 5.3). */
export function StageTaskDrawer(props: {
  milestone: MilestoneView;
  state: string;
  role: RoleCardView;
  policyVersion: number | null;
  onClose: () => void;
  triggerRef: RefObject<HTMLElement | null>;
}) {
  const { milestone } = props;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onKeyDown = useOverlayKeyboard(dialogRef, props.onClose);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog !== null && !dialog.contains(document.activeElement)) dialog.focus();
  }, []);
  useEffect(() => {
    const triggerRef = props.triggerRef;
    return () => {
      triggerRef.current?.focus();
    };
  }, [props.triggerRef]);

  const completed = props.state === "completed";
  return (
    <div
      className="trajectory-v2-overlay"
      data-testid="trajectory-drawer-overlay"
      onClick={props.onClose}
    >
      <div
        ref={dialogRef}
        className="trajectory-v2-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trajectory-drawer-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <button type="button" className="trajectory-v2-drawer-close" onClick={props.onClose}>
          Закрыть
        </button>
        <h2 id="trajectory-drawer-title">Детали этапа</h2>
        {props.policyVersion !== null && (
          <small>Снимок дорожной карты v{String(props.policyVersion)}</small>
        )}
        <dl className="trajectory-v2-drawer-facts">
          <div>
            <dt>Статус</dt>
            <dd>
              {MILESTONE_STATE_LABELS[props.state] ?? props.state} ·{" "}
              {stageTargetLabel(milestone)} · позиция {String(milestone.position)}
            </dd>
          </div>
          <div>
            <dt>Цель</dt>
            <dd>{milestone.purpose}</dd>
          </div>
          <div>
            <dt>Требования</dt>
            <dd>{UNKNOWN_PUBLISHED}</dd>
          </div>
          <div>
            <dt>Ожидаемый артефакт</dt>
            <dd>
              {stageTargetLabel(milestone)}
              {completed
                ? " · этап завершён в снимке дорожной карты"
                : " · этап ещё не завершён"}
            </dd>
          </div>
          <div>
            <dt>Верификация</dt>
            <dd>
              {completed
                ? "Этап отмечен пройденным в снимке дорожной карты; метаданные верификации не публикуются."
                : "Этап не завершён; метаданные верификации не публикуются в снимке."}
            </dd>
          </div>
          <div>
            <dt>Влияние</dt>
            <dd>Навык: {milestone.skill}</dd>
          </div>
          <div>
            <dt>Продолжение</dt>
            <dd data-testid="trajectory-drawer-continuation">
              <StageDrawerContinuation
                milestone={milestone}
                state={props.state}
                canContinue={props.role.attempt_number !== null}
              />
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function StageDrawerContinuation(props: {
  milestone: MilestoneView;
  state: string;
  canContinue: boolean;
}) {
  const { milestone } = props;
  const navigate = useNavigate();
  const navigable = milestone.target_kind === "task" || milestone.target_kind === "course";
  const roleNavigation = useQuery({
    queryKey: ["me"],
    queryFn: () => apiRequest<{ navigation: string[] }>("/api/v1/me"),
    enabled: props.canContinue && props.state !== "locked" && navigable,
  });
  if (!props.canContinue) {
    return (
      <p role="status">
        Роль не выбрана: доступ к цели появится после входа в каталог траекторий.
      </p>
    );
  }
  if (props.state === "locked") {
    return (
      <p role="status">
        Этап закрыт серверной политикой; доступ появится после завершения предыдущих шагов.
      </p>
    );
  }
  if (!navigable) {
    return <p role="status">Канонический переход для цели «{milestone.target_kind}» не определён в снимке.</p>;
  }
  if (roleNavigation.isPending) {
    return <p role="status">Уточняем доступный раздел для перехода…</p>;
  }
  if (roleNavigation.isError) {
    return <p role="status">Не удалось проверить доступный раздел. Обновите страницу и повторите попытку.</p>;
  }
  const section = TARGET_SECTIONS[milestone.target_kind as keyof typeof TARGET_SECTIONS];
  const sectionIndex = roleNavigation.data.navigation.indexOf(section);
  if (sectionIndex < 0) {
    return <p role="status">Раздел «{section}» недоступен для текущей роли.</p>;
  }
  const route = `/workspace/${String(sectionIndex)}?${milestone.target_kind === "task" ? "task" : "course"}=${encodeURIComponent(milestone.target_key)}`;
  return (
    <button
      type="button"
      onClick={() => {
        void navigate(route);
      }}
    >
      {milestone.target_kind === "course"
        ? "Открыть курс"
        : props.state === "completed" ? "Открыть результат" : "Открыть задачу"}
    </button>
  );
}

const ROLE_INFO_SECTIONS: readonly { id: string; title: string }[] = [
  { id: "purpose", title: "Назначение роли" },
  { id: "responsibilities", title: "Ответственность" },
  { id: "competencies", title: "Компетенции" },
  { id: "representative", title: "Представительные задачи" },
  { id: "development", title: "Ожидания развития" },
  { id: "entry", title: "Вход и переходы" },
] as const;

/** Role-information dialog with six source-backed sections (5.3). */
export function RoleInfoDialog(props: {
  role: RoleCardView;
  roadmap: RoadmapView | null;
  onClose: () => void;
  triggerRef: RefObject<HTMLElement | null>;
}) {
  const { role, roadmap } = props;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const onKeyDown = useOverlayKeyboard(dialogRef, props.onClose);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog !== null && !dialog.contains(document.activeElement)) dialog.focus();
  }, []);
  useEffect(() => {
    const triggerRef = props.triggerRef;
    return () => {
      triggerRef.current?.focus();
    };
  }, [props.triggerRef]);
  useEffect(() => {
    tabRefs.current[active]?.focus();
  }, [active]);

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const count = ROLE_INFO_SECTIONS.length;
    let delta: number | null = null;
    if (event.key === "ArrowRight") delta = 1;
    else if (event.key === "ArrowLeft") delta = -1;
    else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
      return;
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(count - 1);
      return;
    }
    if (delta === null) return;
    event.preventDefault();
    setActive((current) => (current + delta + count) % count);
  };

  const milestones = roadmap?.milestones ?? [];
  const activeSection = ROLE_INFO_SECTIONS[active] ?? ROLE_INFO_SECTIONS[0];
  if (activeSection === undefined) return null;
  const skills: string[] = [];
  for (const item of milestones) {
    if (!skills.includes(item.skill)) skills.push(item.skill);
  }
  const taskStages = milestones.filter((item) => item.target_kind === "task");
  const sectionContent = (() => {
    switch (activeSection.id) {
      case "purpose":
        return roadmap === null
          ? "Снимок дорожной карты недоступен; целевое описание роли не публикуется."
          : `Дорожная карта v${String(roadmap.policy_version)} для трека ${roadmap.track_key}: ${String(milestones.length)} этапов. Целевое описание роли добавится вместе с каталогом ролей.`;
      case "responsibilities":
        return milestones.length === 0 ? (
          UNKNOWN_PUBLISHED
        ) : (
          <ul>
            {milestones.map((item) => (
              <li key={item.key}>
                <strong>{item.title}</strong> — {item.purpose}
              </li>
            ))}
          </ul>
        );
      case "competencies":
        return skills.length === 0 ? (
          UNKNOWN_PUBLISHED
        ) : (
          <ul>
            {skills.map((skill) => (
              <li key={skill}>{skill}</li>
            ))}
          </ul>
        );
      case "representative":
        return taskStages.length === 0 ? (
          "Задач в снимке нет; цели роли доступны курсами."
        ) : (
          <ul>
            {taskStages.map((item) => (
              <li key={item.key}>
                {item.title} · цель {item.target_key}
              </li>
            ))}
          </ul>
        );
      case "development":
        return role.attempt_number === null
          ? "Роль не выбрана: прогресс появится после входа в каталог траекторий."
          : `Завершено этапов: ${String(role.completed_milestones)} из ${String(role.total_milestones)} (попытка ${String(role.attempt_number)}). Каталог грейдов не подключён к снимку.`;
      case "entry":
        return role.attempt_number === null
          ? "Вход — через каталог траекторий; персональный прогресс отсутствует."
          : `Состояние роли: ${roleStateLabel(role.state)}; активна попытка ${String(role.attempt_number)}.`;
      default:
        return UNKNOWN_PUBLISHED;
    }
  })();

  return (
    <div
      className="trajectory-v2-overlay"
      data-testid="trajectory-role-dialog-overlay"
      onClick={props.onClose}
    >
      <div
        ref={dialogRef}
        className="trajectory-v2-role-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trajectory-role-dialog-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <button type="button" className="trajectory-v2-drawer-close" onClick={props.onClose}>
          Закрыть
        </button>
        <h2 id="trajectory-role-dialog-title">Роль: {role.title}</h2>
        <small>
          {roadmap === null
            ? "Снимок дорожной карты недоступен."
            : `Дорожная карта v${String(roadmap.policy_version)} · политика замены${
                roadmap.replacement_reason ? `: ${roadmap.replacement_reason}` : " не задана"
              }`}
        </small>
        <div className="trajectory-v2-role-tabs" role="tablist" aria-label="Разделы роли">
          {ROLE_INFO_SECTIONS.map((section, index) => (
            <button
              key={section.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`trajectory-role-tab-${section.id}`}
              aria-selected={index === active}
              aria-controls={`trajectory-role-panel-${section.id}`}
              tabIndex={index === active ? 0 : -1}
              onClick={() => {
                setActive(index);
              }}
              onKeyDown={handleTabKeyDown}
            >
              {section.title}
            </button>
          ))}
        </div>
        <p className="trajectory-v2-sr-only" role="status">
          Активный раздел: {activeSection.title}
        </p>
        <div
          role="tabpanel"
          id={`trajectory-role-panel-${activeSection.id}`}
          aria-labelledby={`trajectory-role-tab-${activeSection.id}`}
          className="trajectory-v2-role-panel"
          tabIndex={0}
        >
          {sectionContent}
        </div>
      </div>
    </div>
  );
}
