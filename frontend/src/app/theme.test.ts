import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyTheme, storedThemeChoice } from "./theme";

describe("applyTheme", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores an explicit light choice and applies it to the document", () => {
    const resolved = applyTheme("light");
    expect(resolved).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("impulse-theme")).toBe("light");
  });

  it("keeps a system choice out of storage and follows prefers-color-scheme", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    const resolved = applyTheme("system");
    expect(resolved).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("impulse-theme")).toBeNull();
  });

  it("falls back to dark when the system preference is dark", () => {
    const resolved = applyTheme("system");
    expect(resolved).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(storedThemeChoice()).toBe("system");
  });
});
