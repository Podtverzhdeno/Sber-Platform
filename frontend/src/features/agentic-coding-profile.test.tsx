import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AGENTIC_ROLE_PROFILES, AgenticCodingProfile } from "./agentic-coding-profile";

describe("Agentic Coding source-derived profile", () => {
  it("preserves six source skill levels and explicit methodology conflicts", () => {
    expect(AGENTIC_ROLE_PROFILES.developer.target).toEqual([3, 4, 3, 2, 3, 2]);
    expect(AGENTIC_ROLE_PROFILES.analyst.target).toEqual([3, null, 3, 2, 2, 2]);
    expect(AGENTIC_ROLE_PROFILES.qa.target).toEqual([3, 2, 2, 2, 2, 2]);
    expect(AGENTIC_ROLE_PROFILES.developer.unresolved).toEqual([4]);
    expect(AGENTIC_ROLE_PROFILES.analyst.unresolved).toEqual([1, 2]);
    expect(AGENTIC_ROLE_PROFILES.qa.unresolved).toEqual([1]);
  });
  it("shows only one selected role; never invents current values or L1 certificates", () => {
    render(<AgenticCodingProfile />);
    const panel = screen.getByTestId("agentic-profile");
    expect(within(panel).getByRole("heading", { name: "Разработчик · 6 навыков" })).toBeInTheDocument();
    expect(within(panel).getByRole("img")).toHaveAccessibleName(/подтверждённых цифровых следов пока нет/);
    expect(within(panel).getByText("Учебная оценка пока не рассчитана")).toBeInTheDocument();
    expect(within(panel).queryByText("L1 подтверждён")).not.toBeInTheDocument();
    expect(within(panel).getAllByText("Постановка задач агенту")).toHaveLength(1);
    fireEvent.change(within(panel).getByLabelText("Профессиональная группа"), { target: { value: "analyst" } });
    expect(within(panel).getByRole("heading", { name: "Аналитик · 6 навыков" })).toBeInTheDocument();
    expect(within(panel).queryByRole("heading", { name: "Разработчик · 6 навыков" })).not.toBeInTheDocument();
    expect(within(panel).getByText(/2 положения методологии требуют согласования/)).toBeInTheDocument();
  });
  it("switches between the same canonical values in radar, bars and table", () => {
    render(<AgenticCodingProfile />);
    const panel = screen.getByTestId("agentic-profile");
    fireEvent.click(within(panel).getByRole("button", { name: "Гистограмма" }));
    expect(within(panel).getByRole("button", { name: "Гистограмма" })).toHaveAttribute("aria-pressed", "true");
    expect(within(panel).getByLabelText("Целевые уровни по навыкам").children).toHaveLength(6);
    fireEvent.click(within(panel).getByRole("button", { name: "Таблица" }));
    const table = within(panel).getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(7);
    expect(within(table).getAllByText("Нет данных")).toHaveLength(6);
    fireEvent.click(within(panel).getByRole("button", { name: "Циклограмма" }));
    expect(within(panel).getByRole("img")).toBeInTheDocument();
  });
});
