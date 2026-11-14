import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImpulseRoleLevel } from "../impulse-role-level";
import { roleLevelQueryKey } from "../impulse-role-level";
import { overviewFixture } from "../participant-home-v2/fixture";
import { PixelParticipantShell, type PixelParticipantShellProps } from "./PixelParticipantShell";

const level: ImpulseRoleLevel = {
  track_key:"python",level:0,cycle_number:1,
  curriculum_state:"published",completed_courses:1,required_courses:2,
  credited_practices:0,approved_practices:0,required_practices:1,
  advance_ready:false,history:[],policy_version:1,max_level:3,
};
beforeEach(() => { window.localStorage.clear(); });
afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-impulse-visual-mode");
});

function mount(overrides: Partial<PixelParticipantShellProps> = {}) {
  const client = new QueryClient({
    defaultOptions:{queries:{retry:false,staleTime:Infinity,gcTime:0}},
  });
  client.setQueryData(roleLevelQueryKey("python"),level);
  client.setQueryData(["talent-passport"],{skills:[
    {key:"Python",practical_level:"Уверенный",confirmed_case_count:1},
  ]});
  const calls = {
    onOpenTarget:vi.fn(),onOpenWorkspace:vi.fn(),onOpenNavigation:vi.fn(),
    onOpenTools:vi.fn(),onOpenNotifications:vi.fn(),onLogout:vi.fn(),
    onSearchChange:vi.fn(),onSearchSelect:vi.fn(),
  };
  const props: PixelParticipantShellProps = {
    overview:overviewFixture,displayName:"Тестовый участник",roleName:"Участник",
    search:"",searchResults:[],unreadNotifications:0,
    ...calls,...overrides,
  };
  render(<QueryClientProvider client={client}><PixelParticipantShell {...props}/></QueryClientProvider>);
  return calls;
}

describe("pixel dashboard live shell", () => {
  it("renders the real authenticated title and handles the canonical prioritized task", () => {
    const actions=mount();
    expect(screen.getByTestId("pixel-live-shell")).toHaveAttribute("data-loading","false");
    expect(screen.getByTestId("pixel-live-shell")).toHaveAttribute("data-partial-data","false");
    expect(screen.getByRole("heading",{name:overviewFixture.active_tasks[0]?.title})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:/Открыть задачу/i}));
    expect(actions.onOpenTarget).toHaveBeenCalledWith(
      "task",overviewFixture.active_tasks[0]?.task_id,undefined,
    );
  });

  it("cycles from blue moon to midnight, persists preference and retains search callback", () => {
    const actions=mount();
    expect(document.documentElement.dataset.impulseVisualMode).toBe("blue");
    fireEvent.click(screen.getByRole("button",{name:/синяя луна/i}));
    expect(document.documentElement.dataset.impulseVisualMode).toBe("midnight");
    expect(localStorage.getItem("impulse-visual-mode")).toBe("midnight");
    fireEvent.change(screen.getByRole("searchbox",{name:"Поиск по платформе"}),{
      target:{value:"курс"},
    });
    expect(actions.onSearchChange).toHaveBeenCalledWith("курс");
  });

  it("preserves real tools and navigation actions behind compact disclosure", () => {
    const actions=mount();
    fireEvent.click(screen.getByRole("button",{name:"Открыть навигацию"}));
    expect(actions.onOpenNavigation).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button",{name:"Мой путь"}));
    expect(actions.onOpenWorkspace).toHaveBeenCalledWith("trajectory");
    fireEvent.click(screen.getByText("Инструменты"));
    fireEvent.click(screen.getByRole("button",{name:/Открыть инструменты/i}));
    expect(actions.onOpenTools).toHaveBeenCalledOnce();
  });

  it("never displays unknown level and verified skills as completed successes", () => {
    const src={...overviewFixture,roles:[],next_outcome:null,active_tasks:[]};
    mount({overview:src});
    expect(screen.queryByText("L0")).toBeNull();
    expect(screen.getByRole("button",{name:/Выбрать траекторию/i})).toBeInTheDocument();
  });
});
