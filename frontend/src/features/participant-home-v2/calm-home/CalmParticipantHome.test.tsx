import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { roleLevelQueryKey, type ImpulseRoleLevel } from "../../impulse-role-level";
import type { DevelopmentOverviewView } from "../client";
import { overviewQueryKey } from "../client";
import { overviewFixture } from "../fixture";
import { ParticipantHomeV2 } from "../page";
import { CalmParticipantHome } from "./CalmParticipantHome";

const publishedLevel: ImpulseRoleLevel = {
  track_key: "python",
  level: 1,
  cycle_number: 2,
  curriculum_state: "published",
  completed_courses: 1,
  required_courses: 3,
  credited_practices: 1,
  approved_practices: 0,
  required_practices: 2,
  advance_ready: false,
  history: [],
  policy_version: 1,
  max_level: 3,
  required_course_keys: [],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderCalmHome(
  override: Partial<DevelopmentOverviewView> = {},
  opts: {
    includeLevel?: boolean;
    includePassport?: boolean;
    buddy?: boolean;
    passportSkills?: { key: string; practical_level: string; confirmed_case_count: number }[];
  } = {},
) {
  const onOpenTarget = vi.fn();
  const onOpenWorkspace = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: 0 } },
  });
  if (opts.includeLevel ?? true) client.setQueryData(roleLevelQueryKey("python"), publishedLevel);
  if (opts.includePassport ?? true) client.setQueryData(["talent-passport"], {
    skills: opts.passportSkills ?? [{ key: "Python", practical_level: "Уверенный", confirmed_case_count: 1 }],
  });
  const view = render(
    <QueryClientProvider client={client}>
      <CalmParticipantHome
        overview={{ ...overviewFixture, ...override }}
        onOpenTarget={onOpenTarget}
        onOpenWorkspace={onOpenWorkspace}
        buddyAvailable={opts.buddy}
      />
    </QueryClientProvider>,
  );
  return { onOpenTarget, onOpenWorkspace, client, container: view.container };
}

describe("calm participant homepage", () => {
  it("shows a single priority CTA for actionable work and uses its canonical task id", () => {
    const { onOpenTarget } = renderCalmHome();
    expect(screen.getByRole("heading", { name: "Главная" })).toBeTruthy();
    const focus = screen.getByRole("region", { name: /Семантический поиск по документам/ });
    expect(focus.querySelectorAll(".calm-home__primary")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Открыть задачу" }));
    expect(onOpenTarget).toHaveBeenCalledWith("task", overviewFixture.active_tasks[0]?.task_id);
  });

  it("never promotes pending review or originality dispute into a submit action", () => {
    const { onOpenTarget } = renderCalmHome({
      active_tasks: overviewFixture.active_tasks.map((task) => ({
        ...task,
        next_action: "dispute_pending",
      })),
    });
    expect(screen.getByRole("heading", { name: "Python: основы" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Продолжить обучение" }));
    expect(onOpenTarget).toHaveBeenCalledWith("course", "python-base", "python");
    fireEvent.click(screen.getByText("Задачи и неделя"));
    expect(screen.getByText("Идёт спор по оригинальности")).toBeTruthy();
  });

  it("does not turn a stale or unsupported outcome into an apparently usable task", () => {
    const next = overviewFixture.next_outcome;
    if (!next) throw new Error("Fixture requires a real next outcome");
    const { onOpenTarget, onOpenWorkspace } = renderCalmHome({
      active_tasks: [],
      next_outcome: { ...next, stale_reason: "Состояние пересчитывается" },
    });
    expect(screen.queryByRole("button", { name: "Продолжить обучение" })).toBeNull();
    expect(screen.getByRole("button", { name: "Выбрать траекторию" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Выбрать траекторию" }));
    expect(onOpenWorkspace).toHaveBeenCalledWith("trajectory");
    expect(onOpenTarget).not.toHaveBeenCalled();
  });

  it("presents a quiet first fold without marketing overlines or dashboard art", () => {
    const { container } = renderCalmHome();
    expect(container.querySelector(".calm-home__eyebrow")).toBeNull();
    expect(container.querySelector(".calm-home__focus-aside")).toBeNull();
    expect(container.querySelector(".calm-home__focus-kicker")).toBeNull();
    expect(container.querySelectorAll(".calm-home__primary")).toHaveLength(1);
    expect(screen.getByText("Продолжить")).toBeTruthy();
    // The selected priority action now flows straight into the next-level panel:
    // no redundant KPI row, while lower course/practice requirements remain.
    expect(container.querySelector(".calm-home__metrics")).toBeNull();
    const focus = container.querySelector(".calm-home__focus");
    expect(focus?.nextElementSibling?.classList.contains("calm-home__path")).toBe(true);
    expect(screen.getByRole("heading", { name: "Следующий уровень" })).toBeTruthy();
  });

  it("falls back to the next real course when there is no actionable task", () => {
    const { onOpenTarget } = renderCalmHome({ active_tasks: [] });
    expect(screen.getByRole("heading", { name: "Python: основы" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Продолжить обучение" }));
    expect(onOpenTarget).toHaveBeenCalledWith("course", "python-base", "python");
  });

  it("offers the trajectory if neither task nor next outcome exists", () => {
    const { onOpenWorkspace } = renderCalmHome({ active_tasks: [], next_outcome: null });
    fireEvent.click(screen.getByRole("button", { name: "Выбрать траекторию" }));
    expect(onOpenWorkspace).toHaveBeenCalledWith("trajectory");
  });

  it("does not fabricate a known level or confirmed skills when API projections are missing", () => {
    renderCalmHome({}, { includeLevel: false, includePassport: false });
    expect(screen.queryByTestId("calm-impulse-level")).toBeNull();
    expect(screen.queryByTestId("calm-verified-skills")).toBeNull();
    expect(screen.queryByText("L0")).toBeNull();
    expect(screen.getByText("Данные об уровне пока недоступны.")).toBeTruthy();
  });

  it("counts only skills with confirmed cases and does not advertise unverified ones", () => {
    renderCalmHome({}, {
      passportSkills: [
        { key: "Unverified Skill", practical_level: "Начальный", confirmed_case_count: 0 },
        { key: "Verified Skill", practical_level: "Уверенный", confirmed_case_count: 2 },
      ],
    });
    expect(screen.queryByTestId("calm-verified-skills")).toBeNull();
    expect(screen.queryByText("С подтверждёнными кейсами")).toBeNull();
    fireEvent.click(screen.getByText("Инструменты"));
    expect(screen.queryByText(/Подтверждённый навык: Unverified Skill/)).toBeNull();
    expect(screen.getByText(/Подтверждённый навык: Verified Skill/)).toBeTruthy();
  });

  it("shows zero rather than fictitious confirmation when skills have no evidence", () => {
    renderCalmHome({}, {
      passportSkills: [{ key: "Still learning", practical_level: "Начальный", confirmed_case_count: 0 }],
    });
    expect(screen.queryByTestId("calm-verified-skills")).toBeNull();
    fireEvent.click(screen.getByText("Инструменты"));
    expect(screen.queryByText(/Подтверждённый навык:/)).toBeNull();
  });

  it("keeps requirements hidden until asked and shows real practice counts", () => {
    renderCalmHome();
    expect(screen.queryByTestId("calm-home-requirements")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Требования уровня" }));
    expect(screen.getByTestId("calm-home-requirements")).toHaveTextContent("Засчитано: 1 из 2");
    expect(screen.getByTestId("calm-home-requirements")).toHaveTextContent(/карьерный грейд/i);
  });

  it("shows source-backed weekly activity without inferred completion", () => {
    renderCalmHome();
    fireEvent.click(screen.getByText("Задачи и неделя"));
    fireEvent.click(screen.getByRole("button", { name: /19 октября.*запланировано/i }));
    expect(screen.getByText(/Запланирован, пока не выполнен/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /20 октября.*выполнено/i }));
    expect(screen.getByText(/День подтверждён выполненным действием/)).toBeTruthy();
  });

  it("keeps secondary work and tools collapsed until explicitly requested", () => {
    renderCalmHome();
    const work = screen.getByTestId("calm-home-work-disclosure");
    expect(work.hasAttribute("open")).toBe(false);
    expect(screen.getByText("Инструменты").closest("details")?.hasAttribute("open")).toBe(false);
    fireEvent.click(screen.getByText("Задачи и неделя"));
    expect(work.hasAttribute("open")).toBe(true);
    fireEvent.click(screen.getByText("Инструменты"));
    expect(screen.getByText("Инструменты").closest("details")?.hasAttribute("open")).toBe(true);
  });

  it("keeps AI Buddy optional and does not show its shortcut without permission", () => {
    renderCalmHome({}, { buddy: false });
    expect(screen.queryByRole("button", { name: /AI Buddy/ })).toBeNull();
    expect(screen.queryByText(/Траектория, скилл-паспорт и AI Buddy/)).toBeNull();
  });

  it("shows calm homepage by default while preserving explicit legacy rollback", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: 0 } } });
    client.setQueryData(overviewQueryKey, overviewFixture);
    client.setQueryData(roleLevelQueryKey("python"), publishedLevel);
    client.setQueryData(["talent-passport"], { skills: [] });

    const view = render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/workspace/0?home=legacy"]}>
          <ParticipantHomeV2 onOpenTarget={() => undefined} onOpenWorkspace={() => undefined} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.queryByTestId("calm-participant-home")).toBeNull();
    expect(view.container.querySelector(".home-v2-hero")).toBeTruthy();
    view.unmount();

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/workspace/0"]}>
          <ParticipantHomeV2 onOpenTarget={() => undefined} onOpenWorkspace={() => undefined} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("calm-participant-home")).toBeTruthy();
    expect(screen.queryByTestId("grade-summary")).toBeNull();
  });
});
