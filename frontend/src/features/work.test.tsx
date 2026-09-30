import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompensationDetails } from "./work";

describe("task terms", () => {
  it("does not render financial terms", () => {
    const { container } = render(
      <CompensationDetails
        terms={{ paid: false, base_amount_per_assignee: null, currency: null, b_multiplier: "1", a_multiplier: "1", b_total: null, a_total: null, quantum: "0.01", rounding_mode: "half_up", policy_version: 1, payout_condition: "" }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
