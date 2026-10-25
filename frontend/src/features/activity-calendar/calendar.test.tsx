import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActivityCalendar } from "./calendar";
import { buildActivityDays, type ActivityFeed } from "./calendar-model";

const exampleEvent = (occurred_at: string) => ({
  occurred_at,
  kind: "impulse_course_finished",
  title: "Пройден курс Impulse: Python",
  source_kind: "impulse_self_study",
  source_ref: "python",
});

describe("Activity calendar data integrity", () => {
  it("groups timestamped events by the participant timezone and deduplicates identical sources", () => {
    const snapshot: ActivityFeed = {
      generated_at: "2026-10-26T04:00:00Z",
      actor_timezone: "America/New_York",
      freshness: { known: true, latest_observed_at: "2026-10-26T02:00:00Z" },
      events: [exampleEvent("2026-10-26T02:00:00Z"), exampleEvent("2026-10-26T02:00:00Z")],
    };
    const days = buildActivityDays(snapshot, 12, new Date("2026-10-26T12:00:00Z"));
    expect(days.find(day => day.key === "2026-10-25")?.count).toBe(1);
    expect(days.find(day => day.key === "2026-10-26")?.count).toBe(0);
    expect(days).toHaveLength(84);
  });

  it("never fabricates activity in the absence of a source", () => {
    const days = buildActivityDays(undefined, 52, new Date("2026-10-26T12:00:00Z"));
    expect(days).toHaveLength(364);
    expect(days.every(day => day.count === 0)).toBe(true);
    expect(days.some(day => day.future)).toBe(true);
  });
});

describe("Interactive activity calendar", () => {
  it("reveals an event on hover, and opens a day detail with truthful duration state", async () => {
    const now = new Date();
    const event = exampleEvent(now.toISOString());
    const snapshot: ActivityFeed = {
      generated_at: now.toISOString(),
      actor_timezone: "UTC",
      freshness: { known: true, latest_observed_at: now.toISOString() },
      events: [event],
    };
    const onOpenCourses = vi.fn();
    const { container } = render(<ActivityCalendar snapshot={snapshot} weeks={12} onOpenCourses={onOpenCourses} onOpenProjects={vi.fn()} onOpenEvents={vi.fn()}/>);
    const cell = container.querySelector<HTMLButtonElement>(".ac-day.ac-level-1");
    expect(cell).not.toBeNull();
    if (!cell) throw new Error("Active cell not found");
    fireEvent.mouseEnter(cell);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Пройден курс Impulse: Python");
    fireEvent.click(cell);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Пройден курс Impulse: Python")).toBeInTheDocument();
    expect(screen.getByText(/часы: длительность не измеряется/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Перейти в раздел" }));
    expect(onOpenCourses).toHaveBeenCalledTimes(1);
    await waitFor(() => { expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); });
  });

  it("opens an empty day without inventing activity or duration", () => {
    const { container } = render(<ActivityCalendar snapshot={undefined} weeks={12} onOpenCourses={vi.fn()} onOpenProjects={vi.fn()} onOpenEvents={vi.fn()}/>);
    expect(screen.getByText(/История активности недоступна/)).toBeInTheDocument();
    const cell = container.querySelector<HTMLButtonElement>(".ac-day:not([disabled])");
    if (!cell) throw new Error("Expected selectable day");
    fireEvent.click(cell);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/источник не передал подтверждённых записей/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Закрыть подробности дня" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("closes hover tooltip on Escape while leaving the calendar focused", () => {
    const now=new Date();
    const snapshot: ActivityFeed={
      generated_at:now.toISOString(),actor_timezone:"UTC",
      freshness:{known:true,latest_observed_at:now.toISOString()},
      events:[exampleEvent(now.toISOString())],
    };
    const {container}=render(<ActivityCalendar snapshot={snapshot} weeks={12}
      onOpenCourses={vi.fn()} onOpenProjects={vi.fn()} onOpenEvents={vi.fn()}/>);
    const cell=container.querySelector<HTMLButtonElement>(".ac-day.ac-level-1");
    if(!cell)throw new Error("Missing test activity");
    cell.focus();
    fireEvent.mouseEnter(cell);
    expect(screen.getByRole("tooltip")).toBeVisible();
    fireEvent.keyDown(document,{key:"Escape"});
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(cell).toHaveFocus();
  });

  it("routes project contributions by source even when task titles mention certificates", () => {
    const now=new Date();
    const snapshot: ActivityFeed={
      generated_at:now.toISOString(),actor_timezone:"UTC",
      freshness:{known:true,latest_observed_at:now.toISOString()},
      events:[{
        occurred_at:now.toISOString(),kind:"revision_accepted",
        source_kind:"work_contribution",source_ref:"contribution-123",
        title:"Сервис проверки сертификатов",
      }],
    };
    const openProjects=vi.fn(),openCourses=vi.fn();
    const {container}=render(<ActivityCalendar snapshot={snapshot} weeks={12}
      onOpenCourses={openCourses} onOpenProjects={openProjects} onOpenEvents={vi.fn()}/>);
    const cell=container.querySelector<HTMLButtonElement>(".ac-day.ac-level-1");
    if(!cell)throw new Error("Missing project contribution activity");
    fireEvent.click(cell);
    expect(screen.getByText("Сервис проверки сертификатов")).toBeVisible();
    fireEvent.click(screen.getByRole("button",{name:"Перейти в раздел"}));
    expect(openProjects).toHaveBeenCalledTimes(1);
    expect(openCourses).not.toHaveBeenCalled();
  });

});
