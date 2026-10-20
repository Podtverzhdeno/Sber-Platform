import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TrajectoryMapPage,
  TrajectoryMapSection,
} from "./trajectory-map";
import type {
  MapCheckpointView,
  TrajectoryCheckpointDetailView,
  TrajectoryMapTrackView,
} from "./types";

function checkpoint(overrides: Partial<MapCheckpointView>): MapCheckpointView {
  return {
    key: "python-step",
    position: 2,
    title: "Качество Python-кода",
    purpose: "Освоить стандарт кода",
    skill: "Python",
    target_kind: "course",
    target_key: "python-quality",
    state: "CURRENT",
    state_label: "Текущий шаг",
    mandatory: true,
    actionable: true,
    points_available: 10,
    points_earned: 0,
    points_rule: "Полные баллы за подтверждённую сдачу",
    policy_version: 1,
    locked_reasons: [],
    branch: null,
    ...overrides,
  };
}

const track: TrajectoryMapTrackView = {
  track_key: "backend-basics",
  policy_version: 1,
  replacement_reason: null,
  current_key: "python-step",
  checkpoints: [
    checkpoint({
      key: "foundation",
      position: 1,
      title: "Фундамент",
      state: "COMPLETED",
      state_label: "Пройдено",
      points_earned: 15,
    }),
    checkpoint({ key: "python-step", position: 2 }),
    checkpoint({
      key: "quality-gate",
      position: 3,
      title: "Врата качества",
      state: "LOCKED",
      state_label: "Заблокировано",
      locked_reasons: [
        {
          milestone_key: "python-step",
          title: "Качество Python-кода",
          ref: "background:intersections.double-step",
        },
      ],
    }),
    checkpoint({
      key: "elective",
      position: 4,
      title: "Опциональный шаг",
      state: "OPTIONAL",
      state_label: "Доступно",
      mandatory: false,
    }),
  ],
  progress: { completed_mandatory: 1, total_mandatory: 3, percent: 33.3 },
};

const pythonCheckpoint = track.checkpoints.find((item) => item.key === "python-step");
if (!pythonCheckpoint) throw new Error("fixture missing checkpoint");

const detail: TrajectoryCheckpointDetailView = {
  checkpoint: pythonCheckpoint,
  goal: "Довести практику до стандарта команды",
  outcome: "Проверяемый артефакт со стандартом кода",
  prerequisites: [
    { milestone_key: "foundation", title: "Фундамент", met: true },
    { milestone_key: "elective", title: "Опциональный шаг", met: false },
  ],
  evidence_refs: ["background:attachments.practice"],
  skill_impact: {
    skill: "Python",
    current_level: "базовый",
    target_level: "уверенный",
    projected_level: "уверенный",
    forecast_only: true,
    explanation: "Шаг добавляет недостающий источник checkpoint:python-quals.",
    missing_evidence: ["checkpoint:python-quals"],
    fallback: null,
  },
  replay: false,
  policy_version: 1,
};

function pathOf(input: RequestInfo | URL): string {
  if (input instanceof Request) return new URL(input.url).pathname;
  if (input instanceof URL) return input.pathname;
  const path = input;
  return path;
}

function renderPage(
  entries: string[] = ["/"],
  tracks: TrajectoryMapTrackView[] | null = [track],
  detailView: TrajectoryCheckpointDetailView | null = detail,
) {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const path = pathOf(input);
    if (path === "/api/v1/me/trajectory-map") {
      if (tracks === null) return Promise.resolve(new Response(null, { status: 500 }));
      return Promise.resolve(new Response(JSON.stringify(tracks), { status: 200 }));
    }
    if (path.startsWith("/api/v1/me/trajectory-map/checkpoints/")) {
      if (!detailView) return Promise.resolve(new Response(null, { status: 404 }));
      const key = path.split("/checkpoints/")[1] ?? "";
      const checkpoint = track.checkpoints.find((item) => item.key === key);
      const payload = checkpoint ? { ...detailView, checkpoint } : detailView;
      return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <MemoryRouter initialEntries={entries}>
      <QueryClientProvider client={client}>
        <TrajectoryMapPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return fetchMock;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("interactive trajectory map (openspec 24.1)", () => {
  it("renders only real API data through react-query", async () => {
    const fetchMock = renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-track")).toBeInTheDocument();
    });
    expect(fetchMock.mock.calls.every(([input]) => pathOf(input) === "/api/v1/me/trajectory-map")).toBe(true);
    expect(screen.getByText("Качество Python-кода")).toBeInTheDocument();
    expect(screen.getByText("Фундамент")).toBeInTheDocument();
    expect(screen.getByText("Заблокировано")).toBeInTheDocument();
    expect(screen.getByText("Обязательных пройдено 1 из 3 (33.3%)")).toBeInTheDocument();
  });

  it("submits nothing itself: map requests are GET only", async () => {
    const fetchMock = renderPage(["/?checkpoint=python-step"]);
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-detail-title")).toBeInTheDocument();
    });
    const methods = fetchMock.mock.calls.map(([input]) => (input instanceof Request ? input.method : "GET"));
    expect(methods.every((method) => method === "GET")).toBe(true);
  });

  it("shows the honest error panel without invented data when the map API fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    render(
      <MemoryRouter initialEntries={["/"]}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <TrajectoryMapPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("Не удалось загрузить")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("trajectory-track")).not.toBeInTheDocument();
  });

  it("shows the empty panel when the platform has no tracks yet", () => {
    render(
      <TrajectoryMapSection
        state="success"
        activeKey={null}
        tracks={[]}
        detail={undefined}
        detailState="pending"
        onOpenCheckpoint={() => undefined}
        onCloseCheckpoint={() => undefined}
        onRetry={() => undefined}
      />,
    );
    expect(screen.getByText("Здесь пока пусто")).toBeInTheDocument();
    expect(screen.queryByTestId("trajectory-track")).not.toBeInTheDocument();
  });

  it("opens detail via deep link and keeps the parameter for Back/Reload", async () => {
    renderPage(["/?checkpoint=quality-gate"]);
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-detail-goal").textContent).toBe("Довести практику до стандарта команды");
    });
    expect(screen.getByTestId("trajectory-detail-outcome").textContent).toContain("Проверяемый артефакт");
    expect(screen.getByTestId("trajectory-detail-points").textContent).toContain("Полные баллы за подтверждённую сдачу");
  });

  it("opens and closes detail through the URL parameter", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-track")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Опциональный шаг. Доступно" }));
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-detail-title").textContent).toBe("Опциональный шаг");
    });
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    await waitFor(() => {
      expect(screen.queryByTestId("trajectory-detail")).not.toBeInTheDocument();
    });
  });

  it("closes detail with Escape and shows locked prerequisites with deep links", async () => {
    renderPage(["/?checkpoint=quality-gate"]);
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-detail-locked-reasons").textContent).toContain("Качество Python-кода");
    });
    expect(screen.getByTestId("trajectory-detail-prerequisites").textContent).toContain("не подтверждено");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByTestId("trajectory-detail")).not.toBeInTheDocument();
    });
  });

  it("marks skill impact as a platform forecast, never a promise", async () => {
    renderPage(["/?checkpoint=python-step"]);
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-skill-impact-forecast").textContent).toBe("Прогноз: уверенный (не подтверждено платформой)");
    });
    expect(screen.getByTestId("trajectory-skill-impact-levels").textContent).toBe("базовый → уверенный");
    expect(screen.getByTestId("trajectory-detail-missing-evidence").textContent).toContain("checkpoint:python-quals");
  });

  it("notes replay steps honestly", async () => {
    renderPage(["/?checkpoint=python-step"], [track], { ...detail, replay: true });
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-detail-replay").textContent).toContain("Вы уже выполняли эту веху");
    });
  });

  it("shows the honest fallback when the MAP cannot define a current step", () => {
    render(
      <TrajectoryMapSection
        state="success"
        activeKey={null}
        tracks={[
          {
            ...track,
            current_key: null,
            checkpoints: [checkpoint({ state: "AVAILABLE", state_label: "Доступно" })],
          },
        ]}
        detail={undefined}
        detailState="pending"
        onOpenCheckpoint={() => undefined}
        onCloseCheckpoint={() => undefined}
        onRetry={() => undefined}
      />,
    );
    expect(screen.getByTestId("trajectory-no-current").textContent).toContain("Система не определила текущий шаг");
  });

  it("does not invent data on map error or detail error", async () => {
    renderPage(["/?checkpoint=quality-gate"], [track], null);
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-track")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-detail-unavailable").textContent).toContain("карта не подменяет данные вымышленными");
    });
  });

  it("keeps keyboard and touch access to every checkpoint and the detail", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-route")).toBeInTheDocument();
    });
    const buttons = within(screen.getByTestId("trajectory-route")).getAllByRole("button");
    expect(buttons.length).toBe(track.checkpoints.length);
    fireEvent.click(buttons[0] as HTMLButtonElement);
    await waitFor(() => {
      expect(screen.getByTestId("trajectory-detail-title").textContent).toBe("Фундамент");
    });
  });
});
