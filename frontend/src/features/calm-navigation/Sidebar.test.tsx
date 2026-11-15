import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { CalmSidebar } from "./Sidebar";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

// JSDOM does not implement PointerEvent in every runner; fire a real
// bubbling pointerover/out with the browser's pointerType explicitly attached.
function dispatchPointer(target: Element, eventName: "pointerover" | "pointerout", pointerType: "mouse" | "touch") {
  const event = new Event(eventName, { bubbles: true });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  fireEvent(target, event);
}

function renderParticipant(activeIndex = 3) {
  return render(
    <MemoryRouter initialEntries={[`/workspace/${String(activeIndex)}`]}>
      <CalmSidebar
        role="participant"
        activeIndex={activeIndex}
        navigation={["Главная", "Сообщения", "Задачи", "Bootcamp", "Рейтинг", "Настройки"]}
      />
    </MemoryRouter>,
  );
}

describe("CalmSidebar", () => {
  it("shows groups rather than every authorized destination on first screen", () => {
    renderParticipant(0);
    expect(screen.getByRole("navigation", { name: "Навигация роли" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Развитие/ }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link", { name: "Bootcamp" })).toBeNull();
    expect(screen.getByRole("link", { name: "Главная" }).getAttribute("href")).toBe("/workspace/0");
  });

  it("reveals the current item after deep-link and keeps original route", () => {
    renderParticipant();
    expect(screen.getByRole("button", { name: /Развитие/ }).getAttribute("aria-expanded")).toBe("true");
    const courseLink = screen.getByRole("link", { name: "Bootcamp" });
    expect(courseLink.getAttribute("href")).toBe("/workspace/3");
    expect(courseLink.getAttribute("aria-current")).toBe("page");
  });

  it("opens requested group on click without navigation", () => {
    renderParticipant(0);
    fireEvent.click(screen.getByRole("button", { name: /Практика/ }));
    const link = screen.getByRole("link", { name: "Задачи" });
    expect(link.getAttribute("href")).toBe("/workspace/2");
    expect(screen.getByRole("button", { name: /Практика/ }).getAttribute("aria-expanded")).toBe("true");
  });

  it("does not render unauthorized actions or foreign role destinations", () => {
    render(
      <MemoryRouter initialEntries={["/workspace/0"]}>
        <CalmSidebar role="hr" navigation={["Главная", "Кандидаты"]} activeIndex={0} />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Создать задачу")).toBeNull();
    expect(screen.queryByText("Проверки")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Поиск/ }));
    expect(screen.getByRole("link", { name: "Кандидаты" }).getAttribute("href")).toBe("/workspace/1");
  });

  it("retains a new server-authorized route in the fallback group", () => {
    render(
      <MemoryRouter initialEntries={["/workspace/1"]}>
        <CalmSidebar role="participant" navigation={["Главная", "Новый раздел"]} activeIndex={1} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /Другие разделы/ }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "Новый раздел" }).getAttribute("href")).toBe("/workspace/1");
  });

  it("uses only assigned roles and forwards the selected role", () => {
    const onSwitchRole = vi.fn();
    render(
      <MemoryRouter initialEntries={["/workspace/0"]}>
        <CalmSidebar
          role="participant"
          navigation={["Главная"]}
          activeIndex={0}
          assignedRoles={["participant", "mentor"]}
          onSwitchRole={onSwitchRole}
        />
      </MemoryRouter>,
    );
    const control = screen.getByRole("combobox", { name: "Рабочая роль" });
    expect(control.querySelectorAll("option")).toHaveLength(2);
    fireEvent.change(control, { target: { value: "mentor" } });
    expect(onSwitchRole).toHaveBeenCalledWith("mentor");
  });

  it("closes the mobile drawer with Escape and returns focus to the trigger", () => {
    renderParticipant(0);
    const trigger = screen.getByRole("button", { name: "Меню" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Главное меню" })).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Главное меню" })).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps a non-interactive backdrop mounted for exit animation and restores focus after backdrop click", () => {
    renderParticipant(0);
    const trigger = screen.getByRole("button", { name: "Меню" });
    const backdrop = document.querySelector<HTMLButtonElement>(".calm-navigation__backdrop");
    expect(backdrop).not.toBeNull();
    expect(backdrop).not.toHaveClass("calm-navigation__backdrop--open");
    expect(backdrop).toHaveAttribute("aria-hidden", "true");
    expect(backdrop).toHaveAttribute("tabindex", "-1");
    fireEvent.click(trigger);
    expect(backdrop).toHaveClass("calm-navigation__backdrop--open");
    expect(screen.getByRole("dialog", { name: "Главное меню" })).toBeInTheDocument();
    if (!backdrop) throw new Error("Expected navigation backdrop to stay mounted");
    fireEvent.click(backdrop);
    expect(backdrop).not.toHaveClass("calm-navigation__backdrop--open");
    expect(screen.queryByRole("dialog", { name: "Главное меню" })).toBeNull();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(trigger);
  });
  it("reveals the non-modal sidebar when a mouse enters the left edge and closes on leaving", () => {
    const view = renderParticipant(0);
    const edge = screen.getByRole("button", { name: "Показать навигацию" });
    const aside = view.container.querySelector<HTMLElement>(".calm-sidebar");
    const backdrop = view.container.querySelector<HTMLElement>(".calm-navigation__backdrop");
    expect(edge).toHaveAttribute("aria-expanded", "false");
    expect(aside).not.toHaveClass("calm-sidebar--open");
    dispatchPointer(edge, "pointerover", "mouse");
    expect(edge).toHaveAttribute("aria-expanded", "true");
    expect(aside).toHaveClass("calm-sidebar--open", "calm-sidebar--hover");
    expect(screen.queryByRole("dialog", { name: "Главное меню" })).toBeNull();
    expect(backdrop).not.toHaveClass("calm-navigation__backdrop--open");
    expect(document.body.style.overflow).toBe("");
    if (!aside) throw new Error("Sidebar is missing");
    dispatchPointer(aside, "pointerout", "mouse");
    expect(edge).toHaveAttribute("aria-expanded", "false");
    expect(aside).not.toHaveClass("calm-sidebar--open");
  });

  it("never opens on touchscreen hover emulation; explicit Menu still works", () => {
    renderParticipant(0);
    const edge = screen.getByRole("button", { name: "Показать навигацию" });
    dispatchPointer(edge, "pointerover", "touch");
    expect(edge).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Меню" }));
    expect(screen.getByRole("dialog", { name: "Главное меню" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("opens from edge by keyboard focus and closes with Escape", () => {
    renderParticipant(0);
    const edge = screen.getByRole("button", { name: "Показать навигацию" });
    fireEvent.focus(edge);
    expect(edge).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(edge).toHaveAttribute("aria-expanded", "false");
  });

  it("does not lose authorized deep links or active-group expansion on hover", () => {
    renderParticipant(3);
    const edge = screen.getByRole("button", { name: "Показать навигацию" });
    dispatchPointer(edge, "pointerover", "mouse");
    expect(screen.getByRole("link", { name: "Bootcamp" })).toHaveAttribute("href", "/workspace/3");
    expect(screen.getByRole("button", { name: /Развитие/ })).toHaveAttribute("aria-expanded", "true");
  });
  it("restores keyboard focus when Escape closes a preview while a link group is focused", () => {
    renderParticipant(0);
    const edge = screen.getByRole("button", { name: "Показать навигацию" });
    fireEvent.focus(edge);
    expect(edge).toHaveAttribute("aria-expanded", "true");
    const group = screen.getByRole("button", { name: /Развитие/ });
    group.focus();
    expect(document.activeElement).toBe(group);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(edge).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(edge);
  });

  it("dismisses an abandoned edge hover but preserves a transfer into the open panel", () => {
    vi.useFakeTimers();
    try {
      const view = renderParticipant(0);
      const edge = screen.getByRole("button", { name: "Показать навигацию" });
      const aside = view.container.querySelector<HTMLElement>(".calm-sidebar");
      if (!aside) throw new Error("Sidebar missing");
      dispatchPointer(edge, "pointerover", "mouse");
      dispatchPointer(edge, "pointerout", "mouse");
      expect(edge).toHaveAttribute("aria-expanded", "true");
      act(() => { vi.advanceTimersByTime(230); });
      expect(edge).toHaveAttribute("aria-expanded", "false");

      dispatchPointer(edge, "pointerover", "mouse");
      dispatchPointer(edge, "pointerout", "mouse");
      dispatchPointer(aside, "pointerover", "mouse");
      act(() => { vi.advanceTimersByTime(230); });
      expect(edge).toHaveAttribute("aria-expanded", "true");
      dispatchPointer(aside, "pointerout", "mouse");
      expect(edge).toHaveAttribute("aria-expanded", "false");
    } finally {
      vi.useRealTimers();
    }
  });
});
