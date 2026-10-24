import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CourseLearningContent } from "./CourseLearningContent";
import { learningPrograms, learningProgramFor } from "./programs";

describe("Bootcamp editorial course curriculum", () => {
  it("contains exactly twelve catalog courses and four concrete lessons per course", () => {
    expect(learningPrograms).toHaveLength(12);
    expect(new Set(learningPrograms.map(item => item.courseKey)).size).toBe(12);
    for (let index = 1; index <= 12; index++) {
      const p = learningProgramFor(`demo-course-${String(index)}`);
      expect(p).not.toBeNull();
      expect(p?.units).toHaveLength(4);
      expect(p?.description.length).toBeGreaterThan(20);
      expect(p?.result.length).toBeGreaterThan(20);
      const keys = p?.units.map(item => item.id) ?? [];
      expect(new Set(keys).size).toBe(4);
      for (const lesson of p?.units ?? []) {
        expect(lesson.title.length).toBeGreaterThan(7);
        expect(lesson.purpose.length).toBeGreaterThan(20);
        expect(lesson.theory).toHaveLength(2);
        expect(lesson.theory.every(item => item.length > 60)).toBe(true);
        expect(lesson.example.length).toBeGreaterThan(45);
        expect(lesson.practice.length).toBeGreaterThan(60);
        expect(lesson.expected.length).toBeGreaterThan(50);
        expect(lesson.checklist).toHaveLength(3);
        expect(lesson.minutes).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it("has working navigation and reveals real exercise expectations without awarding grade", () => {
    render(<CourseLearningContent courseKey="demo-course-3" courseTitle="Python: основа" />);
    const nav = screen.getByRole("navigation", { name: "Шаги обучения" });
    expect(within(nav).getAllByRole("button")).toHaveLength(4);
    expect(screen.getByRole("heading", { name: "Типы и выражения" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Предыдущий урок" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Следующий урок" }));
    expect(screen.getByRole("heading", { name: "Условия и циклы" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Показать ожидаемый результат" }));
    expect(screen.getByRole("status")).toHaveTextContent(/Два списка/);
    fireEvent.click(screen.getByRole("button", { name: "Скрыть ожидаемый результат" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText(/не начисляют XP/)).toBeInTheDocument();
  });

  it("shows honest fallback rather than a fabricated lesson for unknown server catalog keys", () => {
    render(<CourseLearningContent courseKey="unknown-provider-course" />);
    expect(screen.getByRole("status")).toHaveTextContent(/пока не подготовлены/);
    expect(screen.queryByRole("button", { name: "Следующий урок" })).not.toBeInTheDocument();
  });

  it("navigates to the selected lesson and retains only local checklist marks", () => {
    render(<CourseLearningContent courseKey="demo-course-1" />);
    const nav = screen.getByRole("navigation", { name: "Шаги обучения" });
    fireEvent.click(within(nav).getByRole("button", { name: /Архитектура и ADR/ }));
    expect(screen.getByRole("heading", { name: "Архитектура и ADR" })).toBeInTheDocument();
    const checks = screen.getAllByRole("checkbox");
    expect(checks).toHaveLength(3);
    fireEvent.click(checks[0]!);
    expect(checks[0]).toBeChecked();
    fireEvent.click(within(nav).getByRole("button", { name: /Сценарии и критерии/ }));
    expect(screen.getByRole("heading", { name: "Сценарии и критерии приёмки" })).toBeInTheDocument();
  });
});
