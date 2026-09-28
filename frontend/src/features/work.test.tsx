import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompensationDetails } from "./work";

describe("CompensationDetails", () => {
  it("shows exact server totals in a keyboard-accessible tooltip", () => {
    render(<CompensationDetails terms={{ paid: true, base_amount_per_assignee: "10000.05", currency: "RUB", b_multiplier: "1.5", a_multiplier: "2.25", b_total: "15000.08", a_total: "22500.11", quantum: "0.01", rounding_mode: "half_up", policy_version: 3, payout_condition: "После принятия вклада." }} />);

    const trigger = screen.getByText("База 10 000,05 ₽ · B 15 000,08 ₽ · A 22 500,11 ₽");
    fireEvent.focus(trigger.closest(".tooltip") as HTMLElement);
    expect(screen.getByRole("tooltip")).toHaveTextContent("B ×1,5: 15 000,08 ₽");
    expect(screen.getByRole("tooltip")).toHaveTextContent("A ×2,25: 22 500,11 ₽");
    expect(screen.getByRole("tooltip")).toHaveTextContent("После принятия вклада.");
  });

  it("labels unpaid work without premium amounts", () => {
    render(<CompensationDetails terms={{ paid: false, base_amount_per_assignee: null, currency: null, b_multiplier: "1.5", a_multiplier: "2.00", b_total: null, a_total: null, quantum: "0.01", rounding_mode: "half_up", policy_version: 1, payout_condition: "Вознаграждение не предусмотрено." }} />);

    expect(screen.getByText("Неоплачиваемая задача")).toBeVisible();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("removes insignificant zeroes from whole-ruble amounts", () => {
    render(<CompensationDetails terms={{ paid: true, base_amount_per_assignee: "90000.00", currency: "RUB", b_multiplier: "1.5000", a_multiplier: "2.5000", b_total: "135000.0000", a_total: "225000.0000", quantum: "0.01", rounding_mode: "half_up", policy_version: 1, payout_condition: "После принятия вклада." }} />);

    expect(screen.getByText("База 90 000 ₽ · B 135 000 ₽ · A 225 000 ₽")).toBeVisible();
  });
});
