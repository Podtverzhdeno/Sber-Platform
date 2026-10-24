import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
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

/** Approved presentation-only catalogue additions. These entries carry no user progress,
 * and are never sent to the server or treated as active trajectories. */
const EXTRA_CATALOG_ROLES: ReadonlyArray<{ track_key: string; title: string }> = [
  { track_key: "catalog-backend-reference", title: "Backend-разработчик" },
  { track_key: "catalog-design-reference", title: "UX/UI-дизайнер" },
  { track_key: "catalog-manager-reference", title: "Менеджер проекта" },
];

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
    const idx = (navigation.data?.navigation ?? []).indexOf("Портфолио");
    if (idx >= 0) window.location.assign(`/workspace/${String(idx)}`);
  };
  const catalogueRoles = useMemo<RoleCardView[]>(() => {
    const existing = [...overview.roles];
    for (const candidate of EXTRA_CATALOG_ROLES) {
      if (existing.some((role) => role.title.toLowerCase() === candidate.title.toLowerCase())) continue;
      existing.push({
        track_key: candidate.track_key,
        title: candidate.title,
        state: "unselected",
        attempt_number: null,
        completed_milestones: 0,
        total_milestones: 0,
      });
    }
    return existing;
  }, [overview.roles]);
  const roleParam = searchParams.get("role");
  const selectedKey = useMemo(() => {
    const paramRole = catalogueRoles.find((role) => role.track_key === roleParam);
    if (paramRole) return paramRole.track_key;
    const outcomeKey = overview.next_outcome?.trajectory_key;
    return outcomeKey !== undefined && catalogueRoles.some((role) => role.track_key === outcomeKey)
      ? outcomeKey
      : (catalogueRoles[0]?.track_key ?? null);
  }, [catalogueRoles, overview.next_outcome, roleParam]);
  const selected = catalogueRoles.find((role) => role.track_key === selectedKey) ?? null;
  const passportSkills = Array.isArray(passport.data?.skills) ? passport.data.skills : [];
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
  const gradeDialogRef = useRef<HTMLElement | null>(null);
  const gradeTriggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!gradesOpen) return;
    gradeDialogRef.current?.focus();
    return () => { gradeTriggerRef.current?.focus(); };
  }, [gradesOpen]);
  const [gradeFocus, setGradeFocus] = useState<number>(() => {
    const candidate = Number(overview.concepts.career_grade.current_grade);
    return Number.isInteger(candidate) && candidate >= 1 && candidate <= 6 ? candidate : 1;
  });
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
          <header><h3>Твой грейд</h3><button type="button" className="trajectory-v2-all-grades-link" onClick={() => { gradeTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setGradesOpen(true); }}>Все уровни →</button></header>
          <div className="trajectory-v2-grade-body">
            <div className="trajectory-v2-grade-ring"><strong>{overview.concepts.career_grade.current_grade === null ? "—" : `Грейд ${overview.concepts.career_grade.current_grade}`}</strong><small>{selected?.title ?? "Моя роль"}</small></div>
            <div className="trajectory-v2-grade-progress">
              <small>До следующего грейда</small>
              <strong>{overview.concepts.career_grade.readiness_percent === null ? "Проверяем" : `${String(100 - overview.concepts.career_grade.readiness_percent)}%`}</strong>
              <progress max={100} value={overview.concepts.career_grade.readiness_percent ?? 0} aria-label="Готовность к следующему грейду" />
              <small>{overview.concepts.career_grade.hint ?? overview.concepts.career_grade.reason ?? "По проверенным результатам"}</small>
            </div>
          </div>
          <div className="trajectory-v2-grade-callout">
            <span aria-hidden="true" className="trajectory-v2-grade-callout-icon">⌁</span>
            <span>{overview.concepts.career_grade.state === "ready"
              ? (overview.next_outcome !== null ? `Заверши текущий шаг «${overview.next_outcome.target_title}», чтобы приблизиться к следующему грейду. После проверки прогресс обновится.` : "Прогресс рассчитывается по проверенным результатам")
              : "Грейд рассчитывается по серверной политике и проверенным результатам"}</span>
          </div>
        </section>
        <section className="trajectory-v2-next-panel">
          <header>
            <h3>Следующий шаг</h3>
            <span>{overview.next_outcome?.trajectory_title ?? "Маршрут"}</span>
          </header>
          <div className="trajectory-v2-next-task">
            <span className="trajectory-v2-next-task-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M5 2h10l4 4v16H5zM15 2v5h4M9 11h6M9 15h6M9 19h4"/></svg>
            </span>
            <div className="trajectory-v2-next-task-description">
              <strong>{overview.next_outcome?.target_title ?? "Следующий шаг пока не назначен"}</strong>
              <small>{overview.next_outcome?.target_kind === "task" ? "Практическая задача" : overview.next_outcome?.target_kind === "course" ? "Обучение" : "Маршрут"}
                {overview.next_outcome?.stale_reason ? ` · ${overview.next_outcome.stale_reason}` : ""}</small>
            </div>
            {overview.next_outcome !== null && <button type="button" aria-label="Посмотреть следующий шаг" onClick={() => {
              const outcome = overview.next_outcome;
              if (outcome === null) return;
              snapshotTrigger();
              if (outcome.trajectory_key !== selectedKey) {
                const nextParams = new URLSearchParams(searchParams);
                nextParams.set("role", outcome.trajectory_key);
                nextParams.set("stage", outcome.milestone_key);
                setSearchParams(nextParams);
              }
              setRoleInfoOpen(false);
              setDrawerKey(outcome.milestone_key);
            }}>→</button>}
          </div>
        </section>
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
                <h2>Все грейды роли «{selected?.title ?? "Моя роль"}»</h2>
                <p>Изучай уровни и свой путь профессионального развития</p>
              </div>
              <button type="button" aria-label="Закрыть" onClick={() => { setGradesOpen(false); }}>✕</button>
            </header>
            <div className="trajectory-v2-grades-layout">
              <nav className="trajectory-v2-grades-list" aria-label="Выбор грейда">
                {["База и основы","Исследование пользователей","Продуктовые гипотезы","Метрики и приоритизация","Реальные задачи и проекты","Подтверждение компетенций"].map((label,index) => {
                  const level = index+1;
                  const current = overview.concepts.career_grade.current_grade === String(level);
                  return <button type="button" key={level} className="trajectory-v2-grade-option" aria-pressed={gradeFocus===level} onClick={() => { setGradeFocus(level); }}>
                    <span className="trajectory-v2-grade-dot">{current ? String(level) : level < Number(overview.concepts.career_grade.current_grade) ? "✓" : String(level)}</span>
                    <span><strong>Грейд {level}</strong><small>{label}</small></span>
                    <span aria-hidden="true">›</span>
                  </button>;
                })}
              </nav>
              <div className="trajectory-v2-grade-explanation">
                <div className="trajectory-v2-grade-explanation-head">
                  <div>
                    <h3>Грейд {gradeFocus}</h3>
                    {overview.concepts.career_grade.current_grade === String(gradeFocus) && <span>Твой текущий грейд</span>}
                  </div>
                  <div className="trajectory-v2-grade-explanation-graphic" aria-hidden="true">⚑</div>
                </div>
                <strong>{["База и основы","Исследование пользователей","Продуктовые гипотезы","Метрики и приоритизация","Реальные задачи и проекты","Подтверждение компетенций"][gradeFocus-1]}</strong>
                <p>Описание уровней приведено для ознакомления с макетом. Официальная политика и требования к этому уровню пока не опубликованы.</p>
                <div className="trajectory-v2-grade-explanation-progress">
                  <div className="trajectory-v2-grade-ring"><strong>{overview.concepts.career_grade.current_grade === String(gradeFocus) ? `Грейд ${String(gradeFocus)}` : "—"}</strong></div>
                  <div>
                    <small>До следующего грейда</small>
                    <strong>{overview.concepts.career_grade.current_grade === String(gradeFocus) && overview.concepts.career_grade.readiness_percent !== null ? `${String(100-overview.concepts.career_grade.readiness_percent)}%` : "Проверяем"}</strong>
                    <progress max={100} value={overview.concepts.career_grade.current_grade === String(gradeFocus) ? overview.concepts.career_grade.readiness_percent ?? 0 : 0}/>
                    <small>{overview.concepts.career_grade.hint ?? "Официальные критерии будут доступны после публикации политики"}</small>
                  </div>
                </div>
                <div className="trajectory-v2-grade-expectations">
                  <h4>Ключевые ожидания на этом уровне</h4>
                  <p>Точные требования к грейду и подтверждённые компетенции публикуются серверной политикой, а не определяются интерфейсом.</p>
                </div>
                <div className="trajectory-v2-grade-next-note">Следующий уровень — грейд {Math.min(6,gradeFocus+1)} · Подтверждённые компетенции и более сложные задачи</div>
              </div>
            </div>
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
      data-role-state={role.state}
      data-primary={props.primary}
      aria-pressed={props.selected}
      onClick={() => {
        props.onSelect();
      }}
    >
      <span className="trajectory-v2-role-icon" aria-hidden="true" data-glyph={
        role.title.toLowerCase().includes("продукт") ? "product" :
        role.title.toLowerCase().includes("ml") ? "ml" :
        role.title.toLowerCase().includes("python") ? "python" :
        role.title.toLowerCase().includes("backend") ? "backend" :
        role.title.toLowerCase().includes("ux") || role.title.toLowerCase().includes("дизайн") ? "design" :
        role.title.toLowerCase().includes("менеджер") ? "manager" : "data"
      }>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          {role.title.toLowerCase().includes("продукт") || role.title.toLowerCase().includes("аналитик") ? (
            <path d="M4 20V13m6 7V8m6 12V4m5 16v-10" strokeWidth="3"/>
          ) : role.title.toLowerCase().includes("ml") ? (
            <path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10"/>
          ) : role.title.toLowerCase().includes("python") ? (
            <path d="m8 5-6 7 6 7m8-14 6 7-6 7m-3-16-2 18"/>
          ) : role.title.toLowerCase().includes("backend") ? (
            <path d="M5 2h10l4 4v16H5zM15 2v5h4M9 11h6M9 15h6M9 19h4"/>
          ) : role.title.toLowerCase().includes("ux") || role.title.toLowerCase().includes("дизайн") ? (
            <path d="m12 2 2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3z"/>
          ) : (
            <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M9 7V4h6v3m-12 6h18m-11 0v2h4v-2"/></>
          )}
        </svg>
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
    <div className="trajectory-v2-role-stack">
    <article
      className="trajectory-v2-role-detail"
      data-testid="trajectory-role-detail"
      data-role-key={role.track_key}
    >
      <header className="trajectory-v2-detail-heading">
        <div className="trajectory-v2-detail-identity">
          <span className="trajectory-v2-detail-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M4 20V13m6 7V8m6 12V4m5 16v-10"/></svg></span>
          <div>
            <div className="trajectory-v2-detail-title">
              <h3>{role.title}</h3>
              {props.primary && <span className="trajectory-v2-role-badge">{PRIMARY_LABEL}</span>}
            </div>
            <p>{role.title.toLowerCase().includes("продукт")
              ? "Исследуй пользователей, находи точки роста и влияй на продуктовые решения через данные."
              : role.attempt_number === null
                ? "Познакомься с профессией и выбери направление развития."
                : `Путь освоения роли · ${String(role.completed_milestones)} из ${String(role.total_milestones)} этапов пройдено`}</p>
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
      <StagePathSection
        role={role}
        roadmap={props.roadmap}
        pending={props.roadmapPending}
        error={props.roadmapError}
        retry={props.roadmapRetry}
        stageKey={props.stageKey}
        onStageSelect={props.onStageSelect}
        onOpenDetails={props.onOpenStageDetails}
        showDetails={false}
      />
    </article>
    <SelectedStageCard role={role} roadmap={props.roadmap} stageKey={props.stageKey} onOpenDetails={props.onOpenStageDetails}/>
    </div>
  );
}

function SelectedStageCard(props: { role: RoleCardView; roadmap: RoadmapView | null; stageKey: string | null; onOpenDetails: (stageKey: string) => void }) {
  const { roadmap, role } = props;
  if (roadmap === null || roadmap.track_key !== role.track_key) return null;
  const currentKey = roadmap.next_step?.key ?? roadmap.milestones[0]?.key ?? "";
  const activeKey = isSelectedStage(props.stageKey, roadmap.milestones, currentKey);
  const active = roadmap.milestones.find((milestone) => milestone.key === activeKey);
  if (active === undefined) return null;
  return <StageDetail milestone={active} state={milestoneState(active, roadmap.next_step)} nextStep={roadmap.next_step} role={role} onOpenDetails={props.onOpenDetails}/>;
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
  const nextStep = roadmap.next_step;
  const currentKey = nextStep?.key ?? roadmapsDefaultKey(roadmap);
  const visibleStageKey = isSelectedStage(props.stageKey, roadmap.milestones, currentKey);
  const visibleMilestone = roadmap.milestones.find((m) => m.key === visibleStageKey);
  return (
    <section className="trajectory-v2-stage-block" aria-label="Этапы" data-testid="trajectory-stages">
      <header>
        <h4>Путь освоения роли</h4>
        <small>
          {role.completed_milestones} завершено · {roadmap.milestones.length} этапов
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
                <span className="trajectory-v2-milestone-node" aria-hidden="true">{state === "completed" ? "✓" : state === "current" ? "◉" : state === "locked" ? "♙" : String(milestone.position)}</span>
                <strong className="trajectory-v2-milestone-position">{milestone.position}</strong>
                <span className="trajectory-v2-milestone-title">{milestone.title}</span>
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
      {visibleMilestone === undefined || props.showDetails === false ? null : (
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
          <div><dt>Цель</dt><dd>{milestone.target_kind === "task" ? "Задача" : milestone.target_kind === "course" ? "Курс" : milestone.target_kind} · {milestone.target_key}</dd></div>
          <div><dt>Позиция</dt><dd>{milestone.position}</dd></div>
        </dl>
      </details>
      {props.state === "locked" && (
        <p className="trajectory-v2-stage-note" role="status">
          {nextStep === null ? "Этап недоступен: сервер не разрешает переход дальше." : `Этап откроется после завершения «${nextStep.title}». Первый разрешённый шаг — «${nextStep.title}».`}
        </p>
      )}
      {props.state === "available" && role.attempt_number === null && (
        <p className="trajectory-v2-stage-note" role="status">Прогресс появится после выбора траектории.</p>
      )}
    </section>
  );
}
