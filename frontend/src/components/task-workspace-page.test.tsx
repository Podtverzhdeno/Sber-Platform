import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskWorkspacePage } from "./task-workspace-page";

vi.mock("../features/platforms", () => ({
  PlatformsSection: ({ projectId }: { projectId: string }) => (
    <div data-testid="platforms-runtime">Каталог платформ · {projectId}</div>
  ),
}));

const renderWorkspace = (taskId = "task-123") =>
  render(
    <TaskWorkspacePage
      mode="participant"
      title="Прототип рекомендательной системы"
      taskId={taskId}
      description="Собрать уточняющий прототип и оформить API-контракт"
      deadline="12 мая"
      tags={["AI / ML"]}
      onMessage={() => undefined}
      onPrimaryAction={() => undefined}
    />,
  );

const sectionBody = (id: string): HTMLElement => {
  const element = document.getElementById(`ctw-body-${id}`);
  if (element === null) throw new Error(`missing section body ${id}`);
  return element;
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("workspace collapsible sections (openspec 22.22)", () => {
  it("mounts the project-scoped platform catalog inside its own collapsible section", () => {
    render(
      <TaskWorkspacePage
        mode="participant"
        title="Проект"
        taskId="task-platforms"
        projectId="00000000-0000-0000-0000-000000000100"
        description="Описание"
        deadline="12 мая"
        tags={["API"]}
        onMessage={() => undefined}
        onPrimaryAction={() => undefined}
      />,
    );

    const toggle = screen.getByRole("button", { name: /Инструменты проекта/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("platforms-runtime")).toHaveTextContent(
      "00000000-0000-0000-0000-000000000100",
    );
    fireEvent.click(toggle);
    expect(sectionBody("platforms")).not.toBeVisible();
  });

  it("collapses one section through its disclosure header while others stay open and status stays visible", () => {
    renderWorkspace();
    const aboutToggle = screen.getByRole("button", { name: /Описание/ });
    expect(aboutToggle).toHaveAttribute("aria-expanded", "true");
    expect(aboutToggle).toHaveAttribute("aria-controls", "ctw-body-about");
    expect(sectionBody("about")).toBeVisible();

    fireEvent.click(aboutToggle);
    expect(aboutToggle).toHaveAttribute("aria-expanded", "false");
    expect(sectionBody("about")).not.toBeVisible();
    expect(aboutToggle.closest("header")?.querySelector("aside")).toBeNull();

    const resultsToggle = screen.getByRole("button", { name: /Промежуточные артефакты/ });
    expect(resultsToggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(resultsToggle);
    expect(resultsToggle).toHaveAttribute("aria-expanded", "false");
    expect(sectionBody("results")).not.toBeVisible();
    expect(resultsToggle.closest("header")).toHaveTextContent("4 результата");
    expect(aboutToggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(aboutToggle);
    expect(aboutToggle).toHaveAttribute("aria-expanded", "true");
    expect(sectionBody("about")).toBeVisible();
    expect(sectionBody("results")).not.toBeVisible();
  });

  it("hides the history control together with its section", () => {
    renderWorkspace();
    const activityToggle = screen.getByRole("button", { name: /Активность команды/ });
    const historyToggle = screen.getByRole("button", { name: "Вся история" });
    expect(historyToggle).toBeVisible();

    fireEvent.click(activityToggle);
    expect(activityToggle).toHaveAttribute("aria-expanded", "false");
    expect(historyToggle).not.toBeVisible();
    expect(sectionBody("activity")).not.toBeVisible();

    fireEvent.click(activityToggle);
    expect(historyToggle).toBeVisible();
    expect(sectionBody("activity")).toBeVisible();
  });

  it("keeps uploaded draft rows through collapse and re-expansion", () => {
    renderWorkspace();
    const input = screen.getByLabelText(/Загрузить файл/);
    fireEvent.change(input, { target: { files: [new File(["x"], "draft-evidence.txt")] } });
    expect(screen.getByText("Добавлено файлов: 1")).toBeInTheDocument();
    const solutionToggle = screen.getByRole("button", { name: /Загрузить решение/ });
    fireEvent.click(solutionToggle);
    expect(solutionToggle).toHaveAttribute("aria-expanded", "false");
    expect(sectionBody("solution")).not.toBeVisible();
    fireEvent.click(solutionToggle);
    expect(solutionToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("draft-evidence.txt")).toBeVisible();
  });

  it("restores collapsed sections after reload from persisted state", () => {
    const first = renderWorkspace("task-persist");
    fireEvent.click(screen.getByRole("button", { name: /Промежуточные артефакты/ }));
    expect(screen.getByRole("button", { name: /Промежуточные артефакты/ })).toHaveAttribute("aria-expanded", "false");
    first.unmount();

    renderWorkspace("task-persist");
    expect(screen.getByRole("button", { name: /Промежуточные артефакты/ })).toHaveAttribute("aria-expanded", "false");
    expect(sectionBody("results")).not.toBeVisible();
    expect(screen.getByRole("button", { name: /Описание/ })).toHaveAttribute("aria-expanded", "true");
    expect(localStorage.getItem("impulse_workspace_sections_task-persist")).toContain("results");
  });

  it("does not resurrect stored state across different projects", () => {
    renderWorkspace("task-persist");
    fireEvent.click(screen.getByRole("button", { name: /Описание/ }));
    cleanup();
    renderWorkspace("task-other");
    expect(screen.getByRole("button", { name: /Описание/ })).toHaveAttribute("aria-expanded", "true");
    expect(sectionBody("about")).toBeVisible();
  });
});

describe("workspace team and metric drill-down (openspec 22.23)", () => {
  const workspace = {
    team: [{ person_id: "00000000-0000-0000-0000-000000000002", display_name: "Мария Воронова", status: "submitted" }],
    checkpoints: [
      { key: "research", title: "Исследование", status: "completed" },
      { key: "api", title: "API", status: "in_progress" },
    ],
    contributions: [{ id: "contribution-1", version: 2, personal_summary: "API готов", artifact_keys: ["openapi-v2"], status: "submitted" }],
    feedback: [{ contribution_id: "contribution-1", contribution_version: 2, review_version: 1, grade: "B", explanation: "Нужен benchmark", status: "draft" }],
    freshness: "обновлено 21 октября, 11:30",
  };
  const member = workspace.team[0];
  if (member === undefined) throw new Error("team fixture must contain a member");

  it("opens a consent-filtered member card and delegates exact profile and message transitions", () => {
    const selectMember = vi.fn();
    const openProfile = vi.fn();
    const openMessage = vi.fn();
    render(<TaskWorkspacePage mode="participant" title="Проект" taskId="00000000-0000-0000-0000-000000000100" description="Описание" deadline="12 мая" tags={["API"]} workspace={workspace} quickCard={{ person_id: member.person_id, task_id: "00000000-0000-0000-0000-000000000100", assignment_status: "submitted", contribution_status: "submitted", availability: "on_review", project_role: "Исполнитель", responsibility: "API готов", display_name: "Мария Воронова", portfolio_available: true, profile: { city: "Москва", university: null, telegram: null, about: null, skills: [{ title: "FastAPI", origin: "project", verified: true }] } }} onSelectMember={selectMember} onCloseQuickCard={() => undefined} onOpenProfile={openProfile} onOpenDirectMessage={openMessage} onMessage={() => undefined} onPrimaryAction={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: /Мария Воронова/ }));
    expect(selectMember).toHaveBeenCalledWith(member.person_id);
    expect(screen.getByRole("dialog", { name: "Карточка участника" })).toHaveTextContent("API готов");
    fireEvent.click(screen.getByRole("button", { name: "Подробная информация" }));
    fireEvent.click(screen.getByRole("button", { name: "Сообщение" }));
    expect(openProfile).toHaveBeenCalledWith(member.person_id);
    expect(openMessage).toHaveBeenCalledWith(member.person_id);
  });

  it("explains numerator, denominator, freshness and object-backed metric rows including non-inert zero states", () => {
    render(<TaskWorkspacePage mode="participant" title="Проект" taskId="00000000-0000-0000-0000-000000000100" description="Описание" deadline="12 мая" tags={["API"]} workspace={workspace} onMessage={() => undefined} onPrimaryAction={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Выполнено этапов" }));
    const stages = screen.getByRole("dialog", { name: "Расчёт ключевой метрики" });
    expect(stages).toHaveTextContent("Числитель — завершённые checkpoint-и");
    expect(stages).toHaveTextContent("обновлено 21 октября, 11:30");
    expect(stages).toHaveTextContent("Исследование");
    expect(stages).toHaveTextContent("API");
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));

    fireEvent.click(screen.getByRole("button", { name: "Есть блокеры" }));
    expect(screen.getByRole("dialog", { name: "Расчёт ключевой метрики" })).toHaveTextContent("Активных блокеров нет");
  });
});
