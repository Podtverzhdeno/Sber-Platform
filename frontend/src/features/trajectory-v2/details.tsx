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
    return () => { triggerRef.current?.focus(); };
  }, [props.triggerRef]);

  const completed = props.state === "completed";
  return (
    <div className="trajectory-v2-overlay" data-testid="trajectory-drawer-overlay" onClick={props.onClose}>
      <div ref={dialogRef} className="trajectory-v2-drawer" role="dialog" aria-modal="true" aria-labelledby="trajectory-drawer-title" tabIndex={-1} onKeyDown={onKeyDown} onClick={(event) => { event.stopPropagation(); }}>
        <header className="trajectory-v2-drawer-heading">
          <div>
            <small id="trajectory-drawer-title">{completed ? "✓ Этап пройден" : "Детали этапа"}</small>
            <h2>{milestone.title}</h2>
            <span className="trajectory-v2-drawer-tag">{milestone.target_kind === "task" ? "Практическая задача" : milestone.target_kind === "course" ? "Обучение" : milestone.target_kind}</span>
            <span className="trajectory-v2-drawer-tag">{milestone.skill}</span>
          </div>
          <button type="button" className="trajectory-v2-drawer-close" aria-label="Закрыть" onClick={props.onClose}>✕</button>
        </header>
        <section className="trajectory-v2-drawer-section">
          <h3>Описание</h3>
          <p>{milestone.purpose}</p>
        </section>
        <section className="trajectory-v2-drawer-section">
          <h3>Что было сделано</h3>
          <p>{completed
            ? "Этап отмечен завершённым в подтверждённом снимке дорожной карты. Подробности личного вклада и отзыв ментора в этом API не публикуются."
            : "Этап ещё не завершён. После выполнения и проверки результат отразится в дорожной карте."}</p>
        </section>
        <div className="trajectory-v2-drawer-metrics">
          <div><small>Состояние</small><strong>{MILESTONE_STATE_LABELS[props.state] ?? props.state}</strong></div>
          <div><small>Навык</small><strong>{milestone.skill}</strong></div>
        </div>
        <section className="trajectory-v2-drawer-section">
          <h3>Цель этапа</h3>
          <p>{stageTargetLabel(milestone)}</p>
          <small>{completed ? "Факт завершения отражён в дорожной карте" : "Факт выполнения ожидает подтверждения"}</small>
        </section>
        <section className="trajectory-v2-drawer-section">
          <h3>Проверка результата</h3>
          <p>Детализация решения ментора недоступна в текущем снимке. Завершение курса не подменяет проверку проектного вклада.</p>
          {props.policyVersion !== null && <small>Политика дорожной карты v{String(props.policyVersion)}</small>}
        </section>
        <footer className="trajectory-v2-drawer-footer">
          <button type="button" onClick={props.onClose}>Закрыть</button>
          <StageDrawerContinuation
            milestone={milestone}
            state={props.state}
            canContinue={props.role.attempt_number !== null}
          />
        </footer>
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
  { id: "purpose", title: "О роли" },
  { id: "responsibilities", title: "Чем занимается" },
  { id: "competencies", title: "Компетенции" },
  { id: "representative", title: "Примеры задач" },
  { id: "development", title: "Следующий грейд" },
  { id: "entry", title: "Кому подойдёт" },
] as const;

/** Role-information dialog with six source-backed sections (5.3). */
export function RoleInfoDialog(props: {
  role: RoleCardView;
  roadmap: RoadmapView | null;
  primary: boolean;
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
        <button type="button" className="trajectory-v2-drawer-close trajectory-v2-role-dialog-close" aria-label="Закрыть" onClick={props.onClose}>×</button>
        <div className="trajectory-v2-role-modal-heading">
          <span className="trajectory-v2-role-modal-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M4 20V13m6 7V8m6 12V4m5 16v-10"/></svg></span>
          <div>
            <div className="trajectory-v2-role-modal-title"><h2 id="trajectory-role-dialog-title">{role.title}</h2>{props.primary && <span className="trajectory-v2-role-badge">Основная роль</span>}</div>
            <p>{role.title.toLowerCase().includes("продуктов") ? "Исследуй пользователей, находи точки роста и влияй на продуктовые решения через данные." : `Освой ${String(role.total_milestones)} этапов профессии: от обучения до проектной практики.`}</p>
          </div>
        </div>
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
          {active === 0 ? (
            <div className="trajectory-v2-role-intro-grid">
              <section className="trajectory-v2-role-intro-hero">
                <div>
                  <h3>О роли</h3>
                  <p>{role.title.toLowerCase().includes("продуктов")
                    ? "Продуктовый аналитик соединяет данные, пользователей и продуктовые решения. Он исследует поведение аудитории, проверяет гипотезы и помогает команде выбирать изменения на основе фактов."
                    : `Дорожная карта роли «${role.title}» включает ${String(milestones.length)} последовательных этапов обучения и практики.`}</p>
                </div>
                <div className="trajectory-v2-chart-bars" aria-hidden="true"><i/><i/><i/><i/></div>
              </section>
              <section className="trajectory-v2-role-intro-card">
                <h3>Чем занимается</h3>
                <ul>{milestones.slice(0,5).map((item) => <li key={item.key}>{item.purpose}</li>)}</ul>
                {milestones.length === 0 && <p>Подробности будут доступны после публикации дорожной карты.</p>}
              </section>
              <section className="trajectory-v2-role-intro-card">
                <h3>Ключевые компетенции</h3>
                <div className="trajectory-v2-role-skill-chips">{skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
                {skills.length === 0 && <p>Компетенции появятся после публикации дорожной карты.</p>}
              </section>
              <section className="trajectory-v2-role-intro-card">
                <h3>Примеры задач</h3>
                <ul>{taskStages.slice(0,4).map((item) => <li key={item.key}>{item.title}</li>)}</ul>
                {taskStages.length === 0 && <p>Проверяемые задачи пока не опубликованы.</p>}
              </section>
              <section className="trajectory-v2-role-intro-card">
                <h3>Что откроется дальше</h3>
                <ul>{milestones.slice(Math.max(0,role.completed_milestones),role.completed_milestones+4).map((item) => <li key={item.key}>{item.title}</li>)}</ul>
                {milestones.length === 0 && <p>Следующие этапы ещё не определены.</p>}
              </section>
            </div>
          ) : sectionContent}
        </div>
      </div>
    </div>
  );
}
