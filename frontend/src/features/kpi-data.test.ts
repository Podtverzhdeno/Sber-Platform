import { describe, expect, it } from "vitest";

import { buildKpiValues } from "./kpi-data";

describe("KPI data resilience", () => {
  it("does not crash or fabricate progress when growth API omits trajectories", () => {
    // Simulate a successful HTTP response containing an invalid/stale body.
    // An API client cast does not guarantee the remote JSON matches its type.
    const sources = {
      growth: { isSuccess: true, isError: false, data: {} },
      work: { isSuccess: false, isError: false },
      anchors: { isSuccess: false, isError: false },
      certificates: { isSuccess: false, isError: false },
      streak: { isSuccess: false, isError: false },
    } as unknown as Parameters<typeof buildKpiValues>[0];

    expect(buildKpiValues(sources).progress).toEqual({
      value: "—",
      delta: "этапы маршрута ещё не назначены",
    });
  });

  it("keeps percent unknown when the growth API returns an empty trajectory list", () => {
    const sources = {
      growth: { isSuccess: true, isError: false, data: { trajectories: [] } },
      work: { isSuccess: false, isError: false },
      anchors: { isSuccess: false, isError: false },
      certificates: { isSuccess: false, isError: false },
      streak: { isSuccess: false, isError: false },
    } as unknown as Parameters<typeof buildKpiValues>[0];
    expect(buildKpiValues(sources).progress?.value).toBe("—");
  });
});
