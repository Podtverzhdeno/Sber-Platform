import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { StatePanel } from "../../components/ui";
import { apiRequest } from "../../api/client";
import { trajectoryStudyProgress } from "./study-progress";
import { projectLearningStages, visitScope, stageWasOpened, markStageOpened } from "./stage-flow";
import {
  loadDevelopmentOverview,
  loadRoadmaps,
  overviewQueryKey,
  roadmapsQueryKey,
  PRIMARY_LABEL,
  MILESTONE_STATE_LABELS,
  readPinnedTrack,
  writePinnedTrack,
} from "./client";
import { RoleComparePanel, TrajectoryActions } from "./actions";
import { LearningProgressPanel } from "../learning-progress-panel";
import { learningSummaryQueryKey, loadLearningSummary, type LearningCourse } from "../learning-progress";
import { RoleInfoDialog, StageTaskDrawer } from "./details";
import { canonicalAiRoles } from "./source-reference/source-catalog";
import { primaryTrajectoryKey, roleVisualTone } from "./role-state";
import { levelCoursesProgress, loadRoleLevel, roleLevelQueryKey, type ImpulseRoleLevel } from "../impulse-role-level";
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
  const learning = useQuery({ queryKey: learningSummaryQueryKey, queryFn: loadLearningSummary });
  const [searchParams, setSearchParams] = useSearchParams();
  const roadmaps = useQuery({
    queryKey: roadmapsQueryKey,
    queryFn: loadRoadmaps,
  });
  const roadmapCatalog = useQuery({
    queryKey: ["trajectory-roadmap-catalog"],
    queryFn: () => apiRequest<RoadmapView[]>("/api/v1/me/roadmap-catalog"),
    retry: false,
  });
  const passport = useQuery({
    queryKey: ["talent-passport"],
    queryFn: () => apiRequest<{ verified_courses: string[]; skills: { key: string; practical_level: string; confirmed_case_count: number }[]; cases: { contribution_id: string; submitted_at: string; reviewer_id: string }[] }>("/api/v1/me/talent-passport"),
  });
  const portfolio = useQuery({
    queryKey: ["portfolio", "me", "trajectory-summary"],
    queryFn: () => apiRequest<{
      demo_data: boolean;
      courses: { key: string; title: string; status: string }[];
      contributions: { contribution_id: string; project_title: string; grade: string | null; verification_status: string }[];
    }>("/api/v1/me/portfolio"),
    retry: false,
  });
  const navigation = useQuery({
    queryKey: ["me"],
    queryFn: () => apiRequest<{ navigation: string[]; person_id?: string }>("/api/v1/me"),
  });
  const goToPortfolio = () => {
    const idx = (navigation.data?.navigation ?? []).indexOf("Портфолио");
    if (idx >= 0) window.location.assign(`/workspace/${String(idx)}`);
  };
  // All cards come from the authorized server catalog; never invent
  // frontend-only roles or progress for unselected tracks.
  const catalogueRoles = useMemo(() => canonicalAiRoles(overview.roles), [overview]);
  const roleParam = searchParams.get("role");
  const selectedKey = useMemo(() => {
    const paramRole = catalogueRoles.find((role) => role.track_key === roleParam);
    if (paramRole) return paramRole.track_key;
    // Prefer the enrolled primary role. Catalogue order and stale next-outcome
    // hints must not select an unrelated role whose level API is unavailable.
    return primaryTrajectoryKey(overview)
      ?? (catalogueRoles[0]?.track_key ?? null);
  }, [catalogueRoles, overview, roleParam]);
  const selected = catalogueRoles.find((role) => role.track_key === selectedKey) ?? null;
  const learningLevel = useQuery({
    queryKey:roleLevelQueryKey(selectedKey),
    queryFn:()=>loadRoleLevel(selectedKey ?? ""),
    enabled:selectedKey!==null,retry:false,
  });
  const roleLevel=learningLevel.data?.track_key===selectedKey ? learningLevel.data : null;
  const nextCycleUnpublished=roleLevel!==null && roleLevel.level>0 && roleLevel.level<3 && roleLevel.curriculum_state==="unpublished";

  const passportSkills = Array.isArray(passport.data?.skills) ? passport.data.skills : [];
  const completedMilestones = overview.roles.reduce((sum, role) => sum + role.completed_milestones, 0);
  const activeTrajectories = overview.roles.filter((role) => role.state === "active").length;
  const verifiedCourses = Array.isArray(portfolio.data?.courses) ? portfolio.data.courses : [];
  const acceptedContributions = Array.isArray(portfolio.data?.contributions)
    ? portfolio.data.contributions.filter((item) => item.verification_status === "verified")
    : [];

  const primaryKey = primaryTrajectoryKey(overview);
  const selectedRoadmap =
    selected !== null
      ? (roadmapCatalog.data?.find((item) => item.track_key === selected.track_key)
        ?? roadmaps.data?.find((item) => item.track_key === selected.track_key)
        ?? null)
      : null;
  // Keep the next-step card aligned with the course-certificate-driven learning path.
  // This changes navigation only, not independently verified professional milestones.
  const currentLearningPath = selected && selectedRoadmap && selected.attempt_number !== null
    ? projectLearningStages(selectedRoadmap, learning.data?.courses, true) : null;
  const hasCertifiedCourse = (currentLearningPath?.studied.studiedKeys.size ?? 0) > 0;
  const nextOutcomeForPanel = hasCertifiedCourse
    ? currentLearningPath?.next && selected
      ? { trajectory_key:selected.track_key, trajectory_title:selected.title,
          milestone_key:currentLearningPath.next.key, target_title:currentLearningPath.next.title,
          target_kind:currentLearningPath.next.target_kind, stale_reason:null }
      : null
    : overview.next_outcome;
  const lastOverlayTriggerRef = useRef<HTMLElement | null>(null);
  const [roleInfoOpen, setRoleInfoOpen] = useState(false);
  const [drawerKey, setDrawerKey] = useState<string | null>(null);
  const [pinnedTrack, setPinnedTrack] = useState<string | null>(() => readPinnedTrack());
  const [hiddenUnselected, setHiddenUnselected] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [compareTarget, setCompareTarget] = useState<string | null>(null);
  const [, refreshVisited] = useState(0);
  const openedScope = navigation.data?.person_id && selected && selectedRoadmap
    ? visitScope(navigation.data.person_id, selected.track_key, selected.attempt_number, selectedRoadmap.policy_version) : null;
  const markVisited = (key: string) => {
    if (openedScope === null) return;
    markStageOpened(openedScope,key);
    refreshVisited((value) => value+1);
  };
  const isUnopened = (key: string): boolean => openedScope !== null && !stageWasOpened(openedScope,key);
  const [gradesOpen, setGradesOpen] = useState(false);
  const gradeDialogRef = useRef<HTMLElement | null>(null);
  const gradeTriggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!gradesOpen) return;
    gradeDialogRef.current?.focus();
    return () => { gradeTriggerRef.current?.focus(); };
  }, [gradesOpen]);
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
    markVisited(stageKey);
    setDrawerKey(stageKey);
  };
  const closeOverlays = () => {
    setRoleInfoOpen(false);
    setDrawerKey(null);
  };
  const drawerMilestone = selectedRoadmap?.milestones.find((m) => m.key === drawerKey);
  const visibleRoles = useMemo(() => {
    const filtered = catalogueRoles.filter(
      (role) =>
        !hiddenUnselected || role.track_key === selectedKey || role.state !== "unselected",
    );
    if (pinnedTrack === null) return filtered;
    return [...filtered].sort(
      (left, right) =>
        Number(right.track_key === pinnedTrack) - Number(left.track_key === pinnedTrack),
    );
  }, [catalogueRoles, hiddenUnselected, selectedKey, pinnedTrack]);
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
        <div className="trajectory-v2-hero-graphic" aria-hidden="true"><span>⚑</span></div>
      </header>
      <div className="trajectory-v2-columns">
        <nav className="trajectory-v2-roles" aria-label="Роли">
          <ul>
            {visibleRoles.map((role) => (
              <li key={role.track_key}>
                <RoleCardOverview
                  role={role}
                  studiedSteps={role.track_key===selectedKey && selectedRoadmap && role.attempt_number!==null
                    ? projectLearningStages(selectedRoadmap,learning.data?.courses,true).completed.size : null}
                  courseProgress={role.track_key===selectedKey && roleLevel?.curriculum_state==="published" ? `${String(roleLevel.completed_courses)} из ${String(roleLevel.required_courses)} курсов` : null}
                  nextCycle={role.track_key===selectedKey && roleLevel?.curriculum_state==="unpublished" && roleLevel.level>0 ? `L${String(roleLevel.level)} · цикл ${String(roleLevel.cycle_number)}` : null}
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
              roadmap={selectedRoadmap}
              learningCourses={learning.data?.courses}
              nextCycleUnpublished={nextCycleUnpublished}
              levelData={roleLevel}
              roadmapPending={roadmapCatalog.isPending && roadmaps.isPending}
              roadmapError={roadmapCatalog.isError && roadmaps.isError}
              roadmapRetry={() => {
                void roadmaps.refetch();
                void roadmapCatalog.refetch();
              }}
              stageKey={searchParams.get("stage")}
              isUnopened={isUnopened}
              markVisited={markVisited}
              onStageSelect={(stageKey) => {
                markVisited(stageKey);
                const next = new URLSearchParams(searchParams);
                next.set("stage", stageKey);
                setSearchParams(next);
              }}
              onOpenRoleInfo={openRoleInfo}
              onOpenStageDetails={openStageDetails}
              pinned={pinnedTrack === selected.track_key}
              hiddenUnselected={hiddenUnselected}
              otherRoles={catalogueRoles.filter((item) => item.track_key !== selected.track_key)}
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
          <header><h3>Уровень Impulse</h3><button type="button" className="trajectory-v2-all-grades-link" onClick={() => { gradeTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setGradesOpen(true); }}>Все уровни →</button></header>
          <div className="trajectory-v2-grade-body">
            <div className="trajectory-v2-grade-ring" style={{background:`conic-gradient(#0de5d6 0 ${String(roleLevel ? levelCoursesProgress(roleLevel) : 0)}%, #204a68 ${String(roleLevel ? levelCoursesProgress(roleLevel) : 0)}% 100%)`}}>
              <strong data-testid="trajectory-impulse-level">{roleLevel ? `L${String(roleLevel.level)}` : learningLevel.isPending ? "…" : "—"}</strong>
              <small>{roleLevel ? `Цикл ${String(roleLevel.cycle_number)}` : "Загрузка"}</small>
            </div>
            <div className="trajectory-v2-grade-progress">
              <small>{roleLevel?.level === 3 ? "Программа L3 освоена" : roleLevel ? `До уровня L${String(roleLevel.level+1)}` : "Учебные уровни Impulse"}</small>
              <strong>{roleLevel?.curriculum_state==="published"
                ? `${String(roleLevel.completed_courses)} из ${String(roleLevel.required_courses)} курсов`
                : roleLevel?.level === 3 ? "L3 достигнут" : roleLevel ? "Новый цикл" : "Данных нет"}</strong>
              <progress max={100} value={roleLevel?.level === 3 ? 100 : roleLevel ? levelCoursesProgress(roleLevel) : 0} aria-label="Освоение курсов текущего цикла"/>
              <small>{roleLevel?.curriculum_state==="published"
                ? `Практика учтена: ${String(roleLevel.credited_practices)} из ${String(roleLevel.required_practices)}`
                : roleLevel?.level === 3 ? "Три учебных цикла сохранены" : roleLevel ? "Программа цикла недоступна" : "Проверяем сохранённый уровень"}</small>
            </div>
          </div>
          {learningLevel.isError && selected?.attempt_number !== null && <p role="alert" className="trajectory-v2-level-error">Не удалось загрузить уровень Impulse. <button type="button" onClick={() => { void learningLevel.refetch(); }}>Повторить</button></p>}
          <div className="trajectory-v2-grade-callout"><span aria-hidden="true" className="trajectory-v2-grade-callout-icon">⌁</span>
            <span>{roleLevel?.advance_ready
              ? "Обязательные курсы завершены, практическая работа отправлена и учтена. Нажми «Следующий этап» в Bootcamp для сохранения нового уровня."
              : roleLevel?.level === 3 ? "Максимальный учебный уровень L3 достигнут. Проверенные результаты сохранены."
                : nextCycleUnpublished
                ? "Уровень сохранён. Новая программа временно недоступна."
                : "Завершай курсы и передавай практические работы на проверку. Это уровень Impulse, не карьерный грейд Сбера."}</span>
          </div>
        </section>
        <section className="trajectory-v2-next-panel">
          {nextCycleUnpublished ? <div className="trajectory-v2-next-task" role="status">
            <div className="trajectory-v2-next-task-description">
              <strong>Следующий цикл ожидает новую программу</strong>
              <small>Старые этапы и курсы сохранены в истории и не засчитываются повторно.</small>
            </div>
          </div> : <>
          <header>
            <h3>Следующий шаг</h3>
            <span>{nextOutcomeForPanel?.trajectory_title ?? "Маршрут"}</span>
          </header>
          <div className="trajectory-v2-next-task">
            <span className="trajectory-v2-next-task-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M5 2h10l4 4v16H5zM15 2v5h4M9 11h6M9 15h6M9 19h4"/></svg>
            </span>
            <div className="trajectory-v2-next-task-description">
              <strong>{nextOutcomeForPanel?.target_title ?? "Следующий шаг пока не назначен"}</strong>
              <small>{nextOutcomeForPanel?.target_kind === "task" ? "Практическая задача" : nextOutcomeForPanel?.target_kind === "course" ? "Обучение" : "Маршрут"}
                {nextOutcomeForPanel?.stale_reason ? ` · ${nextOutcomeForPanel.stale_reason}` : ""}</small>
            </div>
            {nextOutcomeForPanel !== null && <button type="button" aria-label="Посмотреть следующий шаг" onClick={() => {
              const outcome = nextOutcomeForPanel;
              snapshotTrigger();
              if (outcome.trajectory_key !== selectedKey) {
                const nextParams = new URLSearchParams(searchParams);
                nextParams.set("role", outcome.trajectory_key);
                nextParams.set("stage", outcome.milestone_key);
                setSearchParams(nextParams);
              }
              setRoleInfoOpen(false);
              markVisited(outcome.milestone_key);
              setDrawerKey(outcome.milestone_key);
            }}>→</button>}
          </div>
          </>}
        </section>
        <LearningProgressPanel compact bootcampIndex={Math.max(0, (navigation.data?.navigation ?? []).indexOf("Bootcamp"))} />
        <section className="trajectory-v2-passport-panel">
          <header>
            <h3>Мой скилл-паспорт</h3>
            {(navigation.data?.navigation ?? []).includes("Портфолио") && (
              <button type="button" onClick={goToPortfolio}>Открыть →</button>
            )}
          </header>
          {passport.isPending && <p role="status">Загружаем подтверждённые навыки…</p>}
          {passport.isError && <p role="status">Не удалось загрузить скилл-паспорт.</p>}
          {!passport.isPending && !passport.isError && passportSkills.length === 0 && <p>Подтверждённые навыки появятся после проверки личного вклада в проект.</p>}
          {passportSkills.length > 0 && (
            <ul className="trajectory-v2-skill-list">
              {passportSkills.slice(0, 4).map((skill, index) => {
                const maxCount = Math.max(1, ...passportSkills.map((entry) => entry.confirmed_case_count));
                return (
                  <li key={skill.key}>
                    <span className="trajectory-v2-skill-icon" data-tone={index % 4}>{["▤", "✧", "▣", "⌁"][index % 4]}</span>
                    <strong>{skill.key}</strong>
                    <progress max={maxCount} value={skill.confirmed_case_count} aria-label={`${skill.key}: подтверждено кейсов ${String(skill.confirmed_case_count)}`}/>
                    <small>{skill.confirmed_case_count} кейс.</small>
                  </li>
                );
              })}
            </ul>
          )}
          <small className="trajectory-v2-passport-disclaimer">Полоса отражает число подтверждённых кейсов относительно других навыков, не оценку уровня компетенции.</small>
          <details className="trajectory-v2-statistics" data-testid="trajectory-user-statistics">
            <summary>Полная статистика участника</summary>
            {portfolio.isPending && <p role="status">Загружаем данные портфолио…</p>}
            {portfolio.isError && <p role="status">Портфолио временно недоступно. Прогресс ролей показан отдельно.</p>}
            {portfolio.data?.demo_data === true && <p className="trajectory-v2-stats-origin">Демонстрационные данные · не реальные достижения</p>}
            <dl className="trajectory-v2-statistics-grid">
              <div><dt>Активных траекторий</dt><dd>{activeTrajectories}</dd></div>
              <div><dt>Пройдено этапов</dt><dd>{completedMilestones}</dd></div>
              <div><dt>Курсов подтверждено</dt><dd>{verifiedCourses.length}</dd></div>
              <div><dt>Проектов принято</dt><dd>{acceptedContributions.length}</dd></div>
              <div><dt>Навыков с кейсами</dt><dd>{passportSkills.length}</dd></div>
              <div><dt>Активных задач</dt><dd>{Array.isArray(overview.active_tasks) ? overview.active_tasks.length : 0}</dd></div>
            </dl>
            {verifiedCourses.length > 0 && (
              <div className="trajectory-v2-statistics-section">
                <strong>Подтверждённые курсы</strong>
                <ul>{verifiedCourses.slice(0, 8).map((course) => <li key={course.key}>{course.title}</li>)}</ul>
              </div>
            )}
            {acceptedContributions.length > 0 && (
              <div className="trajectory-v2-statistics-section">
                <strong>Проверенные проекты</strong>
                <ul>{acceptedContributions.slice(0, 5).map((item) => (
                  <li key={item.contribution_id}>{item.project_title}{item.grade ? ` · оценка ${item.grade}` : ""}</li>
                ))}</ul>
              </div>
            )}
            <p className="trajectory-v2-stats-caveat">Карьерный грейд, рейтинг и подтверждённый уровень компетенций рассчитываются раздельно, по своим опубликованным правилам.</p>
          </details>
        </section>
      </aside>
      </div>
      {gradesOpen && (
        <div className="trajectory-v2-overlay" onClick={() => { setGradesOpen(false); }}>
          <section
            ref={gradeDialogRef}
            className="trajectory-v2-grades-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Все уровни"
            tabIndex={-1}
            onClick={(event) => { event.stopPropagation(); }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setGradesOpen(false);
              } else if (event.key === "Tab") {
                const nodes = gradeDialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]),a[href],[tabindex]:not([tabindex='-1'])");
                if (!nodes || nodes.length === 0) return;
                const first = nodes[0], last = nodes[nodes.length - 1];
                if (!first || !last) return;
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <header className="trajectory-v2-grades-heading">
              <div className="trajectory-v2-grades-symbol" aria-hidden="true">▥</div>
              <div>
                <h2>Уровни Impulse · {selected?.title ?? "Моя роль"}</h2>
                <p>Учебные уровни и карьерные грейды Сбера — разные системы.</p>
              </div>
              <button type="button" aria-label="Закрыть" onClick={() => { setGradesOpen(false); }}>✕</button>
            </header>
            <div className="trajectory-v2-grades-layout">
              <nav className="trajectory-v2-grades-list" aria-label="Учебные циклы">
                {(["Фундамент и практика", "Архитектура и оценка агентов", "Эксплуатация и оркестрация", "Программа освоена"] as const).map((label,index)=><div className="trajectory-v2-grade-option" key={label} data-attained={roleLevel !== null && roleLevel.level >= index}>
                  <span className="trajectory-v2-grade-dot">L{index}</span>
                  <span><strong>{label}</strong><small>{roleLevel === null ? "Загрузка" : roleLevel.level === index ? "Текущий уровень" : roleLevel.level > index ? "Получен" : "Впереди"}</small></span>
                </div>)}
              </nav>
              <div className="trajectory-v2-grade-explanation">
                <div className="trajectory-v2-grade-explanation-head">
                  <div><h3>{roleLevel ? `L${String(roleLevel.level)}` : "Уровень загружается"}</h3>
                    <span>Текущий цикл: {roleLevel?.cycle_number ?? "—"}</span>
                  </div>
                </div>
                <p>Для повышения уровня Impulse пройдите обязательные курсы и отправьте практику. Она учитывается сразу; независимый сертификат выдаётся отдельно после проверки.</p>
                {roleLevel && <div className="trajectory-v2-grade-expectations">
                  <h4>Прогресс текущего цикла</h4>
                  <p>Курсы: {roleLevel.completed_courses} из {roleLevel.required_courses}</p>
                  <p>Зачтённая практика: {roleLevel.credited_practices} из {roleLevel.required_practices}</p>
                  {roleLevel.level === 3 && <p>L3 — максимальный уровень опубликованной программы.</p>}
                </div>}
                <div className="trajectory-v2-grade-next-note">Переход подтверждает сервер. Просмотр этой страницы не повышает уровень.</div>
              </div>
            </div>
          </section>
        </div>
      )}
      {roleInfoOpen && selected !== null ? (
        <RoleInfoDialog
          role={selected}
          primary={selected.track_key === primaryKey}
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
          state={projectLearningStages(selectedRoadmap, learning.data?.courses, selected.attempt_number !== null).stateOf(drawerMilestone)}
          role={selected}
          policyVersion={selectedRoadmap.policy_version}
          onClose={closeOverlays}
          triggerRef={lastOverlayTriggerRef}
        />
      ) : null}
    </div>
  );
}

function formatAsOf(asOf: string): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(asOf),
  );
}

export function RoleCardOverview(props: {
  role: RoleCardView;
  courseProgress?: string | null;
  studiedSteps?: number | null;
  nextCycle?: string | null;
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
      data-role-state={role.state}
      data-primary={props.primary}
      data-tone={roleVisualTone(role, props.primary)}
      title={roleVisualTone(role, props.primary) === "primary"
        ? "Основная траектория"
        : roleVisualTone(role, props.primary) === "learning"
          ? "Дополнительная траектория для изучения"
          : "Направление ещё не выбрано"}
      aria-pressed={props.selected}
      onClick={() => {
        props.onSelect();
      }}
    >
      <span className="trajectory-v2-role-icon" aria-hidden="true" data-glyph={
        role.track_key === "product" ? "product" :
        role.track_key === "ml" ? "ml" :
        role.track_key === "python" ? "security" :
        role.track_key === "backend" ? "backend" :
        role.track_key === "design" ? "agent" :
        role.track_key === "manager" ? "manager" : "data"
      }>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          {role.track_key === "product" || role.track_key === "data" ? (
            <path d="M4 20V13m6 7V8m6 12V4m5 16v-10" strokeWidth="3"/>
          ) : role.track_key === "ml" ? (
            <path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10"/>
          ) : role.track_key === "python" ? (
            <path d="m8 5-6 7 6 7m8-14 6 7-6 7m-3-16-2 18"/>
          ) : role.track_key === "backend" ? (
            <path d="M5 2h10l4 4v16H5zM15 2v5h4M9 11h6M9 15h6M9 19h4"/>
          ) : role.track_key === "design" ? (
            <path d="m12 2 2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3z"/>
          ) : (
            <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M9 7V4h6v3m-12 6h18m-11 0v2h4v-2"/></>
          )}
        </svg>
      </span>
      {props.primary && <span className="trajectory-v2-primary-check" aria-label="Основная роль">✓</span>}
      <strong>{role.title}</strong>
      {props.nextCycle ? <small>{props.nextCycle} · ожидает новые этапы</small> : role.attempt_number !== null ? (
        <>
          <progress max={Math.max(1,role.total_milestones)} value={Math.min(role.total_milestones,props.studiedSteps ?? role.completed_milestones)} aria-label="Прогресс учебных шагов роли" />
          <small>{props.studiedSteps !== null && props.studiedSteps !== undefined
            ? `${String(props.studiedSteps)} из ${String(role.total_milestones)} шагов освоено · ${String(role.completed_milestones)} подтверждено`
            : `${String(role.completed_milestones)} из ${String(role.total_milestones)} этапов подтверждено`}
            {role.state === "paused" ? " · пауза" : ""}{props.courseProgress ? ` · ${props.courseProgress}` : ""}</small>
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
  learningCourses?: LearningCourse[];
  nextCycleUnpublished?: boolean;
  levelData?: ImpulseRoleLevel | null;
  roadmapPending: boolean;
  roadmapError: boolean;
  roadmapRetry: () => void;
  stageKey: string | null;
  onStageSelect: (stageKey: string) => void;
  isUnopened?: (key: string) => boolean;
  markVisited?: (key: string) => void;
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
    <div className="trajectory-v2-role-stack">
    <article
      className="trajectory-v2-role-detail"
      data-testid="trajectory-role-detail"
      data-role-key={role.track_key}
      data-tone={roleVisualTone(role, props.primary)}
    >
      <header className="trajectory-v2-detail-heading">
        <div className="trajectory-v2-detail-identity">
          <span className="trajectory-v2-detail-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M4 20V13m6 7V8m6 12V4m5 16v-10"/></svg></span>
          <div>
            <div className="trajectory-v2-detail-title">
              <h3>{role.title}</h3>
              {props.primary && <span className="trajectory-v2-role-badge">{PRIMARY_LABEL}</span>}
            </div>
            <p>{role.attempt_number === null
                ? "Познакомься с профессией и выбери направление развития."
                : "Обучение и практические шаги"}</p>
          </div>
        </div>
        <div className="trajectory-v2-detail-controls">
          <button type="button" className="trajectory-v2-role-info-button" onClick={props.onOpenRoleInfo}>О роли →</button>
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
        </div>
      </header>
      {role.attempt_number === null && (
        <p className="trajectory-v2-unselected-note" role="status">
          Это направление пока не выбрано. Персональный прогресс отсутствует; этапы появятся после подключения роли.
        </p>
      )}
      {props.levelData && props.levelData.level >= 1 ? <CycleLearningPath level={props.levelData} learningCourses={props.learningCourses ?? []} roleKey={role.track_key} isUnopened={props.isUnopened} markVisited={props.markVisited} /> :
      props.nextCycleUnpublished ? <div className="trajectory-v2-next-cycle" role="status" data-testid="trajectory-next-cycle">
        <h4>Новый виток развития</h4>
        <p>Уровень Impulse повышен и сохранён. Новая программа курсов и практических задач для следующего цикла пока не опубликована.
          После публикации здесь появится новая последовательность этапов; старые сертификаты не засчитываются повторно.</p>
      </div> : <StagePathSection
        role={role}
        roadmap={props.roadmap}
        learningCourses={props.learningCourses}
        pending={props.roadmapPending}
        error={props.roadmapError}
        retry={props.roadmapRetry}
        stageKey={props.stageKey}
        onStageSelect={props.onStageSelect}
        onOpenDetails={props.onOpenStageDetails}
        isUnopened={props.isUnopened}
        showDetails={false}
      />}
    </article>
    {!props.nextCycleUnpublished && !(props.levelData && props.levelData.level >= 1) && <SelectedStageCard role={role} roadmap={props.roadmap} learningCourses={props.learningCourses} stageKey={props.stageKey} onOpenDetails={props.onOpenStageDetails}/>}
    </div>
  );
}

/** One fresh course+review cycle per saved Impulse level. This is not a
 * fabricated professional-grade trajectory checkpoint. */
function CycleLearningPath(props: { level: ImpulseRoleLevel; learningCourses: LearningCourse[]; roleKey: string; isUnopened?: (key:string)=>boolean; markVisited?: (key:string)=>void }) {
  const {level, roleKey} = props;
  const finished = level.level >= (level.max_level ?? 3);
  const subjectNames: Record<number, string> = {
    13: "Архитектура AI-сервисов и контракты",
    14: "Оценка и качество AI-агентов",
    15: "Безопасность и эксплуатация AI-систем",
    16: "Мультиагентная оркестрация и надёжность",
  };
  const keys = level.required_course_keys ?? [];
  return <section className="trajectory-v2-cycle-path" data-testid="trajectory-cycle-path" aria-label="Текущий учебный цикл">
    <header><div><small>Цикл {level.cycle_number}</small><h3>{finished ? "L3 · Программа завершена" : `Развитие L${String(level.level)} → L${String(level.level + 1)}`}</h3></div>
      <span>{finished ? "Все уровни пройдены" : `${String(level.completed_courses)} из ${String(level.required_courses)} курсов`}</span></header>
    {finished ? <p>Три учебных цикла завершены. Полученные сертификаты и проверенные практические результаты сохранены в истории Impulse.</p> : <>
      <p>Новый виток: заверши курсы и отправь практическую работу. Она сразу засчитывается для уровня Impulse; затем нажми «Следующий этап» в Bootcamp.</p>
      <div className="trajectory-v2-cycle-courses">{keys.map((key,index)=>{
        const course=props.learningCourses.find(item=>item.course_key===key);
        const number=Number(/^demo-course-(\d+)/.exec(key)?.[1] ?? "0");
        const isDone=course?.finished === true;
        const nextCourse = keys.find(k=>!props.learningCourses.some(c=>c.course_key===k && c.finished && c.certificate_id));
        const visitKey = `cycle:${String(level.cycle_number)}:${key}`;
        const attention = !isDone && nextCourse===key && props.isUnopened?.(visitKey)===true;
        return <div key={key} className="trajectory-v2-cycle-course-entry">
        <Link to={`/workspace/2?role=${encodeURIComponent(roleKey)}&course=${encodeURIComponent(key)}&panel=detail`} className="trajectory-v2-cycle-course" data-attention={attention ? "new" : undefined} onClick={()=>{props.markVisited?.(visitKey);}}> 
          <span className="trajectory-v2-cycle-num">{isDone ? "✓" : String(index+1)}</span>
          <div><strong>{subjectNames[number] ?? course?.title ?? key}</strong><small>{isDone ? "Учебный сертификат сохранён" : course?.completed_units ? `${String(course.completed_units)} из 8 уроков` : "Курс не начат"}</small></div>
          <span>{isDone ? "Пройден" : "Открыть"} →</span>
        </Link>
          {isDone && <Link className="trajectory-v2-cycle-practice-link"
            to={`/workspace/2?role=${encodeURIComponent(roleKey)}&course=${encodeURIComponent(key)}&panel=detail&study=practice`}>
            {course.practice_status === "pending" || course.practice_status === "approved"
              ? "Посмотреть зачтённую практику" : "Выбрать практическую задачу"} →
          </Link>}
        </div>;
      })}</div>
      <div className="trajectory-v2-cycle-practice">
        <strong>Практика текущего уровня</strong>
        <span>{level.credited_practices} из {level.required_practices} зачтённых работ</span>
        <p>После отправки работа сразу учитывается для учебного уровня. Отдельный сертификат подтверждения компетенций выдаётся после независимой проверки.</p>
      </div>
      {level.advance_ready && <p role="status" className="trajectory-v2-cycle-ready">Все условия выполнены. Перейди в Bootcamp и нажми «Следующий этап».</p>}
    </>}
    <Link to={`/workspace/2?role=${encodeURIComponent(roleKey)}`} className="trajectory-v2-cycle-link">{finished ? "Посмотреть сертификаты" : "Открыть текущий цикл в Bootcamp"} →</Link>
  </section>;
}

function SelectedStageCard(props: { role: RoleCardView; roadmap: RoadmapView | null; learningCourses?: LearningCourse[]; stageKey: string | null; onOpenDetails: (stageKey: string) => void }) {
  const { roadmap, role } = props;
  if (roadmap === null || roadmap.track_key !== role.track_key) return null;
  const projection = projectLearningStages(roadmap,props.learningCourses,role.attempt_number !== null);
  const currentKey = projection.next?.key ?? roadmap.milestones[0]?.key ?? "";
  const activeKey = isSelectedStage(props.stageKey, roadmap.milestones, currentKey);
  const active = roadmap.milestones.find((milestone) => milestone.key === activeKey);
  if (active === undefined) return null;
  return <StageDetail milestone={active} state={projection.stateOf(active)} nextStep={projection.next} role={role} learningCourses={props.learningCourses} onOpenDetails={props.onOpenDetails}/>;
}

export function StagePathSection(props: {
  role: RoleCardView;
  roadmap: RoadmapView | null;
  learningCourses?: LearningCourse[];
  pending: boolean;
  error: boolean;
  retry: () => void;
  stageKey: string | null;
  onStageSelect: (stageKey: string) => void;
  onOpenDetails: (stageKey: string) => void;
  isUnopened?: (key: string) => boolean;
  showDetails?: boolean;
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
  const projection = projectLearningStages(roadmap,props.learningCourses,role.attempt_number !== null);
  const nextStep = projection.next;
  const currentKey = nextStep?.key ?? roadmapsDefaultKey(roadmap);
  const visibleStageKey = isSelectedStage(props.stageKey, roadmap.milestones, currentKey);
  const visibleMilestone = roadmap.milestones.find((m) => m.key === visibleStageKey);
  const studyProgress=trajectoryStudyProgress(roadmap.milestones,props.learningCourses,role.attempt_number!==null);
  return (
    <section className="trajectory-v2-stage-block" aria-label="Этапы" data-testid="trajectory-stages">
      <header>
        <h4>Путь освоения роли</h4>
      </header>
      <ol className="trajectory-v2-stage-path">
        {roadmap.milestones.map((milestone) => {
          const state = projection.stateOf(milestone);
          const studied = role.attempt_number === null || milestone.target_kind !== "course" ? undefined : props.learningCourses?.find(course => course.course_key === milestone.target_key);
          return (
            <li key={milestone.key}>
              <button
                type="button"
                className="trajectory-v2-stage"
                aria-pressed={milestone.key === visibleStageKey}
                data-stage-state={state}
                data-attention={state==="current" && props.isUnopened?.(milestone.key)===true ? "new" : undefined}
                data-study-state={studyProgress.studiedKeys.has(milestone.key) ? "studied" : studied?.completed_units ? "learning" : "none"}
                title={studied ? `Обучение: ${String(studied.completed_units)} из ${String(studied.total_units)} уроков. ${studied.finished ? "Курс изучен, подтверждение этапа отдельно" : "Обучение в процессе"}` : milestone.title}
                onClick={() => {
                  props.onStageSelect(milestone.key);
                }}
              >
                <span className="trajectory-v2-milestone-node" aria-hidden="true">{state === "completed" ? "✓" : state === "current" ? "◉" : state === "locked" ? "♙" : "♙"}</span>
                <strong className="trajectory-v2-milestone-position">{milestone.position}</strong>
                <span className="trajectory-v2-milestone-title">{milestone.title}</span>
                {studied && studied.completed_units > 0 && <small className="trajectory-v2-stage-study-tag">{studyProgress.studiedKeys.has(milestone.key) ? "✓ Курс пройден" : `${String(Math.round(100*studied.completed_units/Math.max(1,studied.total_units)))}% обучения`}</small>}
              </button>
            </li>
          );
        })}
        {Array.from({ length: Math.max(0, 7 - roadmap.milestones.length) }, (_, index) => {
          const slot = roadmap.milestones.length + index + 1;
          return (
            <li key={`unpublished-${String(slot)}`} className="trajectory-v2-unpublished-stage" aria-label={`Этап ${String(slot)} пока не опубликован`}>
              <div className="trajectory-v2-stage" data-stage-state="unpublished">
                <span className="trajectory-v2-milestone-node" aria-hidden="true">♙</span>
                <strong className="trajectory-v2-milestone-position">{slot}</strong>
                <span className="trajectory-v2-milestone-title">Не опубликован</span>
              </div>
            </li>
          );
        })}
      </ol>
      {studyProgress.matchedCourses > 0 && <div className="trajectory-v2-study-summary" data-testid="trajectory-study-evidence" role="status">
        <div className="trajectory-v2-study-summary__text">
          <strong>{studyProgress.finishedCourses} из {studyProgress.matchedCourses} учебных курсов завершено</strong>
          <small>{projection.completed.size} из {roadmap.milestones.length} учебных шагов выполнено · {role.completed_milestones} этапов подтверждено отдельно</small>
        </div>
        <div className="trajectory-v2-studying" data-testid="trajectory-study-progress">
          <progress max={studyProgress.matchedCourses} value={studyProgress.finishedCourses} aria-label="Завершённые курсы выбранной траектории"/>
        </div>
      </div>}
      {visibleMilestone === undefined || props.showDetails === false ? null : (
        <StageDetail
          milestone={visibleMilestone}
          state={projection.stateOf(visibleMilestone)}
          nextStep={nextStep}
          role={role}
          learningCourses={props.learningCourses}
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
  learningCourses?: LearningCourse[];
  onOpenDetails?: (stageKey: string) => void;
}) {
  const { milestone, nextStep, role } = props;
  const canOpen = props.onOpenDetails !== undefined && props.state !== "locked";
  const total = Math.max(1, role.total_milestones);
  const studied = role.attempt_number !== null && milestone.target_kind === "course" ? props.learningCourses?.find(course => course.course_key === milestone.target_key) : undefined;
  return (
    <section className="trajectory-v2-stage-detail" data-testid="trajectory-stage-detail" data-stage-key={milestone.key}>
      <div className="trajectory-v2-stage-header">
        <div>
          <small>Этап {milestone.position} из {total}</small>
          <h3>{milestone.title}</h3>
          <p>{milestone.purpose}</p>
        </div>
        <span className="trajectory-v2-stage-state" data-state={props.state}>
          {props.state === "preview" ? "План обучения" : props.state === "completed" && studied?.finished && !milestone.completed ? "Курс завершён" : (MILESTONE_STATE_LABELS[props.state] ?? props.state)}
        </span>
      </div>
      <div className="trajectory-v2-task-row" data-state={props.state}>
        <span className="trajectory-v2-task-check" aria-hidden="true">
          {props.state === "completed" ? "✓" : props.state === "locked" ? "🔒" : ""}
        </span>
        <div className="trajectory-v2-task-copy">
          <strong>{milestone.target_kind === "course" ? "Курс в Bootcamp" : milestone.title}</strong>
          <small>{milestone.skill} · {milestone.target_kind === "task" ? "Практическая задача" : milestone.target_kind === "course" ? "Обучение" : milestone.target_kind}</small>
        </div>
        <span className="trajectory-v2-task-status">{props.state === "preview" ? "Для ознакомления" : props.state === "completed" && studied?.finished && !milestone.completed ? "Курс пройден" : props.state === "completed" ? "Подтверждено" : props.state === "locked" ? "Недоступно" : studied?.finished ? "Курс пройден" : studied?.completed_units ? "В процессе" : "К выполнению"}</span>
        {canOpen ? (
          <button type="button" className={props.state === "completed" || role.attempt_number === null ? "trajectory-v2-task-action" : "trajectory-v2-task-action is-primary"} onClick={() => props.onOpenDetails?.(milestone.key)}>
            {role.attempt_number === null || props.state === "completed" || studied?.finished ? "Посмотреть" : "Продолжить"} →
          </button>
        ) : null}
      </div>
      {studied && <p className="trajectory-v2-study-caption" data-testid="trajectory-course-learning" data-course-key={studied.course_key}>
        {studied.completed_units} из {studied.total_units} уроков{studied.finished ? " · учебный сертификат выдан" : " · прогресс сохранён"}
        <span> · учебный шаг учтён; практика подтверждается отдельно</span>
      </p>}
      {milestone.activities && milestone.activities.length > 0 && (
        <div className="trajectory-v2-activities" data-testid="trajectory-stage-activities">
          <h4>План этапа</h4>
          <ol>
            {milestone.activities.map((activity, index) => (
              <li key={activity}>
                <span className="trajectory-v2-activity-order" aria-hidden="true">{index + 1}</span>
                <span>{activity}</span>
              </li>
            ))}
          </ol>
          {milestone.deliverable && (
            <p className="trajectory-v2-deliverable">
              <strong>Результат:</strong> {milestone.deliverable}
            </p>
          )}
        </div>
      )}
      {(milestone.theory?.length || milestone.lab || milestone.acceptance?.length) && (
        <details className="trajectory-v2-learning-material" data-testid="trajectory-learning-material">
          <summary>Материалы и критерии
            {milestone.estimated_hours ? <span>{milestone.estimated_hours} ч ориентировочно</span> : null}
          </summary>
          {milestone.theory && milestone.theory.length > 0 && (
            <section>
              <h4>Разобраться в теории</h4>
              <ul>{milestone.theory.map((topic) => <li key={topic}>{topic}</li>)}</ul>
            </section>
          )}
          {milestone.lab && (
            <section>
              <h4>Лабораторная работа</h4>
              <p>{milestone.lab}</p>
            </section>
          )}
          {milestone.acceptance && milestone.acceptance.length > 0 && (
            <section>
              <h4>Критерии готовности</h4>
              <ul>{milestone.acceptance.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
            </section>
          )}
          {milestone.resources && milestone.resources.length > 0 && (
            <section className="trajectory-v2-reading-resources">
              <h4>Официальные материалы для изучения</h4>
              <ul>{milestone.resources
                .filter((resource) => resource.url?.startsWith("https://"))
                .map((resource) => (
                  <li key={resource.url}>
                    <a href={resource.url} target="_blank" rel="noopener noreferrer">
                      {resource.title || "Открыть руководство"} ↗
                    </a>
                  </li>
                ))}</ul>
            </section>
          )}
          <section className="trajectory-v2-stage-meta">
            <h4>Навык и формат</h4>
            <dl>
              <div><dt>Навык</dt><dd>{milestone.skill}</dd></div>
              <div><dt>Формат</dt><dd>{milestone.target_kind === "task" ? "Практическая задача" : milestone.target_kind === "course" ? "Курс" : milestone.target_kind}</dd></div>
            </dl>
          </section>
        </details>
      )}
      {props.state === "locked" && (
        <p className="trajectory-v2-stage-note" role="status">
          {nextStep === null ? "Этап недоступен: сервер не разрешает переход дальше." : `Этап откроется после завершения «${nextStep.title}». Первый разрешённый шаг — «${nextStep.title}».`}
        </p>
      )}
      {role.attempt_number === null && (
        <p className="trajectory-v2-stage-note" role="status">Это программа обучения. Личный прогресс появится после выбора профессии.</p>
      )}
    </section>
  );
}
