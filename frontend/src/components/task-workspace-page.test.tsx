import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TaskWorkspacePage } from "./task-workspace-page";

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
