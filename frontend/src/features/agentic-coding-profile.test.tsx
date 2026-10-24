import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgenticCodingProfile } from "./agentic-coding-profile";
import type { components } from "../../api/schema";

describe("Agentic Coding source-derived profile", () => {
  it("renders developer, analyst and QA target levels exactly as in source map", () => {
    render(<AgenticCodingProfile />);
    const panel = screen.getByTestId("agentic-profile");
    fireEvent.click(within(panel).getByRole("button", { name: "Таблица" }));
    const checkTargets = (expected: string[]) => {
      const rows = within(panel).getByRole("table").querySelectorAll("tbody tr");
      expect(Array.from(rows, (row) => row.querySelector("td:last-child")?.textContent)).toEqual(expected);
    };
    checkTargets(["3", "4", "3", "2", "3", "2"]);
    fireEvent.change(within(panel).getByLabelText("Профессиональная группа"), { target: { value: "analyst" } });
    checkTargets(["3", "Не задана", "3", "2", "2", "2"]);
    fireEvent.change(within(panel).getByLabelText("Профессиональная группа"), { target: { value: "qa" } });
    checkTargets(["3", "2", "2", "2", "2", "2"]);
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
  it("renders green contour only from verified server snapshot and avoids role leakage", () => {
    const source: components["schemas"]["RoleProfile"] = {
      role_key: "developer",
      role_title: "Разработчик",
      profile_scope: "impulse_learning",
      scale_key: "agentic_coding_1_4",
      framework_version: "agentic-coding-source-map-2026-10-23",
      as_of: "2026-10-24T12:00:00Z",
      known_evidence_count: 1,
      certification_state: "not_evaluable",
      certification_reason: "Only advisory profile",
      data_origin: "verified_evidence",
      skills: [
        { key: "prompting", title: "Постановка задач агенту", target_level: 3, current_level: 2, evidence_count: 1, data_state: "verified", unresolved_methodology: false },
        { key: "prompt_engineering", title: "Правила работы агента", target_level: 4, current_level: null, evidence_count: 0, data_state: "not_connected", unresolved_methodology: false },
        { key: "context_management", title: "Контекст", target_level: 3, current_level: null, evidence_count: 0, data_state: "not_connected", unresolved_methodology: false },
        { key: "tools_mcp", title: "Tools", target_level: 2, current_level: null, evidence_count: 0, data_state: "not_connected", unresolved_methodology: false },
        { key: "creating_skills", title: "Skills", target_level: 3, current_level: null, evidence_count: 0, data_state: "not_connected", unresolved_methodology: true },
        { key: "agents_team", title: "Agents", target_level: 2, current_level: null, evidence_count: 0, data_state: "not_connected", unresolved_methodology: false },
      ],
    };
    const { container } = render(<AgenticCodingProfile serverProfile={source} serverStatus="ready" />);
    const panel = screen.getByTestId("agentic-profile");
    expect(within(panel).getByText("Проверенных цифровых следов: 1")).toBeInTheDocument();
    expect(container.querySelectorAll(".agentic-current-dot")).toHaveLength(1);
    fireEvent.click(within(panel).getByRole("button", { name: "Таблица" }));
    const rows = within(panel).getByRole("table").querySelectorAll("tbody tr");
    expect(rows[0]?.querySelector("td")?.textContent).toBe("2");
    fireEvent.change(within(panel).getByLabelText("Профессиональная группа"), { target: { value: "qa" } });
    const otherRows = within(panel).getByRole("table").querySelectorAll("tbody tr");
    expect(otherRows[0]?.querySelector("td")?.textContent).toBe("Нет данных");
  });

});
