import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { KpiDetailsBody, ProjectsBody, ProgressBody, VerifiedBody } from "./kpi-details";
import {
  buildKpiValues,
  useCertificates,
  useEvidenceAnchors,
  useGrowthSnapshot,
  useStudentStreak,
  useWorkItems,
  type CourseCertificateView,
  type EvidenceAnchorView,
  type GrowthSnapshotView,
  type WorkItemView,
} from "./kpi-data";

type QueryMode = "pending" | "error" | "success";

const snapshot: GrowthSnapshotView = {
  snapshot_id: "growth-snapshot-1",
  generated_at: "2026-10-19T17:55:00+03:00",
  snapshot_version: 2,
  actor_timezone: "Europe/Moscow",
  definitions: {
    activity: "impulse-growth-activity-v3",
    hours: "impulse-growth-hours-v1",
    milestones: "impulse-growth-milestones-v2",
    readiness: "impulse-growth-readiness-v1",
    snapshot: "impulse-growth-snapshot-v2",
  },
  period_boundaries: {
    day: { start: "2026-10-19T00:00:00+03:00", end: "2026-10-20T00:00:00+03:00" },
    week: { start: "2026-10-13T00:00:00+03:00", end: "2026-10-20T00:00:00+03:00" },
    month: { start: "2026-10-01T00:00:00+03:00", end: "2026-11-01T00:00:00+03:00" },
    year: { start: "2026-01-01T00:00:00+03:00", end: "2027-01-01T00:00:00+03:00" },
  },
  activity: {
    day: { total: 2, course_checkpoint: 1, project_submission: 1, revision_accepted: 0, event_participation: 0 },
    week: { total: 4, course_checkpoint: 2, project_submission: 1, revision_accepted: 1, event_participation: 0 },
    month: { total: 1, course_checkpoint: 0, project_submission: 1, revision_accepted: 0, event_participation: 0 },
    year: { total: 14, course_checkpoint: 7, project_submission: 4, revision_accepted: 2, event_participation: 1 },
  },
  activity_state: {
    day: neutralState(),
    week: neutralState(),
    month: neutralState(),
    year: neutralState(),
  },
  events: [],
  hours: { known: true, trusted_minutes: 0, self_reported_minutes: 0, intervals: [] },
  freshness: { known: true, latest_observed_at: "2026-10-18T12:00:00+03:00" },
  trajectories: [],
};

function neutralState() {
  return {
    version: 1,
    state: "neutral",
    total: 0,
    target_min: null,
    target_max: null,
    missing_category: null,
    text: "состояние нейтральное",
    action: null,
  };
}

function trajectorySnapshot(partial: boolean, percent: number | null): GrowthSnapshotView {
  return {
    ...snapshot,
    trajectories: [
      {
        track_key: "python-dev",
        track_title: "Python-разработчик",
        policy_version: 2,
        milestones: [
          { key: "ms-python-base", known: true, position: 1, purpose: "Python base", skill: "backend", status: "completed", target_key: "course-python-base", target_kind: "course", target_title: "Курс python-base", title: "Python base" },
          { key: "ms-rag-diagnosis", known: true, position: 2, purpose: "Диагностика задач", skill: "rag", status: "available", target_key: "rag-mvp", target_kind: "task", target_title: "Проект RAG", title: "Диагностика задач" },
        ],
        completion: { percent, coverage: 1, partial },
        readiness_skills: [],
        readiness: { percent: 50, coverage: 1, partial: false },
        object_refs: [],
        next_step_ref: "course:python-base",
      },
    ],
  };
}

const work = [
  {
    assignment: {
      id: "assignment-active",
      task_id: "task-1",
      person_id: "person-1",
      application_id: "application-1",
      status: "in_progress",
    },
    task: { title: "RAG: надёжный поиск по документам" },
    terms: { deadline_at: "2026-10-20T18:00:00Z" },
    contributions: [],
    decisions: [],
  },
  {
    assignment: {
      id: "assignment-history",
      task_id: "task-2",
      person_id: "person-1",
      application_id: "application-2",
      status: "accepted",
    },
    task: { title: "Прогнозирование нагрузки контактного центра" },
    terms: { deadline_at: "2026-10-01T18:00:00Z" },
    contributions: [],
    decisions: [],
  },
  {
    assignment: {
      id: "assignment-attention",
      task_id: "task-3",
      person_id: "person-1",
      application_id: "application-3",
      status: "revision_requested",
    },
    task: { title: "Чат-бот поддержки" },
    terms: { deadline_at: "2026-10-25T18:00:00Z" },
    contributions: [],
    decisions: [],
  },
] as unknown as WorkItemView[];

const anchors: EvidenceAnchorView[] = [
  {
    competency_key: "backend",
    counted: true,
    level: "P2",
    observed_at: "2026-10-18T12:00:00+03:00",
    reason: "Вклад принят заказчиком",
    source_kind: "contribution",
    source_ref: "contribution-1",
  },
  {
    competency_key: "analytics",
    counted: false,
    level: "P1",
    observed_at: "2026-10-15T09:00:00+03:00",
    reason: "Не совпал с портфелем",
    source_kind: "checkpoint",
    source_ref: "checkpoint-2",
  },
];

const certificates: CourseCertificateView[] = [
  {
    certificate_id: "cert-1",
    competencies: [],
    course_key: "openspec",
    course_title: "OpenSpec и SDD",
    holder_name: "Алекс Речной",
    issued_at: "2026-10-10T12:00:00+03:00",
    period: "2026 Q4",
    preview_marking: "",
    program_version: "1.0",
  } as never,
];

describe("kpi progress body", () => {
  it("explains the formula and shows milestone contributions", () => {
    render(<ProgressBody state="success" snapshot={trajectorySnapshot(false, 66.7)} />);
    expect(screen.getByTestId("kpi-progress-definition").textContent).toContain(
      "impulse-growth-milestones-v2",
    );
    expect(screen.getByTestId("kpi-track-python-dev").textContent).toContain("67%");
    expect(screen.getByTestId("kpi-progress-percent-python-dev").textContent).toBe("67%");
    expect(screen.getByTestId("kpi-milestone-ms-python-base").textContent).toContain("входит в прогресс");
    expect(screen.getByTestId("kpi-milestone-ms-rag-diagnosis").textContent).toContain("вклад пока ноль");
  });

  it("refuses a percent when coverage is partial", () => {
    render(<ProgressBody state="success" snapshot={trajectorySnapshot(true, null)} />);
    expect(screen.getByTestId("kpi-progress-percent-python-dev").textContent).toContain("точность частична");
  });

  it("shows honest empty, loading and unavailable states", () => {
    const empty = render(<ProgressBody state="success" snapshot={snapshot} />);
    expect(empty.getByTestId("kpi-progress-empty").textContent).toContain("Маршрут ещё не начат");
    empty.unmount();
    const loading = render(<ProgressBody state="pending" />);
    expect(loading.getByTestId("kpi-progress-loading").textContent).toContain("Загружаем");
    loading.unmount();
    render(<ProgressBody state="error" />);
    expect(screen.getByTestId("kpi-progress-unavailable").textContent).toContain(
      "не показывает выдуманные числа",
    );
  });
});

describe("kpi projects body", () => {
  it("splits active, attention and history works with statuses", () => {
    render(<ProjectsBody state="success" work={work} onOpenProject={() => undefined} />);
    expect(screen.getByTestId("kpi-status-assignment-active").textContent).toBe("В работе");
    expect(screen.getByTestId("kpi-status-assignment-attention").textContent).toBe("Требует доработки");
    expect(screen.getByTestId("kpi-status-assignment-history").textContent).toBe("Принят");
    expect(screen.getByTestId("kpi-item-assignment-active").textContent).toContain("RAG: надёжный поиск");
    expect(screen.getAllByTestId(/^kpi-item-/)).toHaveLength(3);
  });

  it("opens a completed project through the deep link callback", () => {
    const onOpenProject = vi.fn();
    const view = render(<ProjectsBody state="success" work={work} onOpenProject={onOpenProject} />);
    expect(screen.getByTestId("kpi-open-project-assignment-history")).toBeInTheDocument();
    expect(screen.queryByTestId("kpi-open-project-assignment-active")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("kpi-open-project-assignment-history"));
    expect(onOpenProject).toHaveBeenCalledWith("assignment-history");
    view.unmount();
  });

  it("shows honest empty and unavailable states", () => {
    const empty = render(<ProjectsBody state="success" work={[]} onOpenProject={() => undefined} />);
    expect(empty.getByTestId("kpi-projects-empty").textContent).toContain("Проектных работ пока нет");
    empty.unmount();
    render(<ProjectsBody state="error" onOpenProject={() => undefined} />);
    expect(screen.getByTestId("kpi-projects-unavailable").textContent).toContain("недоступны");
  });
});

describe("kpi verified body", () => {
  it("lists evidence with provenance and counted badge", () => {
    render(
      <VerifiedBody
        state="success"
        anchors={anchors}
        certificates={certificates}
        evidenceRef="checkpoint-2"
      />,
    );
    expect(screen.getByTestId("kpi-verified-total").textContent).toContain("1 зафиксированных");
    expect(screen.getByTestId("kpi-anchor-contribution-1").textContent).toContain("входит в KPI");
    expect(screen.getByTestId("kpi-anchor-contribution-1").textContent).toContain("Вклад");
    expect(screen.getByTestId("kpi-anchor-checkpoint-2").textContent).toContain("вне KPI");
    expect(screen.getByTestId("kpi-anchor-checkpoint-2").textContent).toContain("Не совпал с портфелем");
    const current = screen.getByTestId("kpi-anchor-checkpoint-2");
    expect(current.getAttribute("data-kpi-evidence-current")).toBe("true");
    expect(current.className).toContain("kpi-anchor--current");
    expect(screen.getByTestId("kpi-certificate-cert-1").textContent).toContain("OpenSpec и SDD");
  });

  it("shows honest empty and unavailable states", () => {
    const empty = render(<VerifiedBody state="success" anchors={[]} certificates={[]} />);
    expect(empty.getByTestId("kpi-verified-empty-anchors").textContent).toContain("якоря появляются");
    empty.unmount();
    render(<VerifiedBody state="error" />);
    expect(screen.getByTestId("kpi-verified-unavailable").textContent).toContain("не показывает выдуманные");
  });
});

describe("kpi details dispatcher", () => {
  it("routes the dialog body by selected metric", () => {
    render(
      <KpiDetailsBody
        kpi="progress"
        progressState="success"
        progress={snapshot}
        projectsState="error"
        verifiedState="error"
        onOpenProject={() => undefined}
      />,
    );
    expect(screen.getByTestId("kpi-progress-empty")).toBeInTheDocument();
  });
});

describe("kpi card values", () => {
  it("derives honest card values from sources", () => {
    const values = buildKpiValues({
      growth: source("success", trajectorySnapshot(false, 66.7)) as ReturnType<typeof useGrowthSnapshot>,
      work: source("success", work) as ReturnType<typeof useWorkItems>,
      anchors: source("success", anchors) as ReturnType<typeof useEvidenceAnchors>,
      certificates: source("success", certificates) as ReturnType<typeof useCertificates>,
      streak: source("success", { current_days: 3, qualified_dates: [], reason: "" }) as ReturnType<
        typeof useStudentStreak
      >,
    });
    expect(values.progress?.value).toBe("67%");
    expect(values.progress?.delta).toBe("по формуле этапов");
    expect(values.projects?.value).toBe("1");
    expect(values.projects?.delta).toContain("история: 1");
    expect(values.verified?.value).toBe("2");
    expect(values.streak?.value).toBe("3");
  });

  it("falls back to explicit unavailable values instead of fake numbers", () => {
    const values = buildKpiValues({
      growth: source("error", undefined) as ReturnType<typeof useGrowthSnapshot>,
      work: source("pending", undefined) as ReturnType<typeof useWorkItems>,
      anchors: source("error", undefined) as ReturnType<typeof useEvidenceAnchors>,
      certificates: source("pending", undefined) as ReturnType<typeof useCertificates>,
      streak: source("pending", undefined) as ReturnType<typeof useStudentStreak>,
    });
    expect(values.progress?.delta).toBe("данные недоступны");
    expect(values.projects?.value).toBe("…");
    expect(values.verified?.delta).toBe("данные недоступны");
    expect(values.streak?.value).toBe("…");
  });
});

function source(mode: QueryMode, data: unknown) {
  return {
    data,
    status: mode,
    isSuccess: mode === "success",
    isError: mode === "error",
  };
}
