import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { catalogItem } from "./fixture";
import { parseSkillPercent } from "./skill-impact-model";
import { SkillImpactStatistics } from "./skill-impact-statistics";

describe("Skill impact evidence statistics", () => {
  it("shows actual accepted counts instead of empty progress forecast or fabricated level", () => {
    const impacts = [
      { ...catalogItem.skill_impact[0], accepted_evidence_count: 2, last_evidence_submitted_at: "2026-10-20T12:00:00Z" },
      {
        ...catalogItem.skill_impact[0],
        skill_id: "recommender-systems",
        title: "recommender-systems",
        accepted_evidence_count: 0,
        last_evidence_submitted_at: null,
      },
    ];
    const onGrowthExpand = vi.fn();
    render(<SkillImpactStatistics impacts={impacts} onGrowthExpand={onGrowthExpand}/>);
    const area = screen.getByRole("region", { name: "Статистика навыков задачи" });
    expect(within(area).getByText("1 из 2")).toBeInTheDocument();
    expect(within(area).getByText("50%")).toBeInTheDocument();
    expect(within(area).getByText("2")).toBeInTheDocument();
    expect(within(area).getAllByText("Не оценивался")).toHaveLength(2);
    expect(within(area).getAllByText("Пока неизвестно")).toHaveLength(2);
    expect(within(area).getAllByText("Оценка после проверки")).toHaveLength(2);
    expect(within(area).getByText(/последние 365 дней/)).toBeInTheDocument();
    expect(within(area).getByText(/Последняя принятая работа отправлена/)).toBeInTheDocument();
    expect(within(area).queryByText("Без числового прогноза")).not.toBeInTheDocument();
    const toggle = within(area).getByRole("button", { name: "Скрыть подробности" });
    fireEvent.click(toggle);
    expect(within(area).queryByText("Не оценивался")).not.toBeInTheDocument();
    fireEvent.click(within(area).getByRole("button", { name: "Показать подробности" }));
    expect(onGrowthExpand).toHaveBeenCalledTimes(1);
  });

  it("does not treat a non-calculated skill impact as a numeric prediction", () => {
    render(<SkillImpactStatistics impacts={[{...catalogItem.skill_impact[0],accepted_evidence_count:0}]} onGrowthExpand={vi.fn()}/>);
    expect(screen.getByText("0 из 1")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("Работ пока нет")).toBeInTheDocument();
    expect(screen.queryByText(/\+\d+%/)).not.toBeInTheDocument();
  });

  it("accepts percentages only when a model provided them", () => {
    expect(parseSkillPercent(null)).toBeNull();
    expect(parseSkillPercent("40%")).toBe(40);
    expect(parseSkillPercent("40,5%")).toBe(40.5);
    expect(parseSkillPercent("уверенный")).toBeNull();
    expect(parseSkillPercent("140%")).toBeNull();
  });
});
