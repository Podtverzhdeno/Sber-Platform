import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BootcampOverview } from "./page";
import { BootcampPage, CatalogToolbar } from "./page";

const fact = {
  source: "test",
  version: "1",
  as_of: "2026-10-23T08:00:00Z",
  data_origin: "test_fixture" as const,
  stale: false,
  stale_reason: null,
};

function requirement(key: string, kind: "course" | "project") {
  return { key, title: key, kind, state: "open" as const, source_key: key, source_version: "1", allowed_action: "open" };
}

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
    render(<BootcampPage overview={overview} view="card" onViewChange={onViewChange} onRoleChange={vi.fn()} onContinue={onContinue} onOpenCourse={onOpenCourse} onOpenRequirements={onOpenRequirements} drawers={<aside>Детали курса</aside>} />);

    expect(screen.getByRole("region", { name: "Python" })).toHaveTextContent("Следующий шаг");
    expect(screen.getByRole("heading", { name: "Профиль роли" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Учебная часть завершена" })).toBeInTheDocument();
    expect(screen.getByText("Детали курса")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Продолжить курс" }));
    fireEvent.click(screen.getByRole("button", { name: "Открыть практические требования" }));
    fireEvent.click(screen.getByRole("button", { name: "Подробнее" }));
    fireEvent.click(screen.getByRole("button", { name: "Список" }));
    expect(onContinue).toHaveBeenCalledWith("python");
    expect(onOpenRequirements).toHaveBeenCalledOnce();
    expect(onOpenCourse).toHaveBeenCalledWith("python");
    expect(onViewChange).toHaveBeenCalledWith("list");
  });

  it("renders list rows from the same canonical courses", () => {
    render(<BootcampPage overview={overview} view="list" onViewChange={vi.fn()} onRoleChange={vi.fn()} onContinue={vi.fn()} onOpenCourse={vi.fn()} onOpenRequirements={vi.fn()} />);
    expect(screen.getByRole("list", { name: "Каталог Bootcamp списком" })).toHaveTextContent("Python");
    expect(screen.getAllByText("Python")).toHaveLength(2);
  });

  it("requests a role change and replaces the complete role projection", () => {
    const onRoleChange = vi.fn();
    const props = { view: "card" as const, onViewChange: vi.fn(), onRoleChange, onContinue: vi.fn(), onOpenCourse: vi.fn(), onOpenRequirements: vi.fn() };
    const { rerender } = render(<BootcampPage overview={{ ...overview, roles: [...overview.roles, { track_key: "data", title: "Data", state: "unselected", roadmap: fact }] }} {...props} />);
    fireEvent.change(screen.getByLabelText("Роль"), { target: { value: "data" } });
    expect(onRoleChange).toHaveBeenCalledWith("data");

    const dataOverview: BootcampOverview = {
      ...overview,
      snapshot_version: "snapshot-2",
      selected_track_key: "data",
      roles: [...overview.roles, { track_key: "data", title: "Data", state: "active", roadmap: fact }],
      continue_learning: null,
      role_summary: { ...overview.role_summary, track_key: "data", current_grade_title: "Data Junior", target_grade_title: "Data Middle" },
      curriculum: { ...overview.curriculum, requirements: [] },
      courses: [],
    };
    rerender(<BootcampPage overview={dataOverview} {...props} />);
    expect(screen.getByText("Data Junior", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("Junior → Middle")).not.toBeInTheDocument();
    expect(screen.queryByText("Python")).not.toBeInTheDocument();
    expect(screen.getByText("Активного шага пока нет. Выберите курс в каталоге.")).toBeInTheDocument();
  });

  it("shows an honest continuation state with exactly one primary action", () => {
    const onContinue = vi.fn();
    const continuationFixture = overview.continue_learning;
    if (continuationFixture === null) throw new Error("continuation fixture is required");
    render(<BootcampPage overview={{ ...overview, continue_learning: { ...continuationFixture, progress: null, deadline: "2026-11-01T00:00:00Z" } }} view="card" onViewChange={vi.fn()} onRoleChange={vi.fn()} onContinue={onContinue} onOpenCourse={vi.fn()} onOpenRequirements={vi.fn()} />);
    const continuation = screen.getByRole("region", { name: "Python" });
    expect(continuation).toHaveTextContent("Прогресс пока не рассчитан.");
    expect(continuation).toHaveTextContent("Checkpoint: functions");
    expect(continuation.querySelector("time")).toHaveAttribute("datetime", "2026-11-01T00:00:00Z");
    expect(continuation.querySelectorAll("button")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Продолжить курс" }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("shows a continuation empty state without an inert action", () => {
    render(<BootcampPage overview={{ ...overview, continue_learning: null }} view="card" onViewChange={vi.fn()} onRoleChange={vi.fn()} onContinue={vi.fn()} onOpenCourse={vi.fn()} onOpenRequirements={vi.fn()} />);
    const continuation = screen.getByRole("region", { name: "Продолжить обучение" });
    expect(continuation).toHaveTextContent("Активного шага пока нет");
    expect(continuation.querySelector("button")).toBeNull();
  });

  it("does not turn unknown role metrics into zero progress", () => {
    const unknownOverview: BootcampOverview = {
      ...overview,
      role_summary: {
        track_key: "backend",
        grade_state: "unknown",
        current_grade_key: null,
        current_grade_title: null,
        target_grade_key: null,
        target_grade_title: null,
        matrix_skill_count: null,
        readiness: null,
        grade_policy: null,
        unavailable_reason: "Грейд ещё не определён владельцем матрицы.",
      },
    };
    render(<BootcampPage overview={unknownOverview} view="card" onViewChange={vi.fn()} onRoleChange={vi.fn()} onContinue={vi.fn()} onOpenCourse={vi.fn()} onOpenRequirements={vi.fn()} />);
    const summary = screen.getByRole("region", { name: "Профиль роли" });
    expect(summary).toHaveTextContent("Грейд ещё не определён владельцем матрицы.");
    expect(summary).not.toHaveTextContent("0%");
    expect(summary).not.toHaveTextContent("62%");
  });

  it("explains known readiness and keeps an unknown count explicit", () => {
    render(<BootcampPage overview={{ ...overview, role_summary: { ...overview.role_summary, matrix_skill_count: null } }} view="card" onViewChange={vi.fn()} onRoleChange={vi.fn()} onContinue={vi.fn()} onOpenCourse={vi.fn()} onOpenRequirements={vi.fn()} />);
    const summary = screen.getByRole("region", { name: "Профиль роли" });
    expect(summary).toHaveTextContent("Навыков в матрице: не определено");
    expect(summary).toHaveTextContent("requirements · 3 из 4");
  });

  it("renders the approved remaining-course copy without promising a grade", () => {
    const courseRequirements = {
      ...overview.curriculum,
      requirements: [
        requirement("course-1", "course"),
        requirement("course-2", "course"),
      ],
    };
    render(<BootcampPage overview={{ ...overview, curriculum: courseRequirements }} view="card" onViewChange={vi.fn()} onRoleChange={vi.fn()} onContinue={vi.fn()} onOpenCourse={vi.fn()} onOpenRequirements={vi.fn()} />);
    const hero = screen.getByRole("region", { name: "Осталось 2 курса" });
    expect(hero).toHaveTextContent("После проверки последнего курса");
    expect(hero).not.toHaveTextContent("получите грейд");
    expect(screen.getByRole("button", { name: "Посмотреть курсы" })).toBeInTheDocument();
  });

  it("distinguishes mixed, complete and unpublished curriculum states", () => {
    const baseProps = { view: "card" as const, onViewChange: vi.fn(), onRoleChange: vi.fn(), onContinue: vi.fn(), onOpenCourse: vi.fn(), onOpenRequirements: vi.fn() };
    const course = requirement("course", "course");
    const project = requirement("project", "project");
    const { rerender } = render(<BootcampPage overview={{ ...overview, curriculum: { ...overview.curriculum, requirements: [course, project] } }} {...baseProps} />);
    expect(screen.getByRole("heading", { name: "До следующего грейда осталось выполнить требования" })).toBeInTheDocument();

    rerender(<BootcampPage overview={{ ...overview, curriculum: { ...overview.curriculum, requirements: [] } }} {...baseProps} />);
    expect(screen.getByRole("heading", { name: "Все требования подтверждены" })).toBeInTheDocument();
    const completeHero = screen.getByRole("region", { name: "Все требования подтверждены" });
    expect(within(completeHero).queryByRole("button")).not.toBeInTheDocument();

    rerender(<BootcampPage overview={{ ...overview, curriculum: { state: "not_evaluable", current_grade_key: null, target_grade_key: null, policy_version: null, curriculum_version: null, requirements: [], provenance: null, unavailable_reason: "Политика ещё не опубликована." } }} {...baseProps} />);
    expect(screen.getByRole("heading", { name: "Требования к следующему грейду пока не опубликованы" })).toBeInTheDocument();
    expect(screen.getByText("Политика ещё не опубликована.")).toBeInTheDocument();
  });
});

describe("CatalogToolbar (BC2-306)", () => {
  it("exposes independent filters, server-derived counts, reset and view controls", () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    render(
      <CatalogToolbar
        state={{ relevance: "all", category: "all", query: "", track: "all", level: "all", view: "card" }}
        roles={overview.roles}
        categories={[{ key: "all", label: "Все курсы", count: 8 }, { key: "role", label: "Для моей роли", count: 3 }]}
        levels={["Начальный", "Продвинутый"]}
        onChange={onChange}
        onReset={onReset}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Актуальные" }));
    fireEvent.click(screen.getByRole("button", { name: /Для моей роли/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Поиск" }), { target: { value: "python" } });
    fireEvent.change(screen.getByLabelText("Направление"), { target: { value: "backend" } });
    fireEvent.change(screen.getByLabelText("Уровень"), { target: { value: "Продвинутый" } });
    fireEvent.click(screen.getByRole("button", { name: "Список" }));
    fireEvent.click(screen.getByRole("button", { name: "Сбросить" }));

    expect(screen.getByLabelText("8 курсов")).toBeInTheDocument();
    expect(screen.getByLabelText("3 курсов")).toBeInTheDocument();
    expect(onChange).toHaveBeenNthCalledWith(1, { relevance: "relevant" });
    expect(onChange).toHaveBeenNthCalledWith(2, { category: "role" });
    expect(onChange).toHaveBeenNthCalledWith(3, { query: "python" });
    expect(onChange).toHaveBeenNthCalledWith(4, { track: "backend" });
    expect(onChange).toHaveBeenNthCalledWith(5, { level: "Продвинутый" });
    expect(onChange).toHaveBeenNthCalledWith(6, { view: "list" });
    expect(onReset).toHaveBeenCalledOnce();
  });
});
