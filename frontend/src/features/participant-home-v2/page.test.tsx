import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, describe, expect, it, vi } from "vitest";

import {
  TASK_NEXT_ACTION_LABELS,
  type DevelopmentOverviewView,
} from "./client";
import { ParticipantHomeV2Body } from "./page";
import { learningSummaryQueryKey } from "../learning-progress";
import { roleLevelQueryKey, type ImpulseRoleLevel } from "../impulse-role-level";

const overview: DevelopmentOverviewView = {
  overview_version: 1,
  as_of: "2026-10-22T21:00:00Z",
  actor_timezone: "Europe/Moscow",
  local_today: "2026-10-20",
  permissions: { trajectory_switch: true, grade_request: false, share: false },
  concepts: {
    career_grade: {
      policy_version: 1,
      state: "not_evaluable",
      reason: "grade_catalog_policy_not_published",
      hint: "Карьерный грейд станет доступен после публикации каталога",
      catalog_version: null,
      current_grade: null,
      target_grade: null,
      readiness_percent: null,
      auto_transition: false,
    },
    competency_level: {
      universe_version: "competencies-framework-v1",
      canonical_surface: "skill-passport",
      independent: true,
      value_state: "separate_surface",
    },
    stage_progress: {
      universe_version: "growth-milestones-v1",
      canonical_surface: "trajectory-roadmap",
      independent: true,
      value_state: "separate_surface",
    },
    readiness_percent: {
      universe_version: "growth-readiness-v1",
      canonical_surface: "trajectory-roadmap",
      independent: true,
      value_state: "separate_surface",
    },
    rating_xp: {
      universe_version: "reward-ledger-v1",
      canonical_surface: "wallet-recognition",
      independent: true,
      value_state: "separate_surface",
    },
    review_grade: {
      universe_version: "reward-acceptance-v1",
      canonical_surface: "work-acceptance",
      independent: true,
      value_state: "separate_surface",
    },
  },
  next_outcome: {
    policy_version: 1,
    trajectory_key: "python",
    trajectory_title: "Python-разработчик",
    milestone_key: "foundation",
    milestone_position: 1,
    target_kind: "course",
    target_key: "python-base",
    target_title: "Python: основы",
    reasons: ["Не выполнен последний обязательный шаг активной траектории"],
    stale_reason: null,
  },
  weekly_focus: {
    week_start: "2026-10-19",
    week_end: "2026-10-25",
    versioned: true,
    preset: "workdays",
    target_days: 5,
    done_days: 2,
    hint: "напоминание",
    days: [
      { date: "2026-10-19", weekday: 1, planned: true, done: false },
      { date: "2026-10-20", weekday: 2, planned: true, done: true },
      { date: "2026-10-21", weekday: 3, planned: true, done: false },
      { date: "2026-10-22", weekday: 4, planned: true, done: false },
      { date: "2026-10-23", weekday: 5, planned: true, done: false },
      { date: "2026-10-24", weekday: 6, planned: false, done: false },
      { date: "2026-10-25", weekday: 7, planned: false, done: false },
    ],
  },
  active_tasks: [
    {
      assignment_id: "11111111-1111-4111-8111-111111111111",
      task_id: "22222222-2222-4222-8222-222222222222",
      task_key: "demo-task-1",
      project_key: "semantic-search-rd",
      title: "Семантический поиск по документам",
      status: "in_progress",
      next_action: "send_work",
      open_contributions: 0,
    },
  ],
  roles: [
    {
      track_key: "python",
      title: "Python-разработчик",
      state: "active",
      attempt_number: 2,
      completed_milestones: 1,
      total_milestones: 2,
    },
  ],
  monthly_plan: null,
};

function renderHome(
  override: Partial<DevelopmentOverviewView> = {},
  seed?: (client: QueryClient) => void,
) {
  const onOpenTarget = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  seed?.(client);
  const view = render(
    <QueryClientProvider client={client}>
      <ParticipantHomeV2Body
        overview={{ ...overview, ...override }}
        onOpenTarget={onOpenTarget}
        onOpenWorkspace={() => undefined}
        onRetry={() => undefined}
      />
    </QueryClientProvider>,
  );
  return { view, onOpenTarget };
}

afterAll(() => {
  vi.restoreAllMocks();
});

describe("participant home v2", () => {
  it("keeps next outcome, grade and weekly focus on one authorized snapshot", () => {
    renderHome();
    expect(screen.getAllByText("Python: основы").length).toBeGreaterThan(0);
    expect(screen.getByTestId("grade-summary")).toHaveTextContent("Уровень Impulse");
    expect(screen.getByTestId("grade-summary").dataset.gradeState).toBe("loading");
    expect(screen.getByTestId("weekly-focus")).toHaveTextContent("План недели");
    const [firstTask] = overview.active_tasks;
    expect(firstTask === undefined ? "missing" : TASK_NEXT_ACTION_LABELS[firstTask.next_action]).toBe(
      "Отправить работу",
    );
  });

  it("reports the honest not-evaluable grade without fabricated values", () => {
    renderHome();
    const grade = screen.getByTestId("grade-summary");
    expect(grade.textContent).toContain("Уровень Impulse");
    expect(grade.textContent).not.toMatch(/готовность: \d/);
  });

  it("opens the canonical target of the next outcome", () => {
    const { onOpenTarget } = renderHome();
    fireEvent.click(screen.getByText("Перейти к шагу"));
    expect(onOpenTarget).toHaveBeenCalledWith("course", "python-base");
  });

  it("uses the real target kind for the hero CTA, without inventing XP or duration", () => {
    const { onOpenTarget } = renderHome({ active_tasks: [] });
    const courseCta = screen.getByRole("button", { name: /Продолжить обучение/ });
    expect(courseCta).toHaveClass("home-v2-primary--learning");
    fireEvent.click(courseCta);
    expect(onOpenTarget).toHaveBeenCalledWith("course", "python-base");
    const nextStep = screen.getByTestId("next-outcome-course");
    expect(nextStep).toHaveTextContent("Этап 1");
    expect(nextStep).toHaveTextContent("Python-разработчик");
    expect(nextStep).not.toHaveTextContent("+250 XP");
    expect(nextStep).not.toHaveTextContent("1,5 часа");
    expect(nextStep).toHaveTextContent("К выполнению");
  });

  it("retains task wording when a real active task is recommended", () => {
    const { onOpenTarget } = renderHome();
    const taskCta = screen.getByRole("button", { name: /Продолжить задачу/ });
    expect(taskCta).not.toHaveClass("home-v2-primary--learning");
    fireEvent.click(taskCta);
    expect(onOpenTarget).toHaveBeenCalledWith("task", overview.active_tasks[0]?.task_id);
  });

  it("explains the selected day and marks planned work separately from completion", () => {
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: /20 октября/ }));
    expect(
      screen.getByText("День подтверждён квалификационным действием."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /24 октября/ }));
    expect(screen.getByText("Не запланирован по ритму недели.")).toBeInTheDocument();
  });

  it("opens the weekly plan and reports only verified days, then restores focus", async () => {
    renderHome();
    const trigger = screen.getByRole("button", { name: "План недели" });
    trigger.focus();
    fireEvent.click(trigger);
    const modal = screen.getByRole("dialog", { name: "План недели" });
    expect(modal).toHaveTextContent("Выполнено 2 из 5");
    expect(modal).toHaveTextContent("Запланировано");
    fireEvent.keyDown(modal, { key: "Escape" });
    await waitFor(() => {expect(screen.queryByRole("dialog", { name: "План недели" })).toBeNull();});
    expect(trigger).toHaveFocus();
  });

  it("keeps one canonical task row for the next outcome task", () => {
    const { onOpenTarget } = renderHome();
    expect(within(screen.getByTestId("active-tasks")).getByText("Семантический поиск по документам")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Открыть задачу"));
    expect(onOpenTarget).toHaveBeenCalledWith("task", overview.active_tasks[0]?.task_id);
  });

  it("renders an explanatory empty state without a next outcome", () => {
    renderHome({ next_outcome: null });
    expect(screen.getByText(/Активной траектории нет/)).toBeInTheDocument();
  });
  it("preserves approved artwork and reference section ordering", () => {
    const { view } = renderHome();
    const heroArt = view.container.querySelector<HTMLImageElement>(".home-v2-hero-art");
    const buddyArt = view.container.querySelector<HTMLImageElement>(".home-v2-buddy-content img");
    expect(heroArt?.getAttribute("src")).toBe("/home-reference/mountain-path.svg");
    expect(buddyArt?.getAttribute("src")).toBe("/home-reference/buddy.svg");
    const work = view.container.querySelector(".home-v2-work-column");
    expect(work?.firstElementChild).toHaveClass("home-v2-next-outcome");
    expect(work?.lastElementChild).toHaveClass("home-v2-tasks");
    const insights = view.container.querySelector(".home-v2-insights-column");
    expect(insights?.firstElementChild).toHaveClass("home-v2-buddy");
    expect(insights?.lastElementChild).toHaveClass("home-v2-passport");
  });

  it("opens approved grade panels and restores keyboard focus without invented grade values", async () => {
    renderHome();
    const opener = screen.getByRole("button", { name: /Все уровни/ });
    opener.focus();
    fireEvent.click(opener);
    const levels = screen.getByRole("dialog", { name: "Карта уровней" });
    expect(levels).toHaveTextContent("L0");
    expect(levels).not.toHaveTextContent("88%");
    fireEvent.keyDown(levels, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => { expect(opener).toHaveFocus(); });
    fireEvent.click(screen.getByRole("button", { name: /Следующий уровень/ }));
    const details = screen.getByRole("dialog", { name: "Требования следующего грейда" });
    expect(details).toHaveTextContent("Сервис учебных уровней недоступен");
    fireEvent.click(screen.getByRole("button", { name: "Закрыть панель" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });


  it("shows the role's exact required courses and opens the unfinished course in Bootcamp", () => {
    const level: ImpulseRoleLevel = {
      track_key: "python",
      level: 0,
      cycle_number: 1,
      curriculum_state: "published",
      completed_courses: 1,
      required_courses: 2,
      approved_practices: 0,
      credited_practices: 0,
      required_practices: 1,
      advance_ready: false,
      policy_version: 1,
      max_level: 3,
      history: [],
      required_course_keys: ["python-base", "python-agents"],
    };
    const { onOpenTarget } = renderHome({}, (client) => {
      client.setQueryData(roleLevelQueryKey("python"), level);
      client.setQueryData(learningSummaryQueryKey, {
        started_courses: 2,
        finished_courses: 1,
        completed_lessons: 9,
        approved_practices: 0,
        credited_practices: 0,
        courses: [
          { course_key: "python-base", title: "Python: основы", completed_units: 8, total_units: 8,
            finished: true, certificate_id: "cert-python-base", finished_at: "2026-10-20",
            updated_at: "2026-10-20", practice_status: null, practical_certificate_id: null },
          { course_key: "python-agents", title: "Разработка AI-агентов", completed_units: 1, total_units: 8,
            finished: false, certificate_id: null, finished_at: null,
            updated_at: "2026-10-21", practice_status: null, practical_certificate_id: null },
        ],
      });
      client.setQueryData(["bootcamp-catalog"], [
        { key: "python-base", title: "Python: основы", completion_state: "verified" },
        { key: "python-agents", title: "Разработка AI-агентов", completion_state: "reported" },
      ]);
    });
    fireEvent.click(screen.getByRole("button", { name: /Следующий уровень/ }));
    const dialog = screen.getByRole("dialog", { name: "Требования следующего грейда" });
    const courseList = within(dialog).getByTestId("home-grade-required-courses");
    expect(courseList).toHaveTextContent("Обязательные курсы · 1/2");
    expect(dialog).toHaveTextContent("Практика для уровня: 0/1");
    expect(courseList).toHaveTextContent("Python: основы");
    expect(courseList).toHaveTextContent("Разработка AI-агентов");
    expect(courseList).toHaveTextContent("Пройден");
    expect(within(courseList).queryByRole("button", { name: /Пройти курс «Python: основы»/ })).toBeNull();
    fireEvent.click(within(courseList).getByRole("button", { name: "Продолжить курс «Разработка AI-агентов»" }));
    expect(onOpenTarget).toHaveBeenCalledWith("course", "python-agents", "python");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers a direct Start action for an unstarted required course", () => {
    renderHome({}, (client) => {
      client.setQueryData(roleLevelQueryKey("python"), {
        track_key: "python", level: 0, cycle_number: 1, curriculum_state: "published",
        completed_courses: 0, required_courses: 1, approved_practices: 0, credited_practices: 0,
        required_practices: 1, advance_ready: false, policy_version: 1, history: [],
        required_course_keys: ["python-base"],
      } satisfies ImpulseRoleLevel);
      client.setQueryData(learningSummaryQueryKey, {
        started_courses: 0, finished_courses: 0, completed_lessons: 0,
        approved_practices: 0, credited_practices: 0, courses: [],
      });
      client.setQueryData(["bootcamp-catalog"], [
        { key: "python-base", title: "Python: основы", completion_state: "not_started" },
      ]);
    });
    fireEvent.click(screen.getByRole("button", { name: /Следующий уровень/ }));
    const courseList = screen.getByTestId("home-grade-required-courses");
    expect(courseList).toHaveTextContent("Python: основы");
    expect(within(courseList).getByRole("button", { name: "Пройти курс «Python: основы»" })).toBeEnabled();
  });

  it("does not fabricate course names when the level has no published course keys", () => {
    renderHome({}, (client) => {
      client.setQueryData(roleLevelQueryKey("python"), {
        track_key: "python", level: 0, cycle_number: 1, curriculum_state: "published",
        completed_courses: 0, required_courses: 2, approved_practices: 0, credited_practices: 0,
        required_practices: 1, advance_ready: false, policy_version: 1, history: [],
      } satisfies ImpulseRoleLevel);
    });
    fireEvent.click(screen.getByRole("button", { name: /Следующий уровень/ }));
    const list = screen.getByTestId("home-grade-required-courses");
    expect(list).toHaveTextContent("Перечень обязательных курсов пока не получен");
    expect(within(list).queryByRole("button")).toBeNull();
  });

  it("renders grade ring from API readiness rather than a fixed decoration", () => {
    const custom = {
      ...overview.concepts,
      career_grade: {
        ...overview.concepts.career_grade,
        state: "evaluable" as const,
        current_grade: "2",
        target_grade: "3",
        readiness_percent: 50,
      },
    };
    const { view } = renderHome({ concepts: custom });
    const ring = view.container.querySelector<HTMLElement>(".home-v2-ring");
    expect(ring?.style.background).toContain("0deg");
    expect(screen.getByTestId("grade-summary")).not.toHaveTextContent("50%");
  });

  it("shows no invented ring fill when grade evaluation is unavailable", () => {
    const { view } = renderHome();
    const ring = view.container.querySelector<HTMLElement>(".home-v2-ring");
    expect(ring?.style.background).toContain("0deg");
  });


});
