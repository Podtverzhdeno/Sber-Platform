import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgenticCodingProfile } from "./agentic-coding-profile";

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

  it("keeps soft skills outside Agentic L1 and makes certification conditions explicit", () => {
    render(<AgenticCodingProfile />);
    fireEvent.click(screen.getByRole("button", { name: "Гибкие" }));
    expect(screen.getByText(/Отдельная модель оценки гибких навыков пока не подключена/)).toBeInTheDocument();
    expect(screen.queryByTestId("agentic-target-radar")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Вернуться к AI-навыкам" }));
    fireEvent.click(screen.getByRole("button", { name: /Посмотреть условия сертификации/ }));
    expect(screen.getByText(/Курс и тест сами по себе не подтверждают/)).toBeInTheDocument();
  });
});
