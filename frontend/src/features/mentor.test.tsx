import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { MentorAssistant, MentorParticipants, MentorProjects, MentorWeekPlan } from "./mentor";

describe("mentor workspace", () => {
  it("switches project and participant inspectors", () => {
    const { unmount } = render(<MemoryRouter><MentorProjects /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Ассистент базы знаний/ }));
    expect(screen.getAllByText("RAG evaluation").length).toBeGreaterThan(0);
    unmount();
    render(<MemoryRouter><MentorParticipants /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Илья Кузнецов/ }));
    expect(screen.getByText("Нет активности по исправлению 3 дня")).toBeInTheDocument();
  });

  it("keeps AI output editable and creates a meeting", () => {
    const { unmount } = render(<MemoryRouter><MentorAssistant /></MemoryRouter>);
    const draft = screen.getByRole("textbox", { name: "Редактируемый AI-черновик" });
    fireEvent.change(draft, { target: { value: "Проверенный человеком черновик" } });
    expect(draft).toHaveValue("Проверенный человеком черновик");
    unmount();
    render(<MemoryRouter><MentorWeekPlan /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Назначить встречу/ }));
    fireEvent.click(screen.getByRole("button", { name: "Создать и уведомить" }));
    expect(screen.getByText("Встреча создана")).toBeInTheDocument();
  });
});
