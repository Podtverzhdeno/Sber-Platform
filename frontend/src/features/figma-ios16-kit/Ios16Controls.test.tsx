import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Ios16Button, Ios16TextField } from "./Ios16Controls";

describe("Figma iOS 16 controls — node-verified initial migration", () => {
  it("uses the real iOS 16 filled button source and fires one native click", () => {
    const click = vi.fn();
    render(<Ios16Button onClick={click}>Продолжить</Ios16Button>);
    const button = screen.getByRole("button", { name: "Продолжить" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-figma-light-node", "839:9700");
    expect(button).toHaveAttribute("data-figma-dark-node", "839:9728");
    fireEvent.click(button);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("preserves tinted semantics, icon layout and disabled behavior", () => {
    const click = vi.fn();
    render(<Ios16Button variant="tinted" icon={<span>→</span>} disabled onClick={click}>Детали</Ios16Button>);
    const button = screen.getByRole("button", { name: "Детали" });
    expect(button).toHaveAttribute("data-figma-light-node", "839:9707");
    expect(button).toBeDisabled();
    expect(button.querySelector(".ios16-kit-button__icon")).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(button);
    expect(click).not.toHaveBeenCalled();
  });

  it("keeps Figma text field geometry identity while exposing a working accessible input", () => {
    const change = vi.fn();
    render(<Ios16TextField label="Название проекта" value="Первый проект" onChange={change} required />);
    const input = screen.getByRole("textbox", { name: "Название проекта" });
    expect(input).toHaveValue("Первый проект");
    expect(input).toHaveAttribute("placeholder", "Название проекта");
    expect(input).toBeRequired();
    expect(input.closest(".ios16-kit-field")).toHaveAttribute("data-figma-light-node", "211:5737");
    fireEvent.change(input, { target: { value: "Новый проект" } });
    expect(change).toHaveBeenCalledTimes(1);
  });

  it("supports custom accessible names without leaking placeholder as the only label", () => {
    render(<Ios16TextField label="Поиск" aria-label="Поиск по курсам" placeholder="Название курса" />);
    expect(screen.getByRole("textbox", { name: "Поиск по курсам" })).toHaveAttribute("placeholder", "Название курса");
  });
});
