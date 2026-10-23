import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BootcampOverview } from "./page";
import { BootcampPage } from "./page";

const fact = {
  source: "test",
  version: "1",
  as_of: "2026-10-23T08:00:00Z",
  data_origin: "test_fixture" as const,
  stale: false,
  stale_reason: null,
};

const overview: BootcampOverview = {
  schema_version: "2.0",
  snapshot_version: "snapshot-1",
  as_of: "2026-10-23T08:00:00Z",
  data_origin: "test_fixture",
  selected_track_key: "backend",
  roles: [{ track_key: "backend", title: "Backend", state: "active", roadmap: fact }],
  continue_learning: {
    course_key: "python",
    checkpoint_key: "functions",
    action: "Продолжить курс",
    reason_code: "recent_progress",
    progress: { numerator: 1, denominator: 4, percent: "25", definition: "checkpoints", provenance: fact },
    deadline: null,
    last_meaningful_activity_at: null,
    selection_provenance: fact,
  },
  role_summary: {
    track_key: "backend",
    grade_state: "known",
    current_grade_key: "junior",
    current_grade_title: "Junior",
    target_grade_key: "middle",
    target_grade_title: "Middle",
    matrix_skill_count: 12,
    readiness: { numerator: 3, denominator: 4, percent: "75", definition: "requirements", provenance: fact },
    grade_policy: fact,
    unavailable_reason: null,
  },
  curriculum: {
    state: "known",
    current_grade_key: "junior",
    target_grade_key: "middle",
    policy_version: "1",
    curriculum_version: "1",
    requirements: [{ key: "req-1", title: "Практика", kind: "project", state: "open", source_key: "p1", source_version: "1", allowed_action: "open" }],
    provenance: fact,
    unavailable_reason: null,
  },
  courses: [{
    card: {
      key: "python",
      title: "Python",
      track_keys: ["backend"],
      source_url: "https://example.test/python",
      access_state: "available",
      access_note: "Доступен",
      completion_state: "in_progress",
      relevant: false,
      relevance_reasons: [],
      recommendation_reason: "",
      must_take: null,
      pending_verification_note: null,
      verified_evidence: null,
    },
    course_version: "1",
    access_policy_version: "1",
    freshness: fact,
    enrollment_provenance: fact,
    checkpoint_provenance: fact,
    evidence_provenance: null,
    allowed_actions: ["continue"],
    role_contexts: [],
  }],
};

describe("BootcampPage composition (BC2-301)", () => {
  it("composes the page sections and delegates every interaction", () => {
    const onViewChange = vi.fn();
    const onContinue = vi.fn();
    const onOpenCourse = vi.fn();
    const onOpenRequirements = vi.fn();
    render(<BootcampPage overview={overview} view="card" onViewChange={onViewChange} onContinue={onContinue} onOpenCourse={onOpenCourse} onOpenRequirements={onOpenRequirements} drawers={<aside>Детали курса</aside>} />);

    expect(screen.getByRole("region", { name: "Python" })).toHaveTextContent("Следующий шаг");
    expect(screen.getByRole("heading", { name: "Профиль роли" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Требования к следующему грейду" })).toBeInTheDocument();
    expect(screen.getByText("Детали курса")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Продолжить курс" }));
    fireEvent.click(screen.getByRole("button", { name: "Посмотреть требования" }));
    fireEvent.click(screen.getByRole("button", { name: "Подробнее" }));
    fireEvent.click(screen.getByRole("button", { name: "Список" }));
    expect(onContinue).toHaveBeenCalledWith("python");
    expect(onOpenRequirements).toHaveBeenCalledOnce();
    expect(onOpenCourse).toHaveBeenCalledWith("python");
    expect(onViewChange).toHaveBeenCalledWith("list");
  });

  it("renders list rows from the same canonical courses", () => {
    render(<BootcampPage overview={overview} view="list" onViewChange={vi.fn()} onContinue={vi.fn()} onOpenCourse={vi.fn()} onOpenRequirements={vi.fn()} />);
    expect(screen.getByRole("list", { name: "Каталог Bootcamp списком" })).toHaveTextContent("Python");
    expect(screen.getAllByText("Python")).toHaveLength(2);
  });
});
