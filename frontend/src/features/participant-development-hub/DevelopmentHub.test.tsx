import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import type { ImpulseRoleLevel } from "../impulse-role-level";
import type { LearningCourse } from "../learning-progress";
import { DevelopmentHubContent } from "./DevelopmentHub";
import { courseDestination } from "./routes";

const navigation = ["Главная", "Моя траектория", "Bootcamp", "Задачи", "Мои проекты"];
const level: ImpulseRoleLevel = {
  track_key: "python",
  level: 0,
  cycle_number: 1,
  curriculum_state: "published",
  completed_courses: 1,
  required_courses: 2,
  approved_practices: 0,
  credited_practices: 1,
  required_practices: 2,
  advance_ready: false,
  history: [],
  policy_version: 1,
  max_level: 3,
  required_course_keys: ["python-base", "rag-mvp"],
};
const courses: LearningCourse[] = [
  {
    course_key: "python-base",
    title: "Основы Python",
    completed_units: 8,
    total_units: 8,
    finished: true,
    finished_at: "2026-11-10T10:00:00Z",
    certificate_id: "CERT-PY",
    updated_at: "2026-11-10T10:00:00Z",
    practice_status: "approved",
    practical_certificate_id: null,
  },
  {
    course_key: "rag-mvp",
    title: "Надёжный RAG",
    completed_units: 3,
    total_units: 8,
    finished: false,
    finished_at: null,
    certificate_id: null,
    updated_at: "2026-11-11T10:00:00Z",
    practice_status: null,
    practical_certificate_id: null,
  },
];

function LocationIndicator() {
  const location = useLocation();
  return <output data-testid="hub-location">{location.pathname + location.search}</output>;
}

function renderSection(opts: {
  url?: string;
  allowed?: readonly string[];
  level?: ImpulseRoleLevel | null;
  roleKey?: string | null;
  learningCourses?: readonly LearningCourse[];
} = {}) {
  const { url = "/workspace/1?role=python", allowed = navigation, level: current = level,
    roleKey = "python", learningCourses = courses } = opts;
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/workspace/:section" element={
          <>
            <DevelopmentHubContent navigation={allowed} roleKey={roleKey}
              roleTitle={roleKey === null ? null : "Python-разработчик"}
              level={current} courses={learningCourses} updatedAt="2026-11-15T17:00:00Z">
              <div data-testid="legacy-roadmap">Существующая карта этапов и ролей</div>
            </DevelopmentHubContent>
            <LocationIndicator />
          </>
        } />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("content-first Development section", () => {
  it("keeps the role journey visible and exposes the original authorized Bootcamp route", () => {
    renderSection();
    expect(screen.getByRole("heading", { name: "Развитие" })).toBeVisible();
    expect(screen.getByTestId("legacy-roadmap")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Подразделы развития" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Курсы" })).toHaveAttribute(
      "href", "/workspace/2?role=python",
    );
    expect(screen.getByRole("button", { name: "Траектории" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("development-level-requirements")).toBeNull();
  });

  it("opens an explicit checklist of next-level courses, including the practical contribution", () => {
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Уровни" }));
    expect(screen.getByTestId("hub-location")).toHaveTextContent("/workspace/1?role=python&hub=levels");
    const requirements = screen.getByTestId("development-level-requirements");
    expect(within(requirements).getByText("L0 → L1 · цикл 1")).toBeVisible();
    const rows = within(requirements).getByTestId("development-required-courses");
    expect(within(rows).getByText("Основы Python")).toBeVisible();
    expect(within(rows).getByText("Надёжный RAG")).toBeVisible();
    expect(within(rows).getByText("Учебный сертификат сохранён")).toBeVisible();
    expect(within(requirements).getByTestId("development-practice-count")).toHaveTextContent("1 из 2");
    expect(within(rows).getByRole("link", { name: "Открыть курс Надёжный RAG" })).toHaveAttribute(
      "href", "/workspace/2?role=python&course=rag-mvp&panel=detail",
    );
    expect(within(requirements).getByText(/не официальный карьерный грейд/)).toBeVisible();
  });

  it("preserves role query while switching between trajectories and levels", () => {
    renderSection({ url: "/workspace/1?role=python&stage=foundation&hub=levels" });
    expect(screen.getByTestId("development-level-requirements")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Траектории" }));
    expect(screen.getByTestId("legacy-roadmap")).toBeVisible();
    expect(screen.getByTestId("hub-location")).toHaveTextContent("/workspace/1?role=python&stage=foundation");
  });

  it("never fabricates a level for grey/unselected tracks or a missing server snapshot", () => {
    renderSection({ url: "/workspace/1?hub=levels", level: null, roleKey: null });
    expect(screen.getByText("Выберите направление")).toBeVisible();
    expect(screen.queryByText("L0")).toBeNull();
    expect(screen.queryByTestId("development-required-courses")).toBeNull();
  });

  it("does not create unauthorized course links, even when keys exist", () => {
    renderSection({ url: "/workspace/1?hub=levels", allowed: navigation.filter((x) => x !== "Bootcamp") });
    expect(screen.queryByRole("link", { name: "Курсы" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Открыть курс/ })).toBeNull();
    expect(screen.getByText("Основы Python")).toBeVisible();
  });

  it("shows unpublished next-cycle curriculum without inventing course names or a false advancement", () => {
    renderSection({ url: "/workspace/1?hub=levels", level: {
      ...level, level: 1, cycle_number: 2, curriculum_state: "unpublished",
      required_course_keys: [], advance_ready: false,
    } });
    expect(screen.getByText(/Программа следующего цикла ещё не опубликована/)).toBeVisible();
    expect(screen.queryByTestId("development-required-courses")).toBeNull();
  });

  it("shows completed level L3 as a terminal state with historical evidence still available", () => {
    renderSection({ url: "/workspace/1?hub=levels", level: { ...level, level: 3, max_level: 3 } });
    expect(screen.getByText("Программа освоена")).toBeVisible();
    expect(screen.queryByTestId("development-required-courses")).toBeNull();
  });

  it("builds a course deep link only from allowed navigation and keeps query encoding", () => {
    expect(courseDestination(["Главная"], "python", "some-key")).toBeNull();
    expect(courseDestination(navigation, "role with spaces", "course-a/b")).toBe(
      "/workspace/2?role=role+with+spaces&course=course-a%2Fb&panel=detail",
    );
  });
});
