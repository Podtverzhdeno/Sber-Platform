import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("explains the participant outcome and demo boundary", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Пробуйте. Делайте реальное. Подтверждайте опыт.",
    );
    expect(screen.getByText("Демо-данные")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Продолжить маршрут" })).toBeEnabled();
  });
});
