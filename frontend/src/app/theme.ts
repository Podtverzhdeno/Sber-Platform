export type ThemeChoice = "light" | "dark" | "system";

type WindowMediaQuery = {
  matches: boolean;
  addEventListener: (type: "change", listener: (event: Event) => void) => void;
  removeEventListener: (type: "change", listener: (event: Event) => void) => void;
};

type WindowMedia = {
  matchMedia?: (query: string) => WindowMediaQuery;
};

export function systemTheme(): "light" | "dark" {
  const query = (window as WindowMedia).matchMedia?.(
    "(prefers-color-scheme: light)",
  );
  return query?.matches ? "light" : "dark";
}

export function storedThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem("impulse-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    return "system";
  }
  return "system";
}

export function applyTheme(choice: ThemeChoice): "light" | "dark" {
  const resolved = choice === "system" ? systemTheme() : choice;
  document.documentElement.dataset.theme = resolved;
  try {
    if (choice === "system") localStorage.removeItem("impulse-theme");
    else localStorage.setItem("impulse-theme", choice);
  } catch {
    return resolved;
  }
  return resolved;
}

export function subscribeSystemTheme(
  onChange: (resolved: "light" | "dark") => void,
): () => void {
  const query = (window as WindowMedia).matchMedia?.(
    "(prefers-color-scheme: light)",
  );
  if (!query) return () => undefined;
  const listener = (event: Event) => {
    const target = event.target as unknown as WindowMediaQuery;
    onChange(target.matches ? "light" : "dark");
  };
  query.addEventListener("change", listener);
  return () => {
    query.removeEventListener("change", listener);
  };
}
