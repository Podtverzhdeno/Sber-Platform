import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ParticipantHelpCenter } from "./participant-help-center";
import { ParticipantHelpTrigger } from "./participant-help-trigger";
import { HELP_CATEGORIES, HELP_TOPICS, searchHelpTopics, topicsForSection } from "./participant-help-content";
const close = vi.fn();
const tour = vi.fn();
const navigate = vi.fn();
beforeEach(() => { close.mockClear(); tour.mockClear(); navigate.mockClear(); });
const setup = (section = "Задачи", id: string | null = null) =>
  render(<ParticipantHelpCenter section={section} initialTopicId={id} onClose={close} onOpenTour={tour} onNavigateSection={navigate} />);

describe("Impulse help center content", () => {
  it("covers the participant lifecycle with complete, grounded instructions", () => {
    expect(HELP_TOPICS.length).toBeGreaterThanOrEqual(35);
    expect(new Set(HELP_TOPICS.map((topic) => topic.id)).size).toBe(HELP_TOPICS.length);
    for (const topic of HELP_TOPICS) {
      expect(HELP_CATEGORIES.some((category) => category.id === topic.category)).toBe(true);
      expect(topic.why.length).toBeGreaterThan(20);
      expect(topic.steps.length).toBeGreaterThanOrEqual(3);
      expect(topic.checklist.length).toBeGreaterThanOrEqual(1);
      expect(topic.caution.length).toBeGreaterThan(15);
    }
  });
  it("links important participant steps to relevant topics", () => {
    for (const id of ["task-discover","task-brief","task-criteria","task-apply","task-before-approval","task-submit","task-review","course-complete","passport","certification","project-contribution","profile-case"]) {
      expect(HELP_TOPICS.some((topic) => topic.id === id)).toBe(true);
    }
    expect(topicsForSection("Мои проекты").some((topic) => topic.id === "task-submit")).toBe(true);
    expect(searchHelpTopics("Skill Passport").some((topic) => topic.id === "passport")).toBe(true);
  });
  it("opens context-relevant topics, can search and navigate category filters", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Помощь: Задачи" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Как выбрать подходящую задачу/ })).toBeInTheDocument();
    const search = screen.getByRole("textbox", { name: "Поиск по инструкциям" });
    fireEvent.change(search, { target: { value: "Skill Passport" } });
    expect(screen.getByRole("button", { name: /Что такое Skill Passport/ })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "xzvxzvxzx-no-matches" } });
    expect(screen.getByText("По этому запросу ничего нет")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Показать все темы" }));
    expect(screen.getByRole("heading", { name: "Найди нужную инструкцию" })).toBeInTheDocument();
  });
  it("shows step-by-step instructions, checklists, cautions and backlink", () => {
    setup("Мои проекты", "task-submit");
    expect(screen.getByRole("heading", { name: "Как передать решение на проверку?" })).toBeInTheDocument();
    expect(screen.getByText(/Сам факт отправки не означает принятие/)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText("Все обязательные материалы приложены")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Другие инструкции/ }));
    expect(screen.getByRole("textbox", { name: "Поиск по инструкциям" })).toBeInTheDocument();
  });
  it("can launch a local walkthrough or close without changing task data", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Центр помощи" });
    fireEvent.click(within(dialog).getByRole("button", { name: /Показать подсказки на странице/ }));
    expect(tour).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Закрыть центр помощи" }));
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("offers a direct link only for a different available section", () => {
    setup("Главная", "task-submit");
    fireEvent.click(screen.getByRole("button", { name: /К разделу «Мои проекты»/ }));
    expect(navigate).toHaveBeenCalledWith("Мои проекты");
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("does not offer navigation to sections unavailable in the active role", () => {
    render(<ParticipantHelpCenter section="Главная" initialTopicId="task-submit"
      onClose={close} onOpenTour={tour} onNavigateSection={navigate}
      availableSections={["Главная", "Задачи"]} />);
    expect(screen.getByRole("heading", { name: "Как передать решение на проверку?" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /К разделу «Мои проекты»/ })).not.toBeInTheDocument();
  });

  it("traps keyboard focus within the dialog", () => {
    setup();
    const closeButton = screen.getByRole("button", { name: "Закрыть центр помощи" });
    closeButton.focus();
    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBeInTheDocument();
  });

  it("opens precisely the requested topic from inline buttons", () => {
    const received: string[] = [];
    const listener = (event: Event) => { received.push((event as CustomEvent<{ topicId: string }>).detail.topicId); };
    window.addEventListener("impulse:guide:topic", listener);
    const { unmount } = render(<ParticipantHelpTrigger topicId="task-criteria" label="Пояснения к критериям" />);
    fireEvent.click(screen.getByRole("button", { name: "Пояснения к критериям" }));
    expect(received).toEqual(["task-criteria"]);
    unmount(); window.removeEventListener("impulse:guide:topic", listener);
  });
});
