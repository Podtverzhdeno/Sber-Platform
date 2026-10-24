import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { useSearchParams } from "react-router-dom";

import { Drawer, StatePanel } from "../../components/ui";
import { useGrowthSnapshot } from "../kpi-data";
import { RoleComparePanel, TrajectoryActions } from "../trajectory-v2/actions";
import {
  loadDevelopmentOverview,
  loadRoadmaps,
  loadRoadmapCatalog,
  roadmapCatalogQueryKey,
  overviewQueryKey,
  readPinnedTrack,
  roadmapsQueryKey,
  writePinnedTrack,
  type DevelopmentOverviewView,
  type MilestoneView,
  type RoadmapView,
  type RoleCardView,
} from "../trajectory-v2/client";
import { RoleInfoDialog } from "../trajectory-v2/details";
import { TrajectoryActivation } from "./track-activation";
import { loadTrajectoryMap, mapFocus, projectedState, trajectoryMapQueryKey } from "./map-client";
import { ProjectedCheckpointDrawer } from "./projected-map";
import "../trajectory-v2/trajectory-v2.scss";
import "./trajectory-redesign.scss";

type Grade = DevelopmentOverviewView["concepts"]["career_grade"];
type DialogKind = "role" | "grades" | "stage" | "stages" | "skills" | null;

const clamp = (value: number): number => Math.min(100, Math.max(0, value));

function localDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "неизвестно"
    : new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function pathStage(roadmap: RoadmapView | null, requested: string | null): MilestoneView | null {
  if (roadmap === null) return null;
  return roadmap.milestones.find((item) => item.key === requested)
    ?? roadmap.next_step
    ?? roadmap.milestones.find((item) => !item.completed)
    ?? roadmap.milestones[0]
    ?? null;
}

function roleCompletion(role: RoleCardView): number | null {
  if (role.attempt_number === null || role.total_milestones <= 0) return null;
  return clamp(Math.round((role.completed_milestones / role.total_milestones) * 100));
}

function GradeDialog(props: { grade: Grade; onClose: () => void; trigger: RefObject<HTMLElement | null> }) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = dialog.current?.querySelector<HTMLButtonElement>("button:not([disabled])");
    if (first) first.focus(); else dialog.current?.focus();
    return () => { props.trigger.current?.focus(); };
  }, [props.trigger]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.stopPropagation(); props.onClose(); return; }
    if (event.key !== "Tab" || dialog.current === null) return;
    const nodes = Array.from(dialog.current.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return (
    <div className="trajectory-v2-overlay" onClick={props.onClose}>
      <div className="trajectory-redesign-grade-dialog" ref={dialog} role="dialog" aria-modal="true"
        aria-labelledby="trajectory-grades-heading" tabIndex={-1} onKeyDown={onKeyDown}
        onClick={(event) => { event.stopPropagation(); }}>
        <div className="trajectory-redesign-dialog-head">
          <div><span className="trajectory-redesign-kicker">КАРЬЕРНОЕ РАЗВИТИЕ</span><h2 id="trajectory-grades-heading">Все уровни</h2></div>
          <button type="button" onClick={props.onClose} aria-label="Закрыть уровни">✕</button>
        </div>
        {props.grade.state === "not_evaluable" ? (
          <div className="trajectory-redesign-grade-empty" role="status">
            <strong>Каталог карьерных грейдов пока не опубликован</strong>
            <p>Уровни, требования и готовность будут показаны после утверждения официальной политики. Этапы обучения и карьерный грейд — разные показатели.</p>
            {props.grade.hint && <small>{props.grade.hint}</small>}
          </div>
        ) : (
          <div className="trajectory-redesign-grade-list">
            <div><span>Текущий грейд</span><strong>{props.grade.current_grade ?? "Не определён"}</strong></div>
            <div><span>Целевой грейд</span><strong>{props.grade.target_grade ?? "Не определён"}</strong></div>
            <div><span>Подтверждённая готовность</span><strong>{props.grade.readiness_percent === null ? "Не рассчитана" : String(props.grade.readiness_percent) + "%"}</strong></div>
            <small>Полный перечень уровней отсутствует в текущем API. Неопубликованные грейды не добавляются на клиенте.</small>
          </div>
        )}
        <p className="trajectory-redesign-caption">Источник: единый снимок Главной и траектории · политика v{String(props.grade.policy_version)}</p>
      </div>
    </div>
  );
}

export function TrajectoryRedesignPage() {
  const overview = useQuery({ queryKey: overviewQueryKey, queryFn: loadDevelopmentOverview });
  if (overview.isPending) return <div className="trajectory-redesign" data-reference="R-PAR-02"><StatePanel kind="loading" /></div>;
  if (overview.isError) return (
    <section className="trajectory-redesign trajectory-redesign-load-error" data-reference="R-PAR-02" role="status">
      <h2>Не удалось загрузить траекторию</h2>
      <p>Для отображения личного прогресса необходим актуальный авторизованный снимок.</p>
      <button type="button" onClick={() => { void overview.refetch(); }}>Повторить</button>
    </section>
  );
  return <TrajectoryRedesignBody overview={overview.data} />;
}

export function TrajectoryRedesignBody({ overview }: { overview: DevelopmentOverviewView }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const roadmaps = useQuery({ queryKey: roadmapsQueryKey, queryFn: loadRoadmaps });
  const roadmapCatalog = useQuery({ queryKey: roadmapCatalogQueryKey, queryFn: loadRoadmapCatalog });
  const maps = useQuery({ queryKey: trajectoryMapQueryKey, queryFn: loadTrajectoryMap });
  const growth = useGrowthSnapshot(true);
  const [pinned, setPinned] = useState<string | null>(() => readPinnedTrack());
  const [hiddenUnselected, setHiddenUnselected] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [compareKey, setCompareKey] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const rolesNavigation = useRef<HTMLElement | null>(null);

  const primaryKey = overview.next_outcome?.trajectory_key ?? null;
  // Resolve Buddy checkpoint links against the authorized server projection.
  const checkpointParam = searchParams.get("checkpoint");
  const linkedTrack = checkpointParam === null ? null
    : maps.data?.find((track) => track.checkpoints.some((node) => node.key === checkpointParam)) ?? null;
  const roleParam = searchParams.get("role");
  const selectedKey = overview.roles.find((role) => role.track_key === roleParam)?.track_key
    ?? overview.roles.find((role) => role.track_key === linkedTrack?.track_key)?.track_key
    ?? overview.roles.find((role) => role.track_key === primaryKey)?.track_key
    ?? overview.roles.find((role) => role.state === "active")?.track_key
    ?? overview.roles[0]?.track_key ?? null;
  const selected = overview.roles.find((role) => role.track_key === selectedKey) ?? null;
  const isCatalogPreview = selected?.state !== "active";
  const roadmap = (isCatalogPreview ? roadmapCatalog.data : roadmaps.data)?.find((item) => item.track_key === selectedKey) ?? null;
  const projectedTrack = maps.data?.find((item) => item.track_key === selectedKey) ?? null;
  const nextMilestone = mapFocus(projectedTrack, roadmap);
  const milestone = pathStage(roadmap, searchParams.get("stage") ?? checkpointParam ?? nextMilestone?.key ?? null);
  const roleProgress = selected === null ? null : roleCompletion(selected);
  const sameCareerContext = selected !== null && selected.track_key === primaryKey;
  const grade = overview.concepts.career_grade;
  const readinessSkills = growth.data?.trajectories.find((item) => item.track_key === selectedKey)?.readiness_skills ?? [];
  const dialogParam = searchParams.get("panel");
  const dialog: DialogKind = checkpointParam !== null ? "stage"
    : dialogParam === "role" || dialogParam === "grades" || dialogParam === "stage" || dialogParam === "stages" || dialogParam === "skills" ? dialogParam : null;
  const linkedCheckpointMissing = checkpointParam !== null && !maps.isPending &&
    (linkedTrack === null || !overview.roles.some((role) => role.track_key === linkedTrack.track_key));

  const roles = useMemo(() => {
    const visible = overview.roles.filter((role) =>
      !hiddenUnselected || role.state !== "unselected" || role.track_key === selectedKey);
    return [...visible].sort((a, b) => Number(b.track_key === pinned) - Number(a.track_key === pinned));
  }, [overview.roles, hiddenUnselected, selectedKey, pinned]);

  const updateLocation = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null) next.delete(key); else next.set(key, value);
    });
    setSearchParams(next);
  };
  const openDialog = (kind: Exclude<DialogKind, null>, stageKey?: string) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    updateLocation({ panel: kind, checkpoint: null, ...(stageKey === undefined ? {} : { stage: stageKey }) });
  };
  const closeDialog = () => {
    updateLocation({ panel: null, checkpoint: null,
      ...(checkpointParam !== null && linkedTrack !== null && selected !== null && milestone !== null
        ? { role: selected.track_key, stage: milestone.key } : {}),
    });
  };
  const togglePin = () => {
    if (selected === null) return;
    const next = pinned === selected.track_key ? null : selected.track_key;
    setPinned(next);
    writePinnedTrack(next);
    setFeedback(next === null ? "Роль откреплена" : "Роль закреплена первой в списке на этом устройстве");
  };

  return (
    <main className="trajectory-redesign" data-reference="R-PAR-02" data-as-of={overview.as_of}>
      <header className="trajectory-redesign-header">
        <div>
          <span className="trajectory-redesign-kicker">ПРОФЕССИОНАЛЬНОЕ РАЗВИТИЕ</span>
          <h1>Моя траектория</h1>
          <p>Выбирай роли, проходи этапы и подтверждай навыки на реальных задачах</p>
        </div>
        <div className="trajectory-redesign-header-actions">
          <span className="trajectory-redesign-freshness">Обновлено {localDate(overview.as_of)}</span>
          <button type="button" disabled={overview.roles.length === 0} onClick={() => {
            const target = rolesNavigation.current?.querySelector<HTMLButtonElement>('[data-role-state="unselected"]')
              ?? rolesNavigation.current?.querySelector<HTMLButtonElement>('[data-testid="trajectory-role-card"]');
            target?.focus();
            if (target && typeof target.scrollIntoView === "function") target.scrollIntoView({ block: "nearest", behavior: "auto" });
          }}>Изменить направления <span aria-hidden="true">↗</span></button>
        </div>
      </header>

      <div className="trajectory-redesign-layout">
        <aside className="trajectory-redesign-sidebar">
          <div className="trajectory-redesign-sidebar-head">
            <h2>Какие роли ты осваиваешь</h2><span>{overview.roles.filter((role) => role.state === "active").length} активных направления · остальные доступны для выбора</span>
          </div>
          
          <nav ref={rolesNavigation} aria-label="Выбор профессиональной роли">
            <ul className="trajectory-redesign-roles">
              {roles.map((role) => (
                <li key={role.track_key}>
                  <button type="button" data-testid="trajectory-role-card" data-role-key={role.track_key}
                    data-role-state={role.state} aria-pressed={selectedKey === role.track_key}
                    className="trajectory-redesign-role"
                    onClick={() => { updateLocation({ role: role.track_key, stage: null, panel: null, checkpoint: null }); setCompareKey(null); setFeedback(null); }}>
                    <span className="trajectory-redesign-role-top">
                      <span className="trajectory-redesign-role-icon" aria-hidden="true">{role.state === "unselected" ? "⌘" : role.track_key === selectedKey ? "◈" : "⌁"}</span>
                      <span className="trajectory-redesign-role-name">{role.title}</span>
                    </span>
                    <span className="trajectory-redesign-role-tags">
                      <span>{role.state === "unselected" ? "Не выбрано" :
                        role.track_key === selectedKey ? "● Осваиваю · выбрано" :
                        role.state === "paused" ? "На паузе" : "● Осваиваю"}</span>
                      {role.track_key === pinned && <span>Закреплена</span>}
                    </span>
                    <span className="trajectory-redesign-role-check" aria-hidden="true">{role.state === "unselected" ? "+" : "✓"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="trajectory-redesign-sidebar-note">
            <strong>Как устроена траектория</strong>
            <p>Курсы → задачи → проверенные результаты → новые возможности</p>
          </div>
        </aside>

        <div className="trajectory-redesign-content">
          {linkedCheckpointMissing && <p role="alert" className="trajectory-redesign-feedback">Этап из ссылки недоступен или больше не опубликован. Выберите этап из карты.</p>}
          {selected === null ? (
            <section className="trajectory-redesign-empty" role="status">
              <h2>Роли пока не доступны</h2>
              <p>После назначения траекторий появится карта профессионального развития.</p>
            </section>
          ) : (
            <>

              <section className="trajectory-redesign-roadmap" aria-label="Карта этапов">
                <div className="trajectory-redesign-section-title">
                  <div><h2>Путь к роли</h2></div>
                  {roadmap && <button className="trajectory-redesign-section-link" type="button" onClick={() => { openDialog("stages"); }}>Все этапы →</button>}
                </div>
                <div className="trajectory-redesign-hero" data-testid="trajectory-role-detail" data-role-key={selected.track_key}>
                  <div className="trajectory-redesign-hero-heading">
                    <h3>{selected.title}</h3>
                    

              {!isCatalogPreview && nextMilestone &&
                      <span className="trajectory-redesign-hero-state">Текущий этап — {nextMilestone.title}</span>}
                  </div>
                  <p>{isCatalogPreview
                    ? "Познакомьтесь с направлением и его этапами, прежде чем выбрать его для освоения."
                    : "Этапы освоения профессии, а не уровни рейтинга · пройдено " +
                      String(selected.completed_milestones) + " из " + String(selected.total_milestones) +
                      " · " + String(roleProgress ?? 0) + "% этапов"}</p>
                  <div className="trajectory-redesign-hero-actions">
                    <button type="button" className="trajectory-redesign-hero-primary" onClick={() => { openDialog("role"); }}>О роли ↗</button>
                    <TrajectoryActivation role={selected} allowed={overview.permissions.trajectory_switch === true} />
                    <TrajectoryActions
                      role={selected} pinned={pinned === selected.track_key}
                      hiddenUnselected={hiddenUnselected}
                      otherRoles={overview.roles.filter((item) => item.track_key !== selected.track_key)}
                      compareTarget={compareKey} feedback={feedback}
                      compare={(key) => { setCompareKey(key); setFeedback(key ? "Роли показаны в сравнении" : "Другой роли для сравнения нет"); }}
                      internalShare={() => { setFeedback("Внутренний обмен пока не подключён"); }}
                      togglePin={togglePin}
                      toggleHiddenUnselected={() => { setHiddenUnselected(!hiddenUnselected); setFeedback(hiddenUnselected ? "Все роли снова показаны" : "Не выбранные роли скрыты"); }}
                      configurePath={() => { setFeedback("Маршрут определяется серверной политикой, редактирование пока не доступно"); }}
                      clearFeedback={() => { setFeedback(null); }}
                    />
                  </div>
                </div>
                {(isCatalogPreview ? roadmapCatalog.isPending : roadmaps.isPending) ? <div aria-busy="true"><StatePanel kind="loading" /></div> :
                  (isCatalogPreview ? roadmapCatalog.isError : roadmaps.isError) ? <div className="trajectory-redesign-error" role="status">
                    <p>Карту этапов загрузить не удалось.</p><button type="button" onClick={() => { if (isCatalogPreview) void roadmapCatalog.refetch(); else void roadmaps.refetch(); }}>Повторить</button>
                  </div> :
                  roadmap === null ? <p className="trajectory-redesign-roadmap-empty" role="status">Для этой роли нет опубликованного каталога этапов.</p> :
                  <div className="trajectory-redesign-path-grid">
                    <ol className="trajectory-redesign-step-list" data-testid="trajectory-stages">
                      {roadmap.milestones.map((step) => {
                        const state = projectedState(selected, step, projectedTrack);
                        const current = step.key === milestone?.key;
                        return (
                          <li key={step.key} className="trajectory-redesign-step-item" data-stage-state={state.css}>
                            <button type="button" className="trajectory-redesign-step" data-stage-state={state.css}
                              aria-pressed={current}
                              onClick={() => { updateLocation({ stage: step.key, panel: null, checkpoint: null }); }}>
                              <span className="trajectory-redesign-step-number" aria-hidden="true">{state.css === "completed" ? "✓" : String(step.position).padStart(2, "0")}</span>
                              <span className="trajectory-redesign-step-description">
                                <strong>{step.title}</strong>
                                <small>{step.purpose}</small>
                                <span className="trajectory-redesign-step-kind">{step.target_kind === "course" ? "Обучение" : step.target_kind === "task" ? "Практика" : "Этап"}</span>
                              </span>
                              <span className="trajectory-redesign-step-status">{isCatalogPreview ? "В каталоге" : state.label}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                    {milestone && (
                      <div className="trajectory-redesign-step-detail" data-testid="trajectory-stage-detail" data-stage-key={milestone.key}>
                        <span className="trajectory-redesign-step-detail-icon" aria-hidden="true">{milestone.target_kind === "course" ? "◇" : "▤"}</span>
                        <div className="trajectory-redesign-step-detail-copy">
                          <strong>{milestone.title}</strong>
                          <p>{milestone.purpose}</p>
                          <small>{isCatalogPreview ? "Каталог этапов · не личный прогресс" :
                            projectedState(selected, milestone, projectedTrack).css === "submitted" ? "Результат на проверке" :
                            projectedState(selected, milestone, projectedTrack).css === "completed" ? "Этап подтверждён" :
                            projectedState(selected, milestone, projectedTrack).css === "locked" ? "Этап пока закрыт" :
                            projectedState(selected, milestone, projectedTrack).label}</small>
                        </div>
                        <button type="button" className="trajectory-redesign-detail-action"
                          onClick={() => { openDialog("stage", milestone.key); }}>Этап подробнее ↗</button>
                      </div>
                    )}
                  </div>
                }
              </section>


              <section className="trajectory-redesign-grade" data-testid="trajectory-grade-summary" aria-label="Карьерный грейд">
                <div className="trajectory-redesign-grade-heading">
                  <strong>Твой уровень</strong>
                  <button type="button" onClick={() => { openDialog("grades"); }}>Все уровни <span aria-hidden="true">→</span></button>
                </div>
                <div className="trajectory-redesign-grade-identity">
                  <span className="trajectory-redesign-grade-symbol" aria-hidden="true">⬡</span>
                  <div>
                    <strong>{sameCareerContext && grade.state !== "not_evaluable" ? grade.current_grade ?? "—" : "—"}</strong>
                    <small>{selected.title}</small>
                  </div>
                </div>
                <div className="trajectory-redesign-grade-bar" aria-hidden="true">
                  <span style={{ width: sameCareerContext && grade.state !== "not_evaluable" && grade.readiness_percent !== null ? String(clamp(grade.readiness_percent)) + "%" : "0%" }} />
                </div>
                <div className="trajectory-redesign-grade-progress">
                  <strong>{sameCareerContext && grade.state !== "not_evaluable" && grade.readiness_percent !== null
                    ? String(grade.readiness_percent) + "% к следующему уровню"
                    : "Карьерный прогресс не рассчитан"}</strong>
                  <span>{sameCareerContext && grade.state !== "not_evaluable" ? (grade.current_grade ?? "—") + " → " + (grade.target_grade ?? "—") : "—"}</span>
                </div>
                <div className="trajectory-redesign-grade-next">
                  <div><small>Следующий уровень</small><strong>{sameCareerContext && grade.state !== "not_evaluable"
                    ? grade.target_grade ?? "Не определён" : "Каталог ещё не опубликован"}</strong></div>
                  <span aria-hidden="true">↗</span>
                </div>
                <p className="trajectory-redesign-grade-caption">{!sameCareerContext
                  ? "Грейд для этой роли не определён в общем снимке"
                  : grade.state === "not_evaluable"
                    ? "Каталог грейдов ещё не утверждён. Прогресс этапов не равен грейду."
                    : "Уровень общий с главной страницей Impulse"}</p>
              </section>

              {!isCatalogPreview && roadmap && (
                <section className="trajectory-redesign-next" data-testid="trajectory-next" aria-label="Следующий шаг">
                  <div className="trajectory-redesign-section-title">
                    <div><h2>Следующий шаг</h2></div>
                    <span className="trajectory-redesign-next-tag">Рекомендуем сейчас</span>
                  </div>
                  {nextMilestone === null ? (
                    <p className="trajectory-redesign-roadmap-empty">Карта пока не определила следующий доступный этап</p>
                  ) : (
                    <div className="trajectory-redesign-next-row">
                      <span className="trajectory-redesign-next-symbol" aria-hidden="true">
                        {nextMilestone.target_kind === "course" ? "◇" : "▤"}
                      </span>
                      <div>
                        <h3>{overview.next_outcome?.trajectory_key === selected.track_key &&
                          overview.next_outcome.milestone_key === nextMilestone.key
                          ? overview.next_outcome.target_title : nextMilestone.title}</h3>
                        <span>{nextMilestone.target_kind === "course" ? "Bootcamp" : "Практическая задача"} · {nextMilestone.skill}</span>
                        <p>{nextMilestone.purpose}</p>
                      </div>
                      <button type="button" onClick={() => { openDialog("stage", nextMilestone.key); }}>
                        Посмотреть задачу <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  )}
                </section>
              )}

              {roadmap && roadmap.milestones.length > 0 && (
                <section className="trajectory-redesign-remaining" aria-label="Остальные шаги траектории">
                  <div className="trajectory-redesign-section-title">
                    <div><h2>Остальные шаги траектории</h2></div>
                    <button className="trajectory-redesign-section-link" type="button" onClick={() => { openDialog("stages"); }}>Вся траектория →</button>
                  </div>
                  <ul>
                    {roadmap.milestones.filter((step) => step.key !== nextMilestone?.key).map((step) => {
                      const state = projectedState(selected, step, projectedTrack);
                      return <li key={step.key}>
                        <span className="trajectory-redesign-remaining-icon" data-stage-state={state.css} aria-hidden="true">
                          {state.css === "completed" ? "✓" : "○"}
                        </span>
                        <div>
                          <strong>{step.title}</strong>
                          <small>{step.target_kind === "course" ? "Bootcamp" : "Практическая задача"} · {step.skill}</small>
                        </div>
                        <span className="trajectory-redesign-remaining-state">{selected.attempt_number === null ? "В каталоге" : state.label}</span>
                        <button type="button" onClick={() => { openDialog("stage", step.key); }}>Детали</button>
                      </li>;
                    })}
                  </ul>
                </section>
              )}

              <section className="trajectory-redesign-skills" aria-label="Навыки маршрута">
                <div className="trajectory-redesign-section-title">
                  <div><h2>Мой скилл-паспорт</h2></div>
                  <button className="trajectory-redesign-section-link" type="button" onClick={() => { openDialog("skills"); }}>Все навыки →</button>
                </div>
                <p className="trajectory-redesign-skills-note">Прогресс по компетенциям, не карьерный грейд</p>
                <ul>
                  {readinessSkills.length > 0 ? readinessSkills.map((skill) => (
                    <li key={skill.skill_key}>
                      <span className="trajectory-redesign-skill-symbol" aria-hidden="true">◫</span>
                      <div><strong>{skill.title}</strong>
                        <small>{skill.known ? "Уровень навыка: " + skill.current_level + " → " + skill.target_level
                          : "Уровень навыка пока неизвестен"}</small>
                        <span className="trajectory-redesign-skill-bar" aria-label="Процент прогресса по навыку не опубликован"><i /></span>
                      </div>
                      <span>{skill.known ? "Без %" : "—"}</span>
                    </li>
                  )) : roadmap === null || roadmap.milestones.length === 0 ? (
                    <li><span className="trajectory-redesign-skill-symbol" aria-hidden="true">◫</span>
                      <div><strong>Данные навыков не опубликованы</strong><small>Появятся после проверки результатов</small></div>
                      <span>—</span></li>
                  ) : Array.from(new Set(roadmap.milestones.map((item) => item.skill))).map((skill) => (
                    <li key={skill}>
                      <span className="trajectory-redesign-skill-symbol" aria-hidden="true">◫</span>
                      <div><strong>{skill}</strong><small>Уровень навыка не оценён</small>
                        <span className="trajectory-redesign-skill-bar"><i /></span>
                      </div>
                      <span>—</span>
                    </li>
                  ))}
                </ul>
                <p className="trajectory-redesign-skills-footer">Открытие этапа не меняет уровень навыка: требуется проверенное evidence</p>
              </section>

              {compareKey !== null && (
                <RoleComparePanel
                  roles={overview.roles} roadmaps={roadmaps.data ?? []}
                  trackA={selected.track_key} trackB={compareKey}
                  onClose={() => { setCompareKey(null); }}
                />
              )}
              {feedback && <p className="trajectory-redesign-feedback" data-testid="trajectory-action-status" role="status">{feedback}</p>}
            </>
          )}
        </div>
      </div>
      {dialog === "stages" && selected && (
        <Drawer title={"Все этапы: " + selected.title} open onClose={closeDialog}>
          <div className="trajectory-redesign-all-stages" data-testid="trajectory-all-stages">
            {roadmap === null ? <p role="status">Дорожная карта не опубликована.</p> : (
              <ol>{roadmap.milestones.map((step) => (
                <li key={step.key}>
                  <span>{String(step.position).padStart(2, "0")}</span>
                  <div><strong>{step.title}</strong><small>{projectedState(selected, step, projectedTrack).label} · {step.skill}</small></div>
                  <button type="button" onClick={() => { openDialog("stage", step.key); }}>Посмотреть</button>
                </li>
              ))}</ol>
            )}
          </div>
        </Drawer>
      )}
      {dialog === "skills" && (
        <Drawer title="Все навыки" open onClose={closeDialog}>
          <div className="trajectory-redesign-all-skills" data-testid="trajectory-all-skills">
            <p>Навыки оцениваются по проверенным результатам. Карьерный грейд и этапы обучения не являются уровнем компетенции.</p>
            {readinessSkills.length > 0 ? (
              <ul>{readinessSkills.map((skill) => <li key={skill.skill_key}>
                <strong>{skill.title}</strong>
                <span>{skill.known ? skill.current_level + " → " + skill.target_level : "Уровень пока не определён"}</span>
              </li>)}</ul>
            ) : (
              <p role="status">Подтверждённые уровни компетенций пока не опубликованы в снимке.</p>
            )}
          </div>
        </Drawer>
      )}
      {selected && dialog === "role" && <RoleInfoDialog role={selected} roadmap={roadmap} onClose={closeDialog} triggerRef={opener} />}
      {selected && dialog === "stage" && (
        !isCatalogPreview && projectedTrack !== null ? (
          <ProjectedCheckpointDrawer checkpointKey={checkpointParam ?? milestone?.key ?? ""}
            track={projectedTrack} onClose={closeDialog} />
        ) : isCatalogPreview && roadmap && milestone ? (
          <Drawer title={"Этап каталога: " + milestone.title} open onClose={closeDialog}>
            <p>{milestone.purpose}</p>
            <p>Компетенция: {milestone.skill}</p>
            <p role="status">Это опубликованная программа роли, не ваш персональный прогресс. Начните или возобновите направление, чтобы выполнять этапы.</p>
          </Drawer>
        ) : (
          <Drawer title="Детали этапа" open onClose={closeDialog}>
            <p role="status">{maps.isPending ? "Загружаем подтверждённые статусы карты…" : "Нет доступной серверной карты. Подтверждённые статусы и переходы временно недоступны."}</p>
            <button type="button" onClick={() => { void maps.refetch(); }}>Повторить загрузку карты</button>
          </Drawer>
        )
      )}
      {dialog === "grades" && <GradeDialog grade={sameCareerContext ? grade : { ...grade, state: "not_evaluable", current_grade: null, target_grade: null, readiness_percent: null, hint: "Данные по выбранной роли недоступны" }} onClose={closeDialog} trigger={opener} />}
    </main>
  );
}
