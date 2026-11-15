import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import {
  ActionDialog,
  ContentSurface,
  ControlButton,
  GlassControl,
  NavigationDrawer,
  SearchField,
  SegmentedControl,
  StatusNotice,
} from "./components";

beforeAll(() => {
  // jsdom does not ship a native modal top layer. Browser QA must separately
  // verify native showModal, focus containment and backdrop behavior.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);

describe("isolated Apple-inspired web controls (NOT Apple native components)", () => {
  it("marks a busy primary action disabled while presenting a readable status", () => {
    const action = vi.fn();
    render(<div className="aui-kit"><ControlButton tone="primary" busy onClick={action}>Отправить</ControlButton></div>);
    const button = screen.getByRole("button", { name: /Отправить/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(action).not.toHaveBeenCalled();
  });

  it("marks glass as control material without changing standard content semantics", () => {
    render(<div className="aui-kit">
      <GlassControl data-testid="glass" variant="clear">Временный элемент</GlassControl>
      <ContentSurface aria-label="Данные">Содержимое</ContentSurface>
    </div>);
    expect(screen.getByTestId("glass")).toHaveClass("aui-glass--clear");
    expect(screen.getByRole("region", { name: "Данные" })).toHaveClass("aui-content");
  });

  it("provides an explicit search label and a clear action", () => {
    function Case() {
      const [value, setValue] = useState("");
      return <SearchField label="Поиск" value={value} onChange={setValue} />;
    }
    render(<div className="aui-kit"><Case /></div>);
    const field = screen.getByRole("searchbox", { name: "Поиск" });
    fireEvent.change(field, { target: { value: "Bootcamp" } });
    expect(field).toHaveValue("Bootcamp");
    const clear = screen.getByRole("button", { name: "Очистить: Поиск" });
    clear.focus();
    fireEvent.click(clear);
    expect(field).toHaveValue("");
    expect(field).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Очистить: Поиск" })).not.toBeInTheDocument();
  });

  it("supports Arrow/Home/End with disabled segmented values skipped", () => {
    const select = vi.fn();
    render(<div className="aui-kit">
      <SegmentedControl label="Режим" value="one" onChange={select} options={[
        { value: "one", label: "Первый" },
        { value: "blocked", label: "Запрещён", disabled: true },
        { value: "three", label: "Третий" },
      ]} />
    </div>);
    const group = screen.getByRole("group", { name: "Режим" });
    const first = within(group).getByRole("button", { name: "Первый" });
    const last = within(group).getByRole("button", { name: "Третий" });
    expect(first).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(select).toHaveBeenLastCalledWith("three");
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Home" });
    expect(select).toHaveBeenLastCalledWith("one");
  });

  it("offers a keyboard tab stop when the controlled segment value is missing", () => {
    function Case() {
      const [value, setValue] = useState("not-current");
      return (
        <SegmentedControl label="Адаптивный фильтр" value={value} onChange={setValue} options={[
          { value: "blocked", label: "Заблокирован", disabled: true },
          { value: "one", label: "Первый" },
          { value: "two", label: "Второй" },
        ]} />
      );
    }
    render(<div className="aui-kit"><Case /></div>);
    const first = screen.getByRole("button", { name: "Первый" });
    const blocked = screen.getByRole("button", { name: "Заблокирован" });
    expect(first).toHaveAttribute("tabindex", "0");
    expect(blocked).toBeDisabled();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const second = screen.getByRole("button", { name: "Второй" });
    expect(second).toHaveAttribute("aria-pressed", "true");
    expect(second).toHaveFocus();
  });

  it("uses native dialog lifecycle but requires a real browser for focus trap QA", () => {
    const close = vi.fn();
    const { rerender } = render(<div className="aui-kit">
      <ActionDialog open title="Подтверждение" onClose={close}>Содержимое</ActionDialog>
    </div>);
    const dialog = screen.getByRole("dialog", { name: "Подтверждение" });
    expect(dialog).toHaveAttribute("open");
    fireEvent.click(within(dialog).getByRole("button", { name: "Закрыть" }));
    expect(close).toHaveBeenCalledTimes(1);
    rerender(<div className="aui-kit">
      <ActionDialog open={false} title="Подтверждение" onClose={close}>Содержимое</ActionDialog>
    </div>);
    expect(dialog).not.toHaveAttribute("open");
  });

  it("connects drawer dismissal and avoids business navigation simulation", () => {
    const close = vi.fn();
    render(<div className="aui-kit">
      <NavigationDrawer open onClose={close}>Демо-меню</NavigationDrawer>
    </div>);
    const dialog = screen.getByRole("dialog", { name: "Навигация" });
    expect(dialog).toHaveTextContent("Демо-меню");
    fireEvent.click(within(dialog).getByRole("button", { name: "Закрыть" }));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("distinguishes unavailable data from errors and loading states", () => {
    const { rerender } = render(<div className="aui-kit">
      <StatusNotice kind="loading" title="Загрузка" detail="Данные ещё не получены" />
    </div>);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    rerender(<div className="aui-kit">
      <StatusNotice kind="error" title="Ошибка" detail="Источник недоступен" />
    </div>);
    expect(screen.getByRole("alert")).toHaveTextContent("Источник недоступен");
  });
});
