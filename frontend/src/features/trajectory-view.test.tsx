import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  buildSkillContours,
  buildTrajectoryCards,
  buildTrackDetail,
  buildTrackOverview,
  buildStages,
  hoursText,
  isTrajectoryViewMode,
  percentText,
  remainderText,
  trajectoryColorClass,
  trajectoryColorName,
  trajectorySlug,

  type TrajectoryGrowthView,
} from "./trajectory-data";
import { TrackDetailBody, TrackOverviewBody, TrajectoryBoard, TrajectoryModeToggle } from "./trajectory-view";
import type { EvidenceAnchorView, GrowthSnapshotView } from "./kpi-data";

const trajectory: TrajectoryGrowthView = {
  track_key: "python-dev",
  track_title: "Python-разработчик",
  policy_version: 2,
  milestones: [
    { key: "ms-base", known: true, position: 1, purpose: "Основа для первого вклада", skill: "Python", status: "completed", target_key: "python-base", target_kind: "course", target_title: "Курс: основы Python", title: "Python base" },
    { key: "ms-rag", known: true, position: 2, purpose: "Прикладной вклад", skill: "RAG", status: "available", target_key: "rag-mvp", target_kind: "task", target_title: "Проект RAG", title: "Вклад RAG" },
  ],
  completion: { percent: 66.7, coverage: 1, partial: false },
  readiness_skills: [
    { skill_key: "python", title: "Python", current_level: "базовый", target_level: "уверенный", known: true },
    { skill_key: "opensec", title: "OpenSec", current_level: "базовый", target_level: "эксперт", known: true },
  ],
  readiness: { percent: 50, coverage: 1, partial: false },
  object_refs: [],
  next_step_ref: "course:python-base",
};

const snapshot: GrowthSnapshotView = {
  snapshot_id: "s1",
  generated_at: "2026-10-19T17:55:00+03:00",
  snapshot_version: 2,
  actor_timezone: "Europe/Moscow",
  definitions: { milestones: "impulse-growth-milestones-v2" },
  period_boundaries: {},
  activity: {},
  activity_state: {},
  events: [
    { kind: "project_submission", title: "Вклад: API поиска", occurred_at: "2026-10-18T12:00:00+03:00", source_kind: "contribution", source_ref: "contribution-1" },
    { kind: "course_checkpoint", title: "Checkpoint RAG", occurred_at: "2026-10-16T09:30:00+03:00", source_kind: "checkpoint", source_ref: "rag-mvp" },
  ],
  hours: {
    known: true,
    trusted_minutes: 210,
    self_reported_minutes: 45,
    intervals: [
      { start: "2026-10-16T09:30:00+03:00", end: "2026-10-16T11:00:00+03:00", source_kind: "checkpoint", source_ref: "rag-mvp" },
    ],
  },
  freshness: { known: true, latest_observed_at: "2026-10-18T12:00:00+03:00" },
  trajectories: [trajectory],
};

const evidence: EvidenceAnchorView[] = [
  { competency_key: "python", counted: true, level: "базовый", observed_at: "2026-10-18T12:00:00+03:00", reason: "Вклад версии 2 принят", source_kind: "contribution", source_ref: "contribution-1" },
  { competency_key: "rag", counted: false, level: "базовый", observed_at: "2026-10-17T14:00:00+03:00", reason: "Checkpoint не совпал с портфелем", source_kind: "checkpoint", source_ref: "rag-global" },
];

describe("trajectory identity", () => {
  it("derives stable slugs, color classes and honest unknown color", () => {
    expect(trajectorySlug("Python-Dev")).toBe("python-dev");
    expect(trajectoryColorClass("python-dev")).toBe("trajectory--python-dev");
    expect(trajectoryColorName("python-dev")).toBe("сине-бирюзовый");
    expect(trajectoryColorName("data")).toBe("бирюзовый");
    expect(trajectoryColorName("unknown-kind")).toBe("синий");
  });

  it("formats percent and remainder without invented numbers", () => {
    expect(percentText(66.7)).toBe("67%");
    expect(percentText(null)).toBe("—");
    expect(percentText(100)).toBe("100%");
    expect(remainderText(66.7)).toBe("до цели 33%");
    expect(remainderText(null)).toBe("остаток неизвестен, пока нет подтверждённых данных");
    expect(remainderText(100)).toBe("цель направления достигнута");
    expect(hoursText(210)).toBe("3 ч 30 мин");
    expect(hoursText(60)).toBe("1 ч");
    expect(hoursText(45)).toBe("45 мин");
    expect(hoursText(null)).toBe("—");
  });

  it("validates deep-link view mode values", () => {
    expect(isTrajectoryViewMode("cards")).toBe(true);
    expect(isTrajectoryViewMode("list")).toBe(true);
    expect(isTrajectoryViewMode("grid")).toBe(false);
    expect(isTrajectoryViewMode(null)).toBe(false);
  });
});

describe("trajectory cards builder", () => {
  it("builds card facts from trajectory snapshot", () => {
    const [card = null] = buildTrajectoryCards([trajectory]);
    expect(card).not.toBeNull();
    expect(card?.title).toBe("Python-разработчик");
    expect(card?.slug).toBe("python-dev");
    expect(card?.colorClass).toBe("trajectory--python-dev");
    expect(card?.percentText).toBe("67%");
    expect(card?.remainderText).toBe("до цели 33%");
    expect(card?.partial).toBe(false);
    expect(card?.readinessPercentText).toBe("50%");
    expect(card?.completedCount).toBe(1);
    expect(card?.totalMilestones).toBe(2);
    expect(card?.nextStepTitle).toBe("Проект RAG");
  });

  it("keeps honest fallbacks when no data", () => {
    expect(buildTrajectoryCards(null)).toEqual([]);
    const [empty = null] = buildTrajectoryCards([{ ...trajectory, completion: { percent: null, coverage: 0, partial: true } }]);
    expect(empty?.percentText).toBe("—");
    expect(empty?.remainderText).toBe("остаток неизвестен, пока нет подтверждённых данных");
    expect(empty?.partial).toBe(true);
  });
});

describe("skill contours", () => {
  it("maps known ladder with current→target text", () => {
    const contours = buildSkillContours(trajectory.readiness_skills);
    expect(contours.at(0)?.progressText).toBe("базовый → уверенный");
  });

  it("explains unknown target level and unknown skill honestly", () => {
    const contours = buildSkillContours([
      { skill_key: "x", title: "OpenSec", current_level: "базовый", target_level: "эксперт", known: true },
      { skill_key: "y", title: "Портфель", current_level: "базовый", target_level: "уверенный", known: false },
    ]);
    expect(contours.at(0)?.progressText).toBe("базовый → целевой уровень не определён формулой");
    expect(contours.at(1)?.progressText).toBe("уровень пока неизвестен");
  });
});

describe("mode toggle", () => {
  it("renders pressed state and reports selection", () => {
    const onChange = vi.fn();
    render(<TrajectoryModeToggle mode="cards" onChange={onChange} />);
    const cardsButton = screen.getByTestId("trajectory-view-cards");
    const listButton = screen.getByTestId("trajectory-view-list");
    expect(cardsButton).toHaveAttribute("aria-pressed", "true");
    expect(listButton).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(listButton);
    expect(onChange).toHaveBeenCalledWith("list");
  });
});

describe("trajectory board", () => {
  const cards = buildTrajectoryCards([trajectory]);
  const open = vi.fn();

  it("renders cards with percent and deep-link callbacks", () => {
    render(<TrajectoryBoard mode="cards" cards={cards} loading={false} onOpenTrack={open} />);
    expect(screen.getByTestId("trajectory-card-python-dev")).toHaveTextContent("Python-разработчик");
    expect(screen.getByTestId("trajectory-percent-python-dev")).toHaveTextContent("67%");
    expect(screen.getByTestId("trajectory-card-python-dev")).toHaveTextContent("до цели 33%");
    expect(screen.getByTestId("trajectory-card-python-dev")).toHaveTextContent("версия плана 2 (техническая)");
    expect(screen.getByTestId("trajectory-card-python-dev")).toHaveTextContent("сине-бирюзовый");
    fireEvent.click(screen.getByTestId("trajectory-open-overview-python-dev"));
    expect(open).toHaveBeenCalledWith("python-dev", "overview");
    fireEvent.click(screen.getByTestId("trajectory-open-detail-python-dev"));
    expect(open).toHaveBeenCalledWith("python-dev", "detail");
  });

  it("renders list rows with the same facts", () => {
    render(<TrajectoryBoard mode="list" cards={cards} loading={false} onOpenTrack={open} />);
    expect(screen.getByTestId("trajectory-row-python-dev")).toBeInTheDocument();
    expect(screen.getByTestId("trajectory-row-python-dev")).toHaveTextContent("67%");
    expect(screen.getByTestId("trajectory-row-python-dev")).toHaveTextContent("Готовность роли: 50%");
  });

  it("explains loading and empty states honestly", () => {
    render(<TrajectoryBoard mode="cards" cards={[]} loading={true} onOpenTrack={open} />);
    expect(screen.getByTestId("trajectory-loading")).toHaveTextContent("Загружаем направления…");
    render(<TrajectoryBoard mode="cards" cards={[]} loading={false} onOpenTrack={open} />);
    expect(screen.getByTestId("trajectory-empty")).toHaveTextContent("после выбора");
    expect(screen.getByTestId("trajectory-empty")).toHaveTextContent("Данные о прогрессе недоступны");
  });
});

describe("overview facts", () => {
  it("explains audience, outcome, stages and evidence rule with version metadata", () => {
    const facts = buildTrackOverview(trajectory);
    expect(facts.title).toBe("Python-разработчик");
    expect(facts.slug).toBe("python-dev");
    expect(facts.colorName).toBe("сине-бирюзовый");
    expect(facts.audience).toContain("«Python-разработчик»");
    expect(facts.purpose).toEqual(["Основа для первого вклада", "Прикладной вклад"]);
    expect(facts.stages.at(0)?.statusLabel).toBe("Подтверждено");
    expect(facts.stages.at(1)?.statusLabel).toBe("Доступно");
    expect(facts.evidenceRule).toContain("подтверждённые checkpoints");
    expect(facts.version).toBe(2);
    render(<TrackOverviewBody facts={facts} />);
    expect(screen.getByTestId("trajectory-overview-body")).toHaveTextContent("#python-dev · цвет: сине-бирюзовый");
    expect(screen.getByTestId("trajectory-overview-body")).toHaveTextContent("версия плана 2 (техническая)");
  });
});

describe("detail facts", () => {
  it("shows honest formula, contour, calendar, hours, evidence and next step", () => {
    const facts = buildTrackDetail(trajectory, snapshot, evidence);
    expect(facts.formulaId).toBe("impulse-growth-milestones-v2");
    expect(facts.formulaText).toContain("равный вес");
    expect(facts.formulaText).toContain("impulse-growth-milestones-v2");
    expect(facts.trustedHoursText).toBe("3 ч 30 мин");
    expect(facts.selfReportedHoursText).toBe("45 мин");
    expect(facts.intervalsCount).toBe(1);
    expect(facts.calendar.at(0)?.label).toBe("18 октября");
    expect(facts.calendar.at(0)?.count).toBe(1);
    expect(facts.evidence.at(0)?.countedLabel).toContain("учтено");
    expect(facts.evidence.at(1)?.countedLabel).toContain("не учтено");
    expect(facts.nextStepRef).toBe("course:python-base");
    render(<TrackDetailBody facts={facts} />);
    expect(screen.getByTestId("trajectory-detail-percent")).toHaveTextContent("67%");
    expect(screen.getByTestId("trajectory-contour-0")).toHaveTextContent("Python: базовый → уверенный");
    expect(screen.getByTestId("trajectory-contour-1")).toHaveTextContent("OpenSec: базовый → целевой уровень не определён формулой");
    expect(screen.getByTestId("trajectory-day-2026-10-16")).toBeInTheDocument();
    expect(screen.getByTestId("trajectory-hours")).toHaveTextContent("Подтверждённые часы");
    expect(screen.getByTestId("trajectory-evidence")).toHaveTextContent("Checkpoint: базовый");
    expect(screen.getByTestId("trajectory-next-step")).toHaveTextContent("course · python-base");
  });

  it("renders unavailable states without snapshot or evidence", () => {
    const facts = buildTrackDetail(trajectory, null, []);
    expect(facts.formulaId).toBeNull();
    expect(facts.trustedHoursText).toBeNull();
    expect(facts.calendar).toEqual([]);
    expect(facts.evidence).toEqual([]);
    render(<TrackDetailBody facts={facts} />);
    expect(screen.getByTestId("trajectory-calendar-empty")).toBeInTheDocument();
    expect(screen.getByTestId("trajectory-evidence-empty")).toBeInTheDocument();
    expect(screen.getByTestId("trajectory-hours")).toHaveTextContent("Часы пока не подтверждены");
  });
});

describe("stages builder", () => {
  it("prefers roadmap milestones with completed flag", () => {
    const stages = buildStages(
      [
        { key: "m1", position: 1, title: "Курс Python", purpose: "Основа", skill: "Python", target_kind: "course", target_key: "python-base", completed: true },
      ],
      null,
    );
    expect(stages.at(0)?.completed).toBe(true);
    expect(stages.at(0)?.targetKey).toBe("python-base");
  });

  it("falls back to growth milestones", () => {
    const stages = buildStages(null, trajectory.milestones);
    expect(stages).toHaveLength(2);
    expect(stages.at(0)?.completed).toBe(true);
    expect(stages.at(1)?.completed).toBe(false);
    expect(stages.at(1)?.targetKey).toBe("rag-mvp");
  });
});



