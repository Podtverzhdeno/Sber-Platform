import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ParticipantMetricSpark } from "./participant-home-spark";

describe("ParticipantMetricSpark (openspec 22.25)", () => {
  it("exposes per-bar number, unit and relative period without hover", () => {
    render(
      <ParticipantMetricSpark
        kpiKey="streak"
        series={[8, 10, 11, 12, 13, 14]}
        testId="kpi-spark-3"
      />,
    );
    const bars = screen.getAllByRole("img");
    expect(bars).toHaveLength(6);
    expect(bars[0]).toHaveAttribute("aria-label", "8 дней · точка 1 из 6");
    expect(bars[3]).toHaveAttribute("aria-label", "12 дней · точка 4 из 6");
    expect(bars[5]).toHaveAttribute("aria-label", "14 дней · точка 6 из 6");
    for (const bar of bars) {
      expect(bar).toHaveAttribute("tabindex", "0");
      expect(bar).toHaveAttribute("data-tip", bar.getAttribute("aria-label"));
    }
  });

  it("keeps percent unit for progress and plural forms for counts", () => {
    render(
      <ParticipantMetricSpark
        kpiKey="progress"
        series={[31, 39, 48, 54, 61, 68]}
        testId="kpi-spark-0"
      />,
    );
    const progressCard = screen.getByTestId("kpi-spark-0");
    expect(progressCard.children).toHaveLength(6);
    const lastBar = progressCard.children[5] as HTMLElement;
    const firstBar = progressCard.children[0] as HTMLElement;
    expect(lastBar).toHaveAttribute("aria-label", "68% · точка 6 из 6");
    expect(firstBar).toHaveAttribute("aria-label", "31% · точка 1 из 6");
  });

  it("uses real count semantics for projects and verified goods", () => {
    render(
      <>
        <ParticipantMetricSpark
          kpiKey="projects"
          series={[3, 2, 3, 2, 3, 2]}
          testId="kpi-spark-1"
        />
        <ParticipantMetricSpark
          kpiKey="verified"
          series={[5, 6, 7, 2, 3, 2]}
          testId="kpi-spark-2"
        />
      </>,
    );
    const projects = screen.getByTestId("kpi-spark-1");
    const projectsFirst = projects.children[0] as HTMLElement;
    const projectsLast = projects.children[5] as HTMLElement;
    expect(projectsFirst).toHaveAttribute("aria-label", "3 работы · точка 1 из 6");
    expect(projectsLast).toHaveAttribute("aria-label", "2 работы · точка 6 из 6");
    const verified = screen.getByTestId("kpi-spark-2");
    const verifiedFirst = verified.children[0] as HTMLElement;
    const verifiedFourth = verified.children[3] as HTMLElement;
    expect(verifiedFirst).toHaveAttribute("aria-label", "5 фактов · точка 1 из 6");
    expect(verifiedFourth).toHaveAttribute("aria-label", "2 факта · точка 4 из 6");
  });

  it("keeps bar heights proportional to the series peak", () => {
    render(
      <ParticipantMetricSpark
        kpiKey="progress"
        series={[31, 68]}
        testId="kpi-spark-9"
      />,
    );
    const bars = screen.getAllByRole("img");
    expect(bars).toHaveLength(2);
    const first = bars[0] as HTMLElement;
    const last = bars[1] as HTMLElement;
    expect(first.getAttribute("style")).toContain("45.5882352");
    expect(last.getAttribute("style")).toContain("100%");
  });
});
