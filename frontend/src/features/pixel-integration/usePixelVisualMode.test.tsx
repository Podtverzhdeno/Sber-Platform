import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PIXEL_VISUAL_MODE_KEY, readPixelVisualMode, usePixelVisualMode } from "./usePixelVisualMode";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-impulse-visual-mode");
});
afterEach(cleanup);

describe("three-state owner visual mode bridge", () => {
  it("defaults to reference blue when the previous user had no explicit preference", () => {
    const {result} = renderHook(usePixelVisualMode);
    expect(result.current.mode).toBe("blue");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.impulseVisualMode).toBe("blue");
  });

  it("migrates an explicit legacy light preference without discarding the user's choice", () => {
    localStorage.setItem("impulse-theme","light");
    expect(readPixelVisualMode()).toBe("light");
    const {result} = renderHook(usePixelVisualMode);
    expect(result.current.mode).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("persists the three modes with legacy light/dark compatibility", () => {
    const {result} = renderHook(usePixelVisualMode);
    act(() => { result.current.setMode("midnight"); });
    expect(result.current.mode).toBe("midnight");
    expect(localStorage.getItem(PIXEL_VISUAL_MODE_KEY)).toBe("midnight");
    expect(localStorage.getItem("impulse-theme")).toBe("dark");
    expect(document.documentElement.dataset.impulseVisualMode).toBe("midnight");
    act(() => { result.current.setMode("light"); });
    expect(localStorage.getItem("impulse-theme")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    act(() => { result.current.setMode("blue"); });
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("notifies concurrent tabs and updates the actual browser root", () => {
    const {result} = renderHook(usePixelVisualMode);
    localStorage.setItem(PIXEL_VISUAL_MODE_KEY,"midnight");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", {key:PIXEL_VISUAL_MODE_KEY,newValue:"midnight"}));
    });
    expect(result.current.mode).toBe("midnight");
    expect(document.documentElement.dataset.impulseVisualMode).toBe("midnight");
  });

  it("keeps multiple controls synchronized within one tab", () => {
    const first = renderHook(usePixelVisualMode);
    const second = renderHook(usePixelVisualMode);
    act(() => { first.result.current.setMode("light"); });
    expect(second.result.current.mode).toBe("light");
    first.unmount();
    second.unmount();
  });
});
