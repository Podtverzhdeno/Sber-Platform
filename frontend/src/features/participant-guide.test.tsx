import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParticipantGuide } from "./participant-guide";
import { GUIDE_COOLDOWN_MS, PARTICIPANT_GUIDES, shouldAutomaticallySuggest } from "./participant-guide-data";

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

  it("shows short contextual support on demand and can navigate to a real section", () => {
    renderGuide();
    expect(screen.queryByText("Здесь начинается твой путь")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Как здесь всё устроено/ }));
    expect(screen.getByRole("heading", { name: "Здесь начинается твой путь" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Посмотреть задачи" }));
    expect(onNavigate).toHaveBeenCalledWith(1);
    expect(screen.queryByText("Здесь начинается твой путь")).not.toBeInTheDocument();
  });

  it("can be dismissed, re-opened, and uses the current page's copy", () => {
    const { rerender } = renderGuide("Задачи");
    fireEvent.click(screen.getByRole("button", { name: /Как здесь всё устроено/ }));
    expect(screen.getByText(/Отправка отклика и назначение — разные этапы/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Закрыть подсказку" }));
    rerender(<ParticipantGuide personId="p1" section="Портфолио" navigation={navigation} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: /Как здесь всё устроено/ }));
    expect(screen.getByRole("heading", { name: "Покажи не только что знаешь, но и что сделал" })).toBeInTheDocument();
    expect(screen.queryByText(/Отправка отклика и назначение — разные этапы/)).not.toBeInTheDocument();
  });

  it("respects opt-out while keeping the manual help button available", () => {
    vi.useFakeTimers();
    const { unmount } = renderGuide("Главная");
    fireEvent.click(screen.getByRole("button", { name: /Как здесь всё устроено/ }));
    fireEvent.click(screen.getByRole("button", { name: "Не показывать автоматически" }));
    expect(JSON.parse(localStorage.getItem("impulse:guide:v1:p1") ?? "{}")).toMatchObject({ autoDisabled: true });
    unmount();
    renderGuide("Задачи");
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.queryByText("Задачи — возможность попробовать себя")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Как здесь всё устроено/ }));
    expect(screen.getByRole("heading", { name: "Задачи — возможность попробовать себя" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Включить автоподсказки" })).toBeInTheDocument();
  });

  it("offers automatic help only once and keeps a preference per participant", () => {
    vi.useFakeTimers();
    const { unmount } = renderGuide("Главная", "student-a");
    act(() => { vi.advanceTimersByTime(1800); });
    expect(screen.getByRole("heading", { name: "Здесь начинается твой путь" })).toBeInTheDocument();
    expect(sessionStorage.getItem("impulse:guide:session:v1:student-a")).toBe("1");
    unmount();
    renderGuide("Задачи", "student-a");
    act(() => { vi.advanceTimersByTime(1800); });
    expect(screen.queryByText("Задачи — возможность попробовать себя")).not.toBeInTheDocument();
  });
});
