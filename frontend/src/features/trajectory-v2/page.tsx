import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { StatePanel } from "../../components/ui";
import {
  loadDevelopmentOverview,
  loadRoadmaps,
  overviewQueryKey,
  roadmapsQueryKey,
  PRIMARY_LABEL,
  MILESTONE_STATE_LABELS,
  milestoneState,
  roleStateLabel,
} from "./client";
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

  const roleSelected = (trackKey: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("role", trackKey);
    setSearchParams(next);
  };

  return (
    <div className="trajectory-v2" data-reference="R-PAR-02" data-as-of={overview.as_of}>
      <header className="trajectory-v2-heading">
        <div>
          <p className="eyebrow">Предпросмотр интерактивного маршрута</p>
          <h2>Моя траектория</h2>
          <small>Снимок авторизованных данных от {formatAsOf(overview.as_of)}</small>
        </div>
      </header>
      <div className="trajectory-v2-columns">
        <nav className="trajectory-v2-roles" aria-label="Роли">
          <ul>
            {overview.roles.map((role) => (
              <li key={role.track_key}>
                <RoleCardOverview
                  role={role}
                  primary={role.track_key === primaryKey}
                  selected={role.track_key === selectedKey}
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
            />
          )}
        </section>
      </div>
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
  onSelect: () => void;
}) {
  const { role } = props;
  return (
    <button
      type="button"
      className="trajectory-v2-role-card"
      aria-pressed={props.selected}
      onClick={() => {
        props.onSelect();
      }}
    >
      <strong>{role.title}</strong>
      <span className="trajectory-v2-role-state">{roleStateLabel(role.state)}</span>
      {props.primary && <span className="trajectory-v2-role-badge">{PRIMARY_LABEL}</span>}
      {role.attempt_number !== null && (
        <span>попытка {role.attempt_number}</span>
      )}
      {role.attempt_number !== null && (
        <small>
          этапы: {role.completed_milestones} из {role.total_milestones}
        </small>
      )}
      {role.attempt_number === null && <small>этапов в каталоге: {role.total_milestones}</small>}
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
  return (
    <section className="trajectory-v2-stage-detail" data-testid="trajectory-stage-detail" data-stage-key={milestone.key}>
      <header>
        <strong>{milestone.title}</strong>
        <span>{MILESTONE_STATE_LABELS[props.state] ?? props.state}</span>
        {props.onOpenDetails !== undefined && (
          <button
            type="button"
            className="trajectory-v2-stage-details-button"
            onClick={() => {
              props.onOpenDetails?.(milestone.key);
            }}
          >
            Подробнее об этапе
          </button>
        )}
      </header>
      <p>{milestone.purpose}</p>
      <dl>
        <div>
          <dt>Навык</dt>
          <dd>{milestone.skill}</dd>
        </div>
        <div>
          <dt>Цель</dt>
          <dd>
            {milestone.target_kind === "course"
              ? `Курс · ${milestone.target_key}`
              : milestone.target_kind === "task"
                ? `Задача · ${milestone.target_key}`
                : milestone.target_kind}
          </dd>
        </div>
        <div>
          <dt>Позиция</dt>
          <dd>{milestone.position}</dd>
        </div>
      </dl>
      {props.state === "locked" ? (
        <p className="trajectory-v2-stage-note" role="status">
          {nextStep === null
            ? "Этап недоступен: сервер не разрешает переход дальше."
            : `Этап откроется после завершения «${nextStep.title}». Первый разрешённый шаг — «${nextStep.title}».`}
        </p>
      ) : null}
      {props.state === "available" && role.attempt_number === null ? (
        <p className="trajectory-v2-stage-note" role="status">
          Прогресс по этапам появится после выбора траектории; каталог цели указан выше.
        </p>
      ) : null}
      {props.state === "current" && role.attempt_number !== null ? (
        <p className="trajectory-v2-stage-note" role="status">
          Первый разрешённый шаг этой траектории — текущий этап «{milestone.title}».
        </p>
      ) : null}
    </section>
  );
}
