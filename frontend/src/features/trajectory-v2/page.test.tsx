import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { overviewFixture } from "../participant-home-v2/fixture";
import type { DevelopmentOverviewView } from "../participant-home-v2/client";
import { TrajectoryV2Body } from "./page";

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

function renderShell(url: string, overview: DevelopmentOverviewView = { ...overviewFixture, roles: rolesFixture }) {
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

describe("trajectory v2 master-detail shell", () => {
  it("renders role cards with state labels and marks the primary trajectory", () => {
    renderShell("/workspace/1");
    const pythonCard = screen.getByRole("button", { name: /Python-разработчик/ });
    expect(pythonCard).toHaveAttribute("aria-pressed", "true");
    expect(pythonCard.textContent).toContain("Активная");
    expect(pythonCard.textContent).toContain("Основная");
    expect(screen.getByRole("button", { name: /Data-аналитик/ }).textContent).toContain("На паузе");
    expect(
      screen.getByRole("button", { name: /Продакт-менеджер/ }).textContent,
    ).toContain("Не выбрана");
    expect(screen.getByTestId("trajectory-role-detail").dataset.roleKey).toBe("python");
  });

  it("shows no fabricated personal progress for an unselected role", () => {
    renderShell("/workspace/1");
    fireEvent.click(screen.getByRole("button", { name: /Продакт-менеджер/ }));
    const detail = screen.getByTestId("trajectory-role-detail");
    expect(detail.dataset.roleKey).toBe("product");
    expect(detail.textContent).toContain("Персональный прогресс отсутствует");
    expect(detail.textContent).toContain("этапов в каталоге: 4");
    expect(detail.textContent).not.toContain("Этапов пройдено");
    const card = screen.getByRole("button", { name: /Продакт-менеджер/ });
    expect(card.textContent).not.toContain("из 4");
    expect(card.textContent).toContain("этапов в каталоге: 4");
  });

  it("switches between two trajectories without mixing their attempts", () => {
    renderShell("/workspace/1");
    const dataCard = screen.getByRole("button", { name: /Data-аналитик/ });
    fireEvent.click(dataCard);
    let detail = screen.getByTestId("trajectory-role-detail");
    expect(detail.dataset.roleKey).toBe("data");
    expect(detail.textContent).toContain("Попытка 1");
    expect(detail.textContent).toContain("Этапов пройдено: 0 из 3");
    fireEvent.click(screen.getByRole("button", { name: /Python-разработчик/ }));
    detail = screen.getByTestId("trajectory-role-detail");
    expect(detail.dataset.roleKey).toBe("python");
    expect(detail.textContent).toContain("Попытка 2");
    expect(detail.textContent).toContain("Этапов пройдено: 1 из 2");
  });

  it("keeps the selection in the URL for back and forward", () => {
    const { locationRef } = renderShell("/workspace/1");
    fireEvent.click(screen.getByRole("button", { name: /Data-аналитик/ }));
    expect(locationRef()).toContain("role=data");
    fireEvent.click(screen.getByRole("button", { name: /Python-разработчик/ }));
    expect(locationRef()).toContain("role=python");
  });

  it("falls back to the primary trajectory when the URL role is unknown", () => {
    renderShell("/workspace/1?role=unknown-track");
    expect(screen.getByTestId("trajectory-role-detail").dataset.roleKey).toBe("python");
  });
});
