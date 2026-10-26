export type Theme = "system" | "light" | "dark";

const THEME_KEY = "cps.theme";

function isTheme(value: string | null): value is Theme {
  return value === "system" || value === "light" || value === "dark";
}

export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // Storage can be blocked; fall back to system.
  }
  return "system";
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore: the choice still applies for this session.
  }
  applyTheme(theme);
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

export function applySavedTheme(): void {
  applyTheme(getTheme());
}
