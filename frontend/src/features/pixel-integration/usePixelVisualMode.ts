import { useCallback, useEffect, useState } from "react";
import type { ImpulseVisualMode } from "../pixel-reference/visual-modes";

export const PIXEL_VISUAL_MODE_KEY = "impulse-visual-mode";
const LEGACY_THEME_KEY = "impulse-theme";
const MODE_CHANGED = "impulse:visual-mode-changed";

function isVisualMode(value: string | null): value is ImpulseVisualMode {
  return value === "light" || value === "blue" || value === "midnight";
}

/**
 * Explicit choice wins. Otherwise migrate an existing user's light/dark
 * preference before applying the owner's new default (blue).
 * "system" was a non-persisted legacy choice and becomes the blue reference
 * until the owner chooses one of the three explicit icons.
 */
export function readPixelVisualMode(): ImpulseVisualMode {
  try {
    const current = localStorage.getItem(PIXEL_VISUAL_MODE_KEY);
    if (isVisualMode(current)) return current;
    const previous = localStorage.getItem(LEGACY_THEME_KEY);
    if (previous === "light") return "light";
    if (previous === "dark") return "blue";
  } catch {
    // Browsers can deny access to storage; the UI must still render.
  }
  return "blue";
}

export function applyPixelVisualMode(mode: ImpulseVisualMode): void {
  document.documentElement.dataset.impulseVisualMode = mode;
  document.documentElement.dataset.theme = mode === "light" ? "light" : "dark";
}

/** Persist and sync the new 3-icon palette with the preexisting light/dark CSS. */
export function usePixelVisualMode(): {
  mode: ImpulseVisualMode;
  setMode: (next: ImpulseVisualMode) => void;
} {
  const [mode, setInternal] = useState<ImpulseVisualMode>(readPixelVisualMode);
  const setMode = useCallback((next: ImpulseVisualMode) => {
    setInternal(next);
    try {
      localStorage.setItem(PIXEL_VISUAL_MODE_KEY, next);
      localStorage.setItem(LEGACY_THEME_KEY, next === "light" ? "light" : "dark");
    } catch {
      // Keep user interaction functional even in private storage contexts.
    }
    window.dispatchEvent(new CustomEvent<ImpulseVisualMode>(MODE_CHANGED, { detail: next }));
  }, []);
  useEffect(() => {
    applyPixelVisualMode(mode);
  }, [mode]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === PIXEL_VISUAL_MODE_KEY || event.key === null) {
        setInternal(readPixelVisualMode());
      }
    };
    const onLocalMode = (event: Event) => {
      const next = (event as CustomEvent<ImpulseVisualMode>).detail;
      if (isVisualMode(next)) setInternal(next);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(MODE_CHANGED, onLocalMode);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(MODE_CHANGED, onLocalMode);
    };
  }, []);
  return { mode, setMode };
}
