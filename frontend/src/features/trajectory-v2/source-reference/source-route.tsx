import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { apiRequest } from "../../../api/client";
import { StatePanel } from "../../../components/ui";
import { RoleComparePanel, TrajectoryActions } from "../actions";
import {
  loadDevelopmentOverview,
  loadRoadmaps,
  milestoneState,
  overviewQueryKey,
  readPinnedTrack,
  roadmapsQueryKey,
  writePinnedTrack,
} from "../client";
import { RoleInfoDialog, StageTaskDrawer } from "../details";
import { SourceTrajectoryLayout } from "./source-layout";
import { sourceCatalogueRoles } from "./source-catalog";
import { verifiedTasksForStage, type ParticipantWorkItem } from "./source-work";

import type { DevelopmentOverviewView } from "../client";
import "../trajectory-v2.scss";

/** Route-ready adapter. Switch from the legacy body only after the integration
 * lane is free and screenshot approval has been completed. */
export function SourceTrajectoryPage() {
  const overview = useQuery({ queryKey: overviewQueryKey, queryFn: loadDevelopmentOverview });
  if (overview.isPending) return <div className="trajectory-v2"><StatePanel kind="loading" /></div>;
  if (overview.isError) return <section role="status" className="trajectory-v2-failure">
    <p>Не удалось загрузить траекторию</p>
    <button type="button" onClick={() => { void overview.refetch(); }}>Повторить</button>
  </section>;
  return <SourceTrajectoryBody overview={overview.data} />;
}

export function SourceTrajectoryBody({ overview }: { overview: DevelopmentOverviewView }) {
  const roadmaps = useQuery({ queryKey: roadmapsQueryKey, queryFn: loadRoadmaps });
  const passport = useQuery({
    queryKey: ["talent-passport"],
    queryFn: () => apiRequest<{
      verified_courses: string[];
      skills: { key: string; confirmed_case_count: number; practical_level: string }[];
      cases: { contribution_id: string; submitted_at: string; reviewer_id: string }[];
    }>("/api/v1/me/talent-passport"),
  });
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiRequest<{ navigation: string[] }>("/api/v1/me") });
  const work = useQuery({ queryKey: ["participant-work"], queryFn: () => apiRequest<ParticipantWorkItem[]>("/api/v1/me/work") });
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [roleInfoOpen, setRoleInfoOpen] = useState(false);
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [drawerKey, setDrawerKey] = useState<string | null>(null);
  const [compareTarget, setCompareTarget] = useState<string | null>(null);
  const [pinned, setPinned] = useState(() => readPinnedTrack());
  const [hiddenUnselected, setHiddenUnselected] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);

  const catalogueRoles = useMemo(() => sourceCatalogueRoles(overview.roles), [overview.roles]);

  const selectedKey = useMemo(() => {
    const requested = params.get("role");
    if (catalogueRoles.some(role => role.track_key === requested)) return requested;
    const primary = overview.next_outcome?.trajectory_key;
    return catalogueRoles.find(role => role.track_key === primary)?.track_key ?? catalogueRoles[0]?.track_key ?? null;
  }, [catalogueRoles, overview.next_outcome, params]);

  const role = catalogueRoles.find(item => item.track_key === selectedKey) ?? null;
  const roadmap = roadmaps.data?.find(item => item.track_key === selectedKey) ?? null;
  const selectedStageKey = params.get("stage");
  const stageForWork = roadmap?.milestones.find(item => item.key === selectedStageKey) ?? roadmap?.next_step ?? roadmap?.milestones[0] ?? null;
  const authorizedTasks = verifiedTasksForStage(stageForWork, work.data);
  const visibleRoles = catalogueRoles.filter(item => !hiddenUnselected || item.state !== "unselected" || item.track_key === selectedKey);
  const drawerMilestone = roadmap?.milestones.find(item => item.key === drawerKey) ?? null;

  const updateSelection = (update: { role?: string; stage?: string }) => {
    const next = new URLSearchParams(params);
    if (update.role !== undefined) {
      next.set("role", update.role);
      next.delete("stage");
      setDrawerKey(null);
      setCompareTarget(null);
    }
    if (update.stage !== undefined) next.set("stage", update.stage);
    setParams(next);
  };
  const markTrigger = () => {
    lastTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };
  const showRoleInfo = () => {
    markTrigger();
    setRoleInfoOpen(true);
  };
  const openStage = (key: string) => {
    markTrigger();
    setDrawerKey(key);
  };
  const openNext = () => {
    const outcome = overview.next_outcome;
    if (outcome === null) return;
    updateSelection({ role: outcome.trajectory_key, stage: outcome.milestone_key });
    if (roadmap?.track_key === outcome.trajectory_key && roadmap.milestones.some(item => item.key === outcome.milestone_key)) openStage(outcome.milestone_key);
  };
  const openPassport = () => {
    const index = me.data?.navigation.indexOf("Портфолио") ?? -1;
    if (index < 0) {
      setFeedback("Переход в портфолио недоступен для этой роли");
      return;
    }
    void navigate(`/workspace/${String(index)}`);
  };
  const togglePin = () => {
    if (role === null) return;
    const next = pinned === role.track_key ? null : role.track_key;
    setPinned(next);
    writePinnedTrack(next);
    setFeedback(next ? "Роль закреплена в этом браузере" : "Роль откреплена");
  };
  const otherRoles = catalogueRoles.filter(item => item.track_key !== role?.track_key);
  const actions = role ? <TrajectoryActions
    role={role}
    pinned={pinned === role.track_key}
    hiddenUnselected={hiddenUnselected}
    otherRoles={otherRoles}
    compareTarget={compareTarget}
    feedback={feedback}
    compare={(key) => { setCompareTarget(key); }}
    internalShare={() => {
      setFeedback("Внутренний обмен пока не подключён: публичная ссылка запрещена политикой доступа");
    }}
    togglePin={togglePin}
    toggleHiddenUnselected={() => { setHiddenUnselected(current => !current); }}
    configurePath={() => {
      setFeedback("Настройка пути доступна только через утверждённую серверную политику");
    }}
    clearFeedback={() => { setFeedback(null); }}
  /> : null;

  return <div className="trajectory-v2" data-reference="R-PAR-02" data-as-of={overview.as_of}>
    <SourceTrajectoryLayout
      roles={visibleRoles}
      selectedRoleKey={selectedKey}
      primaryRoleKey={overview.next_outcome?.trajectory_key ?? null}
      roadmap={roadmap}
      selectedStageKey={selectedStageKey}
      grade={overview.concepts.career_grade}
      nextOutcome={overview.next_outcome}
      competencies={passport.data?.skills ?? []}
      stageTasks={authorizedTasks && authorizedTasks.length > 0 ? authorizedTasks : undefined}
      onSelectRole={(key) => { updateSelection({ role: key }); }}
      onSelectStage={(key) => { updateSelection({ stage: key }); }}
      onOpenRole={showRoleInfo}
      onOpenActions={() => { setFeedback("Меню действий недоступно"); }}
      roleActions={actions}
      onOpenGrades={() => { markTrigger(); setGradeDialogOpen(true); }}
      onOpenTask={openStage}
      onOpenNext={openNext}
      onOpenPassport={openPassport}
    />
    {roadmaps.isError && <p role="status">Не удалось загрузить дорожные карты — {String(roadmaps.error)}</p>}
    {passport.isError && <p role="status">Не удалось получить подтверждённые компетенции</p>}
    {work.isError && <p role="status">История назначений сейчас недоступна — показана только цель этапа</p>}
    {feedback !== null && <p role="status" className="trajectory-v2-action-status">{feedback}</p>}
    {compareTarget && role && <RoleComparePanel
      roles={catalogueRoles} roadmaps={roadmaps.data ?? []}
      trackA={role.track_key} trackB={compareTarget}
      onClose={() => { setCompareTarget(null); }}
    />}
    {roleInfoOpen && role && <RoleInfoDialog
      role={role} roadmap={roadmap}
      primary={role.track_key === overview.next_outcome?.trajectory_key}
      onClose={() => { setRoleInfoOpen(false); }}
      triggerRef={lastTrigger}
    />}
    {role && roadmap && drawerMilestone && <StageTaskDrawer
      key={drawerMilestone.key}
      milestone={drawerMilestone}
      state={milestoneState(drawerMilestone, roadmap.next_step)}
      policyVersion={roadmap.policy_version}
      role={role}
      onClose={() => { setDrawerKey(null); }}
      triggerRef={lastTrigger}
    />}
    {gradeDialogOpen && <SourceGradePolicyDialog
      grade={overview.concepts.career_grade}
      onClose={() => { setGradeDialogOpen(false); lastTrigger.current?.focus(); }}
    />}
  </div>;
}

function SourceGradePolicyDialog({ grade, onClose }: {
  grade: DevelopmentOverviewView["concepts"]["career_grade"];
  onClose: () => void;
}) {
  // Grade catalog remains unavailable unless server publishes it.
  // No invented 1..6 array; use established server projection only.
  return <div className="trajectory-v2-overlay" onClick={onClose}>
    <section className="trajectory-v2-grades-dialog" role="dialog" aria-modal="true" aria-label="Все уровни" onClick={(event) => { event.stopPropagation(); }} onKeyDown={(event) => {
      if (event.key === "Escape") onClose();
    }}>
      <header><h2>Все уровни</h2><button type="button" aria-label="Закрыть" onClick={onClose}>×</button></header>
      <p>Грейд определяется действующей версией политики и подтверждёнными результатами</p>
      <div className="trajectory-v2-grades-list" role="status">
        <p>Полный каталог уровней и требования к ним ещё не опубликованы</p>
        {grade.current_grade !== null && <p><strong>Текущий грейд:</strong> {grade.current_grade}</p>}
        {grade.target_grade !== null && <p><strong>Целевой грейд:</strong> {grade.target_grade}</p>}
      </div>
      <small>Версия политики: {String(grade.policy_version)}</small>
    </section>
  </div>;
}
