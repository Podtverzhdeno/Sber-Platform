import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EventDetailBody, type EventDetail, type RegistrationAggregate } from "./participant-events";

const detail: EventDetail = {
  key: "event-1", title: "AI Journey", event_type: "Хакатон", organizer: "Сбер",
  conditions: "Команда до четырёх человек", source_url: "https://example.test/event",
  deadline_at: null, status: "open", track_keys: ["python"],
  recommendation_reason: "Соответствует траектории", source_checked_at: "2026-10-20T08:00:00Z",
  source_status: "current", description: "Практический хакатон по AI-агентам",
  target_audience: "Разработчики", prerequisites: ["Базовый Python"],
  program: [{ day: "День 1", title: "Прототип", detail: "Собрать рабочий контур" }],
  expected_result: "Проверяемый прототип", participation_rules: "По регистрации",
  venue_format: "Онлайн", timezone: "Europe/Moscow",
};

function aggregate(state: "ok" | "zero" | "unknown"): RegistrationAggregate {
  return {
    confirmed_registrations: state === "unknown" ? null : state === "zero" ? 0 : 18,
    participations: state === "unknown" ? null : state === "zero" ? 0 : 7,
    counter_state: state,
    definition_text: "Подтверждённые регистрации не содержат персональных данных.",
  };
}

describe("participant event detail (openspec 22.19)", () => {
  it("shows description, program, conditions, relevance source and confirmed aggregates", () => {
    render(<EventDetailBody detail={detail} aggregate={aggregate("ok")} />);
    expect(screen.getByText(/Практический хакатон/)).toBeInTheDocument();
    expect(screen.getByText(/Команда до четырёх/)).toBeInTheDocument();
    expect(screen.getByText(/День 1 · Прототип/)).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Открыть первоисточник/ })).toHaveAttribute("href", detail.source_url);
  });

  it("distinguishes a real zero from unavailable data", () => {
    const { rerender } = render(<EventDetailBody detail={detail} aggregate={aggregate("zero")} />);
    expect(screen.getAllByText("0")).toHaveLength(2);
    expect(screen.queryByText(/не показано как ноль/)).not.toBeInTheDocument();
    rerender(<EventDetailBody detail={detail} aggregate={aggregate("unknown")} />);
    expect(screen.getAllByText("Нет данных")).toHaveLength(2);
    expect(screen.getByText(/не показано как ноль/)).toBeInTheDocument();
  });
});
