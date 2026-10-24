import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { StatePanel } from "../../components/ui";
import { apiRequest } from "../../api/client";
import {
  loadDevelopmentOverview,
  loadRoadmaps,
  overviewQueryKey,
  roadmapsQueryKey,
  PRIMARY_LABEL,
  MILESTONE_STATE_LABELS,
  milestoneState,
  readPinnedTrack,
  roleStateLabel,
  writePinnedTrack,
} from "./client";
import { RoleComparePanel, TrajectoryActions } from "./actions";
import { RoleInfoDialog, StageTaskDrawer } from "./details";
import type {
  DevelopmentOverviewView,
  MilestoneView,
  RoadmapView,
  RoleCardView,
} from "./client";
import "./trajectory-v2.scss";

function isSelectedStage(
  stageKey: string | null,
  milestones: { key: string }[],
  currentKey: string,
): string {
  if (stageKey !== null && milestones.some((m) => m.key === stageKey)) return stageKey;
  return currentKey;
}



/**
 * Trajectory v2 master-detail shell (participant-home-trajectory-grades 5.1).
 * One authorized overview snapshot feeds the server-truth role cards; the
 * selected role is addressable through the ?role= query parameter so Back and
 * Forward restore the selection. Unselected roles show catalog structure only,
 * never personal progress.
 */
export function TrajectoryV2() {
  const overview = useQuery({
    queryKey: overviewQueryKey,
    queryFn: loadDevelopmentOverview,
  });
  if (overview.isPending) {
    return (
      <div className="trajectory-v2" data-reference="R-PAR-02">
        <StatePanel kind="loading" />
      </div>
    );
  }
  if (overview.isError) {
    return (
      <div className="trajectory-v2" data-reference="R-PAR-02">
        <section className="trajectory-v2-failure" role="status">
          <strong>Не удалось загрузить траекторию.</strong>
          <p>Карта этапов остаётся недоступной без авторизованного снимка.</p>
          <button
            type="button"
            onClick={() => {
              void overview.refetch();
            }}
          >
            Повторить
          </button>
        </section>
      </div>
    );
  }
  return (
    <TrajectoryV2Body overview={overview.data} />
  );
}

export function TrajectoryV2Body(props: { overview: DevelopmentOverviewView }) {
  const { overview } = props;
  const [searchParams, setSearchParams] = useSearchParams();
  const roadmaps = useQuery({
    queryKey: roadmapsQueryKey,
    queryFn: loadRoadmaps,
  });
  const passport = useQuery({
    queryKey: ["talent-passport"],
    queryFn: () => apiRequest<{ verified_courses: string[]; skills: { key: string; practical_level: string; confirmed_case_count: number }[]; cases: { contribution_id: string; submitted_at: string; reviewer_id: string }[] }>("/api/v1/me/talent-passport"),
  });
  const navigation = useQuery({
    queryKey: ["me"],
    queryFn: () => apiRequest<{ navigation: string[] }>("/api/v1/me"),
  });
  const goToPortfolio = () => {
    const idx = navigation.data?.navigation.indexOf("Портфолио") ?? -1;
    if (idx >= 0) window.location.assign(`/workspace/${String(idx)}`);
  };
  const roleParam = searchParams.get("role");
  const selectedKey = useMemo(() => {
    const paramRole = overview.roles.find((role) => role.track_key === roleParam);
    if (paramRole) return paramRole.track_key;
    const outcomeKey = overview.next_outcome?.trajectory_key;
    return outcomeKey !== undefined && overview.roles.some((role) => role.track_key === outcomeKey)
      ? outcomeKey
      : (overview.roles[0]?.track_key ?? null);
  }, [overview, roleParam]);
  const selected = overview.roles.find((role) => role.track_key === selectedKey) ?? null;
  const primaryKey = primaryTrajectoryKey(overview);
  const selectedRoadmap =
    selected !== null
      ? (roadmaps.data?.find((item) => item.track_key === selected.track_key) ?? null)
      : null;
  const lastOverlayTriggerRef = useRef<HTMLElement | null>(null);
  const [roleInfoOpen, setRoleInfoOpen] = useState(false);
  const [drawerKey, setDrawerKey] = useState<string | null>(null);
  const [pinnedTrack, setPinnedTrack] = useState<string | null>(() => readPinnedTrack());
  const [hiddenUnselected, setHiddenUnselected] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [compareTarget, setCompareTarget] = useState<string | null>(null);
  const [gradesOpen, setGradesOpen] = useState(false);
  const snapshotTrigger = () => {
    lastOverlayTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };
  const openRoleInfo = () => {
    snapshotTrigger();
    setDrawerKey(null);
    setRoleInfoOpen(true);
  };
  const openStageDetails = (stageKey: string) => {
    snapshotTrigger();
    setRoleInfoOpen(false);
    setDrawerKey(stageKey);
  };
  const closeOverlays = () => {
    setRoleInfoOpen(false);
    setDrawerKey(null);
  };
  const drawerMilestone = selectedRoadmap?.milestones.find((m) => m.key === drawerKey);
  const visibleRoles = useMemo(() => {
    const filtered = overview.roles.filter(
      (role) =>
        !hiddenUnselected || role.track_key === selectedKey || role.state !== "unselected",
    );
    if (pinnedTrack === null) return filtered;
    return [...filtered].sort(
      (left, right) =>
        Number(right.track_key === pinnedTrack) - Number(left.track_key === pinnedTrack),
    );
  }, [overview.roles, hiddenUnselected, selectedKey, pinnedTrack]);
  const togglePin = (trackKey: string) => {
    const next = pinnedTrack === trackKey ? null : trackKey;
    setPinnedTrack(next);
    writePinnedTrack(next);
    setActionFeedback(
      next === null
        ? "Роль откреплена; локальный приоритет снят."
        : "Роль закреплена сверху списка (локальный приоритет, сохраняется в браузере).",
    );
  };
  const internalShare = () => {
    setActionFeedback(
      "Доступ по ссылке возможен только для конкретного получателя с ограниченным сроком и отзывом. Сервис внутреннего обмена пока не подключён.",
    );
  };
  const configurePath = () => {
    setActionFeedback(
      "Конфигурирование пути недоступно: параметры дорожной карты меняет только серверная политика.",
    );
  };
  const toggleHiddenUnselected = () => {
    const nextHidden = !hiddenUnselected;
    setHiddenUnselected(nextHidden);
    setActionFeedback(
      nextHidden
        ? "Не выбранные роли скрыты; выбранные роли остаются видимыми."
        : "Не выбранные роли снова показаны.",
    );
  };
  const compareRoles = (trackKey: string | null) => {
    setCompareTarget(trackKey);
    setActionFeedback(
      trackKey === null
        ? "Сравнение недоступно: в снимке нет второй роли."
        : "Сравнение открыто для выбранной пары ролей.",
    );
  };

  const roleSelected = (trackKey: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("role", trackKey);
    setSearchParams(next);
  };

  return (
    <div className="trajectory-v2" data-reference="R-PAR-02" data-as-of={overview.as_of}>
      <header className="trajectory-v2-heading">
        <div>
          <h2>Моя траектория</h2>
          <p className="trajectory-v2-intro">Строй свою карьерную историю в Сбере — от обучения к реальным проектам</p>
          <small>Данные обновлены: {formatAsOf(overview.as_of)}</small>
        </div>
      </header>
      <div className="trajectory-v2-columns">
        <nav className="trajectory-v2-roles" aria-label="Роли">
          <ul>
            {visibleRoles.map((role) => (
              <li key={role.track_key}>
                <RoleCardOverview
                  role={role}
                  primary={role.track_key === primaryKey}
                  selected={role.track_key === selectedKey}
                  pinned={role.track_key === pinnedTrack}
                  onSelect={() => {
                    roleSelected(role.track_key);
                  }}
                />
              </li>
            ))}
          </ul>
        </nav>
        <section className="trajectory-v2-detail" aria-label="Детали роли">
          {selected === null ? (
            <p role="status">Роли пока не связаны с траекторией.</p>
          ) : (
            <>
              <RoleDetailPanel
                role={selected}
              primary={selected.track_key === primaryKey}
              roadmap={roadmaps.data?.find((item) => item.track_key === selected.track_key) ?? null}
              roadmapPending={roadmaps.isPending}
              roadmapError={roadmaps.isError}
              roadmapRetry={() => {
                void roadmaps.refetch();
              }}
              stageKey={searchParams.get("stage")}
              onStageSelect={(stageKey) => {
                const next = new URLSearchParams(searchParams);
                next.set("stage", stageKey);
                setSearchParams(next);
              }}
              onOpenRoleInfo={openRoleInfo}
              onOpenStageDetails={openStageDetails}
              pinned={pinnedTrack === selected.track_key}
              hiddenUnselected={hiddenUnselected}
              otherRoles={overview.roles.filter((item) => item.track_key !== selected.track_key)}
              compareTarget={compareTarget}
              feedback={actionFeedback}
              compare={compareRoles}
              internalShare={internalShare}
              togglePin={() => {
                togglePin(selected.track_key);
              }}
              toggleHiddenUnselected={toggleHiddenUnselected}
              configurePath={configurePath}
              clearFeedback={() => {
                setActionFeedback(null);
              }}
              />
              {compareTarget !== null ? (
                <RoleComparePanel
                  roles={overview.roles}
                  roadmaps={roadmaps.data ?? []}
                  trackA={selected.track_key}
                  trackB={compareTarget}
                  onClose={() => {
                    setCompareTarget(null);
                  }}
                />
              ) : null}
              {actionFeedback !== null ? (
                <p
                  className="trajectory-v2-action-status"
                  role="status"
                  data-testid="trajectory-action-status"
                >
                  {actionFeedback}
                </p>
              ) : null}
            </>
          )}
        </section>
      <aside className="trajectory-v2-reference-sidebar" aria-label="Карьерный прогресс и следующий шаг">
        <section className="trajectory-v2-grade-panel">
          <header><h3>Твой грейд</h3><button type="button" className="trajectory-v2-all-grades-link" onClick={() => { setGradesOpen(true); }}>Все уровни →</button></header>
          <div className="trajectory-v2-grade-body">
            <div className="trajectory-v2-grade-ring"><strong>{overview.concepts.career_grade.current_grade === null ? "—" : `Грейд ${overview.concepts.career_grade.current_grade}`}</strong><small>{selected?.title ?? "Моя роль"}</small></div>
            <div className="trajectory-v2-grade-progress">
              <small>До следующего грейда</small>
              <strong>{overview.concepts.career_grade.readiness_percent === null ? "Проверяем" : `${String(100 - overview.concepts.career_grade.readiness_percent)}%`}</strong>
              <progress max={100} value={overview.concepts.career_grade.readiness_percent ?? 0} aria-label="Готовность к следующему грейду" />
              <small>{overview.concepts.career_grade.hint ?? overview.concepts.career_grade.reason ?? "По проверенным результатам"}</small>
            </div>
          </div>
          <p>{overview.concepts.career_grade.state === "ready" ? "Прогресс подтверждён" : "Грейд рассчитывается по серверной политике и проверенным результатам"}</p>
        </section>
        <section className="trajectory-v2-next-panel">
          <header><h3>Следующий шаг</h3><span>{overview.next_outcome?.trajectory_title ?? "Маршрут"}</span></header>
          <strong>{overview.next_outcome?.target_title ?? "Следующий шаг пока не назначен"}</strong>
          <p>{overview.next_outcome?.stale_reason ?? "Продолжайте маршрут после подтверждения результата"}</p>
          {overview.next_outcome !== null && <button type="button" onClick={() => { if (overview.next_outcome !== null) openStageDetails(overview.next_outcome.milestone_key); }}>Посмотреть →</button>}
        </section>
        <section className="trajectory-v2-passport-panel">
          <header>
            <h3>Мой скилл-паспорт</h3>
            {navigation.data?.navigation.includes("Портфолио") && (
              <button type="button" onClick={goToPortfolio}>Открыть →</button>
            )}
          </header>
          {passport.isPending && <p role="status">Загружаем подтверждённые навыки…</p>}
          {passport.isError && <p role="status">Не удалось загрузить скилл-паспорт.</p>}
          {passport.data?.skills.length === 0 && <p>Подтверждённые навыки появятся после проверки личного вклада в проект.</p>}
          {passport.data && passport.data.skills.length > 0 && (
            <ul className="trajectory-v2-skill-list">
              {passport.data.skills.slice(0, 4).map((skill, index) => {
                const maxCount = Math.max(1, ...passport.data!.skills.map((entry) => entry.confirmed_case_count));
                return (
                  <li key={skill.key}>
                    <span className="trajectory-v2-skill-icon" data-tone={index % 4}>{["▤", "✧", "▣", "⌁"][index % 4]}</span>
                    <strong>{skill.key}</strong>
                    <progress max={maxCount} value={skill.confirmed_case_count} aria-label={`${skill.key}: подтверждено кейсов ${skill.confirmed_case_count}`}/>
                    <small>{skill.confirmed_case_count} кейс.</small>
                  </li>
                );
              })}
            </ul>
          )}
          <small className="trajectory-v2-passport-disclaimer">Полоса отражает число подтверждённых кейсов относительно других навыков, не оценку уровня компетенции.</small>
        </section>
      </aside>
      </div>
      {gradesOpen && (
        <div className="trajectory-v2-overlay" onClick={() => { setGradesOpen(false); }}>
          <section className="trajectory-v2-grades-dialog" role="dialog" aria-modal="true" aria-label="Все уровни" onClick={(event) => { event.stopPropagation(); }}>
            <header><h2>Все уровни</h2><button type="button" aria-label="Закрыть" onClick={() => { setGradesOpen(false); }}>✕</button></header>
            <p>Грейд определяется подтверждёнными результатами и действующей политикой оценки.</p>
            <div className="trajectory-v2-grades-list" role="status">
              <p>Полный перечень грейдов пока не опубликован. Условия и количество уровней появятся после утверждения карьерной политики.</p>
              {overview.concepts.career_grade.current_grade !== null && (
                <p><strong>Текущий грейд:</strong> {overview.concepts.career_grade.current_grade}</p>
              )}
              {overview.concepts.career_grade.target_grade !== null && (
                <p><strong>Целевой грейд:</strong> {overview.concepts.career_grade.target_grade}</p>
              )}
            </div>
            <small>Версия политики: {overview.concepts.career_grade.policy_version ?? "не опубликована"}. Точный каталог условий недоступен в текущем снимке.</small>
          </section>
        </div>
      )}
      {roleInfoOpen && selected !== null ? (
        <RoleInfoDialog
          role={selected}
          roadmap={selectedRoadmap}
          onClose={closeOverlays}
          triggerRef={lastOverlayTriggerRef}
        />
      ) : null}
      {selectedRoadmap !== null &&
      selected !== null &&
      drawerKey !== null &&
      drawerMilestone !== undefined ? (
        <StageTaskDrawer
          key={drawerMilestone.key}
          milestone={drawerMilestone}
          state={milestoneState(drawerMilestone, selectedRoadmap.next_step)}
          role={selected}
          policyVersion={selectedRoadmap.policy_version}
          onClose={closeOverlays}
          triggerRef={lastOverlayTriggerRef}
        />
      ) : null}
    </div>
  );
}

function primaryTrajectoryKey(overview: DevelopmentOverviewView): string | null {
  return overview.next_outcome?.trajectory_key ?? null;
}

function formatAsOf(asOf: string): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(asOf),
  );
}

export function RoleCardOverview(props: {
  role: RoleCardView;
  primary: boolean;
  selected: boolean;
  pinned: boolean;
  onSelect: () => void;
}) {
  const { role } = props;
  return (
    <button
      type="button"
      className="trajectory-v2-role-card"
      data-testid="trajectory-role-card"
      data-role-key={role.track_key}
      aria-pressed={props.selected}
      onClick={() => {
        props.onSelect();
      }}
    >
      <span className="trajectory-v2-role-icon" aria-hidden="true">
        {role.title.toLowerCase().includes("python") || role.title.toLowerCase().includes("разработ") ? (
          <svg viewBox="0 0 32 32" fill="none"><path d="m12 7-8 9 8 9M20 7l8 9-8 9M18 5l-4 22" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        ) : role.title.toLowerCase().includes("ml") || role.title.toLowerCase().includes("инженер") ? (
          <svg viewBox="0 0 32 32" fill="none"><path d="m16 3 12 7v13l-12 7L4 23V10L16 3zm0 13 12-6M16 16 4 10m12 6v14" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/></svg>
        ) : (
          <svg viewBox="0 0 32 32" fill="none"><path d="M5 26V16m7 10V9m7 17V5m7 21V13" stroke="currentColor" strokeWidth="3.8" strokeLinecap="round"/></svg>
        )}
      </span>
      {props.primary && <span className="trajectory-v2-primary-check" aria-label="Основная роль">✓</span>}
      <strong>{role.title}</strong>
      {role.attempt_number !== null ? (
        <>
          <progress max={Math.max(1,role.total_milestones)} value={Math.min(role.total_milestones,role.completed_milestones)} aria-label="Прогресс этапов роли" />
          <small>{role.completed_milestones} из {role.total_milestones} этапов{role.state === "paused" ? " · пауза" : ""}</small>
        </>
      ) : (
        <small className="trajectory-v2-role-unselected">Не выбрана</small>
      )}
      {props.pinned && <span className="trajectory-v2-role-pinned" aria-label="Закреплена">◆</span>}
    </button>
  );
}

export function RoleDetailPanel(props: {
  role: RoleCardView;
  primary: boolean;
  roadmap: RoadmapView | null;
  roadmapPending: boolean;
  roadmapError: boolean;
  roadmapRetry: () => void;
  stageKey: string | null;
  onStageSelect: (stageKey: string) => void;
  onOpenRoleInfo: () => void;
  onOpenStageDetails: (stageKey: string) => void;
  pinned: boolean;
  hiddenUnselected: boolean;
  otherRoles: RoleCardView[];
  compareTarget: string | null;
  feedback: string | null;
  compare: (trackKey: string | null) => void;
  internalShare: () => void;
  togglePin: () => void;
  toggleHiddenUnselected: () => void;
  configurePath: () => void;
  clearFeedback: () => void;
}) {
  const role = props.role;
  return (
    <article
      className="trajectory-v2-role-detail"
      data-testid="trajectory-role-detail"
      data-role-key={role.track_key}
    >
      <header>
        <h3>{role.title}</h3>
        <span className="trajectory-v2-role-state">{roleStateLabel(role.state)}</span>
        {props.primary && <span className="trajectory-v2-role-badge">{PRIMARY_LABEL}</span>}
        <button
          type="button"
          className="trajectory-v2-role-info-button"
          onClick={props.onOpenRoleInfo}
        >
          Подробнее о роли
        </button>
        <TrajectoryActions
          role={role}
          pinned={props.pinned}
          hiddenUnselected={props.hiddenUnselected}
          otherRoles={props.otherRoles}
          compareTarget={props.compareTarget}
          feedback={props.feedback}
          compare={props.compare}
          internalShare={props.internalShare}
          togglePin={props.togglePin}
          toggleHiddenUnselected={props.toggleHiddenUnselected}
          configurePath={props.configurePath}
          clearFeedback={props.clearFeedback}
        />
      </header>
      {role.attempt_number === null ? (
        <section aria-label="Прогресс роли">
          <p className="trajectory-v2-unselected-note" role="status">
            Траектория ещё не включена. Персональный прогресс отсутствует — он появится после
            выбора роли в каталоге траекторий.
          </p>
          <small>этапов в каталоге: {role.total_milestones}</small>
        </section>
      ) : (
        <section aria-label="Прогресс роли">
          <p>
            Этапов пройдено: {role.completed_milestones} из {role.total_milestones}.
          </p>
          <small>Попытка {role.attempt_number}.</small>
        </section>
      )}
      <StagePathSection
        role={role}
        roadmap={props.roadmap}
        pending={props.roadmapPending}
        error={props.roadmapError}
        retry={props.roadmapRetry}
        stageKey={props.stageKey}
        onStageSelect={props.onStageSelect}
        onOpenDetails={props.onOpenStageDetails}
      />
    </article>
  );
}

export function StagePathSection(props: {
  role: RoleCardView;
  roadmap: RoadmapView | null;
  pending: boolean;
  error: boolean;
  retry: () => void;
  stageKey: string | null;
  onStageSelect: (stageKey: string) => void;
  onOpenDetails: (stageKey: string) => void;
}) {
  const { role, roadmap } = props;
  if (props.pending) {
    return (
      <div className="trajectory-v2-stage-block" aria-busy="true" data-testid="trajectory-stages">
        <StatePanel kind="loading" />
      </div>
    );
  }
  if (props.error) {
    return (
      <div className="trajectory-v2-stage-block" data-testid="trajectory-stages">
        <p className="trajectory-v2-failure-note" role="status">
          Не удалось загрузить карту этапов.
        </p>
        <button type="button" onClick={props.retry}>
          Повторить
        </button>
      </div>
    );
  }
  if (roadmap === null) {
    return (
      <div className="trajectory-v2-stage-block" data-testid="trajectory-stages">
        <p role="status">Карта этапов для этой роли пока не опубликована.</p>
      </div>
    );
  }
  if (roadmap.track_key !== role.track_key) {
    return (
      <div className="trajectory-v2-stage-block" data-testid="trajectory-stages">
        <p role="status">Карта этапов не соответствует выбранной роли; снимок обновляется.</p>
      </div>
    );
  }
  const nextStep = roadmap.next_step;
  const currentKey = nextStep?.key ?? roadmapsDefaultKey(roadmap);
  const visibleStageKey = isSelectedStage(props.stageKey, roadmap.milestones, currentKey);
  const visibleMilestone = roadmap.milestones.find((m) => m.key === visibleStageKey);
  return (
    <section className="trajectory-v2-stage-block" aria-label="Этапы" data-testid="trajectory-stages">
      <header>
        <h4>Этапы</h4>
        <small>
          политика v{roadmap.policy_version}
          {roadmap.replacement_reason ? ` · ${roadmap.replacement_reason}` : ""}
        </small>
      </header>
      <ol className="trajectory-v2-stage-path">
        {roadmap.milestones.map((milestone) => {
          const state = milestoneState(milestone, nextStep);
          return (
            <li key={milestone.key}>
              <button
                type="button"
                className="trajectory-v2-stage"
                aria-pressed={milestone.key === visibleStageKey}
                data-stage-state={state}
                onClick={() => {
                  props.onStageSelect(milestone.key);
                }}
              >
                <strong>{milestone.title}</strong>
                <span>{MILESTONE_STATE_LABELS[state] ?? state}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {visibleMilestone === undefined ? null : (
        <StageDetail
          milestone={visibleMilestone}
          state={milestoneState(visibleMilestone, nextStep)}
          nextStep={nextStep}
          role={role}
          onOpenDetails={props.onOpenDetails}
        />
      )}
    </section>
  );
}

function roadmapsDefaultKey(roadmap: RoadmapView): string {
  return roadmap.next_step?.key ?? roadmap.milestones[0]?.key ?? "";
}

export function StageDetail(props: {
  milestone: MilestoneView;
  state: string;
  nextStep: MilestoneView | null;
  role: RoleCardView;
  onOpenDetails?: (stageKey: string) => void;
}) {
  const { milestone, nextStep, role } = props;
  const canOpen = props.onOpenDetails !== undefined && props.state !== "locked";
  const total = Math.max(1, role.total_milestones);
  return (
    <section className="trajectory-v2-stage-detail" data-testid="trajectory-stage-detail" data-stage-key={milestone.key}>
      <div className="trajectory-v2-stage-header">
        <div>
          <small>Этап {milestone.position} из {total}</small>
          <h3>{milestone.title}</h3>
          <p>{milestone.purpose}</p>
        </div>
        <div className="trajectory-v2-stage-progress">
          <span className="trajectory-v2-stage-state" data-state={props.state}>
            {MILESTONE_STATE_LABELS[props.state] ?? props.state}
          </span>
          {role.attempt_number !== null && <small>{role.completed_milestones} из {total} этапов завершено</small>}
          <progress max={total} value={Math.min(total,role.completed_milestones)} aria-label="Завершено этапов роли"/>
        </div>
      </div>
      <div className="trajectory-v2-task-row" data-state={props.state}>
        <span className="trajectory-v2-task-check" aria-hidden="true">
          {props.state === "completed" ? "✓" : props.state === "locked" ? "🔒" : ""}
        </span>
        <div className="trajectory-v2-task-copy">
          <strong>{milestone.target_kind === "course" ? `Курс: ${milestone.title}` : milestone.title}</strong>
          <small>{milestone.skill} · {milestone.target_kind === "task" ? "Практическая задача" : milestone.target_kind === "course" ? "Обучение" : milestone.target_kind}</small>
        </div>
        <span className="trajectory-v2-task-status">{props.state === "completed" ? "Завершено" : props.state === "locked" ? "Недоступно" : "К выполнению"}</span>
        {canOpen ? (
          <button type="button" className={props.state === "completed" ? "trajectory-v2-task-action" : "trajectory-v2-task-action is-primary"} onClick={() => props.onOpenDetails?.(milestone.key)}>
            {props.state === "completed" ? "Посмотреть" : "Продолжить"} →
          </button>
        ) : null}
      </div>
      <details className="trajectory-v2-stage-more">
        <summary>Подробнее об этапе</summary>
        <dl>
          <div><dt>Навык</dt><dd>{milestone.skill}</dd></div>
          <div><dt>Цель</dt><dd>{milestone.target_kind} · {milestone.target_key}</dd></div>
          <div><dt>Позиция</dt><dd>{milestone.position}</dd></div>
        </dl>
      </details>
      {props.state === "locked" && (
        <p className="trajectory-v2-stage-note" role="status">
          {nextStep === null ? "Этап недоступен: сервер не разрешает переход дальше." : `Этап откроется после завершения «${nextStep.title}».`}
        </p>
      )}
      {props.state === "available" && role.attempt_number === null && (
        <p className="trajectory-v2-stage-note" role="status">Прогресс появится после выбора траектории.</p>
      )}
    </section>
  );
}
