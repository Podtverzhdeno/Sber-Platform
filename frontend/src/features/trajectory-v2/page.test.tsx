import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { overviewFixture } from "../participant-home-v2/fixture";
import type { DevelopmentOverviewView } from "../participant-home-v2/client";
import { StageDetail, TrajectoryV2Body, primaryTrajectoryKey, roleVisualTone } from "./page";
import { milestoneState } from "./client";
import type { RoadmapView } from "./client";

const rolesFixture: DevelopmentOverviewView["roles"] = [
  {
    track_key: "python",
    title: "Python-разработчик",
    state: "active",
    attempt_number: 2,
    completed_milestones: 1,
    total_milestones: 2,
  },
  {
    track_key: "data",
    title: "Data-аналитик",
    state: "paused",
    attempt_number: 1,
    completed_milestones: 0,
    total_milestones: 3,
  },
  {
    track_key: "product",
    title: "Продакт-менеджер",
    state: "unselected",
    attempt_number: null,
    completed_milestones: 0,
    total_milestones: 4,
  },
];

const roadmapFixture: RoadmapView = {
  track_key: "python",
  policy_version: 1,
  replacement_reason: null,
  milestones: [
    {
      key: "foundation",
      position: 1,
      title: "Фундамент",
      purpose: "База языка",
      skill: "python-core",
      target_kind: "course",
      target_key: "python-base",
      completed: true,
      deliverable: null, lab: null, estimated_hours: null,
    },
    {
      key: "api",
      position: 2,
      title: "API и сервисы",
      purpose: "Сервисный слой",
      skill: "python-web",
      target_kind: "course",
      target_key: "python-api",
      completed: false,
      deliverable: null, lab: null, estimated_hours: null,
    },
    {
      key: "capstone",
      position: 3,
      title: "Итоговый проект",
      purpose: "Комплексный проект",
      skill: "python-project",
      target_kind: "task",
      target_key: "demo-task-1",
      completed: false,
      deliverable: null, lab: null, estimated_hours: null,
    },
  ],
  next_step: null,
};

const roadmapWithNext: RoadmapView = {
  ...roadmapFixture,
  next_step: roadmapFixture.milestones[1] ?? null,
};

const dataRoadmap: RoadmapView = {
  track_key: "data",
  policy_version: 1,
  replacement_reason: null,
  milestones: roadmapFixture.milestones.map((m) => ({ ...m, key: `data-${m.key}` })),
  next_step: null,
};

function renderShell(
  url: string,
  options: { overview?: DevelopmentOverviewView; roadmaps?: RoadmapView[] } = {},
) {
  const overview = options.overview ?? { ...overviewFixture, roles: rolesFixture };
  let location = "";
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route
            path="/workspace/:section"
            element={
              <>
                <TrajectoryV2Body overview={overview} />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  function LocationProbe() {
    location = useLocation().search;
    return null;
  }
  return { view, locationRef: () => location };
}

function mockRoadmapsFetch() {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify([roadmapWithNext, dataRoadmap]), { status: 200 }),
      ),
    );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("trajectory role palette and single primary", () => {
  it("keeps exactly one gold primary, blue enrolled secondary and grey untouched role", () => {
    mockRoadmapsFetch();
    renderShell("/workspace/1", {
      overview: { ...overviewFixture, roles: rolesFixture },
    });
    const roles = screen.getAllByTestId("trajectory-role-card");
    const primary = roles.find((role) => role.getAttribute("data-role-key") === "python");
    const secondary = roles.find((role) => role.getAttribute("data-role-key") === "data");
    const untouched = roles.find((role) => role.getAttribute("data-role-key") === "product");
    expect(roles.filter((role) => role.getAttribute("data-tone") === "primary")).toHaveLength(1);
    expect(primary).toHaveAttribute("data-tone", "primary");
    expect(secondary).toHaveAttribute("data-tone", "learning");
    expect(untouched).toHaveAttribute("data-tone", "unselected");
    if (!secondary || !untouched) throw new Error("Secondary and untouched role fixtures are required");

    fireEvent.click(secondary);
    expect(primary).toHaveAttribute("data-tone", "primary");
    expect(secondary).toHaveAttribute("aria-pressed", "true");
    expect(secondary).toHaveAttribute("data-tone", "learning");
    expect(screen.getByTestId("trajectory-role-detail")).toHaveAttribute("data-tone", "learning");

    fireEvent.click(untouched);
    expect(untouched).toHaveAttribute("aria-pressed", "true");
    expect(untouched).toHaveAttribute("data-tone", "unselected");
    expect(screen.getByTestId("trajectory-role-detail")).toHaveAttribute("data-tone", "unselected");
    expect(roles.filter((role) => role.getAttribute("data-tone") === "primary")).toHaveLength(1);
  });

  it("never creates two primary paths or promotes a role without enrollment", () => {
    const twoActive = rolesFixture.map((role) =>
      role.track_key === "data" ? { ...role, state: "active" as const } : role,
    );
    const overview = { ...overviewFixture, roles: twoActive };
    expect(primaryTrajectoryKey(overview)).toBe("python");
    expect(primaryTrajectoryKey({ ...overview, next_outcome: null })).toBe("python");
    expect(primaryTrajectoryKey({
      ...overview,
      next_outcome: { ...overviewFixture.next_outcome!, trajectory_key: "product" },
    })).toBe("python");
    expect(primaryTrajectoryKey({
      ...overview,
      next_outcome: null,
      roles: [rolesFixture[2]!],
    })).toBeNull();
    expect(roleVisualTone(rolesFixture[2]!, true)).toBe("unselected");
  });
});

describe("trajectory v2 stage path", () => {
  it("renders the data-driven stage path from the versioned roadmap", async () => {
    const fetchSpy = mockRoadmapsFetch();
    renderShell("/workspace/1");
    const stages = await screen.findAllByRole("button", {
      name: /Фундамент|API и сервисы|Итоговый проект/,
    });
    expect(stages).toHaveLength(3);
    expect(stages[0]).toHaveAttribute("data-stage-state", "completed");
    expect(stages[1]).toHaveAttribute("data-stage-state", "current");
    expect(stages[2]).toHaveAttribute("data-stage-state", "locked");
    expect(screen.getByTestId("trajectory-stages").textContent).toContain("1 завершено · 3 этапов");
    fetchSpy.mockRestore();
  });

  it("reveals stage detail on selection and keeps it in the URL", async () => {
    mockRoadmapsFetch();
    const { locationRef } = renderShell("/workspace/1");
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-stage-detail").dataset.stageKey).toBe("api");
    });
    fireEvent.click(screen.getByRole("button", { name: /Фундамент/ }));
    expect(screen.getByTestId("trajectory-stage-detail").dataset.stageKey).toBe("foundation");
    expect(locationRef()).toContain("stage=foundation");
    expect(screen.getByTestId("trajectory-stage-detail").textContent).toContain("База языка");
    expect(screen.getByTestId("trajectory-stage-detail").textContent).toContain(
      "Курс · python-base",
    );
  });

  it("explains prerequisites when a locked stage is selected", async () => {
    mockRoadmapsFetch();
    renderShell("/workspace/1");
    fireEvent.click(await screen.findByRole("button", { name: /Итоговый проект/ }));
    const detail = screen.getByTestId("trajectory-stage-detail");
    expect(detail.textContent).toContain("Этап откроется после завершения «API и сервисы»");
    expect(detail.textContent).toContain("Первый разрешённый шаг");
  });

  it("stages never mix across switched roles", async () => {
    mockRoadmapsFetch();
    renderShell("/workspace/1");
    fireEvent.click(await screen.findByRole("button", { name: /AI Data Engineer/ }));
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /API и сервисы/ })[0]).toHaveAttribute(
        "data-stage-state",
        "available",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /API и сервисы/ }));
    const detail = screen.getByTestId("trajectory-stage-detail");
    expect(detail.dataset.stageKey).toBe("data-api");
    expect(detail.textContent).toContain("Сервисный слой");
  });

  it("derives milestone states only from roadmap server truth", () => {
    const m1 = roadmapFixture.milestones[0] as NonNullable<RoadmapView["milestones"][number]>;
    const m2 = roadmapFixture.milestones[1] as NonNullable<RoadmapView["milestones"][number]>;
    const m3 = roadmapFixture.milestones[2] as NonNullable<RoadmapView["milestones"][number]>;
    expect(milestoneState(m1, roadmapWithNext.next_step)).toBe("completed");
    expect(milestoneState(m2, roadmapWithNext.next_step)).toBe("current");
    expect(milestoneState(m3, roadmapWithNext.next_step)).toBe("locked");
    expect(milestoneState(m2, null)).toBe("available");
  });

  it("shows an honest catalog note for an unselected role", async () => {
    mockRoadmapsFetch();
    renderShell("/workspace/1?role=product");
    await waitFor(() => expect(screen.getByTestId("trajectory-stages")).toBeInTheDocument());
    expect(screen.getByTestId("trajectory-role-detail").textContent).toContain(
      "Персональный прогресс отсутствует",
    );
  });

  it("renders stage detail labels via StageDetail", () => {
    render(
      <StageDetail
        milestone={roadmapFixture.milestones[2] as NonNullable<RoadmapView["milestones"][number]>}
        state="available"
        nextStep={null}
        role={rolesFixture[2] as NonNullable<DevelopmentOverviewView["roles"][number]>}
      />,
    );
    expect(screen.getByTestId("trajectory-stage-detail").textContent).toContain(
      "Задача · demo-task-1",
    );
  });
});
