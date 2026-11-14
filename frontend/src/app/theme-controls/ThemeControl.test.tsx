import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeControl } from "./ThemeControl";

afterEach(() => { cleanup(); });

describe("ThemeControl", () => {
  it("has an explicit visible light/dark/system control for all roles", () => {
    const change = vi.fn();
    render(<ThemeControl value="system" onChange={change} />);
    const select = screen.getByRole("combobox", { name: "Тема оформления" });
    expect(select).toHaveValue("system");
    expect(screen.getByRole("option", { name: "Светлая" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Тёмная" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Как в системе" })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "dark" } });
    expect(change).toHaveBeenCalledWith("dark");
    fireEvent.change(select, { target: { value: "light" } });
    expect(change).toHaveBeenCalledWith("light");
  });
});
