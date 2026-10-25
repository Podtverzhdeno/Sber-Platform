import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerCreateTask } from "./customer-create-task";

const candidates = [{ id: "p1", name: "Мария Ковалёва", direction: "AI / ML", cases: [{ title: "AI-агент" }] }];
const create = (publish = vi.fn()) => {
  const view = render(<CustomerCreateTask candidates={candidates} onPublish={publish} />);
  return { ...view, publish };
};
const completeBrief = () => {
  fireEvent.change(screen.getByPlaceholderText("Например, AI-агент для анализа обращений"), { target: { value: "AI-агент для обращений" } });
  fireEvent.change(screen.getByPlaceholderText("Опишите задачу в 2–3 предложениях"), { target: { value: "Автоматизировать распределение обращений" } });
  fireEvent.change(screen.getByPlaceholderText("Добавьте детали, контекст, текущие ограничения и ожидаемый эффект"), { target: { value: "Обращения маршрутизируются вручную" } });
  fireEvent.click(screen.getByRole("navigation", { name: "Этапы создания задачи" }).getByRole("button", { name: /Критерии/ }));
  fireEvent.change(screen.getByPlaceholderText("Что нужно передать: код, API, демо, отчёт, инструкции, метрики?"), { target: { value: "Прототип, API и README" } });
  fireEvent.change(screen.getByPlaceholderText(/Каждый критерий с новой строки/), { target: { value: "Запуск по инструкции; отчёт по точности" } });
};
beforeEach(() => { localStorage.clear(); });

describe("customer task creation wizard", () => {
  it("keeps draft fields and step after reopening", () => {
    const { unmount } = create();
    fireEvent.change(screen.getByPlaceholderText("Например, AI-агент для анализа обращений"), { target: { value: "Новая задача" } });
    fireEvent.click(screen.getByRole("navigation", { name: "Этапы создания задачи" }).getByRole("button", { name: /Критерии/ }));
    expect(localStorage.getItem("impulse-customer-task-wizard-v2")).toContain("Новая задача");
    unmount();
    create();
    expect(screen.getByRole("heading", { name: "Критерии и сроки" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("navigation", { name: "Этапы создания задачи" }).getByRole("button", { name: /Бриф/ }));
    expect(screen.getByPlaceholderText("Например, AI-агент для анализа обращений")).toHaveValue("Новая задача");
  });

  it("prevents publication without mandatory requirements", () => {
    const { publish } = create();
    fireEvent.click(screen.getByRole("navigation", { name: "Этапы создания задачи" }).getByRole("button", { name: /Публикация/ }));
    expect(screen.getByRole("button", { name: "Опубликовать" })).toBeDisabled();
    expect(screen.getByText("Остались обязательные поля")).toBeInTheDocument();
    expect(publish).not.toHaveBeenCalled();
  });

  it("publishes a complete open task and clears only the wizard draft", () => {
    const { publish } = create();
    completeBrief();
    fireEvent.click(screen.getByRole("navigation", { name: "Этапы создания задачи" }).getByRole("button", { name: /Публикация/ }));
    expect(screen.getByRole("button", { name: "Опубликовать" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ title: "AI-агент для обращений", criteria: "Запуск по инструкции; отчёт по точности" }), []);
    expect(localStorage.getItem("impulse-customer-task-wizard-v2")).toBeNull();
  });

  it("requires an invited participant when invitation-only is selected", () => {
    const { publish } = create();
    completeBrief();
    fireEvent.click(screen.getByRole("navigation", { name: "Этапы создания задачи" }).getByRole("button", { name: "Формат" }));
    fireEvent.click(screen.getByRole("button", { name: /По приглашению/ }));
    fireEvent.click(screen.getByRole("navigation", { name: "Этапы создания задачи" }).getByRole("button", { name: /Публикация/ }));
    expect(screen.getByRole("button", { name: "Опубликовать" })).toBeDisabled();
    fireEvent.click(screen.getByRole("navigation", { name: "Этапы создания задачи" }).getByRole("button", { name: "Поддержка" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("navigation", { name: "Этапы создания задачи" }).getByRole("button", { name: /Публикация/ }));
    expect(screen.getByRole("button", { name: "Опубликовать" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ mode: "invitation_only" }), ["p1"]);
  });

  it("updates live preview and allows adding and removing competency chips", () => {
    create();
    fireEvent.change(screen.getByPlaceholderText("Например, AI-агент для анализа обращений"), { target: { value: "Агент проверки качества" } });
    fireEvent.change(screen.getByPlaceholderText("Опишите задачу в 2–3 предложениях"), { target: { value: "Проверить качество ответов" } });
    expect(screen.getByRole("heading", { name: "Агент проверки качества" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Python/ }));
    expect(screen.getByRole("button", { name: "Удалить навык Python" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Удалить навык Python" }));
    expect(screen.queryByRole("button", { name: "Удалить навык Python" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Поиск или добавление навыка…"), { target: { value: "Системный анализ" } });
    fireEvent.click(screen.getByRole("button", { name: "Добавить навык" }));
    expect(screen.getByRole("button", { name: "Удалить навык Системный анализ" })).toBeInTheDocument();
  });

  it("inserts a real list marker into the detailed task description", () => {
    create();
    fireEvent.click(screen.getByRole("button", { name: "Добавить маркированный список" }));
    expect(screen.getByPlaceholderText("Добавьте детали, контекст, текущие ограничения и ожидаемый эффект")).toHaveValue("• ");
  });

  it("opens participant preview without publishing", () => {
    const { publish } = create();
    fireEvent.click(screen.getByRole("button", { name: "Открыть полный предпросмотр" }));
    expect(screen.getByRole("dialog", { name: "Название ещё не задано" })).toBeInTheDocument();
    expect(screen.getByText(/задача ещё не опубликована/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Закрыть предпросмотр" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(publish).not.toHaveBeenCalled();
  });
});
