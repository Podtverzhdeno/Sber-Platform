import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CourseLearningContent } from "./CourseLearningContent";
import { learningPrograms, learningProgramFor } from "./programs";
import { courseBlueprints } from "./course-blueprints";
import { allKnowledgeChecks } from "./knowledge-checks";
import { allManualChapters, manualFor } from "./manuals";

describe("Bootcamp editorial course curriculum", () => {
  it("offers 96 distinct original explanations and accountable primary reading links", () => {
    const chapters = allManualChapters();
    expect(chapters).toHaveLength(96);
    expect(new Set(chapters.map(item => item.hook)).size).toBe(96);
    for (let course = 1; course <= 12; course++) {
      const key = `demo-course-${String(course)}`;
      for (let index = 0; index < 8; index++) {
        const guide = manualFor(key, index);
        expect(guide).not.toBeNull();
        expect(guide?.hook.length).toBeGreaterThan(35);
        expect(guide?.insight.length).toBeGreaterThan(80);
        expect(guide?.read.length).toBeGreaterThan(8);
        expect(guide?.source.length).toBeGreaterThan(10);
        expect(guide?.url).toMatch(/^https:\/\//);
      }
      expect(manualFor(key, 8)).toBeNull();
    }
    expect(manualFor("unknown-course", 0)).toBeNull();
    expect(manualFor("demo-course-1", -1)).toBeNull();
  });

  it("makes a real technical handbook visible within the lesson and updates by chapter", () => {
    render(<CourseLearningContent courseKey="demo-course-3" />);
    expect(screen.queryByText(/Заказчик пишет/)).not.toBeInTheDocument();
    expect(screen.getByText(/Функция принимает/)).toBeInTheDocument();
    const source = screen.getByRole("link", { name: /Читать Python — The Python Tutorial/ });
    expect(source).toHaveAttribute("href", "https://docs.python.org/3/tutorial/");
    expect(source).toHaveAttribute("rel", "noopener noreferrer");
    const snippet = document.querySelector(".bc-manual__snippet pre code");
    expect(snippet?.textContent).toContain("def normalize_amount(raw: str)");
    expect(snippet?.textContent).toContain("\n    value = int(raw)");
    fireEvent.click(screen.getByRole("button", { name: "Следующий урок" }));
    expect(screen.getByText(/В списке 1000 заявок/)).toBeInTheDocument();
    expect(document.querySelector(".bc-manual__snippet")).toBeNull();
  });

  it("contains exactly twelve catalog courses and eight concrete lessons per course", () => {
    expect(learningPrograms).toHaveLength(12);
    expect(new Set(learningPrograms.map(item => item.courseKey)).size).toBe(12);
    for (let index = 1; index <= 12; index++) {
      const p = learningProgramFor(`demo-course-${String(index)}`);
      expect(p).not.toBeNull();
      expect(p?.units).toHaveLength(8);
      expect(p?.description.length).toBeGreaterThan(20);
      expect(p?.result.length).toBeGreaterThan(20);
      const keys = p?.units.map(item => item.id) ?? [];
      expect(new Set(keys).size).toBe(8);
      for (const lesson of p?.units ?? []) {
        expect(lesson.title.length).toBeGreaterThan(7);
        expect(lesson.purpose.length).toBeGreaterThan(20);
        expect(lesson.theory).toHaveLength(2);
        expect(lesson.theory.every(item => item.length > 60)).toBe(true);
        expect(lesson.example.length).toBeGreaterThan(45);
        expect(lesson.practice.length).toBeGreaterThan(60);
        expect(lesson.expected.length).toBeGreaterThanOrEqual(45);
        expect(lesson.checklist.length).toBeGreaterThanOrEqual(3);
        expect(lesson.checklist.length).toBeLessThanOrEqual(4);
        expect(lesson.minutes).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it("publishes twelve complete capstones with balanced review rubrics", () => {
    expect(courseBlueprints).toHaveLength(12);
    expect(new Set(courseBlueprints.map(item => item.key)).size).toBe(12);
    for (const blueprint of courseBlueprints) {
      expect(learningProgramFor(blueprint.key)).not.toBeNull();
      expect(blueprint.prereqs.length).toBeGreaterThanOrEqual(2);
      expect(blueprint.outcomes.length).toBeGreaterThanOrEqual(3);
      expect(blueprint.capstone.steps.length).toBeGreaterThanOrEqual(5);
      expect(blueprint.capstone.artifacts.length).toBeGreaterThanOrEqual(3);
      expect(blueprint.capstone.validation.length).toBeGreaterThanOrEqual(3);
      expect(blueprint.capstone.rubric).toHaveLength(4);
      expect(blueprint.capstone.rubric.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
      expect(blueprint.capstone.rubric.every(item => item.pass.length > 20)).toBe(true);
    }
  });

  it("opens a concrete final project and returns to lessons without granting a certificate", () => {
    render(<CourseLearningContent courseKey="demo-course-2" />);
    fireEvent.click(screen.getByRole("button", { name: "Итоговый проект" }));
    expect(screen.getByRole("heading", { name: "B2B-агент обработки заявок" })).toBeInTheDocument();
    expect(screen.getByText(/six-tool-contract/)).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText(/Официальная оценка и сертификат/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Вернуться к урокам" }));
    expect(screen.getByRole("heading", { name: "Операции агента и границы автономности" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Шаги обучения" })).toBeInTheDocument();
  });

  it("offers two meaningful comprehension prompts per course tied to published lesson IDs", () => {
    const checks = allKnowledgeChecks();
    expect(checks).toHaveLength(24);
    for (const { courseKey, check } of checks) {
      const program = learningProgramFor(courseKey);
      expect(program?.units.some(item => item.id === check.unitId)).toBe(true);
      expect(check.options).toHaveLength(3);
      expect(check.correctIndex).toBeGreaterThanOrEqual(0);
      expect(check.correctIndex).toBeLessThan(3);
      expect(check.explanation.length).toBeGreaterThan(40);
      expect(new Set(check.options).size).toBe(3);
    }
  });

  it("gives case-based feedback and allows correction without marking official completion", () => {
    render(<CourseLearningContent courseKey="demo-course-1" />);
    const nav = screen.getByRole("navigation", { name: "Шаги обучения" });
    fireEvent.click(within(nav).getByRole("button", { name: /Проверка и управление изменением/ }));
    fireEvent.click(screen.getByRole("button", { name: /04 Самопроверка/ }));
    const group = screen.getByRole("group", { name: "Варианты ответа" });
    expect(within(group).getAllByRole("button")).toHaveLength(3);
    fireEvent.click(within(group).getByRole("button", { name: /Проверить только HTTP 200/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Ещё раз проверьте логику");
    fireEvent.click(within(group).getByRole("button", { name: /Дважды вызвать POST/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Верно");
    expect(screen.getByText(/не начисляют XP/)).toBeInTheDocument();
  });

  it("has working navigation and reveals real exercise expectations without awarding grade", () => {
    render(<CourseLearningContent courseKey="demo-course-3" courseTitle="Python: основа" />);
    const nav = screen.getByRole("navigation", { name: "Шаги обучения" });
    expect(within(nav).getAllByRole("button")).toHaveLength(8);
    expect(screen.getByRole("heading", { name: "Типы и выражения" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Предыдущий урок" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Следующий урок" }));
    expect(screen.getByRole("heading", { name: "Условия и циклы" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Показать ожидаемый результат" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /04 Самопроверка/ }));
    fireEvent.click(screen.getByRole("button", { name: "Показать ожидаемый результат" }));
    expect(screen.getByRole("status")).toHaveTextContent(/Два списка/);
    fireEvent.click(screen.getByRole("button", { name: "Скрыть ожидаемый результат" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText(/не начисляют XP/)).toBeInTheDocument();
  });

  it("combines all four parts in one lesson and hides self-check until intentional reveal", () => {
    render(<CourseLearningContent courseKey="demo-course-3" />);
    const lesson = screen.getByTestId("unified-course-lesson");
    const frames = within(lesson).getAllByRole("button", { name: /0[1-4] (Теория|Разобранный пример|Практическое задание|Самопроверка)/ });
    expect(frames).toHaveLength(4);
    expect(frames.map(button => button.getAttribute("aria-expanded"))).toEqual(["true", "true", "true", "false"]);
    expect(within(lesson).queryByRole("checkbox")).not.toBeInTheDocument();
    const selfCheck = frames[3];
    if (!selfCheck) throw new Error("Expected self-check frame");
    fireEvent.click(selfCheck);
    expect(selfCheck).toHaveAttribute("aria-expanded", "true");
    expect(within(lesson).getAllByRole("checkbox").length).toBeGreaterThan(0);
    fireEvent.click(frames[3]!);
    expect(within(lesson).queryByRole("checkbox")).not.toBeInTheDocument();
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
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /04 Самопроверка/ }));
    const checks = screen.getAllByRole("checkbox");
    expect(checks).toHaveLength(3);
    const firstCheck = checks[0];
    if (!firstCheck) throw new Error("Expected a self-check checkbox");
    fireEvent.click(firstCheck);
    expect(checks[0]).toBeChecked();
    fireEvent.click(within(nav).getByRole("button", { name: /Сценарии и критерии/ }));
    expect(screen.getByRole("heading", { name: "Сценарии и критерии приёмки" })).toBeInTheDocument();
  });
});
