import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParticipantGuide } from "./participant-guide";
import { GUIDE_COOLDOWN_MS, PARTICIPANT_GUIDES, shouldAutomaticallySuggest } from "./participant-guide-data";
import { SECTION_TOURS, locatePopover } from "./participant-tour-steps";

const navigation = ["Главная", "Задачи", "Мои проекты", "Bootcamp", "Портфолио", "Аналитика"];
const onNavigate = vi.fn();
const renderGuide = (section = "Главная", personId = "p1") =>
  render(<ParticipantGuide personId={personId} section={section} navigation={navigation} onNavigate={onNavigate} />);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  onNavigate.mockClear();
});
afterEach(() => { vi.useRealTimers(); });

describe("contextual participant guide", () => {
  it("has a concrete answer for core participant sections", () => {
    for (const name of navigation) {
      expect(PARTICIPANT_GUIDES[name]?.heading).toBeTruthy();
      expect(PARTICIPANT_GUIDES[name]?.action).toBeTruthy();
      expect(PARTICIPANT_GUIDES[name]?.benefit).toBeTruthy();
    }
  });

  it("never auto-opens twice in a session or within a weekly cooldown", () => {
    const now = Date.parse("2026-10-25T12:00:00Z");
    const prefs = { seen: ["Главная"], lastAutoAt: now, autoDisabled: false };
    expect(shouldAutomaticallySuggest(prefs, "Задачи", now + 1000, false)).toBe(false);
    expect(shouldAutomaticallySuggest(prefs, "Задачи", now + GUIDE_COOLDOWN_MS, true)).toBe(false);
    expect(shouldAutomaticallySuggest(prefs, "Главная", now + GUIDE_COOLDOWN_MS, false)).toBe(false);
    expect(shouldAutomaticallySuggest(prefs, "Задачи", now + GUIDE_COOLDOWN_MS, false)).toBe(true);
    expect(shouldAutomaticallySuggest({ ...prefs, autoDisabled: true }, "Задачи", now + GUIDE_COOLDOWN_MS, false)).toBe(false);
  });

  it("opens a polished welcome screen and guided sidebar tour", () => {
    renderGuide();
    fireEvent.click(screen.getByRole("button", { name: "Как здесь всё устроено?" }));
    expect(screen.getByRole("dialog", { name: /Добро пожаловать/ })).toBeInTheDocument();
    expect(screen.getByText("Реальные задачи")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Далее/ }));
    expect(screen.getByRole("heading", { name: "Найди интересную задачу" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Далее/ }));
    expect(screen.getByRole("heading", { name: "Сохраняй результаты" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Готово/ }));
    expect(screen.getByRole("dialog", { name: "Ты готов к старту!" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /К интересным задачам/ }));
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it("can be dismissed, re-opened, and uses the current page's copy", () => {
    const { rerender } = renderGuide("Задачи");
    fireEvent.click(screen.getByRole("button", { name: "Как здесь всё устроено?" }));
    expect(screen.getByRole("heading", { name: "Выбирай задачи под свой интерес" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Закрыть подсказку" }));
    rerender(<ParticipantGuide personId="p1" section="Портфолио" navigation={navigation} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Как здесь всё устроено?" }));
    expect(screen.getByRole("heading", { name: "Покажи, что ты сделал" })).toBeInTheDocument();
    expect(screen.queryByText("Выбирай задачи под свой интерес")).not.toBeInTheDocument();
  });

  it("respects opt-out while keeping manual help available", () => {
    vi.useFakeTimers();
    const { unmount } = renderGuide("Задачи");
    fireEvent.click(screen.getByRole("button", { name: "Как здесь всё устроено?" }));
    fireEvent.click(screen.getByRole("button", { name: "Не показывать автоматически" }));
    expect(JSON.parse(localStorage.getItem("impulse:guide:v1:p1") ?? "{}")).toMatchObject({ autoDisabled: true });
    unmount();
    renderGuide("Портфолио");
    act(() => { vi.advanceTimersByTime(2200); });
    expect(screen.queryByText("Покажи, что ты сделал")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Как здесь всё устроено?" }));
    expect(screen.getByRole("heading", { name: "Покажи, что ты сделал" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Включить автоподсказки" })).toBeInTheDocument();
  });

  it("shows welcome only once automatically, then stays quiet within the session", () => {
    vi.useFakeTimers();
    const { unmount } = renderGuide("Главная", "student-a");
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByRole("dialog", { name: /Добро пожаловать/ })).toBeInTheDocument();
    expect(sessionStorage.getItem("impulse:guide:session:v1:student-a")).toBe("1");
    expect(localStorage.getItem("impulse:guide:welcome:v2:student-a")).toBe("1");
    unmount();
    renderGuide("Задачи", "student-a");
    act(() => { vi.advanceTimersByTime(2200); });
    expect(screen.queryByText("Выбирай задачи под свой интерес")).not.toBeInTheDocument();
  });

  it("opens full contextual instructions from a lightweight coachmark", () => {
    renderGuide("Задачи");
    fireEvent.click(screen.getByRole("button", { name: "Как здесь всё устроено?" }));
    expect(screen.getByRole("heading", { name: "Выбирай задачи под свой интерес" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Подробная помощь/ }));
    expect(screen.getByRole("dialog", { name: "Центр помощи" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Как выбрать подходящую задачу?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Показать подсказки на странице/ }));
    expect(screen.getByRole("heading", { name: "Выбирай задачи под свой интерес" })).toBeInTheDocument();
  });

  it("lets participants jump from the welcome screen to full instructions", () => {
    renderGuide("Главная");
    fireEvent.click(screen.getByRole("button", { name: "Как здесь всё устроено?" }));
    expect(screen.getByRole("dialog", { name: /Добро пожаловать/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Все инструкции" }));
    expect(screen.getByRole("dialog", { name: "Центр помощи" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Помощь: Главная" })).toBeInTheDocument();
  });

  it("opens exactly the requested just-in-time topic and returns to the page", () => {
    renderGuide("Мои проекты");
    fireEvent(window, new CustomEvent("impulse:guide:topic", { detail: { topicId: "task-submit" } }));
    expect(screen.getByRole("dialog", { name: "Центр помощи" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Как передать решение на проверку?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Закрыть центр помощи" }));
    expect(screen.queryByRole("dialog", { name: "Центр помощи" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Как здесь всё устроено?" })).toBeInTheDocument();
  });

  it("keeps coachmarks inside the viewport at both screen edges", () => {
    const right = locatePopover({left: 10,right: 150,top: 100,bottom: 140,width: 140,height: 40}, {width:290,height:205}, {width:1000,height:700});
    expect(right.side).toBe("right");
    expect(right.left).toBeGreaterThan(150);
    const left = locatePopover({left: 940,right: 985,top: 200,bottom: 260,width:45,height:60}, {width:290,height:205}, {width:1000,height:700});
    expect(left.side).toBe("left");
    expect(left.left).toBeGreaterThanOrEqual(12);
  });

  it("covers the approved reference sections with concrete local targets", () => {
    for (const section of ["Главная", "Задачи", "Мои проекты", "Портфолио", "Аналитика", "Моя траектория", "Bootcamp", "Сообщения"]) {
      expect(SECTION_TOURS[section]?.[0]?.anchor).toBeTruthy();
      expect(SECTION_TOURS[section]?.[0]?.title).toBeTruthy();
    }
  });
});
