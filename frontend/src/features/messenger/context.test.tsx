import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContextPanel } from "./context";
import type { ApiChannelView } from "./contracts";

const channel: ApiChannelView = {
  id: "ch-team",
  kind: "task_team",
  title: "MVP impulse",
  status: "active",
  task_id: "task-1",
  role: "member",
  muted: false,
  sender_enabled: true,
  unread: 2,
  participants: [
    { id: "u1", display_name: "Алексей Смирнов", role: "member" },
    { id: "u2", display_name: "Ментор Е", role: "mentor" },
  ],
  last_message: null,
  created_at: "2026-10-01T09:00:00Z",
};

const workContext = {
  project_key: "impulse-primavera",
  task_title: "MVP impulse",
  deadline_at: "2026-10-25T18:00:00Z",
  contribution_version: 2,
  contribution_accepted: false,
  review_status: "human_confirmed",
};

function baseProps(): { channel: typeof channel; viewerId: string; workContext: typeof workContext | null; open: boolean } {
  return {
    channel,
    viewerId: "u1",
    workContext: workContext,
    open: true,
  };
}

describe("ContextPanel", () => {
  it("показывает точный объект и версию вклада", () => {
    render(<ContextPanel {...baseProps()} onOpenTask={vi.fn()} />);
    expect(screen.getByTestId("context-project")).toHaveTextContent("impulse-primavera");
    expect(screen.getByTestId("context-task")).toHaveTextContent("MVP impulse");
    expect(screen.getByTestId("context-contribution")).toHaveTextContent(/версия 2/);
    expect(screen.getByTestId("context-review")).toHaveTextContent("Оценка подтверждена человеком");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("MVP impulse");
  });

  it("показывает дедлайн-контрольную точку и участников с ролями", () => {
    render(<ContextPanel {...baseProps()} />);
    expect(screen.getByTestId("context-deadline")).not.toHaveTextContent("");
    const people = screen.getAllByTestId("context-participant");
    expect(people).toHaveLength(2);
    expect(people[0]).toHaveTextContent("Алексей Смирнов");
    expect(people[0]).toHaveTextContent("участник");
    expect(people[1]).toHaveTextContent("ментор");
    expect(screen.getByTestId("context-your-role")).toHaveTextContent("ваша роль: участник");
  });

  it("не содержит формальных действий: приёмка, оценка, выплата, оффер отсутствуют", () => {
    render(<ContextPanel {...baseProps()} />);
    expect(screen.queryByRole("button", { name: /принять/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /оценить/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /выплат/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /оффер/i })).toBeNull();
    const disclaimer = screen.getByTestId("context-disclaimer");
    expect(disclaimer).toHaveTextContent("выполняются только в доменных экранах");
  });

  it("callback-кнопки только навигационные: одна кнопка на открытие задачи", () => {
    const onOpenTask = vi.fn<(taskId: string) => void>();
    render(<ContextPanel {...baseProps()} onOpenTask={onOpenTask} />);
    const button = screen.getByRole("button", { name: "Открыть вклад задачи" });
    fireEvent.click(button);
    expect(onOpenTask).toHaveBeenCalledTimes(1);
    const openedTask = onOpenTask.mock.calls[0];
    if (!openedTask) throw new Error("нет вызова onOpenTask");
    expect(openedTask[0]).toBe("task-1");
  });

  it("свёрнутая панель не рендерится", () => {
    render(<ContextPanel {...baseProps()} open={false} />);
    expect(screen.queryByText("Контекст")).toBeNull();
  });

  it("без контекста показывает нейтральные заглушки", () => {
    render(<ContextPanel {...{ ...baseProps(), workContext: null }} />);
    expect(screen.getByTestId("context-project")).toHaveTextContent("не выбран");
    expect(screen.getByTestId("context-task")).toHaveTextContent("не привязана");
  });
});
