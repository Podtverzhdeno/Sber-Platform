import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ImpulsePixelReference, type ImpulsePixelReferenceProps } from "./ImpulsePixelReference";
import { nextImpulseVisualMode } from "./visual-modes";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const model: ImpulsePixelReferenceProps["home"] = {
  roleTitle: "AI Security Engineer",
  moduleTrackTitle: "AI Agent Engineer",
  nextTitle: "Создание AI-агентов",
  nextKind: "course",
  nextState: "Следующий курс",
  nextDescription: "Учитесь создавать AI-агентов",
  nextActionText: "Продолжить",
  moduleProgress: { complete: 3, total: 6 },
  level: 0, nextLevel: 1,
  completedCourses: 1, requiredCourses: 2,
  activeTaskCount: 0, confirmedSkills: 2,
};

function props(overrides: Partial<ImpulsePixelReferenceProps> = {}): ImpulsePixelReferenceProps {
  return {
    mode: "blue", onModeChange: vi.fn(),
    displayName: "Проверочный участник", roleName: "Участник",
    search: "", searchResults: [], onSearchChange: vi.fn(),
    onSearchSelect: vi.fn(), onOpenNavigation: vi.fn(),
    onOpenNotifications: vi.fn(), onOpenJourney: vi.fn(),
    onContinue: vi.fn(), onOpenRequirements: vi.fn(),
    onOpenTasks: vi.fn(), onOpenTools: vi.fn(),
    onLogout: vi.fn(), onOpenRanking: vi.fn(), onOpenHelp: vi.fn(),
    home: model, ...overrides,
  };
}

describe("Impulse pixel reference", () => {
  it("cycles exactly sun, blue moon and midnight moon, without a fourth hidden mode", () => {
    expect(nextImpulseVisualMode("light")).toBe("blue");
    expect(nextImpulseVisualMode("blue")).toBe("midnight");
    expect(nextImpulseVisualMode("midnight")).toBe("light");
    const onModeChange = vi.fn();
    const p = props({mode:"blue",onModeChange});
    const view = render(<ImpulsePixelReference {...p} />);
    fireEvent.click(screen.getByRole("button", {name:/синяя луна/i}));
    expect(onModeChange).toHaveBeenCalledWith("midnight");
    view.rerender(<ImpulsePixelReference {...p} mode="midnight" />);
    fireEvent.click(screen.getByRole("button", {name:/тёмная луна/i}));
    expect(onModeChange).toHaveBeenCalledWith("light");
    view.rerender(<ImpulsePixelReference {...p} mode="light" />);
    fireEvent.click(screen.getByRole("button", {name:/солнце/i}));
    expect(onModeChange).toHaveBeenCalledWith("blue");
  });

  it("has no visible hamburger Menu and preserves accessible navigation through the brand", () => {
    const onOpenNavigation = vi.fn();
    render(<ImpulsePixelReference {...props({onOpenNavigation})} />);
    expect(screen.queryByText("Меню")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name:"Открыть навигацию"}));
    expect(onOpenNavigation).toHaveBeenCalledOnce();
    expect(screen.getByText("Impulse")).toBeInTheDocument();
  });

  it("keeps an accessible home heading without showing the redundant visible title", () => {
    const { container } = render(<ImpulsePixelReference {...props()} />);
    const heading = screen.getByRole("heading", { name: "Обзор участника" });
    expect(heading).toHaveClass("sr-only");
    expect(heading).toHaveAttribute("id", "workspace-title");
    expect(container.querySelector(".impulse-pixel__heading h1:not(.sr-only)")).toBeNull();
    expect(container.querySelector(".impulse-pixel__heading p")).toBeNull();
    expect(screen.queryByText("AI Security Engineer")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Мой путь" })).toBeEnabled();
  });

  it("renders real current module and both dynamic progress values", () => {
    render(<ImpulsePixelReference {...props()} />);
    expect(screen.getByRole("heading", {name:"Создание AI-агентов"})).toBeInTheDocument();
    expect(screen.getByText("Текущий модуль · AI Agent Engineer")).toBeInTheDocument();
    expect(screen.queryByText("AI Security Engineer")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar", {name:"Прогресс текущего курса"})).toHaveAttribute("aria-valuenow","50");
    expect(screen.getByRole("progressbar", {name:"Прогресс обязательных курсов"})).toHaveAttribute("aria-valuenow","50");
    expect(screen.getByText("С подтверждёнными кейсами")).toBeInTheDocument();
  });

  it("does not invent numeric progress when backend fields are unknown", () => {
    render(<ImpulsePixelReference {...props({home:{...model, moduleProgress:null, level:null,nextLevel:null,completedCourses:null,requiredCourses:null,confirmedSkills:null}})} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText("L0")).not.toBeInTheDocument();
    expect(screen.getByText("Выбрать траекторию")).toBeInTheDocument();
  });

  it("calls existing data-bound continuation and trajectory handlers", () => {
    const onContinue=vi.fn(),onOpenJourney=vi.fn();
    render(<ImpulsePixelReference {...props({onContinue,onOpenJourney})}/>);
    fireEvent.click(screen.getByRole("button",{name:/Продолжить/i}));
    expect(onContinue).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button",{name:"Мой путь"}));
    expect(onOpenJourney).toHaveBeenCalledOnce();
  });

  it("does not repeat required course and practice counts and opens the actual trajectory", () => {
    const onOpenRequirements = vi.fn();
    render(<ImpulsePixelReference {...props({ onOpenRequirements })} />);
    expect(screen.queryByText(/Обязательные курсы:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Практика: [0-9]/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Требования уровня" }));
    expect(onOpenRequirements).toHaveBeenCalledOnce();
  });

  it("opens the profile without losing ranking, help or logout", () => {
    const onLogout=vi.fn(),onOpenRanking=vi.fn();
    render(<ImpulsePixelReference {...props({onLogout,onOpenRanking})}/>);
    fireEvent.click(screen.getByRole("button",{name:"Меню профиля"}));
    expect(screen.getByRole("menu",{name:"Профиль"})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem",{name:"Рейтинг"}));
    expect(onOpenRanking).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button",{name:"Меню профиля"}));
    fireEvent.click(screen.getByRole("menuitem",{name:"Выйти"}));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("keeps the real search callback and keyboard shortcut", () => {
    const onSearchChange=vi.fn(),onSearchSelect=vi.fn();
    render(<ImpulsePixelReference {...props({
      search:"траек",onSearchChange,onSearchSelect,
      searchResults:[{id:"traj",title:"Моя траектория",context:"Раздел"}],
    })} />);
    fireEvent.focus(screen.getByRole("searchbox",{name:"Поиск по платформе"}));
    expect(screen.getByRole("option",{name:/Моя траектория/i})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option",{name:/Моя траектория/i}));
    expect(onSearchSelect).toHaveBeenCalledWith("traj");
    fireEvent.change(screen.getByRole("searchbox",{name:"Поиск по платформе"}),{target:{value:"другая"}});
    expect(onSearchChange).toHaveBeenCalledWith("другая");
    fireEvent.keyDown(document,{key:"k",ctrlKey:true});
    expect(screen.getByRole("searchbox",{name:"Поиск по платформе"})).toHaveFocus();
  });
});
