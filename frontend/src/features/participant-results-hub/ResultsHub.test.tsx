import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ResultsHub } from "./ResultsHub";
import { RESULT_SECTIONS, resultDestinations } from "./model";

describe("ResultsHub participant information architecture", () => {
  const navigation = [
    "Главная", "Моя траектория", "Bootcamp", "Задачи",
    "Мои проекты", "Портфолио", "События", "Достижения",
    "Рейтинг", "Аналитика", "Сообщения", "Настройки",
  ];

  it("retains original backend route indexes even when visual tab order changes", () => {
    expect(resultDestinations(navigation)).toEqual([
      { label: "Портфолио", href: "/workspace/5" },
      { label: "Аналитика", href: "/workspace/9" },
      { label: "Достижения", href: "/workspace/7" },
      { label: "Рейтинг", href: "/workspace/8" },
    ]);
    expect(RESULT_SECTIONS).toHaveLength(4);
  });

  it("shows only authorized destinations and preserves functional child content", () => {
    render(
      <MemoryRouter>
        <ResultsHub navigation={["Главная", "Портфолио", "Аналитика"]} activeSection="Портфолио">
          <button type="button">Открыть доказательство</button>
        </ResultsHub>
      </MemoryRouter>,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/workspace/1");
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(links[1]).toHaveAttribute("href", "/workspace/2");
    expect(screen.queryByRole("link", { name: "Рейтинг" })).toBeNull();
    expect(screen.getByRole("button", { name: "Открыть доказательство" })).toBeTruthy();
  });

  it("marks the chosen section without inventing personal counters or ranking", () => {
    render(
      <MemoryRouter>
        <ResultsHub navigation={navigation} activeSection="Достижения">
          <span>Источник подтверждения доступен</span>
        </ResultsHub>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Достижения" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "Результаты" })).toBeTruthy();
    expect(screen.getByText("Источник подтверждения доступен")).toBeTruthy();
    expect(screen.queryByText("68%")).toBeNull();
    expect(screen.queryByText("7 достижений")).toBeNull();
  });

  it("shows an honest fallback for authorized unknown sections", () => {
    render(
      <MemoryRouter>
        <ResultsHub navigation={[]} activeSection="Недоступный раздел">
          <p>Нет доступа</p>
        </ResultsHub>
      </MemoryRouter>,
    );
    expect(screen.queryByRole("navigation", { name: "Подразделы результатов" })).toBeNull();
    expect(screen.getByText("Доступные результаты вашего развития.")).toBeTruthy();
    expect(screen.getByText("Нет доступа")).toBeTruthy();
  });
});
