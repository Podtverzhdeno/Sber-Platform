import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { AppleDisclosure, AppleList, AppleListRow, ApplePage, AppleSection } from "./AppleSurface";

afterEach(() => { cleanup(); });

describe("Apple-like workspace primitives", () => {
  it("keeps context, one page title, actions and section identity accessible", () => {
    render(
      <ApplePage title="Главная" context="AI Agent Engineer" action={<button type="button">Мой путь</button>}>
        <AppleSection title="Следующий шаг" description="Только подтверждённые данные">
          <span>Начать практику</span>
        </AppleSection>
      </ApplePage>,
    );
    expect(screen.getByRole("main")).toHaveClass("apple-surface");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Главная" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Следующий шаг" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Мой путь" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Следующий шаг" })).toHaveTextContent("Начать практику");
  });

  it("hides secondary data by default and reveals it by keyboard-style activation", () => {
    render(
      <ApplePage title="Проверки">
        <AppleDisclosure title="История и доказательства" description="Подробнее по запросу" testId="evidence">
          <p>Проверено человеком</p>
        </AppleDisclosure>
      </ApplePage>,
    );
    const details = screen.getByTestId("evidence");
    expect(details.hasAttribute("open")).toBe(false);
    expect(screen.getByText("История и доказательства").closest("summary")).toBeInTheDocument();
    fireEvent.click(screen.getByText("История и доказательства"));
    expect(details.hasAttribute("open")).toBe(true);
    fireEvent.click(screen.getByText("История и доказательства"));
    expect(details.hasAttribute("open")).toBe(false);
  });

  it("supports initially expanded details when a task explicitly needs them", () => {
    render(
      <ApplePage title="Результат">
        <AppleDisclosure title="Важное предупреждение" defaultOpen>Есть блокировка</AppleDisclosure>
      </ApplePage>,
    );
    expect(screen.getByText("Важное предупреждение").closest("details")).toHaveAttribute("open");
  });

  it("supports real list semantics and calls only the selected authorized callback", () => {
    const openTask = vi.fn();
    render(
      <ApplePage title="Задачи">
        <AppleList label="Текущие задачи">
          <AppleListRow title="Семантический поиск" description="В работе"
            state="Ожидает результата" stateTone="warning" onSelect={openTask} />
          <AppleListRow title="Выполненная задача" description="Подтверждено" state="Принято" stateTone="success" />
        </AppleList>
      </ApplePage>,
    );
    const list = screen.getByRole("list", { name: "Текущие задачи" });
    expect(list.querySelectorAll("li")).toHaveLength(2);
    const current = screen.getByRole("button", { name: /Семантический поиск/ });
    expect(current).toHaveTextContent("Ожидает результата");
    fireEvent.click(current);
    expect(openTask).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Выполненная задача/ })).toBeNull();
    expect(screen.getByText("Принято")).toHaveAttribute("data-tone", "success");
  });

  it("states disabled reasons without invoking unavailable or destructive actions", () => {
    const act = vi.fn();
    render(
      <ApplePage title="Приёмка">
        <AppleList label="Результаты">
          <AppleListRow title="Принять результат" description="Ожидает проверки"
            disabled disabledReason="Нужна независимая проверка" onSelect={act} />
        </AppleList>
      </ApplePage>,
    );
    const control = screen.getByRole("button", { name: /Принять результат/ });
    expect(control).toBeDisabled();
    expect(screen.getByText("Нужна независимая проверка")).toBeInTheDocument();
    fireEvent.click(control);
    expect(act).not.toHaveBeenCalled();
  });

  it("renders optional trailing data without promoting a read-only row to a button", () => {
    render(
      <ApplePage title="Навыки">
        <AppleList label="Подтверждённые навыки">
          <AppleListRow title="Python" description="Два подтверждённых кейса"
            trailing={<span>2</span>} />
        </AppleList>
      </ApplePage>,
    );
    expect(screen.getByRole("list", { name: "Подтверждённые навыки" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
