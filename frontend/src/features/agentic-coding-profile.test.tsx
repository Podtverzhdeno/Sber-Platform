import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgenticCodingProfile, type AgenticServerProfile } from "./agentic-coding-profile";

describe("Agentic Coding source-derived profile", () => {
  it("renders exact role targets without treating an unknown value as zero", () => {
    render(<AgenticCodingProfile />);
    const panel = screen.getByTestId("agentic-profile");
    fireEvent.click(within(panel).getByRole("button", { name: "Таблица" }));
    const checkTargets = (expected: string[]) => {
      const rows = within(panel).getByRole("table").querySelectorAll("tbody tr");
      expect(Array.from(rows, (row) => row.querySelector("td:nth-child(3)")?.textContent)).toEqual(expected);
    };
    checkTargets(["3/4", "4/4", "3/4", "2/4", "3/4", "2/4"]);
    fireEvent.change(within(panel).getByLabelText("Профессиональная группа"), { target: { value: "analyst" } });
    checkTargets(["3/4", "Не задана", "3/4", "2/4", "2/4", "2/4"]);
    expect(within(panel).getByText("5 требований")).toBeInTheDocument();
    fireEvent.change(within(panel).getByLabelText("Профессиональная группа"), { target: { value: "qa" } });
    checkTargets(["3/4", "2/4", "2/4", "2/4", "2/4", "2/4"]);
    expect(within(panel).getByText("6 требований")).toBeInTheDocument();
  });

  it("shows a six-skill matrix first and never invents measured skills or an L1 badge", () => {
    render(<AgenticCodingProfile />);
    const panel = screen.getByTestId("agentic-profile");
    expect(within(panel).getByRole("heading", { name: "Матрица компетенций" })).toBeInTheDocument();
    expect(within(panel).getAllByTestId(/^agentic-skill-/)).toHaveLength(6);
    expect(within(panel).getByRole("img")).toHaveAccessibleName(/Подтверждённые уровни отсутствуют/);
    expect(within(panel).getByText(/цифровых следов не подключены/i)).toBeInTheDocument();
    expect(within(panel).getByText(/Официальный бейдж L1 не выдаётся/)).toBeInTheDocument();
    expect(within(panel).queryByText(/L1 подтверждён/)).not.toBeInTheDocument();
  });

  it("switches radar, bars and table while preserving six required axes", () => {
    render(<AgenticCodingProfile />);
    const panel = screen.getByTestId("agentic-profile");
    expect(within(panel).getByLabelText("Значения целевого профиля")).toHaveTextContent("Постановка задач агенту");
    fireEvent.click(within(panel).getByRole("button", { name: "Полосы" }));
    expect(within(panel).getByRole("button", { name: "Полосы" })).toHaveAttribute("aria-pressed", "true");
    expect(within(panel).getByLabelText("Целевые уровни по навыкам").children).toHaveLength(6);
    fireEvent.click(within(panel).getByRole("button", { name: "Таблица" }));
    const table = within(panel).getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(7);
    expect(within(table).getAllByText("Нет данных")).toHaveLength(6);
    fireEvent.click(within(panel).getByRole("button", { name: "Циклограмма" }));
    expect(within(panel).getByRole("img")).toBeInTheDocument();
  });

  it("opens a keyboard-closable skills inspector with level anchors and trace examples", () => {
    render(<AgenticCodingProfile />);
    fireEvent.click(screen.getByTestId("agentic-skill-creating_skills"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Skills агента" })).toBeInTheDocument();
    expect(within(dialog).getByText("Теория")).toBeInTheDocument();
    expect(within(dialog).getByText("Применение")).toBeInTheDocument();
    expect(within(dialog).getByText("Управление")).toBeInTheDocument();
    expect(within(dialog).getByText("Экспертиза")).toBeInTheDocument();
    expect(within(dialog).getByText("chat_window.skill.invoked")).toBeInTheDocument();
    expect(within(dialog).getByText(/Примеры событий не означают/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Проверенные события, исключённые сигналы/)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });


  it("renders the skill inspector above the application and traps keyboard focus", () => {
    render(<AgenticCodingProfile />);
    const trigger = screen.getByTestId("agentic-skill-prompting");
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    expect(dialog.closest(".agentic-profile")).toBeNull();
    const close = within(dialog).getByRole("button", { name: "Закрыть" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    const summaries = dialog.querySelectorAll("summary");
    expect(document.activeElement).toBe(summaries[summaries.length - 1]);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.click(close);
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("uses distinct prompting levels and telemetry for analysts and QA", () => {
    render(<AgenticCodingProfile />);
    fireEvent.change(screen.getByLabelText("Профессиональная группа"), { target: { value: "analyst" } });
    fireEvent.click(screen.getByTestId("agentic-skill-prompting"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Назначает задачу агенту-аналитику");
    expect(screen.getByRole("dialog")).toHaveTextContent("AI_PDLC_CORE_AGENT_DATALAKE_TELEMETRY");
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.change(screen.getByLabelText("Профессиональная группа"), { target: { value: "qa" } });
    fireEvent.click(screen.getByTestId("agentic-skill-prompting"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Назначает задачу агенту-тестировщику");
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.change(screen.getByLabelText("Профессиональная группа"), { target: { value: "developer" } });
    fireEvent.click(screen.getByTestId("agentic-skill-prompting"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Применяет AI-ассистента");
  });

  it("keeps soft skills outside Agentic L1 and makes certification conditions explicit", () => {
    render(<AgenticCodingProfile />);
    fireEvent.click(screen.getByRole("button", { name: "Гибкие" }));
    expect(screen.getByText(/Отдельная модель оценки гибких навыков пока не подключена/)).toBeInTheDocument();
    expect(screen.queryByTestId("agentic-target-radar")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Вернуться к AI-навыкам" }));
    fireEvent.click(screen.getByRole("button", { name: /Посмотреть условия сертификации/ }));
    expect(screen.getByText(/Курс и тест сами по себе не подтверждают/)).toBeInTheDocument();
  });

  it("renders qualified server levels in radar and table without leaking evidence across roles", () => {
    const source: AgenticServerProfile = {
      role_key: "developer", role_title: "Разработчик", profile_scope: "impulse_learning",
      scale_key: "agentic_coding_1_4", framework_version: "agentic-coding-source-map-2026-10-23",
      as_of: "2026-10-24T12:00:00Z", known_evidence_count: 1,
      certification_state: "not_evaluable", certification_reason: "Only advisory profile",
      data_origin: "verified_evidence",
      skills: [
        { key: "prompting", title: "Постановка задач агенту", target_level: 3, current_level: 2, evidence_count: 1, data_state: "verified", unresolved_methodology: false },
        { key: "prompt_engineering", title: "Правила работы агента", target_level: 4, current_level: null, evidence_count: 0, data_state: "not_connected", unresolved_methodology: false }
      ]
    };
    const { container } = render(<AgenticCodingProfile serverProfile={source} serverStatus="ready" />);
    expect(container.querySelectorAll(".agentic-current-dot")).toHaveLength(1);
    expect(screen.getByText(/Подтверждённых навыков: 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Таблица" }));
    const rows = screen.getByRole("table").querySelectorAll("tbody tr");
    expect(rows[0]?.querySelector("td")?.textContent).toBe("2");
    fireEvent.change(screen.getByLabelText("Профессиональная группа"), { target: { value: "qa" } });
    const other = screen.getByRole("table").querySelectorAll("tbody tr");
    expect(other[0]?.querySelector("td")?.textContent).toBe("Нет данных");
  });

  it("does not replace explicit null policy target with hardcoded role goal", () => {
    const source: AgenticServerProfile = {
      role_key: "developer", role_title: "Разработчик", profile_scope: "impulse_learning",
      scale_key: "agentic_coding_1_4", framework_version: "agentic-coding-source-map-2026-10-23",
      as_of: "2026-10-24T12:00:00Z", known_evidence_count: 0,
      certification_state: "not_evaluable", certification_reason: "No published policy",
      data_origin: "not_connected",
      skills: [
        { key: "prompt_engineering", title: "Правила работы агента", target_level: null, current_level: null, evidence_count: 0, data_state: "not_connected", unresolved_methodology: true }
      ]
    };
    render(<AgenticCodingProfile serverProfile={source} serverStatus="ready" />);
    fireEvent.click(screen.getByRole("button", { name: "Таблица" }));
    const rows = screen.getByRole("table").querySelectorAll("tbody tr");
    expect(rows[1]?.querySelector("td:nth-child(3)")?.textContent).toBe("Не задана");
  });

});
